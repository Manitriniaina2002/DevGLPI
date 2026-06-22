"""
repositories/ticket_repository.py — Accès et enrichissement des tickets
Adapté au formulaire réel GLPI Forms "DEMANDE D'ACHAT" :
  - Projet et Service sont dans le CONTENT du ticket (pas dans projects_id)
  - Urgence est fixée à 3 par le formulaire → on la lit depuis content si dispo
  - Tous les tickets GLPI sont des demandes d'achat → pas de filtre par mots-clés
  - L'acheteur assigné est résolu via la table relationnelle Ticket_User
    (glpi_tickets_users, type=2) — voir _enrich() pour le détail

Cache Redis :
  - get_ticket_history()      → clé "ticket_history:{id}"       TTL 5 min
  - get_users()               → clé "glpi_users"                TTL 30 min
  - get_projects()            → clé "glpi_projects"             TTL 30 min
  - get_ticket_assignees_map()→ clé "ticket_assignees_map"      TTL 2 min
  - get_purchase_tickets()    → clé "purchase_tickets"          TTL 2 min
  - get_ticket_validations()  → clé "ticket_validations:{id}"   TTL 5 min

  Dégradation gracieuse : si Redis est indisponible, on retombe sur
  l'appel GLPI direct sans lever d'exception.
"""
from __future__ import annotations

import asyncio
import re
import time
from datetime import date, datetime
from typing import Any, Optional

from clients.glpi_client import GLPIClient
from clients.mock_client import generate_mock_tickets
from core.config import Settings
from core.cache import cache_get, cache_set
from services.form_parser import FormParser


# ── Helpers ───────────────────────────────────────────────────────────────────

def _parse_date(val: Any) -> date | None:
    if not val or val in ("NULL", "0000-00-00 00:00:00"):
        return None
    try:
        return datetime.fromisoformat(str(val).replace(" ", "T")).date()
    except ValueError:
        return None


def _resolve_project_id(ticket: dict) -> int:
    candidates = (
        "projects_id",
        "project_id",
        "projects",
        "project",
        "projects_id_assign",
        "project_id_assigned",
    )

    def parse_value(val: Any) -> int:
        if isinstance(val, int):
            return val
        if isinstance(val, str):
            cleaned = val.strip()
            if cleaned.isdigit():
                return int(cleaned)
            m = re.search(r"\d+", cleaned)
            if m:
                return int(m.group(0))
        if isinstance(val, dict):
            for nested_key in ("id", "projects_id", "project_id"):
                nested_value = val.get(nested_key)
                if nested_value is not None:
                    resolved = parse_value(nested_value)
                    if resolved:
                        return resolved
        if isinstance(val, (list, tuple)) and val:
            return parse_value(val[0])
        return 0

    for key in candidates:
        value = ticket.get(key)
        if not value:
            continue
        resolved = parse_value(value)
        if resolved:
            return resolved

    return 0


def _run_async(coro):
    """
    Exécute une coroutine depuis un contexte synchrone.
    Utilisé pour les méthodes du repository qui restent synchrones
    mais délèguent le cache à des helpers async.
    """
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            # Dans un contexte FastAPI async, créer une tâche
            import concurrent.futures
            with concurrent.futures.ThreadPoolExecutor() as pool:
                future = pool.submit(asyncio.run, coro)
                return future.result()
        else:
            return loop.run_until_complete(coro)
    except Exception:
        return None


_form_parser = FormParser()


# ── Repository ────────────────────────────────────────────────────────────────

class TicketRepository:
    def __init__(self, settings: Settings, client: GLPIClient | None = None):
        self._settings = settings
        self._client = client

    # ── Helpers cache Redis ───────────────────────────────────────

    def _cache_get(self, key: str) -> Any | None:
        """Cache GET synchrone (wrapper autour de l'helper async)."""
        if not self._settings.redis_enabled:
            return None
        return _run_async(cache_get(key))

    def _cache_set(self, key: str, value: Any, ttl: int) -> None:
        """Cache SET synchrone (wrapper autour de l'helper async)."""
        if not self._settings.redis_enabled:
            return
        _run_async(cache_set(key, value, ttl))

    # ── Enrichissement ────────────────────────────────────────────
    def _enrich(self, tickets: list[dict]) -> list[dict]:
        """
        Enrichit les tickets avec :
        - _project_name  : extrait du content HTML (formulaire GLPI Forms)
        - _service       : service demandeur (content HTML)
        - _buyer_user_id : id GLPI de l'acheteur RÉELLEMENT assigné (0 si aucun)
        - _buyer_name    : nom résolu depuis _buyer_user_id ("Non assigné" si 0)
        - _lieu          : lieu de livraison (content HTML)
        - _urgence_int   : urgence réelle si renseignée dans le formulaire
        """
        if self._settings.use_mock_data:
            return tickets

        # Charger les utilisateurs GLPI (avec cache Redis)
        users = self.get_users()
        name_to_uid = {v.lower(): k for k, v in users.items() if isinstance(v, str)}

        project_names = self.get_projects()

        # Acheteur assigné (avec cache Redis)
        assignees_map = self.get_ticket_assignees_map()

        for t in tickets:
            # ── Parser le content du formulaire ──────────────────
            content = t.get("content") or ""
            parsed = _form_parser.parse(content)

            if parsed.projet:
                t["_project_name"] = parsed.projet
            else:
                pid = _resolve_project_id(t)
                if pid:
                    t["_project_name"] = project_names.get(pid, f"Projet #{pid}")
                else:
                    t["_project_name"] = "Sans projet"

            t["_service"] = parsed.service or "Non renseigné"
            t["_lieu"] = parsed.lieu or ""
            t["_beneficiaire"] = parsed.beneficiaire or ""
            t["_date_livraison"] = parsed.date_livr or ""
            t["_description"] = parsed.description or ""
            t["_a_valider"] = parsed.a_valider or ""

            if parsed.urgence_int:
                t["_urgence_int"] = parsed.urgence_int
            else:
                t["_urgence_int"] = t.get("urgency") or t.get("priority") or 3

            # ── Acheteur assigné ──────────────────────────────────
            try:
                tid = int(t.get("id"))
            except (TypeError, ValueError):
                tid = None

            assigned_ids = assignees_map.get(tid, []) if tid is not None else []

            if assigned_ids:
                uid = assigned_ids[0]
            else:
                uid = 0
                v = t.get("users_id_assign")
                if v:
                    try:
                        uid = int(v)
                    except (TypeError, ValueError):
                        if isinstance(v, str):
                            name_key = v.lower()
                            resolved = name_to_uid.get(name_key)
                            if resolved is not None:
                                uid = resolved
                            else:
                                for nm, uid2 in name_to_uid.items():
                                    if name_key in nm or nm in name_key:
                                        uid = uid2
                                        break

            t["_buyer_user_id"] = uid
            t["_buyer_name"] = users.get(uid, f"User #{uid}") if uid else "Non assigné"

        return tickets

    # ── Filtre achat ──────────────────────────────────────────────
    def _is_purchase(self, ticket: dict) -> bool:
        if self._settings.use_mock_data:
            return True

        cat_id = self._settings.glpi_purchase_category_id
        if cat_id:
            return ticket.get("itilcategories_id") == cat_id

        name = (ticket.get("name") or "").lower()
        keywords = ("achat", "purchase", "commande", "approvision", "fourniture")
        if any(k in name for k in keywords):
            return True

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

    # ── Méthodes publiques (avec cache Redis) ─────────────────────

    def get_purchase_tickets(
        self,
        date_from: date | None = None,
        date_to: date | None = None,
    ) -> list[dict]:
        if self._settings.use_mock_data:
            tickets = generate_mock_tickets()
            return self._apply_date_filter(tickets, date_from, date_to)

        # Cache uniquement pour la requête sans filtre de date
        # (la liste complète, le filtre de date est appliqué après)
        cache_key = "purchase_tickets"
        cached = self._cache_get(cache_key)

        if cached is not None:
            return self._apply_date_filter(cached, date_from, date_to)

        # Sinon, appel GLPI
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

        # Mettre en cache (sans filtre date)
        self._cache_set(cache_key, tickets, self._settings.redis_ttl_purchase_tickets)

        return self._apply_date_filter(tickets, date_from, date_to)

    def get_deleted_tickets(
        self,
        date_from: date | None = None,
        date_to: date | None = None,
    ) -> list[dict]:
        if self._settings.use_mock_data:
            return []

        # Pas de cache pour les tickets supprimés (moins fréquent)
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
        """Annuaire GLPI {id: nom_complet} — mis en cache 30 min."""
        if self._settings.use_mock_data or not self._client:
            return {}

        cache_key = "glpi_users"
        cached = self._cache_get(cache_key)
        if cached is not None:
            # Redis retourne les clés en str — on reconvertit en int
            return {int(k): v for k, v in cached.items()}

        users: dict[int, str] = {}
        for u in self._client.get_all("User", {"fields": "id,name,realname,firstname"}):
            try:
                uid = int(u["id"])
            except (TypeError, ValueError):
                continue
            full = " ".join(filter(None, [u.get("firstname"), u.get("realname")])) or u.get("name", str(uid))
            users[uid] = full

        # Sérialiser avec clés str pour JSON
        self._cache_set(cache_key, {str(k): v for k, v in users.items()}, self._settings.redis_ttl_users)
        return users

    def get_projects(self) -> dict[int, str]:
        """Projets GLPI {id: nom} — mis en cache 30 min."""
        if self._settings.use_mock_data or not self._client:
            return {}

        cache_key = "glpi_projects"
        cached = self._cache_get(cache_key)
        if cached is not None:
            return {int(k): v for k, v in cached.items()}

        projects: dict[int, str] = {}
        for p in self._client.get_all("Project", {"fields": "id,name"}):
            pid = p.get("id")
            try:
                pid = int(pid)
            except (TypeError, ValueError):
                continue
            projects[pid] = p.get("name", "")

        self._cache_set(cache_key, {str(k): v for k, v in projects.items()}, self._settings.redis_ttl_projects)
        return projects

    def get_ticket_assignees_map(self) -> dict[int, list[int]]:
        """
        Map {ticket_id: [users_id]} depuis Ticket_User (type=2).
        Mis en cache 2 min (données critiques mais changeantes).
        """
        if not self._client:
            return {}

        cache_key = "ticket_assignees_map"
        cached = self._cache_get(cache_key)
        if cached is not None:
            # Redis retourne les clés en str — on reconvertit en int
            return {int(k): v for k, v in cached.items()}

        if not hasattr(self._client, "get_ticket_assignees_map"):
            return {}

        try:
            mapping = self._client.get_ticket_assignees_map()
        except Exception:
            return {}

        self._cache_set(
            cache_key,
            {str(k): v for k, v in mapping.items()},
            self._settings.redis_ttl_assignees_map,
        )
        return mapping

    def get_ticket_history(self, ticket_id: int) -> list[dict]:
        """
        Logs / historique d'un ticket — mis en cache 5 min par ticket.
        Remplace l'ancien CacheEntry in-process (perdu au restart,
        dupliqué par worker).
        """
        cache_key = f"ticket_history:{ticket_id}"
        cached = self._cache_get(cache_key)
        if cached is not None:
            return cached

        result = self._get_ticket_history_uncached(ticket_id)

        if result:
            self._cache_set(cache_key, result, self._settings.redis_ttl_ticket_history)

        return result

    def get_ticket_validations(self, ticket_id: int) -> list[dict]:
        """
        Validations GLPI d'un ticket — mis en cache 5 min.
        Nouvelle méthode centralisée (était inline dans tickets.py).
        """
        if self._settings.use_mock_data or not self._client:
            return []

        cache_key = f"ticket_validations:{ticket_id}"
        cached = self._cache_get(cache_key)
        if cached is not None:
            return cached

        try:
            validations = self._client.get_ticket_validations(ticket_id)
        except Exception:
            validations = []

        if validations:
            self._cache_set(cache_key, validations, self._settings.redis_ttl_validations)

        return validations

    def _get_ticket_history_uncached(self, ticket_id: int) -> list[dict]:
        """
        Récupère les followups / historiques d'un ticket GLPI (sans cache).
        Logique identique à l'original — séparée pour clarté.
        """
        if self._settings.use_mock_data:
            return []

        if not self._client:
            return []

        params: dict[str, Any] = {
            "searchText[tickets_id]": ticket_id,
            "sort": "date",
            "order": "ASC",
            "expand_dropdowns": 1,
        }

        logs: list[dict] = []

        # 1) Préférer `Ticket/<id>/Log` (pagination robuste)
        if hasattr(self._client, "get_ticket_logs"):
            try:
                logs = self._client.get_ticket_logs(ticket_id)
            except Exception:
                logs = []

        # 2) Fallback : `with_logs=true`
        if not logs and hasattr(self._client, "get_ticket_with_logs"):
            try:
                logs_payload: dict = self._client.get_ticket_with_logs(ticket_id)
                raw_logs = logs_payload.get("_logs") or logs_payload.get("logs") or []
                if isinstance(raw_logs, list):
                    logs = raw_logs
            except Exception:
                logs = []

        items: list[dict] = []
        users = self.get_users()

        def _extract_date_from_log(rec: dict) -> str | None:
            return rec.get("date_mod") or rec.get("date") or rec.get("date_creation")

        _LINKED_ACTION_ADD_SUBITEM = 17
        _LINKED_ACTION_ADD_LINK = 15
        _ITEMTYPE_LABELS_FR = {
            "ITILFollowup": "Suivi",
            "TicketTask": "Tâche",
            "Document_Item": "Document",
        }

        def _format_duration_fr(value: Any) -> str:
            try:
                seconds = int(value)
            except (TypeError, ValueError):
                return str(value)
            if seconds <= 0:
                return "0 seconde"
            days, rem = divmod(seconds, 86400)
            hours, rem = divmod(rem, 3600)
            minutes, secs = divmod(rem, 60)
            parts = []
            if days:
                parts.append(f"{days} jour{'s' if days > 1 else ''}")
            if hours:
                parts.append(f"{hours} heure{'s' if hours > 1 else ''}")
            if minutes:
                parts.append(f"{minutes} minute{'s' if minutes > 1 else ''}")
            if not parts and secs:
                parts.append(f"{secs} seconde{'s' if secs > 1 else ''}")
            return " ".join(parts) if parts else "0 seconde"

        def _format_log_message(l: dict, ov: str, nv: str) -> str:
            linked_action = l.get("linked_action")
            itemtype_link = l.get("itemtype_link") or ""
            if not ov and not nv and linked_action:
                return "Ajouter l'élément"
            if linked_action == _LINKED_ACTION_ADD_SUBITEM and nv:
                label = _ITEMTYPE_LABELS_FR.get(itemtype_link, itemtype_link or "élément")
                return f"Ajout d'un élément : {label} ({nv})"
            if linked_action == _LINKED_ACTION_ADD_LINK and nv:
                return f"Ajout d'un lien avec un élément : {nv}"
            if ov and nv:
                return f"Changement de {ov} à {nv}"
            return nv or ov

        search_options: dict[int, dict] = {}
        if hasattr(self._client, "get_search_options"):
            try:
                search_options = self._client.get_search_options("Ticket")
            except Exception:
                search_options = {}

        if logs:
            for l in logs:
                itemtype_link = l.get("itemtype_link") or ""
                id_search_option = l.get("id_search_option")
                old_value, new_value = l.get("old_value"), l.get("new_value")
                entry_type = "followup" if itemtype_link == "ITILFollowup" else "change"
                champ = ""

                if isinstance(id_search_option, int) and id_search_option:
                    champ = search_options.get(id_search_option, {}).get("name", str(id_search_option))
                elif l.get("linked_action") == _LINKED_ACTION_ADD_SUBITEM and itemtype_link:
                    champ = _ITEMTYPE_LABELS_FR.get(itemtype_link, itemtype_link)

                def _norm_str(v: Any) -> str:
                    if isinstance(v, str):
                        return v.strip()
                    return str(v) if v is not None else ""

                ov = _norm_str(old_value or "")
                nv = _norm_str(new_value or "")

                if id_search_option == 12:
                    if ov.isdigit():
                        ov = self._settings.status_map.get(int(ov), ov)
                    if nv.isdigit():
                        nv = self._settings.status_map.get(int(nv), nv)

                if champ and any(k in champ.lower() for k in ("délai", "temps", "durée")):
                    if ov.lstrip("-").isdigit():
                        ov = _format_duration_fr(ov)
                    if nv.lstrip("-").isdigit():
                        nv = _format_duration_fr(nv)

                mise_a_jour = _format_log_message(l, ov, nv)

                items.append({
                    "id": l.get("id") or 0,
                    "ticket_id": ticket_id,
                    "date": _extract_date_from_log(l),
                    "author_id": 0,
                    "author_name": l.get("user_name") or "",
                    "content": mise_a_jour,
                    "private": False,
                    "type": entry_type,
                    "champ": champ,
                    "mise_a_jour": mise_a_jour,
                    "raw": l,
                })

            return sorted(items, key=lambda x: (x.get("date") or ""))

        # Fallback: followups + changes
        if hasattr(self._client, "get_ticket_followups"):
            followups = self._client.get_ticket_followups(ticket_id)
        else:
            followups = self._client.get_all("TicketFollowup", params)

        changes: list[dict] = []
        if hasattr(self._client, "get_ticket_changes"):
            try:
                changes = self._client.get_ticket_changes(ticket_id)
            except Exception:
                changes = []

        def _extract_date(rec: dict) -> str | None:
            return rec.get("date") or rec.get("date_creation") or rec.get("date_mod")

        for r in followups:
            author_id = r.get("users_id") or r.get("users_id_author") or 0
            author_name = users.get(author_id, f"User #{author_id}")
            content = r.get("content") or r.get("comment") or ""
            items.append({
                "id": r.get("id") or 0,
                "ticket_id": ticket_id,
                "date": _extract_date(r),
                "author_id": author_id,
                "author_name": author_name,
                "content": content,
                "private": bool(r.get("private", 0)),
                "type": "followup",
                "raw": r,
            })

        for c in changes:
            author_id = c.get("users_id") or c.get("users_id_author") or 0
            author_name = users.get(author_id, f"User #{author_id}")
            change_desc = c.get("content") or c.get("changes") or str(c)
            champ = ""
            mise_a_jour = ""
            for k in ("field", "field_label", "name"):
                v = c.get(k)
                if isinstance(v, str) and v.strip():
                    champ = v.strip()
                    break
            if not champ and isinstance(change_desc, str):
                txt = change_desc.replace("\n", " ").strip()
                if ":" in txt:
                    left, right = txt.split(":", 1)
                    if left and right:
                        champ = left.strip()
                        mise_a_jour = right.strip()
                if not champ:
                    mise_a_jour = txt
            else:
                if not mise_a_jour and isinstance(change_desc, str):
                    mise_a_jour = change_desc

            items.append({
                "id": c.get("id") or 0,
                "ticket_id": ticket_id,
                "date": _extract_date(c),
                "author_id": author_id,
                "author_name": author_name,
                "content": change_desc,
                "champ": champ,
                "mise_a_jour": mise_a_jour,
                "private": False,
                "type": "change",
                "raw": c,
            })

        return sorted(items, key=lambda x: (x.get("date") or ""))