"""
api/routes/dashboard.py — Endpoint synthèse dashboard
GET /api/dashboard/summary  → tous les KPI en un seul appel
"""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, Query

from core.config import Settings, get_settings
from core.dependencies import get_date_range
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


@router.get("/summary")
def dashboard_summary(
    dates: tuple = Depends(get_date_range),
    year: Optional[int] = Query(None, description="Année pour le YTD (défaut = année courante)"),
    repo: TicketRepository = Depends(_get_repo),
    svc: MetricsService = Depends(_get_service),
):
    """
    Tous les KPI en un seul appel — optimisé pour l'écran d'accueil du dashboard.

    Retourne :
    - kpis : taux réalisation, retard, rejet, urgence, délai moyen
    - ytd  : évolution mensuelle de l'année en cours
    - top_buyers / top_projects : classement par volume
    """
    from datetime import date

    df, dt = dates
    tickets = repo.get_purchase_tickets(df, dt)
    ytd_year = year or date.today().year

    return svc.dashboard_summary(tickets, ytd_year, df, dt)
