"""
repositories/ticket_repository.py — Accès et enrichissement des tickets
Adapté au formulaire réel GLPI Forms "DEMANDE D'ACHAT" :
  - Projet et Service sont dans le CONTENT du ticket (pas dans projects_id)
  - Urgence est fixée à 3 par le formulaire → on la lit depuis content si dispo
  - Tous les tickets GLPI sont des demandes d'achat → pas de filtre par mots-clés
"""
from __future__ import annotations

import re
import time
from datetime import date, datetime
from typing import Any, Optional

from clients.glpi_client import GLPIClient
from clients.mock_client import generate_mock_tickets
from core.config import Settings
from services.form_parser import FormParser


class CacheEntry:
    """Cache entry with TTL (Time To Live)"""
    def __init__(self, value: Any, ttl_seconds: int = 300):
        self.value = value
        self.created_at = time.time()
        self.ttl = ttl_seconds

    def is_expired(self) -> bool:
        """Check if cache entry has expired"""
        return (time.time() - self.created_at) > self.ttl


def _parse_date(val: Any) -> date | None:
    if not val or val in ("NULL", "0000-00-00 00:00:00"):
        return None
    try:
        return datetime.fromisoformat(str(val).replace(" ", "T")).date()
    except ValueError:
        return None


_form_parser = FormParser()


class TicketRepository:
    def __init__(self, settings: Settings, client: GLPIClient | None = None):
        self._settings = settings
        self._client = client
        self._history_cache: dict[int, CacheEntry] = {}  # Cache for ticket history

    # ── Enrichissement ────────────────────────────────────────────
    def _enrich(self, tickets: list[dict]) -> list[dict]:
        """
        Enrichit les tickets avec :
        - _project_name : extrait du content HTML (formulaire GLPI Forms)
        - _service      : service demandeur (content HTML)
        - _buyer_name   : nom de l'utilisateur assigné ou demandeur
        - _lieu         : lieu de livraison (content HTML)
        - _urgence_int  : urgence réelle si renseignée dans le formulaire
        """
        if self._settings.use_mock_data:
            return tickets

        # Charger les utilisateurs GLPI
        users: dict[int, str] = {0: "Non assigné"}
        for u in self._client.get_all("User", {"fields": "id,name,realname,firstname"}):
            try:
                uid = int(u["id"])
            except (TypeError, ValueError):
                continue
            full = " ".join(filter(None, [u.get("firstname"), u.get("realname")])) or u.get("name", str(uid))
            users[uid] = full

        # Inverse map to resolve user names (some GLPI responses return names when expand_dropdowns=1)
        name_to_uid = {v.lower(): k for k, v in users.items() if isinstance(v, str)}

        for t in tickets:
            # ── Parser le content du formulaire ──────────────────
            content = t.get("content") or ""
            parsed = _form_parser.parse(content)

            # Projet → depuis le content (formulaire GLPI Forms)
            if parsed.projet:
                t["_project_name"] = parsed.projet
            else:
                pid = t.get("projects_id") or 0
                t["_project_name"] = f"Projet #{pid}" if pid else "Sans projet"

            # Service demandeur
            t["_service"] = parsed.service or "Non renseigné"

            # Lieu de livraison
            t["_lieu"] = parsed.lieu or ""

            # Bénéficiaire
            t["_beneficiaire"] = parsed.beneficiaire or ""

            # Description
            t["_description"] = parsed.description or ""

            # A valider par
            t["_a_valider"] = parsed.a_valider or ""

            # Urgence réelle depuis formulaire, sinon urgency GLPI
            if parsed.urgence_int:
                t["_urgence_int"] = parsed.urgence_int
            else:
                t["_urgence_int"] = t.get("urgency") or t.get("priority") or 3

            # Acheteur → essayer plusieurs champs possibles (les installations GLPI varient)
            def _get_uid_from_ticket(rec: dict) -> int:
                candidates = (
                    "users_id_assign",
                    "users_id_assignments_id",
                    "users_id_assignments",
                    "users_id_assigned",
                    "assigned_to",
                    "assigned_to_id",
                    "users_id_taker",
                    "users_id_requester",
                    "users_id_recipient",
                    "users_id_change",
                )
                for k in candidates:
                    v = rec.get(k)
                    if v:
                        # If the field is numeric (id), return it
                        try:
                            return int(v)
                        except (TypeError, ValueError):
                            # If the field is a name (expand_dropdowns), try to resolve it
                            if isinstance(v, str):
                                name_key = v.lower()
                                uid = name_to_uid.get(name_key)
                                if uid is not None:
                                    return int(uid)
                                # Try partial match: GLPI may return only a first name
                                for nm, uid2 in name_to_uid.items():
                                    if name_key in nm or nm in name_key:
                                        return int(uid2)
                            continue
                # Fallback: some GLPI responses embed links or nested structures
                # Try simple heuristics
                if isinstance(rec.get("users"), dict):
                    u = rec["users"].get("id") or rec["users"].get("users_id")
                    try:
                        return int(u)
                    except (TypeError, ValueError):
                        pass
                # As a last resort, fetch the detailed ticket and retry (some endpoints return names instead of ids)
                try:
                    tid = rec.get("id")
                    if tid and self._client:
                        detailed = self._client.get_one("Ticket", tid)
                        # Retry candidates on the detailed record
                        for k in candidates:
                            v2 = detailed.get(k)
                            if v2:
                                try:
                                    return int(v2)
                                except (TypeError, ValueError):
                                    if isinstance(v2, str):
                                        uid2 = name_to_uid.get(v2.lower())
                                        if uid2 is not None:
                                            return int(uid2)
                                        for nm, uid3 in name_to_uid.items():
                                            if v2.lower() in nm or nm in v2.lower():
                                                return int(uid3)
                except Exception:
                    pass

                return 0

            uid = _get_uid_from_ticket(t)
            t["_buyer_name"] = users.get(uid, f"User #{uid}")

        return tickets

    # ── Filtre achat ──────────────────────────────────────────────
    def _is_purchase(self, ticket: dict) -> bool:
        """
        Détecte si un ticket est une demande d'achat.
        Priorité 1 : catégorie GLPI configurée (GLPI_PURCHASE_CATEGORY_ID)
        Priorité 2 : filtre par mots-clés dans le nom
        Priorité 3 : si aucune config → vérifier le content formulaire GLPI Forms
        """
        if self._settings.use_mock_data:
            return True

        cat_id = self._settings.glpi_purchase_category_id
        if cat_id:
            return ticket.get("itilcategories_id") == cat_id

        # Filtre par mots-clés dans le nom
        name = (ticket.get("name") or "").lower()
        keywords = ("achat", "purchase", "commande", "approvision", "fourniture")
        if any(k in name for k in keywords):
            return True

        # Aucune catégorie configurée et pas de mot-clé →
        # vérifier si le content contient les champs du formulaire GLPI Forms
        content = ticket.get("content") or ""
        return bool(
            re.search(r"<b>\s*1\)\s*Projet", content, re.IGNORECASE)
            or re.search(r"Projet\s*:", content, re.IGNORECASE)
        )

    # ── Filtre date ───────────────────────────────────────────────
    def _apply_date_filter(
        self,
        tickets: list[dict],
        df: date | None,
        dt: date | None,
    ) -> list[dict]:
        if not df and not dt:
            return tickets
        result = []
        for t in tickets:
            d = _parse_date(t.get("date"))
            if d is None:
                continue
            if df and d < df:
                continue
            if dt and d > dt:
                continue
            result.append(t)
        return result

    # ── Méthodes publiques ────────────────────────────────────────
    def get_purchase_tickets(
        self,
        date_from: date | None = None,
        date_to: date | None = None,
    ) -> list[dict]:
        if self._settings.use_mock_data:
            tickets = generate_mock_tickets()
        else:
            params: dict[str, Any] = {
                "is_deleted": 0,
                "sort": "date",
                "order": "ASC",
                "expand_dropdowns": 1,
            }
            cat = self._settings.glpi_purchase_category_id
            if cat:
                params["searchText[itilcategories_id]"] = cat

            raw = self._client.get_all("Ticket", params)
            tickets = [t for t in raw if self._is_purchase(t)]
            tickets = self._enrich(tickets)

        return self._apply_date_filter(tickets, date_from, date_to)

    def get_deleted_tickets(
        self,
        date_from: date | None = None,
        date_to: date | None = None,
    ) -> list[dict]:
        if self._settings.use_mock_data:
            return []
        params: dict[str, Any] = {"is_deleted": 1, "expand_dropdowns": 1}
        cat = self._settings.glpi_purchase_category_id
        if cat:
            params["searchText[itilcategories_id]"] = cat
        raw = self._client.get_all("Ticket", params)
        tickets = [t for t in raw if self._is_purchase(t)]
        for t in tickets:
            t["_deleted"] = True
        tickets = self._enrich(tickets)
        return self._apply_date_filter(tickets, date_from, date_to)

    def get_users(self) -> dict[int, str]:
        if self._settings.use_mock_data or not self._client:
            return {}
        users = {}
        for u in self._client.get_all("User", {"fields": "id,name,realname,firstname"}):
            try:
                uid = int(u["id"])
            except (TypeError, ValueError):
                continue
            full = " ".join(filter(None, [u.get("firstname"), u.get("realname")])) or u.get("name", str(uid))
            users[uid] = full
        return users

    def get_projects(self) -> dict[int, str]:
        if self._settings.use_mock_data or not self._client:
            return {}
        projects = {}
        for p in self._client.get_all("Project", {"fields": "id,name"}):
            projects[p["id"]] = p.get("name", "")
        return projects

    def get_ticket_history(self, ticket_id: int) -> list[dict]:
        """
        Récupère les followups / historiques d'un ticket GLPI.
        Utilise un cache en mémoire avec TTL de 5 minutes.

        Retourne une liste d'entrées enrichies avec le nom de l'auteur.
        """
        # Vérifier le cache
        if ticket_id in self._history_cache:
            cache_entry = self._history_cache[ticket_id]
            if not cache_entry.is_expired():
                return cache_entry.value

        # Si pas en cache ou expiré, récupérer les données
        result = self._get_ticket_history_uncached(ticket_id)

        # Mettre en cache avec TTL configuré
        self._history_cache[ticket_id] = CacheEntry(result, ttl_seconds=self._settings.glpi_history_cache_ttl_seconds)

        return result

    def _get_ticket_history_uncached(self, ticket_id: int) -> list[dict]:
        """
        Récupère les followups / historiques d'un ticket GLPI (sans cache).
        Cette méthode est appelée par get_ticket_history après vérification du cache.
        """
        if self._settings.use_mock_data:
            # En mode mock, pas d'historique fiable — retourner vide
            return []

        if not self._client:
            return []

        params: dict[str, Any] = {
            "searchText[tickets_id]": ticket_id,
            "sort": "date",
            "order": "ASC",
            "expand_dropdowns": 1,
        }

        # Récupérer followups via helper (ou directement si helper absent)
        if hasattr(self._client, "get_ticket_followups"):
            followups = self._client.get_ticket_followups(ticket_id)
        else:
            followups = self._client.get_all("TicketFollowup", params)

        # Récupérer les changements (glpi_changes) si le client le permet
        changes: list[dict] = []
        if hasattr(self._client, "get_ticket_changes"):
            try:
                changes = self._client.get_ticket_changes(ticket_id)
            except Exception:
                changes = []

        # Charger les utilisateurs pour enrichir les auteurs
        users = self.get_users()

        items: list[dict] = []

        def _extract_date(rec: dict) -> str | None:
            return rec.get("date") or rec.get("date_creation") or rec.get("date_mod") or rec.get("dates")

        # Transformer followups
        for r in followups:
            author_id = r.get("users_id") or r.get("users_id_author") or r.get("users_id_recipient") or 0
            author_name = users.get(author_id, f"User #{author_id}")
            content = r.get("content") or r.get("comment") or r.get("followup") or ""
            date_val = _extract_date(r)
            items.append(
                {
                    "id": r.get("id") or r.get("ticketfollowups_id") or 0,
                    "ticket_id": ticket_id,
                    "date": date_val,
                    "author_id": author_id,
                    "author_name": author_name,
                    "content": content,
                    "private": bool(r.get("private", 0)),
                    "type": "followup",
                    "raw": r,
                }
            )

        # Transformer changes
        for c in changes:
            # Les enregistrements de changes peuvent contenir des colonnes différentes
            author_id = c.get("users_id") or c.get("users_id_author") or c.get("users_id_recipient") or c.get("users_id_change") or 0
            author_name = users.get(author_id, f"User #{author_id}")
            # Essayer d'agréger la description des changements
            change_desc = c.get("content") or c.get("changes") or c.get("comment") or str(c)
            date_val = _extract_date(c)
            items.append(
                {
                    "id": c.get("id") or c.get("changes_id") or 0,
                    "ticket_id": ticket_id,
                    "date": date_val,
                    "author_id": author_id,
                    "author_name": author_name,
                    "content": change_desc,
                    "private": False,
                    "type": "change",
                    "raw": c,
                }
            )

        # Trier par date (les dates GLPI sont en iso-like ; trier en string fonctionne pour ISO)
        items_sorted = sorted(items, key=lambda x: (x.get("date") or ""))
        return items_sorted