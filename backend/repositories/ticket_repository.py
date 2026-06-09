"""
repositories/ticket_repository.py — Accès et enrichissement des tickets
Adapté au formulaire réel GLPI Forms "DEMANDE D'ACHAT" :
  - Projet et Service sont dans le CONTENT du ticket (pas dans projects_id)
  - Urgence est fixée à 3 par le formulaire → on la lit depuis content si dispo
"""
from __future__ import annotations

from datetime import date, datetime
from typing import Any, Optional

from clients.glpi_client import GLPIClient
from clients.mock_client import generate_mock_tickets
from core.config import Settings
from services.form_parser import FormParser


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
            uid = u["id"]
            full = " ".join(filter(None, [u.get("firstname"), u.get("realname")])) or u.get("name", str(uid))
            users[uid] = full

        for t in tickets:
            # ── Parser le content du formulaire ──────────────────
            content = t.get("content") or ""
            parsed = _form_parser.parse(content)

            # Projet → depuis le content (formulaire GLPI Forms)
            # Fallback → projects_id si le champ natif est rempli
            if parsed.projet:
                t["_project_name"] = parsed.projet
            else:
                pid = t.get("projects_id") or 0
                if pid:
                    t["_project_name"] = f"Projet #{pid}"
                else:
                    t["_project_name"] = "Sans projet"

            # Service demandeur → depuis le content
            t["_service"] = parsed.service or "Non renseigné"

            # Lieu de livraison
            t["_lieu"] = parsed.lieu or ""

            # Bénéficiaire
            t["_beneficiaire"] = parsed.beneficiaire or ""

            # Urgence réelle depuis formulaire (si renseignée),
            # sinon on garde urgency du ticket GLPI
            if parsed.urgence_int:
                t["_urgence_int"] = parsed.urgence_int
            else:
                t["_urgence_int"] = t.get("urgency") or t.get("priority") or 3

            # Acheteur → utilisateur assigné ou demandeur
            uid = t.get("users_id_assign") or t.get("users_id_requester") or 0
            t["_buyer_name"] = users.get(uid, f"User #{uid}")

        return tickets

    # ── Filtre achat ──────────────────────────────────────────────
    def _is_purchase(self, ticket: dict) -> bool:
        """
        Détecte si un ticket est une demande d'achat.
        Priorité : catégorie GLPI configurée → mots-clés dans le nom.
        """
        if self._settings.use_mock_data:
            return True
        cat_id = self._settings.glpi_purchase_category_id
        if cat_id:
            return ticket.get("itilcategories_id") == cat_id
        name = (ticket.get("name") or "").lower()
        return any(k in name for k in ("achat", "purchase", "commande", "approvision", "fourniture"))

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
            # Récupérer les tickets avec le content pour pouvoir parser le formulaire
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
            uid = u["id"]
            full = " ".join(filter(None, [u.get("firstname"), u.get("realname")])) or u.get("name", str(uid))
            users[uid] = full
        return users

    def get_projects(self) -> dict[int, str]:
        """
        En mode formulaire GLPI Forms, les projets sont dans le content.
        Cette méthode reste utile pour la liste des projets disponibles.
        """
        if self._settings.use_mock_data or not self._client:
            return {}
        projects = {}
        for p in self._client.get_all("Project", {"fields": "id,name"}):
            projects[p["id"]] = p.get("name", "")
        return projects