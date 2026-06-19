"""
services/workflow_service.py — Suivi du workflow achat en 5 étapes
==================================================================
Reconstruit les étapes du cycle de vie d'un ticket d'achat :

  1. Création    → linked_action=20 ou date de création du ticket
  2. Validation  → TicketValidation GLPI (accepté / refusé / en attente)
                   ou détection dans les logs (linked_action=0, id_search_option=52 ou contenu)
  3. Attribution → linked_action=15, id_search_option=5 (Technicien/Acheteur assigné)
                   ou fallback sur users_id_assign
  4. Solution    → linked_action=17, itemtype_link="ITILSolution"
                   ou log contenant "solution" dans le contenu
  5. Résolution  → statut 5 (Résolu) ou 6 (Clos) + closedate/solvedate

Statuts possibles pour chaque étape :
  done    → étape franchie
  pending → étape en attente (pas encore faite)
  refused → validation refusée (spécifique à l'étape validation)
  unknown → données insuffisantes pour conclure

── Journal des correctifs (19/06/2026) ─────────────────────────────────────
1. Codes TicketValidation GLPI 11.0.6 confirmés via dump réel (ticket #45) :
     1 = En attente, 2 = Refusée, 3 = Acceptée.
2. Attribution acheteur : ne déclencher que sur linked_action=15 ET
   id_search_option=5 (Technicien/Assigné), pas le premier lien trouvé
   (qui était souvent le Demandeur, id_search_option=4).
3. BUG SYSTÉMIQUE corrigé : _extract_creation_from_logs,
   _extract_validation_from_logs et _extract_solution_from_logs lisaient
   linked_action / user_name / date_mod directement sur l'item de log
   top-level, alors que ces clés n'existent que dans log["raw"]. Résultat :
   ces trois extracteurs ne matchaient jamais rien et retombaient
   silencieusement sur des fallback. Corrigé pour lire depuis log["raw"].
4. Résolution des noms d'acteurs : build_workflow() accepte désormais un
   dict `users` (id GLPI → nom complet, même format que TicketRepository
   .get_users() / _buyer_name) pour éviter les "User #2" et unifier le
   format ("RANDRIAMBOLOLONA (2)" → "RANDRIAMBOLOLONA").
5. Étape attribution : ajout du champ `acheteur_assigne`, distinct de
   `acteur` (qui a fait l'action) — utile si un responsable assigne le
   ticket à un acheteur différent de lui-même.
"""
from __future__ import annotations

import re
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

# id_search_option GLPI pour les rôles utilisateur sur un ticket
SEARCH_OPTION_REQUESTER  = 4   # Demandeur
SEARCH_OPTION_ASSIGNEE   = 5   # Technicien / Acheteur assigné  ← attribution
SEARCH_OPTION_STATUS     = 12  # Statut du ticket
SEARCH_OPTION_OBSERVER   = 66  # Observateur


def _parse_dt(val: Any) -> Optional[str]:
    """Retourne val tel quel si c'est une date/datetime valide, sinon None."""
    if not val or val in ("NULL", "0000-00-00 00:00:00"):
        return None
    return str(val)


def _sort_logs(logs: list[dict]) -> list[dict]:
    """Trie les logs par date croissante (la clé `date` est au niveau top-level)."""
    return sorted(logs, key=lambda x: x.get("date") or x.get("raw", {}).get("date_mod") or "")


def _raw(log: dict) -> dict:
    """Retourne le dict GLPI brut d'un log enrichi (clé `raw`), ou le log lui-même en fallback."""
    return log.get("raw") or log


def _resolve_actor_name(value: Any, users: dict[int, str]) -> Optional[str]:
    """
    Résout un acteur GLPI (id entier, id en chaîne, ou nom brut type
    "RANDRIAMBOLOLONA (2)") vers un nom lisible et cohérent avec
    TicketRepository.get_users() / _buyer_name.

    Priorité : table `users` (annuaire GLPI résolu) > valeur brute telle quelle.
    """
    if value is None or value == "":
        return None

    if isinstance(value, int):
        return users.get(value, f"User #{value}")

    if isinstance(value, str):
        v = value.strip()
        if not v:
            return None

        if v.isdigit():
            uid = int(v)
            return users.get(uid, f"User #{uid}")

        # Format "Nom (id)" — on tente de résoudre via l'id pour avoir
        # un nom canonique identique à celui utilisé ailleurs dans l'API.
        m = re.match(r"^(.*)\((\d+)\)\s*$", v)
        if m:
            uid = int(m.group(2))
            resolved = users.get(uid)
            if resolved:
                return resolved
            return m.group(1).strip() or v

        return v

    return str(value)


# ── Extracteurs ───────────────────────────────────────────────────────────────

def _extract_creation_from_logs(logs: list[dict]) -> tuple[Optional[str], Optional[Any]]:
    """
    Cherche le premier log de création (linked_action=20).
    Retourne (date, acteur_brut). L'acteur n'est pas résolu ici — voir
    _resolve_actor_name(), appelé côté étape avec la table `users`.
    """
    for log in _sort_logs(logs):
        raw = _raw(log)
        if raw.get("linked_action") == LINKED_ACTION_CREATE:
            date_val = _parse_dt(raw.get("date_mod") or raw.get("date") or log.get("date"))
            acteur_brut = raw.get("user_name") or log.get("author_name")
            return date_val, acteur_brut
    return None, None


def _extract_validation_from_validations(validations: list[dict]) -> tuple[str, Optional[str], Optional[Any]]:
    """
    Analyse la liste des TicketValidation GLPI.
    Retourne (statut, date, acteur_brut) — acteur_brut peut être un id entier
    (users_id_validate) ou un nom déjà résolu, résolu ensuite via `users`.
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
    acteur_brut = val.get("_validator_name") or val.get("users_id_validate") or None

    return statut, date_val, acteur_brut


def _extract_validation_from_logs(logs: list[dict]) -> tuple[Optional[str], Optional[str], Optional[Any]]:
    """
    Fallback : cherche dans les logs un changement de statut de validation.
    Retourne (statut, date, acteur_brut) ou (None, None, None) si non trouvé.

    GLPI écrit typiquement :
      id_search_option=52, old_value='En attente de validation',
      new_value='Acceptée' | 'Refusée'
    """
    for log in _sort_logs(logs):
        raw      = _raw(log)
        action   = raw.get("linked_action")
        search   = raw.get("id_search_option")
        new_val  = (raw.get("new_value") or "").lower()
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

            date_val    = _parse_dt(raw.get("date_mod") or raw.get("date") or log.get("date"))
            acteur_brut = raw.get("user_name") or log.get("author_name")
            return statut, date_val, acteur_brut

    return None, None, None


def _extract_attribution_from_logs(
    logs: list[dict],
) -> tuple[Optional[str], Optional[Any], Optional[Any]]:
    """
    Cherche dans les logs l'attribution à un acheteur — et retient la PLUS
    RÉCENTE, pas la première. Un ticket peut être réattribué (ex: log #3083
    assigne RANDRIAMBOLOLONA à 06:57, puis log #3099 réassigne à
    "Acheteur Test" à 07:18 avec retrait de l'ancien lien en #3100) : c'est
    la dernière attribution en date qui doit faire foi.

    Règle GLPI 11.0.6 confirmée :
      linked_action = 15  (ajout d'un lien utilisateur)
      id_search_option = 5  (rôle Technicien/Assigné = acheteur dans ce workflow)

    Les logs linked_action=15 avec id_search_option=4 (Demandeur)
    ou id_search_option=66 (Observateur) sont ignorés.

    Note : les évènements de RETRAIT de lien ("Supprimer un lien...") ne sont
    pas traités ici — on suit uniquement la chaîne des ajouts. Si un acheteur
    est retiré sans être remplacé par un nouvel ajout, cette fonction continue
    de renvoyer le dernier acheteur ajouté. À affiner si ce cas se présente
    réellement (voir le code GLPI exact du log de suppression au besoin).

    Retourne (date, acteur_qui_a_assigne_brut, acheteur_assigne_brut) —
    la dernière paire trouvée chronologiquement, ou (None, None, None).
    """
    derniere_attribution: tuple[Optional[str], Optional[Any], Optional[Any]] | None = None

    for log in _sort_logs(logs):  # ordre chronologique croissant
        raw = _raw(log)
        if raw.get("linked_action") != LINKED_ACTION_ADD_LINK:
            continue
        if raw.get("id_search_option") != SEARCH_OPTION_ASSIGNEE:
            continue
        # itemtype_link doit être User (vide accepté aussi)
        itemtype = (raw.get("itemtype_link") or "").lower()
        if itemtype and "user" not in itemtype:
            continue

        date_val = _parse_dt(raw.get("date_mod") or raw.get("date") or log.get("date"))
        performed_by_brut = raw.get("user_name") or log.get("author_name")
        assigned_to_brut   = raw.get("new_value") or performed_by_brut

        # Pas de `return` ici : on continue à parcourir pour ne garder
        # que la dernière attribution en cas de réassignation.
        derniere_attribution = (date_val, performed_by_brut, assigned_to_brut)

    return derniere_attribution or (None, None, None)


def _extract_solution_from_logs(logs: list[dict]) -> tuple[Optional[str], Optional[Any]]:
    """
    Cherche dans les logs l'ajout d'une solution GLPI.
    Critères (par priorité) :
      - linked_action=17 ET itemtype_link='ITILSolution'
      - linked_action=17 ET 'solution' dans le contenu
    Retourne (date, acteur_brut).
    """
    for log in _sort_logs(logs):
        raw = _raw(log)
        if raw.get("linked_action") != LINKED_ACTION_ADD_ELEMENT:
            continue
        itemtype = (raw.get("itemtype_link") or "").lower()
        content  = (log.get("content")       or "").lower()

        if "itilsolution" in itemtype or "solution" in content:
            date_val    = _parse_dt(raw.get("date_mod") or raw.get("date") or log.get("date"))
            acteur_brut = raw.get("user_name") or log.get("author_name")
            return date_val, acteur_brut

    return None, None


# ── Service principal ─────────────────────────────────────────────────────────

class WorkflowService:
    """
    Reconstruit le workflow d'achat d'un ticket GLPI en 5 étapes.

    Usage :
        svc = WorkflowService()
        result = svc.build_workflow(ticket, logs, validations, users=users_dict)

    `users` est un dict {id_glpi: nom_complet}, typiquement
    TicketRepository.get_users() — utilisé pour résoudre tous les acteurs
    (validateur, créateur, attributeur, acheteur assigné) vers un nom lisible
    et cohérent avec le reste de l'API (même format que `_buyer_name`).
    Si omis, les valeurs brutes GLPI sont utilisées telles quelles.
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
        users: dict[int, str] | None = None,
    ) -> dict:
        """
        Construit la structure des 5 étapes.

        Args:
            ticket      : ticket brut (dict retourné par le repo GLPI)
            logs        : liste des entrées d'historique
            validations : liste des TicketValidation GLPI (peut être vide)
            users       : annuaire {id_glpi: nom_complet} pour résoudre les acteurs
        """
        users = users or {}

        etapes = [
            self._etape_creation(ticket, logs, users),
            self._etape_validation(ticket, logs, validations, users),
            self._etape_attribution(ticket, logs, users),
            self._etape_solution(logs, users),
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
    def _etape_creation(self, ticket: dict, logs: list[dict], users: dict[int, str]) -> dict:
        date_log, acteur_brut = _extract_creation_from_logs(logs)

        date_creation = date_log or _parse_dt(ticket.get("date"))
        acteur = (
            _resolve_actor_name(acteur_brut, users)
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
        users: dict[int, str],
    ) -> dict:
        # Source 1 : table TicketValidation
        if validations:
            statut, date_val, acteur_brut = _extract_validation_from_validations(validations)
            return {
                "etape":  "validation",
                "label":  "Validation",
                "statut": statut,
                "date":   date_val,
                "acteur": _resolve_actor_name(acteur_brut, users),
                "detail": None,
            }

        # Source 2 : logs d'historique
        statut, date_val, acteur_brut = _extract_validation_from_logs(logs)
        if statut:
            return {
                "etape":  "validation",
                "label":  "Validation",
                "statut": statut,
                "date":   date_val,
                "acteur": _resolve_actor_name(acteur_brut, users),
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
    def _etape_attribution(self, ticket: dict, logs: list[dict], users: dict[int, str]) -> dict:
        # Priorité 1 : logs (source de vérité)
        # Règle GLPI 11.0.6 : linked_action=15 + id_search_option=5 = acheteur assigné
        date_attr, performed_by_brut, assigned_to_brut = _extract_attribution_from_logs(logs)
        if date_attr and assigned_to_brut:
            acheteur_assigne = _resolve_actor_name(assigned_to_brut, users)
            return {
                "etape":             "attribution",
                "label":             "Attribution",
                "statut":            "done",
                "date":              date_attr,
                "acteur":            _resolve_actor_name(performed_by_brut, users) or acheteur_assigne,
                "acheteur_assigne":  acheteur_assigne,
                "detail":            None,
            }

        # Priorité 2 : fallback sur users_id_assign du ticket
        uid_assign = ticket.get("users_id_assign") or 0
        if uid_assign and uid_assign != 0:
            acheteur_assigne = (
                ticket.get("_buyer_name")
                or users.get(uid_assign)
                or f"User #{uid_assign}"
            )
            return {
                "etape":             "attribution",
                "label":             "Attribution",
                "statut":            "done",
                "date":              None,
                "acteur":            acheteur_assigne,
                "acheteur_assigne":  acheteur_assigne,
                "detail":            None,
            }

        return {
            "etape":             "attribution",
            "label":             "Attribution",
            "statut":            "pending",
            "date":              None,
            "acteur":            None,
            "acheteur_assigne":  None,
            "detail":            None,
        }

    # ── Étape 4 : Solution ────────────────────────────────────────
    def _etape_solution(self, logs: list[dict], users: dict[int, str]) -> dict:
        date_sol, acteur_brut = _extract_solution_from_logs(logs)

        if date_sol:
            return {
                "etape":  "solution",
                "label":  "Solution",
                "statut": "done",
                "date":   date_sol,
                "acteur": _resolve_actor_name(acteur_brut, users),
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