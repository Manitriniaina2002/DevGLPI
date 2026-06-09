"""
repositories/referentiel_repository.py — Référentiels acheteurs, projets, statuts
Centralise toutes les listes de valeurs utilisées comme filtres dans le dashboard.
"""
from __future__ import annotations

from clients.glpi_client import GLPIClient
from core.config import Settings


class ReferentielRepository:
    def __init__(self, settings: Settings, client: GLPIClient | None = None):
        self._s = settings
        self._client = client

    # ── Acheteurs ─────────────────────────────────────────────────
    def get_acheteurs(self, tickets: list[dict]) -> list[str]:
        """
        Extrait la liste dédupliquée des acheteurs à partir des tickets déjà chargés.
        Si GLPI est disponible, peut aussi aller chercher tous les utilisateurs actifs.
        """
        names = sorted(
            {t.get("_buyer_name", "Non assigné") for t in tickets}
        )
        return names

    def get_all_acheteurs(self) -> list[dict]:
        """
        Retourne tous les utilisateurs GLPI (mode live uniquement).
        Chaque entrée : {"id": int, "name": str}
        """
        if self._s.use_mock_data or not self._client:
            return [
                {"id": 10, "name": "RANDRIANIRINA Isabelle"},
                {"id": 11, "name": "ANDRIANASOLO Ny Ando"},
                {"id": 12, "name": "RAJAONARISON Heriniaina"},
                {"id": 13, "name": "RAHARINIRINA Claire"},
                {"id": 14, "name": "ANDRIANASOLO Ny Ando"},
            ]

        users = []
        for u in self._client.get_all("User", {"fields": "id,name,realname,firstname", "is_active": 1}):
            uid = u.get("id")
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
