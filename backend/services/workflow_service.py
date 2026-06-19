"""
services/workflow_service.py — Suivi du workflow achat en 5 étapes
==================================================================
Reconstruit les étapes du cycle de vie d'un ticket d'achat :

  1. Création    → linked_action=20 ou date de création du ticket
  2. Validation  → TicketValidation GLPI (accepté / refusé / en attente)
                   ou détection dans les logs (linked_action=0, id_search_option=52 ou contenu)
  3. Attribution → linked_action=15, itemtype_link contient "User"
                   ou fallback sur users_id_assign
  4. Solution    → linked_action=17, itemtype_link="ITILSolution"
                   ou log contenant "solution" dans le contenu
  5. Résolution  → statut 5 (Résolu) ou 6 (Clos) + closedate/solvedate

Statuts possibles pour chaque étape :
  done    → étape franchie
  pending → étape en attente (pas encore faite)
  refused → validation refusée (spécifique à l'étape validation)
  unknown → données insuffisantes pour conclure
"""
from __future__ import annotations

from typing import Any, Optional

# ── Codes de statut TicketValidation GLPI 11.0.6 (confirmés par API) ────────
# Valeurs réelles retournées par CommonITILValidation dans GLPI 11.0.6 :
#   1 = En attente de validation
#   2 = Refusée
#   3 = Acceptée   ← inversé par rapport aux anciennes docs
VALIDATION_WAITING  = 1
VALIDATION_REFUSED  = 2
VALIDATION_ACCEPTED = 3

VALIDATION_STATUS_MAP = {
    1: "pending",   # En attente
    2: "refused",   # Refusée  (GLPI 11.0.6 confirmé)
    3: "done",      # Acceptée (GLPI 11.0.6 confirmé)
    4: "refused",   # Refusée  (variante selon config)
    5: "pending",   # En attente (variante selon config)
}

# Statuts ticket GLPI
STATUS_RESOLVED = 5
STATUS_CLOSED   = 6

# linked_action GLPI
LINKED_ACTION_FIELD_CHANGE     = 0   # Modification d'un champ
LINKED_ACTION_ADD_LINK         = 15  # Ajout d'un lien utilisateur/acteur
LINKED_ACTION_ADD_ELEMENT      = 17  # Ajout d'un élément lié (solution, suivi…)
LINKED_ACTION_CREATE           = 20  # Création de l'élément

# id_search_option pour le statut du ticket
SEARCH_OPTION_STATUS = 12


def _parse_dt(val: Any) -> Optional[str]:
    """Retourne val tel quel si c'est une date/datetime valide, sinon None."""
    if not val or val in ("NULL", "0000-00-00 00:00:00"):
        return None
    return str(val)


def _sort_logs(logs: list[dict]) -> list[dict]:
    """Trie les logs par date croissante."""
    return sorted(logs, key=lambda x: x.get("date_mod") or x.get("date") or "")


# ── Extracteurs ───────────────────────────────────────────────────────────────

def _extract_creation_from_logs(logs: list[dict]) -> tuple[Optional[str], Optional[str]]:
    """
    Cherche le premier log de création (linked_action=20).
    Retourne (date, auteur).
    """
    for log in _sort_logs(logs):
        if log.get("linked_action") == LINKED_ACTION_CREATE:
            date_val = _parse_dt(log.get("date_mod") or log.get("date"))
            acteur   = log.get("user_name") or None
            return date_val, acteur
    return None, None


def _extract_validation_from_validations(validations: list[dict]) -> tuple[str, Optional[str], Optional[str]]:
    """
    Analyse la liste des TicketValidation GLPI.
    Retourne (statut, date, acteur).
    """
    if not validations:
        return "unknown", None, None

    # La validation la plus récente fait foi
    val = sorted(
        validations,
        key=lambda v: v.get("submission_date") or v.get("date") or "",
    )[-1]

    code = val.get("status") or val.get("validation_status")
    try:
        code = int(code)
    except (TypeError, ValueError):
        code = None

    statut = VALIDATION_STATUS_MAP.get(code, "pending")
    date_val = _parse_dt(
        val.get("validation_date") or val.get("date") or val.get("submission_date")
    )
    acteur = val.get("_validator_name") or val.get("users_id_validate") or None
    if isinstance(acteur, int):
        acteur = f"User #{acteur}"

    return statut, date_val, acteur


def _extract_validation_from_logs(logs: list[dict]) -> tuple[Optional[str], Optional[str], Optional[str]]:
    """
    Fallback : cherche dans les logs un changement de statut de validation.
    Retourne (statut, date, acteur) ou (None, None, None) si non trouvé.

    GLPI écrit typiquement :
      id_search_option=52, old_value='En attente de validation',
      new_value='Acceptée' | 'Refusée'
    """
    for log in _sort_logs(logs):
        action   = log.get("linked_action")
        search   = log.get("id_search_option")
        new_val  = (log.get("new_value") or "").lower()
        content  = (log.get("content")   or "").lower()

        is_validation_field = (action == LINKED_ACTION_FIELD_CHANGE and search in (52, 55))
        is_validation_text  = "validat" in content and ("accept" in content or "refus" in content)

        if is_validation_field or is_validation_text:
            if "refus" in new_val or "refus" in content:
                statut = "refused"
            elif "accept" in new_val or "accept" in content:
                statut = "done"
            else:
                statut = "pending"

            date_val = _parse_dt(log.get("date_mod") or log.get("date"))
            acteur   = log.get("user_name") or None
            return statut, date_val, acteur

    return None, None, None


# id_search_option GLPI pour les rôles utilisateur sur un ticket
SEARCH_OPTION_REQUESTER  = 4   # Demandeur
SEARCH_OPTION_ASSIGNEE   = 5   # Technicien / Acheteur assigné  ← attribution
SEARCH_OPTION_OBSERVER   = 66  # Observateur


def _extract_attribution_from_logs(logs: list[dict]) -> tuple[Optional[str], Optional[str]]:
    """
    Cherche dans les logs l'attribution à un acheteur.

    Règle GLPI 11.0.6 confirmée :
      linked_action = 15  (ajout d'un lien utilisateur)
      id_search_option = 5  (rôle Technicien/Assigné = acheteur dans ce workflow)

    Les logs linked_action=15 avec id_search_option=4 (Demandeur)
    ou id_search_option=66 (Observateur) sont ignorés.

    Retourne (date, acteur_cible).
    """
    for log in _sort_logs(logs):
        raw = log.get("raw", log)
        if raw.get("linked_action") != LINKED_ACTION_ADD_LINK:
            continue
        if raw.get("id_search_option") != SEARCH_OPTION_ASSIGNEE:
            continue
        # itemtype_link doit être User
        itemtype = (raw.get("itemtype_link") or "").lower()
        if itemtype and "user" not in itemtype:
            continue

        date_val = _parse_dt(
            raw.get("date_mod") or raw.get("date") or log.get("date")
        )
        acteur = raw.get("new_value") or raw.get("user_name") or ""
        return date_val, acteur or None

    return None, None


def _extract_solution_from_logs(logs: list[dict]) -> tuple[Optional[str], Optional[str]]:
    """
    Cherche dans les logs l'ajout d'une solution GLPI.
    Critères (par priorité) :
      - linked_action=17 ET itemtype_link='ITILSolution'
      - linked_action=17 ET 'solution' dans le contenu
    Retourne (date, acteur).
    """
    for log in _sort_logs(logs):
        if log.get("linked_action") != LINKED_ACTION_ADD_ELEMENT:
            continue
        itemtype = (log.get("itemtype_link") or "").lower()
        content  = (log.get("content")       or "").lower()

        if "itilsolution" in itemtype or "solution" in content:
            date_val = _parse_dt(log.get("date_mod") or log.get("date"))
            acteur   = log.get("user_name") or None
            return date_val, acteur

    return None, None


# ── Service principal ─────────────────────────────────────────────────────────

class WorkflowService:
    """
    Reconstruit le workflow d'achat d'un ticket GLPI en 5 étapes.

    Usage :
        svc = WorkflowService(settings)
        result = svc.build_workflow(ticket, logs, validations)
    """

    # Statuts ticket considérés comme "résolus"
    RESOLVED_STATUSES = {STATUS_RESOLVED, STATUS_CLOSED}

    STATUS_LABELS = {
        1: "Nouveau",
        2: "En cours (assigné)",
        3: "En cours (planifié)",
        4: "En attente",
        5: "Résolu",
        6: "Clos",
    }

    def build_workflow(
        self,
        ticket: dict,
        logs: list[dict],
        validations: list[dict],
    ) -> dict:
        """
        Construit la structure des 5 étapes.

        Args:
            ticket      : ticket brut (dict retourné par le repo GLPI)
            logs        : liste des entrées d'historique
            validations : liste des TicketValidation GLPI (peut être vide)
        """
        etapes = [
            self._etape_creation(ticket, logs),
            self._etape_validation(ticket, logs, validations),
            self._etape_attribution(ticket, logs),
            self._etape_solution(logs),
            self._etape_resolution(ticket),
        ]

        statuts = [e["statut"] for e in etapes]
        if all(s == "done" for s in statuts):
            statut_global = "done"
        elif "refused" in statuts:
            statut_global = "refused"
        else:
            statut_global = "in_progress"

        return {
            "ticket_id":      ticket.get("id"),
            "statut_global":  statut_global,
            "etapes":         etapes,
        }

    # ── Étape 1 : Création ────────────────────────────────────────
    def _etape_creation(self, ticket: dict, logs: list[dict]) -> dict:
        date_log, acteur_log = _extract_creation_from_logs(logs)

        date_creation = date_log or _parse_dt(ticket.get("date"))
        acteur = (
            acteur_log
            or ticket.get("_buyer_name")
            or ticket.get("_requester_name")
        )

        return {
            "etape":  "creation",
            "label":  "Création",
            "statut": "done" if date_creation else "unknown",
            "date":   date_creation,
            "acteur": acteur,
            "detail": None,
        }

    # ── Étape 2 : Validation ──────────────────────────────────────
    def _etape_validation(
        self,
        ticket: dict,
        logs: list[dict],
        validations: list[dict],
    ) -> dict:
        # Source 1 : table TicketValidation
        if validations:
            statut, date_val, acteur = _extract_validation_from_validations(validations)
            return {
                "etape":  "validation",
                "label":  "Validation",
                "statut": statut,
                "date":   date_val,
                "acteur": acteur,
                "detail": None,
            }

        # Source 2 : logs d'historique
        statut, date_val, acteur = _extract_validation_from_logs(logs)
        if statut:
            return {
                "etape":  "validation",
                "label":  "Validation",
                "statut": statut,
                "date":   date_val,
                "acteur": acteur,
                "detail": None,
            }

        # Source 3 : global_validation du ticket
        global_val = ticket.get("global_validation")
        if global_val not in (None, 0, "", "0"):
            try:
                statut = VALIDATION_STATUS_MAP.get(int(global_val), "pending")
            except (TypeError, ValueError):
                statut = "unknown"
            return {
                "etape":  "validation",
                "label":  "Validation",
                "statut": statut,
                "date":   None,
                "acteur": None,
                "detail": None,
            }

        return {
            "etape":  "validation",
            "label":  "Validation",
            "statut": "unknown",
            "date":   None,
            "acteur": None,
            "detail": "Aucune validation GLPI enregistrée",
        }

    # ── Étape 3 : Attribution ─────────────────────────────────────
    def _etape_attribution(self, ticket: dict, logs: list[dict]) -> dict:
        # Priorité 1 : logs (source de vérité)
        # Règle GLPI 11.0.6 : linked_action=15 + id_search_option=5 = acheteur assigné
        date_attr, acteur_log = _extract_attribution_from_logs(logs)
        if date_attr and acteur_log:
            return {
                "etape":  "attribution",
                "label":  "Attribution",
                "statut": "done",
                "date":   date_attr,
                "acteur": acteur_log,
                "detail": None,
            }

        # Priorité 2 : fallback sur users_id_assign du ticket
        uid_assign = ticket.get("users_id_assign") or 0
        acheteur   = ticket.get("_buyer_name")
        if uid_assign and uid_assign != 0:
            return {
                "etape":  "attribution",
                "label":  "Attribution",
                "statut": "done",
                "date":   None,
                "acteur": acheteur or f"User #{uid_assign}",
                "detail": None,
            }

        return {
            "etape":  "attribution",
            "label":  "Attribution",
            "statut": "pending",
            "date":   None,
            "acteur": None,
            "detail": None,
        }

        # ── Étape 4 : Solution ────────────────────────────────────────
    def _etape_solution(self, logs: list[dict]) -> dict:
        date_sol, acteur = _extract_solution_from_logs(logs)

        if date_sol:
            return {
                "etape":  "solution",
                "label":  "Solution",
                "statut": "done",
                "date":   date_sol,
                "acteur": acteur,
                "detail": None,
            }

        return {
            "etape":  "solution",
            "label":  "Solution",
            "statut": "pending",
            "date":   None,
            "acteur": None,
            "detail": None,
        }

    # ── Étape 5 : Résolution ──────────────────────────────────────
    def _etape_resolution(self, ticket: dict) -> dict:
        status = ticket.get("status", 0)

        if status in self.RESOLVED_STATUSES:
            date_res     = _parse_dt(ticket.get("solvedate") or ticket.get("closedate"))
            status_label = self.STATUS_LABELS.get(status, "Résolu")
            return {
                "etape":  "resolution",
                "label":  "Résolution",
                "statut": "done",
                "date":   date_res,
                "acteur": ticket.get("_buyer_name"),
                "detail": status_label,
            }

        return {
            "etape":  "resolution",
            "label":  "Résolution",
            "statut": "pending",
            "date":   None,
            "acteur": None,
            "detail": self.STATUS_LABELS.get(status, "En cours"),
        }