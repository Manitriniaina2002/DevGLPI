"""
repositories/referentiel_repository.py — Référentiels acheteurs, projets, statuts
Centralise toutes les listes de valeurs utilisées comme filtres dans le dashboard.
"""
from __future__ import annotations

import logging

from clients.glpi_client import GLPIClient
from core.config import Settings
from core.security import GLPI_PROFILE_ROLE_MAP

log = logging.getLogger("referentiels")

# Noms de profils GLPI considérés comme "Acheteur" — même source de vérité que
# la résolution du rôle à la connexion (core/security.py), pour éviter toute
# divergence entre "qui peut se connecter en tant qu'acheteur" et "qui
# apparaît comme acheteur dans les référentiels / filtres".
ACHETEUR_PROFILE_NAMES: set[str] = {
    name for name, role in GLPI_PROFILE_ROLE_MAP.items() if role == "acheteur"
}


class ReferentielRepository:
    def __init__(self, settings: Settings, client: GLPIClient | None = None):
        self._s = settings
        self._client = client
        self._acheteur_ids_cache: set[int] | None = None

    # ── Acheteurs (profils GLPI réels) ───────────────────────────────
    def _get_acheteur_user_ids(self) -> set[int]:
        """
        Ids des utilisateurs GLPI porteurs du profil Acheteur/Achat
        (table glpi_profiles_users). Résultat mis en cache pour la durée de
        vie du repository (une seule requête GLPI par requête HTTP, pas par
        ticket / par appel).
        """
        if self._s.use_mock_data or not self._client:
            return set()
        if self._acheteur_ids_cache is not None:
            return self._acheteur_ids_cache

        try:
            ids = set(self._client.get_users_with_profile(ACHETEUR_PROFILE_NAMES))
        except Exception:
            log.exception("Échec de récupération des utilisateurs du profil Acheteur")
            ids = set()

        self._acheteur_ids_cache = ids
        return ids

    def get_acheteurs(self, tickets: list[dict]) -> list[str]:
        """
        Acheteurs réellement présents sur les tickets de la période, en ne
        retenant que les utilisateurs effectivement assignés (cf.
        TicketRepository._enrich → _buyer_user_id) ET porteurs du profil GLPI
        Acheteur/Achat.

        Si la résolution du profil échoue (mauvaise config GLPI, profil
        introuvable) on retombe sur la simple liste des acheteurs assignés,
        pour ne pas faire disparaître silencieusement le filtre.
        """
        if self._s.use_mock_data or not self._client:
            names = sorted({t.get("_buyer_name", "Non assigné") for t in tickets})
            return [n for n in names if n != "Non assigné"]

        acheteur_ids = self._get_acheteur_user_ids()

        names: set[str] = set()
        for t in tickets:
            uid = t.get("_buyer_user_id")
            name = t.get("_buyer_name")
            if not uid or not name or name == "Non assigné":
                continue
            if acheteur_ids and uid not in acheteur_ids:
                # Assigné sur le ticket mais pas porteur du profil Acheteur
                # (ex: erreur d'attribution GLPI) → on ne le liste pas comme
                # acheteur "officiel".
                continue
            names.add(name)

        return sorted(names)

    def get_all_acheteurs(self) -> list[dict]:
        """
        Tous les utilisateurs GLPI porteurs du profil Acheteur/Achat
        (indépendamment des tickets) — pour les selects de filtres frontend.

        Retourne une liste vide si aucun profil Acheteur/Achat n'est trouvé
        côté GLPI (à vérifier dans Administration > Profils si ça arrive).
        """
        if self._s.use_mock_data or not self._client:
            return [
                {"id": 10, "name": "RANDRIANIRINA Isabelle"},
                {"id": 11, "name": "ANDRIANASOLO Ny Ando"},
                {"id": 12, "name": "RAJAONARISON Heriniaina"},
                {"id": 13, "name": "RAHARINIRINA Claire"},
                {"id": 14, "name": "ANDRIANASOLO Ny Ando"},
            ]

        acheteur_ids = self._get_acheteur_user_ids()
        if not acheteur_ids:
            return []

        users = []
        for u in self._client.get_all("User", {"fields": "id,name,realname,firstname", "is_active": 1}):
            try:
                uid = int(u.get("id"))
            except (TypeError, ValueError):
                continue
            if uid not in acheteur_ids:
                continue
            full = " ".join(filter(None, [u.get("firstname"), u.get("realname")])) or u.get("name", str(uid))
            users.append({"id": uid, "name": full})

        return sorted(users, key=lambda x: x["name"])

    # ── Projets ───────────────────────────────────────────────────
    def get_projets(self, tickets: list[dict]) -> list[str]:
        """Extrait la liste dédupliquée des projets à partir des tickets déjà chargés."""
        names = sorted(
            {t.get("_project_name", "Sans projet") for t in tickets}
        )
        return names

    def get_all_projets(self) -> list[dict]:
        """
        Retourne tous les projets GLPI (mode live uniquement).
        Chaque entrée : {"id": int, "name": str}
        """
        if self._s.use_mock_data or not self._client:
            return [
                {"id": 1, "name": "M001 -- DN & Administration"},
                {"id": 2, "name": "M004 -- Informatique (IT)"},
                {"id": 3, "name": "M232 -- Programme École"},
                {"id": 4, "name": "M300 -- Reboisement"},
                {"id": 0, "name": "Sans projet"},
            ]

        projects = []
        for p in self._client.get_all("Project", {"fields": "id,name"}):
            projects.append({"id": p["id"], "name": p.get("name", "")})

        projects.append({"id": 0, "name": "Sans projet"})
        return sorted(projects, key=lambda x: x["name"])

    # ── Statuts ───────────────────────────────────────────────────
    def get_statuts(self) -> list[dict]:
        """Retourne la table des statuts enrichie avec les flags métier."""
        return [
            {
                "id": k,
                "label": v,
                "is_resolved": k in self._s.resolved_statuses,
                "is_rejected": k in self._s.rejected_statuses,
            }
            for k, v in self._s.status_map.items()
        ]

    # ── Catégories GLPI ───────────────────────────────────────────
    def get_categories(self) -> list[dict]:
        """
        Retourne les catégories ITIL GLPI (utile pour détecter GLPI_PURCHASE_CATEGORY_ID).
        Mode mock : retourne une catégorie fictive.
        """
        if self._s.use_mock_data or not self._client:
            return [{"id": 1, "name": "Demande d'achat", "completename": "Demandes > Achat"}]

        cats = []
        for c in self._client.get_all("ITILCategory", {"fields": "id,name,completename"}):
            cats.append({
                "id": c["id"],
                "name": c.get("name", ""),
                "completename": c.get("completename", ""),
            })
        return sorted(cats, key=lambda x: x["completename"])

    # ── Priorités ─────────────────────────────────────────────────
    def get_priorites(self) -> list[dict]:
        """Mapping statique des priorités GLPI."""
        priority_map = {
            1: "Très basse",
            2: "Basse",
            3: "Moyenne",
            4: "Haute",
            5: "Très haute",
            6: "Majeure",
        }
        return [
            {
                "id": k,
                "label": v,
                "is_urgent": k in self._s.urgent_priorities,
            }
            for k, v in priority_map.items()
        ]