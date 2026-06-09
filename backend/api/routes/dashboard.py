"""
api/routes/dashboard.py — Endpoint synthèse dashboard avec filtrage par rôle
=============================================================================
GET /api/dashboard/summary  → tous les KPI en un seul appel

Le périmètre des données retournées dépend du rôle de l'utilisateur :
  demandeur   → KPI calculés sur ses tickets uniquement
  acheteur    → KPI calculés sur les tickets qui lui sont assignés
  responsable → KPI globaux (tous les tickets)
"""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, Query

from core.config import Settings, get_settings
from core.dependencies import get_date_range
from core.security import CurrentUser, get_current_user_optional
from repositories.ticket_repository import TicketRepository
from services.metrics_service import MetricsService

router = APIRouter(prefix="/api/dashboard", tags=["Dashboard"])


def _get_repo(settings: Settings = Depends(get_settings)) -> TicketRepository:
    if settings.use_mock_data:
        return TicketRepository(settings)
    from clients.glpi_client import GLPIClient
    return TicketRepository(settings, GLPIClient(settings))


def _get_service(settings: Settings = Depends(get_settings)) -> MetricsService:
    return MetricsService(settings)


def _apply_role_filter(
    tickets: list[dict],
    user: Optional[CurrentUser],
) -> list[dict]:
    if user is None or user.is_responsable:
        return tickets
    if user.is_acheteur:
        return [t for t in tickets if t.get("users_id_assign") == user.user_id]
    # demandeur
    return [t for t in tickets if t.get("users_id_requester") == user.user_id]


@router.get("/summary")
def dashboard_summary(
    dates: tuple = Depends(get_date_range),
    year: Optional[int] = Query(None, description="Année pour le YTD (défaut = année courante)"),
    repo: TicketRepository = Depends(_get_repo),
    svc: MetricsService = Depends(_get_service),
    user: Optional[CurrentUser] = Depends(get_current_user_optional),
):
    """
    Tous les KPI en un seul appel — optimisé pour l'écran d'accueil du dashboard.
    Le champ `scope` indique le périmètre appliqué (global / acheteur / demandeur).
    """
    from datetime import date

    df, dt = dates
    tickets = repo.get_purchase_tickets(df, dt)
    tickets = _apply_role_filter(tickets, user)
    ytd_year = year or date.today().year

    summary = svc.dashboard_summary(tickets, ytd_year, df, dt)

    # Enrichir avec le scope et l'identité de l'utilisateur
    summary["scope"] = _scope_label(user)
    if user:
        summary["current_user"] = {
            "user_id": user.user_id,
            "login": user.login,
            "full_name": user.full_name,
            "role": user.role,
        }

    return summary


def _scope_label(user: Optional[CurrentUser]) -> str:
    if user is None:
        return "global"
    return {"responsable": "global", "acheteur": "mes_tickets_assignes", "demandeur": "mes_demandes"}.get(
        user.role, "global"
    )
