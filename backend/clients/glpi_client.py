"""
clients/glpi_client.py — Client GLPI REST
Gère la session, la pagination et le retry.
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta

import requests
import urllib3

from core.config import Settings

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
log = logging.getLogger("glpi.client")


class GLPIClient:
    """
    Client GLPI REST authentifié par User-Token + App-Token.
    Session renouvelée automatiquement toutes les 50 minutes.
    """

    def __init__(self, settings: Settings):
        self._settings = settings
        self._session_token: str | None = None
        self._expires_at: datetime = datetime.min

    # ── Session ───────────────────────────────────────────────────
    def _init_session(self) -> str:
        cfg = self._settings
        if not cfg.glpi_app_token:
            raise RuntimeError("GLPI_APP_TOKEN non configuré")
        if not cfg.glpi_user_token:
            raise RuntimeError("GLPI_USER_TOKEN non configuré")

        resp = requests.get(
            f"{cfg.glpi_api_url}/initSession",
            headers={
                "Content-Type": "application/json",
                "App-Token": cfg.glpi_app_token,
                "Authorization": f"user_token {cfg.glpi_user_token}",
            },
            verify=cfg.glpi_verify_ssl,
            timeout=15,
        )
        if resp.status_code != 200:
            raise RuntimeError(f"initSession GLPI ({resp.status_code}): {resp.text[:300]}")

        token = resp.json().get("session_token")
        if not token:
            raise RuntimeError("session_token vide")

        log.info("Session GLPI ouverte")
        return token

    def _ensure_session(self):
        if not self._session_token or datetime.utcnow() >= self._expires_at:
            self._session_token = self._init_session()
            self._expires_at = datetime.utcnow() + timedelta(minutes=50)

    def _headers(self) -> dict:
        self._ensure_session()
        return {
            "Content-Type": "application/json",
            "App-Token": self._settings.glpi_app_token,
            "Session-Token": self._session_token,
        }

    # ── Requêtes ──────────────────────────────────────────────────
    def _get(self, endpoint: str, params: dict | None = None) -> requests.Response:
        return requests.get(
            f"{self._settings.glpi_api_url}/{endpoint}",
            headers=self._headers(),
            params=params or {},
            verify=self._settings.glpi_verify_ssl,
            timeout=30,
        )

    def get_all(
        self,
        endpoint: str,
        params: dict | None = None,
        page_size: int = 500,
    ) -> list[dict]:
        """Récupère tous les enregistrements en gérant la pagination GLPI (206 Partial)."""
        items: list[dict] = []
        offset = 0
        base = dict(params or {})

        while True:
            base["range"] = f"{offset}-{offset + page_size - 1}"
            resp = self._get(endpoint, base)

            if resp.status_code == 401:
                self._session_token = None
                resp = self._get(endpoint, base)

            if resp.status_code in (200, 206):
                data = resp.json()
                if not isinstance(data, list):
                    break
                items.extend(data)
                if resp.status_code == 200 or len(data) < page_size:
                    break
                offset += page_size
            else:
                # Log détaillé pour diagnostiquer les 400/401
                body_preview = (resp.text or "")[:500]
                log.warning("GET %s → HTTP %s | %s", endpoint, resp.status_code, body_preview)
                break

        return items

    def get_one(self, endpoint: str, item_id: int) -> dict:
        resp = self._get(f"{endpoint}/{item_id}")
        return resp.json() if resp.ok else {}

    def get_ticket_followups(self, ticket_id: int, page_size: int = 500) -> list[dict]:
        """Récupère tous les followups d'un ticket (pagination gérée).

        GLPI peut refuser certains filtres de recherche. En fallback, on récupère
        tous les followups et on filtre côté client sur tickets_id/ticket_id.
        """
        params_options = [
            {"searchText[tickets_id]": ticket_id, "sort": "date", "order": "ASC"},
            {"searchText[ticket_id]": ticket_id, "sort": "date", "order": "ASC"},
        ]
        for params in params_options:
            items = self.get_all("TicketFollowup", params, page_size)
            if items:
                return items

        items = self.get_all("TicketFollowup", {"sort": "date", "order": "ASC"}, page_size)
        return [
            item for item in items
            if item.get("tickets_id") == ticket_id
            or item.get("ticket_id") == ticket_id
            or str(item.get("tickets_id")) == str(ticket_id)
            or str(item.get("ticket_id")) == str(ticket_id)
        ]

    def get_ticket_with_logs(self, ticket_id: int) -> dict:
        """Récupère un Ticket avec l'historique déjà reconstruit.

        Endpoint GLPI (chez toi) :
          GET /apirest.php/Ticket/<id>?with_logs=true&expand_dropdowns=true

        Retourne le JSON (incluant typiquement une clé `_logs`).

        Note : dans certains GLPI, `_logs` peut être plafonné à la première page.
        Pour récupérer l'intégralité, préférer `get_ticket_logs()`.
        """
        params = {
            "with_logs": "true",
            "expand_dropdowns": "true",
        }
        resp = self._get(f"Ticket/{ticket_id}", params=params)
        return resp.json() if resp.ok else {}

    def get_ticket_logs(self, ticket_id: int, page_size: int = 500) -> list[dict]:
        """Récupère l'intégralité du journal d'historique GLPI (`glpi_logs`).

        Utilise le sous-type paginé : `Ticket/<id>/Log`.
        Comme `get_all()` gère la pagination `range`/`206`, on évite les troncatures
        potentielles de `with_logs=true`.
        """
        return self.get_all(f"Ticket/{ticket_id}/Log", {}, page_size)

    def get_ticket_validations(self, ticket_id: int, page_size: int = 500) -> list[dict]:
        """Récupère les demandes de validation (TicketValidation) liées à un ticket."""
        # Sous-type (si exposé ainsi par l'API)
        items = self.get_all(f"Ticket/{ticket_id}/TicketValidation", {}, page_size)
        if items:
            return items
        # Fallback générique
        return self.get_all(
            "TicketValidation",
            {"searchText[tickets_id]": ticket_id, "sort": "submission_date", "order": "ASC"},
            page_size,
        )


    def get_ticket_changes(self, ticket_id: int, page_size: int = 500) -> list[dict]:

        """Récupère les changements (`glpi_changes`) liés à un ticket.

        Certains environnements GLPI exposent ce type via la ressource `Change`.
        On tente d'abord une recherche par ticket, puis on filtre côté client si nécessaire.
        """
        params_options = [
            {"searchText[ticket_id]": ticket_id, "sort": "date", "order": "ASC"},
            {"searchText[tickets_id]": ticket_id, "sort": "date", "order": "ASC"},
        ]
        for endpoint in ("Change", "Changes"):
            for params in params_options:
                items = self.get_all(endpoint, params, page_size)
                if items:
                    return items

            items = self.get_all(endpoint, {"sort": "date", "order": "ASC"}, page_size)
            if items:
                filtered = [
                    item for item in items
                    if item.get("ticket_id") == ticket_id
                    or item.get("tickets_id") == ticket_id
                    or str(item.get("ticket_id")) == str(ticket_id)
                    or str(item.get("tickets_id")) == str(ticket_id)
                ]
                if filtered:
                    return filtered

        return []

    # ── Acteurs réels (acheteur assigné, profils GLPI) ───────────────────
    def get_ticket_assignees_map(self, page_size: int = 500) -> dict[int, list[int]]:
        """
        Construit une map {ticket_id: [users_id assignés comme Technicien/Acheteur]}
        à partir de la table relationnelle `glpi_tickets_users` (classe GLPI
        `Ticket_User`).

        Codes `type` GLPI : 1 = Demandeur, 2 = Technicien assigné
        (Acheteur dans ce workflow), 3 = Observateur.

        Contrairement aux champs directs du `Ticket` (souvent absents côté API)
        ou aux logs d'historique (qui demandent de reconstituer la chronologie),
        cette table ne contient que l'état COURANT : GLPI supprime l'ancienne
        ligne et insère la nouvelle lors d'une réattribution. Pas d'ambiguïté
        en cas de changement d'acheteur.
        """
        mapping: dict[int, list[int]] = {}
        items = self.get_all("Ticket_User", {"fields": "id,tickets_id,users_id,type"}, page_size)
        for it in items:
            try:
                if int(it.get("type")) != 2:
                    continue
                tid = int(it.get("tickets_id"))
                uid = int(it.get("users_id"))
            except (TypeError, ValueError):
                continue
            mapping.setdefault(tid, []).append(uid)
        return mapping

    def get_users_with_profile(self, profile_names: set[str], page_size: int = 500) -> list[int]:
        """
        Retourne les ids des utilisateurs ayant un profil GLPI dont le nom
        (en minuscules, espaces superflus retirés) figure dans `profile_names`.

        Utilise `glpi_profiles` (classe `Profile`) pour trouver le(s) profils_id
        correspondant(s), puis `glpi_profiles_users` (classe `Profile_User`)
        pour les utilisateurs liés à ce(s) profil(s).
        """
        profiles = self.get_all("Profile", {"fields": "id,name"}, page_size)
        matching_ids = {
            p["id"] for p in profiles
            if (p.get("name") or "").strip().lower() in profile_names
        }
        if not matching_ids:
            log.warning(
                "Aucun profil GLPI ne correspond à %s — vérifier le nom exact "
                "du profil Acheteur dans GLPI (Administration > Profils)",
                sorted(profile_names),
            )
            return []

        user_ids: set[int] = set()
        for pid in matching_ids:
            # Sous-ressource dédiée (même pattern que Ticket/<id>/TicketValidation)
            items = self.get_all(f"Profile/{pid}/Profile_User", {}, page_size)
            if not items:
                # Fallback générique si la sous-ressource n'est pas exposée ainsi
                items = self.get_all(
                    "Profile_User",
                    {"searchText[profiles_id]": pid},
                    page_size,
                )
            for it in items:
                try:
                    user_ids.add(int(it.get("users_id")))
                except (TypeError, ValueError):
                    continue

        return sorted(user_ids)