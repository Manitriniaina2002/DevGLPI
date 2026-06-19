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

        project_names = self.get_projects() if self._client else {}

        for t in tickets:
            # ── Parser le content du formulaire ──────────────────
            content = t.get("content") or ""
            parsed = _form_parser.parse(content)

            # Projet → depuis le content (formulaire GLPI Forms)
            if parsed.projet:
                t["_project_name"] = parsed.projet
            else:
                pid = _resolve_project_id(t)
                if pid:
                    t["_project_name"] = project_names.get(pid, f"Projet #{pid}")
                else:
                    t["_project_name"] = "Sans projet"

            # Service demandeur
            t["_service"] = parsed.service or "Non renseigné"

            # Lieu de livraison
            t["_lieu"] = parsed.lieu or ""

            # Bénéficiaire
            t["_beneficiaire"] = parsed.beneficiaire or ""

            # Date de livraison souhaitée
            t["_date_livraison"] = parsed.date_livr or ""

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
            pid = p.get("id")
            try:
                pid = int(pid)
            except (TypeError, ValueError):
                continue
            projects[pid] = p.get("name", "")
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

        # Preferer l'historique déjà prêt côté GLPI
        # (chez toi, apirest.php/Ticket/<id>?with_logs=true renvoie une clé _logs)
        logs: list[dict] = []

        # 1) Preferer `Ticket/<id>/Log` (pagination robuste)
        if hasattr(self._client, "get_ticket_logs"):
            try:
                logs = self._client.get_ticket_logs(ticket_id)
            except Exception:
                logs = []

        # 2) Fallback : `with_logs=true` (peut être plafonné côté GLPI)
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
            # Dans l'extrait que tu as donné : date_mod
            return rec.get("date_mod") or rec.get("date") or rec.get("date_creation") or rec.get("date_mod")

        # ── Traduction GLPI logs (champ + mise_a_jour lisibles) ─────────────────
        # Objectif : reproduire la couche de mapping de l'UI GLPI.
        _LINKED_ACTION_ADD_SUBITEM = 17   # ajout d'un sous-élément (Suivi, Tâche...)
        _LINKED_ACTION_ADD_LINK = 15      # ajout d'un lien vers un élément (User...)
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

                # Si GLPI n'associe pas de champ (ou que c'est un sous-élément), on dérive via itemtype_link
                elif l.get("linked_action") == _LINKED_ACTION_ADD_SUBITEM and itemtype_link:
                    champ = _ITEMTYPE_LABELS_FR.get(itemtype_link, itemtype_link)

                def _norm_str(v: Any) -> str:
                    if isinstance(v, str):
                        return v.strip()
                    return str(v) if v is not None else ""

                ov = _norm_str(old_value or "")
                nv = _norm_str(new_value or "")

                # Statut : traduire codes entiers (id_search_option == 12)
                if id_search_option == 12:
                    if ov.isdigit():
                        ov = self._settings.status_map.get(int(ov), ov)
                    if nv.isdigit():
                        nv = self._settings.status_map.get(int(nv), nv)

                # Durées/SLA : conversion secondes -> texte
                if champ and any(k in champ.lower() for k in ("délai", "temps", "durée")):
                    if ov.lstrip("-").isdigit():
                        ov = _format_duration_fr(ov)
                    if nv.lstrip("-").isdigit():
                        nv = _format_duration_fr(nv)

                mise_a_jour = _format_log_message(l, ov, nv)

                items.append(
                    {
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
                    }
                )

            items_sorted = sorted(items, key=lambda x: (x.get("date") or ""))
            return items_sorted


        # Fallback: followups + changes si with_logs ne renvoie rien
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
            author_id = (
                c.get("users_id")
                or c.get("users_id_author")
                or c.get("users_id_recipient")
                or c.get("users_id_change")
                or 0
            )
            author_name = users.get(author_id, f"User #{author_id}")

            date_val = _extract_date(c)
            # Texte brut du changement
            change_desc = c.get("content") or c.get("changes") or c.get("comment") or str(c)

            # Tentative de mapping vers les colonnes GLPI "Champ" + "Mise à jour".
            # Sur la page GLPI, on voit souvent des patterns du type :
            # "Statut" / "Changement de ... à ..."
            champ: str = ""
            mise_a_jour: str = ""

            # 1) Si GLPI renvoie déjà une clé "field" / "name" / "field_label"
            for k in ("field", "field_label", "name", "items_id_field", "subfield"):
                v = c.get(k)
                if isinstance(v, str) and v.strip():
                    champ = v.strip()
                    break

            # 2) Sinon, on essaie d'extraire via un séparateur ':' ou via parenthèses
            # Exemple attendu : "Statut: Changement de Nouveau à En cours (Attribué)"
            if not champ and isinstance(change_desc, str):
                # Nettoyage minimal
                txt = change_desc.replace("\n", " ").strip()
                if ":" in txt:
                    left, right = txt.split(":", 1)
                    if left and right:
                        champ = left.strip()
                        mise_a_jour = right.strip()
                if not champ:
                    # Exemple : "Changement de Nouveau à En cours (Attribué)" -> champ inconnu
                    mise_a_jour = txt
            else:
                # champ connu, on met tout le reste en mise_a_jour si vide
                if not mise_a_jour and isinstance(change_desc, str):
                    mise_a_jour = change_desc

            items.append(
                {
                    "id": c.get("id") or c.get("changes_id") or 0,
                    "ticket_id": ticket_id,
                    "date": date_val,
                    "author_id": author_id,
                    "author_name": author_name,
                    # Compat: on garde content
                    "content": change_desc,
                    # Nouveau: colonnes séparées
                    "champ": champ,
                    "mise_a_jour": mise_a_jour,
                    "private": False,
                    "type": "change",
                    "raw": c,
                }
            )


        # Trier par date (les dates GLPI sont en iso-like ; trier en string fonctionne pour ISO)
        items_sorted = sorted(items, key=lambda x: (x.get("date") or ""))
        return items_sorted
