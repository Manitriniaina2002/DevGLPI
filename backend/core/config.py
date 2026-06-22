"""
core/config.py — Configuration centralisée
Toutes les variables d'environnement sont lues ici et nulle part ailleurs.
"""
from __future__ import annotations

import json
import os
import secrets
from functools import lru_cache

from dotenv import load_dotenv
from pydantic import field_validator
from pydantic_settings import BaseSettings

load_dotenv()


class Settings(BaseSettings):
    # ── Mode ───────────────────────────────────────────────────────
    use_mock_data: bool = True

    # ── GLPI ───────────────────────────────────────────────────────
    glpi_base_url: str = "http://nginx"
    glpi_app_token: str = ""
    glpi_user_token: str = ""
    glpi_verify_ssl: bool = False
    glpi_purchase_category_id: int = 0

    # ── Base de données ────────────────────────────────────────────
    database_url: str = "postgresql://dashboard:dashboard@postgres:5432/dashboard_achat"

    # ── Redis Cache ────────────────────────────────────────────────
    # En Docker : redis = nom du service dans docker-compose.yml
    # Mettre à "" pour désactiver Redis (fallback sur cache mémoire)
    redis_url: str = "redis://redis:6379"

    # TTL en secondes pour chaque type de donnée
    redis_ttl_ticket_history: int = 300      # 5 min  — logs d'un ticket
    redis_ttl_purchase_tickets: int = 120    # 2 min  — liste complète
    redis_ttl_assignees_map: int = 120       # 2 min  — map acheteurs
    redis_ttl_users: int = 1800              # 30 min — annuaire utilisateurs
    redis_ttl_projects: int = 1800           # 30 min — liste des projets
    redis_ttl_validations: int = 300         # 5 min  — validations ticket

    # ── CORS ───────────────────────────────────────────────────────
    cors_origins: list[str] = ["http://localhost:3000", "http://127.0.0.1:3000"]

    # ── Sécurité JWT ───────────────────────────────────────────────
    jwt_secret: str = "change-me-in-production-use-a-long-random-secret"
    glpi_plugin_secret: str = ""

    # ── Timezone ───────────────────────────────────────────────────
    tz: str = "Indian/Antananarivo"

    # ── Constantes métier GLPI ─────────────────────────────────────
    resolved_statuses: frozenset[int] = frozenset({5, 6})
    rejected_statuses: frozenset[int] = frozenset({6})
    urgent_priorities: frozenset[int] = frozenset({4, 5, 6})
    late_threshold_days: int = 5

    # Gardé pour compatibilité ascendante (utilisé dans l'ancien CacheEntry)
    glpi_history_cache_ttl_seconds: int = 300

    status_map: dict[int, str] = {
        1: "Nouveau",
        2: "En cours (assigné)",
        3: "En cours (planifié)",
        4: "En attente",
        5: "Résolu",
        6: "Clos",
    }

    @field_validator("cors_origins", mode="before")
    @classmethod
    def parse_cors(cls, v: str | list) -> list[str]:
        if isinstance(v, str):
            try:
                return json.loads(v)
            except Exception:
                return [v]
        return v

    @property
    def glpi_api_url(self) -> str:
        return f"{self.glpi_base_url.rstrip('/')}/apirest.php"

    @property
    def redis_enabled(self) -> bool:
        """Redis est activé si redis_url est défini et non vide."""
        return bool(self.redis_url and self.redis_url.strip())

    model_config = {"env_file": ".env", "case_sensitive": False, "extra": "ignore"}


@lru_cache
def get_settings() -> Settings:
    return Settings()