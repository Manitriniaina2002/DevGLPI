"""
services/workflow_service.py — Suivi du workflow achat en 5 étapes
==================================================================
Reconstruit les étapes du cycle de vie d'un ticket d'achat :

  1. Création    → date de création du ticket + demandeur
  2. Validation  → TicketValidation GLPI (accepté / refusé / en attente)
  3. Attribution → assignation à un acheteur (log linked_action=15 ou users_id_assign)
  4. Solution    → ajout d'une solution (log ITILSolution / linked_action=17)
  5. Résolution  → statut 5 (Résolu) ou 6 (Clos) + closedate/solvedate

Statuts possibles pour chaque étape :
  done    → étape franchie
  pending → étape en attente (pas encore faite)
  refused → validation refusée (spécifique à l'étape validation)
  unknown → données insuffisantes pour conclure
"""
from __future__ import annotations

from typing import Any, Optional

from core.config import Settings

# ── Codes de statut TicketValidation GLPI (CommonITILValidation) ──
VALIDATION_WAITING  = 1
VALIDATION_ACCEPTED = 2
VALIDATION_REFUSED  = 3

VALIDATION_STATUS_MAP = {
    VALIDATION_WAITING:  "pending",
    VALIDATION_ACCEPTED: "done",
    VALIDATION_REFUSED:  "refused",
}

# linked_action GLPI
LINKED_ACTION_ADD_LINK       = 15  # ajout d'un lien (attribution User, etc.)
LINKED_ACTION_ADD_SUBITEM   = 17  # ajout d'un sous-élément (Solution, Followup, Task...)
LINKED_ACTION_CREATE        = 20  # création du ticket


def _parse_dt(val: Any) -> Optional[str]:
    """Retourne val tel quel si c'est une date/datetime valide, sinon None."""
    if not val or val in ("NULL", "0000-00-00 00:00:00"):
        return None
    return str(val)


def _get_raw(log: dict) -> dict:
    """
    Les logs traités stockent les champs bruts GLPI dans la clé 'raw'.
    Retourne le dict brut ou le log lui-même si 'raw' n'existe pas.
    """
    return log.get("raw", log)


def _extract_attribution_from_logs(logs: list[dict]) -> tuple[Optional[str], Optional[str]]:
    """
    Cherche dans les logs le premier événement d'attribution :
      - linked_action=15 (ajout d'un lien)
      - itemtype_link contenant 'User'

    Retourne (date, acteur_cible).
    Les champs structurés sont dans log['raw'] (linked_action, itemtype_link...).
    """
    for log in logs:
        raw = _get_raw(log)
        if raw.get("linked_action") == LINKED_ACTION_ADD_LINK:
            itemtype = raw.get("itemtype_link") or ""
            if "user" in itemtype.lower() or not itemtype:
                date_val = (
                    raw.get("date_mod")
                    or raw.get("date")
                    or raw.get("date_creation")
                )
                acteur = raw.get("new_value") or raw.get("user_name") or ""
                return _parse_dt(date_val), acteur or None
    return None, None


def _extract_solution_from_logs(logs: list[dict]) -> tuple[Optional[str], Optional[str]]:
    """
    Cherche dans les logs le premier événement d'ajout de solution :
      - itemtype_link = 'ITILSolution'
      - linked_action = 17  (ajout d'un sous-élément)
      - ou le contenu textuel mentionne 'Solution'

    Retourne (date, acteur).
    """
    for log in logs:
        raw = _get_raw(log)
        itemtype = raw.get("itemtype_link") or ""
        linked_action = raw.get("linked_action")

        # itemtype_link = "ITILSolution" => c'est une solution
        if itemtype == "ITILSolution":
            date_val = (
                raw.get("date_mod")
                or raw.get("date")
                or raw.get("date_creation")
                or log.get("date")
            )
            acteur = raw.get("user_name") or log.get("author_name") or ""
            return _parse_dt(date_val), acteur or None

        # linked_action = 17 (ajout sous-élément) + contenu mentionnant "Solution"
        if linked_action == LINKED_ACTION_ADD_SUBITEM:
            mise_a_jour = log.get("mise_a_jour") or raw.get("new_value") or ""
            if "solution" in (mise_a_jour or "").lower():
                date_val = (
                    raw.get("date_mod")
                    or raw.get("date")
                    or raw.get("date_creation")
                    or log.get("date")
                )
                acteur = raw.get("user_name") or log.get("author_name") or ""
                return _parse_dt(date_val), acteur or None

        # Fallback : contenu textuel du log mentionnant "Solution"
        content = log.get("content") or raw.get("new_value") or ""
        champ = log.get("champ") or ""
        if "solution" in (content or "").lower() or "solution" in (champ or "").lower():
            date_val = (
                raw.get("date_mod")
                or raw.get("date")
                or raw.get("date_creation")
                or log.get("date")
            )
            acteur = raw.get("user_name") or log.get("author_name") or ""
            return _parse_dt(date_val), acteur or None

    return None, None


class WorkflowService:
    def __init__(self, settings: Settings):
        self._s = settings

    def build_workflow(
        self,
        ticket: dict,
        logs: list[dict],
        validations: list[dict],
    ) -> dict:
        """
        Construit la structure des 5 étapes à partir des données disponibles.

        Args:
            ticket      : ticket brut (dict tel que retourné par le repo)
            logs        : liste des entrées d'historique (get_ticket_history)
            validations : liste des TicketValidation GLPI (peut être vide)
        """
        etapes = [
            self._etape_creation(ticket, logs),
            self._etape_validation(ticket, validations),
            self._etape_attribution(ticket, logs),
            self._etape_solution(ticket, logs),
            self._etape_resolution(ticket),
        ]

        # Statut global du workflow
        statuts = [e["statut"] for e in etapes]
        if all(s == "done" for s in statuts):
            statut_global = "done"
        elif "refused" in statuts:
            statut_global = "refused"
        else:
            statut_global = "in_progress"

        return {
            "ticket_id": ticket.get("id"),
            "statut_global": statut_global,
            "etapes": etapes,
        }

    # ── Étape 1 : Création ────────────────────────────────────────
    def _etape_creation(self, ticket: dict, logs: list[dict]) -> dict:
        date_creation = _parse_dt(ticket.get("date"))

        # Auteur : chercher le premier log (linked_action=20) ou fallback
        acteur = None
        for log in sorted(logs, key=lambda x: x.get("date") or ""):
            raw = _get_raw(log)
            if raw.get("linked_action") == LINKED_ACTION_CREATE:
                acteur = raw.get("user_name") or log.get("author_name") or None
                break
            if not acteur and raw.get("user_name"):
                acteur = raw.get("user_name") or None
                break

        # Fallback : nom du demandeur extrait lors de l'enrichissement
        if not acteur:
            acteur = ticket.get("_buyer_name") or ticket.get("_requester_name")

        return {
            "etape": "creation",
            "label": "Création",
            "statut": "done" if date_creation else "unknown",
            "date": date_creation,
            "acteur": acteur,
            "detail": None,
        }

    # ── Étape 2 : Validation ──────────────────────────────────────
    def _etape_validation(self, ticket: dict, validations: list[dict]) -> dict:
        if not validations:
            return {
                "etape": "validation",
                "label": "Validation",
                "statut": "unknown",
                "date": None,
                "acteur": None,
                "detail": "Aucune validation GLPI enregistrée",
            }

        # Prendre la validation la plus récente
        val = sorted(
            validations,
            key=lambda v: v.get("submission_date") or v.get("date") or "",
        )[-1]

        # Ne PAS se fier à status=2 si validation_date est null :
        # GLPI met auto-implement status=2 dès la soumission quand le
        # créateur est aussi le validateur → ce n'est pas une vraie validation
        validation_date = _parse_dt(val.get("validation_date") or val.get("date"))
        if not validation_date:
            # Pas de validation_date → la validation est en attente
            # (même si GLPI a auto-mis status=2 par défaut)
            return {
                "etape": "validation",
                "label": "Validation",
                "statut": "pending",
                "date": _parse_dt(val.get("submission_date")),
                "acteur": None,
                "detail": "En attente de validation",
            }

        val_status_code = val.get("status") or val.get("validation_status")
        try:
            val_status_code = int(val_status_code)
        except (TypeError, ValueError):
            val_status_code = None

        statut = VALIDATION_STATUS_MAP.get(val_status_code, "pending")
        acteur = val.get("_validator_name") or val.get("users_id_validate") or None
        if isinstance(acteur, int):
            acteur = f"User #{acteur}"

        commentaire = val.get("comment_validation") or val.get("comment") or None

        return {
            "etape": "validation",
            "label": "Validation",
            "statut": statut,
            "date": validation_date,
            "acteur": acteur,
            "detail": commentaire,
        }

    # ── Étape 3 : Attribution ─────────────────────────────────────
    def _etape_attribution(self, ticket: dict, logs: list[dict]) -> dict:
        # Priorité 1 : chercher dans les logs l'événement d'attribution
        date_attr, acteur_log = _extract_attribution_from_logs(logs)

        # Si les logs contiennent une attribution utilisateur, l'étape est validée
        if date_attr and acteur_log:
            return {
                "etape": "attribution",
                "label": "Attribution",
                "statut": "done",
                "date": date_attr,
                "acteur": acteur_log,
                "detail": None,
            }

        # Priorité 2 : fallback sur le champ users_id_assign + _buyer_name
        uid_assign = ticket.get("users_id_assign") or ticket.get("users_id_assignments_id")
        if uid_assign:
            acteur = acteur_log or ticket.get("_buyer_name") or f"User #{uid_assign}"
            return {
                "etape": "attribution",
                "label": "Attribution",
                "statut": "done",
                "date": date_attr,
                "acteur": acteur,
                "detail": None,
            }

        # Aucune attribution détectée
        return {
            "etape": "attribution",
            "label": "Attribution",
            "statut": "pending",
            "date": None,
            "acteur": None,
            "detail": None,
        }

    # ── Étape 4 : Solution ────────────────────────────────────────
    def _etape_solution(self, ticket: dict, logs: list[dict]) -> dict:
        """Détecte si une solution a été ajoutée au ticket."""
        date_sol, acteur_sol = _extract_solution_from_logs(logs)

        if date_sol:
            return {
                "etape": "solution",
                "label": "Solution",
                "statut": "done",
                "date": date_sol,
                "acteur": acteur_sol,
                "detail": None,
            }

        # Pas de solution détectée dans les logs
        return {
            "etape": "solution",
            "label": "Solution",
            "statut": "pending",
            "date": None,
            "acteur": None,
            "detail": None,
        }

    # ── Étape 5 : Résolution ──────────────────────────────────────
    def _etape_resolution(self, ticket: dict) -> dict:
        status = ticket.get("status", 0)
        is_resolved = status in self._s.resolved_statuses

        if is_resolved:
            date_res = _parse_dt(
                ticket.get("closedate") or ticket.get("solvedate")
            )
            status_label = self._s.status_map.get(status, "Résolu")
            return {
                "etape": "resolution",
                "label": "Résolution",
                "statut": "done",
                "date": date_res,
                "acteur": ticket.get("_buyer_name"),
                "detail": status_label,
            }

        return {
            "etape": "resolution",
            "label": "Résolution",
            "statut": "pending",
            "date": None,
            "acteur": None,
            "detail": self._s.status_map.get(status, "En cours"),
        }
