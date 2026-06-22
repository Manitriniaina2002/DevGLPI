"""
Dashboard Achat GLPI — Backend FastAPI
========================================
Point d'entrée unique : configure l'app et monte les routers.
Toute la logique métier est dans services/, repositories/, clients/.
"""
from __future__ import annotations

import logging
import sys

from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware

from core.config import get_settings
from core.cache import cache_invalidate_all, cache_stats
from core.security import require_responsable, CurrentUser
from api.routes import metrics, tickets, referentiels, dashboard, export, auth

# ── Logging ───────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
)
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

# ── App ───────────────────────────────────────────────────────────
settings = get_settings()

app = FastAPI(
    title="Dashboard Achat GLPI",
    version="5.1.0",
    description=(
        "API analytique pour le suivi des demandes d'achat GLPI. "
        "USE_MOCK_DATA=true → données simulées | false → API GLPI réelle.\n\n"
        "**Authentification :** POST /api/auth/login → JWT Bearer.\n"
        "En mode mock, comptes de test : responsable/demo · acheteur/demo · demandeur/demo"
    ),
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────────
app.include_router(auth.router)
app.include_router(metrics.router)
app.include_router(tickets.router)
app.include_router(referentiels.router)
app.include_router(dashboard.router)
app.include_router(export.router)


# ── Health ────────────────────────────────────────────────────────
import requests
import urllib3
from datetime import datetime

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)


@app.get("/health", tags=["Système"])
async def health():
    cfg = get_settings()
    glpi_ok, glpi_error, glpi_version = False, None, None

    if not cfg.use_mock_data:
        try:
            resp = requests.get(
                cfg.glpi_api_url,
                headers={"App-Token": cfg.glpi_app_token, "Content-Type": "application/json"},
                verify=False,
                timeout=5,
            )
            glpi_ok = resp.ok
            if glpi_ok:
                glpi_version = resp.json().get("api_version")
        except requests.exceptions.ConnectionError:
            glpi_error = f"Connexion refusée — GLPI_BASE_URL={cfg.glpi_base_url}"
        except Exception as exc:
            glpi_error = str(exc)
    else:
        glpi_ok = True

    # Stats Redis
    redis_info = await cache_stats()

    return {
        "status": "ok" if glpi_ok else "degraded",
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "timezone": cfg.tz,
        "mode": "mock" if cfg.use_mock_data else "glpi_live",
        "glpi": {
            "base_url": cfg.glpi_base_url,
            "api_url": cfg.glpi_api_url,
            "reachable": glpi_ok,
            "version": glpi_version,
            "error": glpi_error,
        },
        "auth": {
            "method": "JWT Bearer",
            "app_token_set": bool(cfg.glpi_app_token),
            "user_token_set": bool(cfg.glpi_user_token),
            "jwt_secret_set": cfg.jwt_secret != "change-me-in-production-use-a-long-random-secret",
        },
        "cache": redis_info,
    }


@app.get("/api/config", tags=["Système"])
def get_config():
    cfg = get_settings()
    return {
        "mode": "mock" if cfg.use_mock_data else "live",
        "glpi_base_url": cfg.glpi_base_url,
        "purchase_category_id": cfg.glpi_purchase_category_id,
        "resolved_statuses": sorted(cfg.resolved_statuses),
        "rejected_statuses": sorted(cfg.rejected_statuses),
        "urgent_priorities": sorted(cfg.urgent_priorities),
        "status_map": cfg.status_map,
        "cors_origins": cfg.cors_origins,
        "redis_enabled": cfg.redis_enabled,
        "redis_ttls": {
            "ticket_history": cfg.redis_ttl_ticket_history,
            "purchase_tickets": cfg.redis_ttl_purchase_tickets,
            "assignees_map": cfg.redis_ttl_assignees_map,
            "users": cfg.redis_ttl_users,
            "projects": cfg.redis_ttl_projects,
            "validations": cfg.redis_ttl_validations,
        },
    }


# ── Cache management (réservé au responsable) ─────────────────────

@app.get("/api/cache/stats", tags=["Cache"])
async def get_cache_stats(user: CurrentUser = Depends(require_responsable)):
    """Statistiques Redis — réservé au responsable."""
    return await cache_stats()


@app.post("/api/cache/flush", tags=["Cache"])
async def flush_cache(user: CurrentUser = Depends(require_responsable)):
    """
    Vide entièrement le cache Redis.
    Force un refresh complet depuis GLPI au prochain appel.
    Réservé au responsable.
    """
    await cache_invalidate_all()
    return {"detail": "Cache Redis vidé. Les prochains appels rechargeront depuis GLPI."}