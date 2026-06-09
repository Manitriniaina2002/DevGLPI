"""
api/routes/metrics.py — Endpoints métriques
"""
from __future__ import annotations

from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, Query

from core.config import Settings, get_settings
from core.dependencies import get_date_range
from repositories.ticket_repository import TicketRepository
from services.metrics_service import MetricsService

router = APIRouter(prefix="/api/metrics", tags=["Métriques"])


def _get_repo(settings: Settings = Depends(get_settings)) -> TicketRepository:
    if settings.use_mock_data:
        return TicketRepository(settings)
    from clients.glpi_client import GLPIClient
    return TicketRepository(settings, GLPIClient(settings))


def _get_service(settings: Settings = Depends(get_settings)) -> MetricsService:
    return MetricsService(settings)


@router.get("/taux-realisation")
def taux_realisation(
    dimension: str = Query("global", description="global | projet | acheteur"),
    dates: tuple = Depends(get_date_range),
    repo: TicketRepository = Depends(_get_repo),
    svc: MetricsService = Depends(_get_service),
):
    df, dt = dates
    tickets = repo.get_purchase_tickets(df, dt)
    return svc.taux_realisation(tickets, dimension)


@router.get("/taux-retard")
def taux_retard(
    dimension: str = Query("global"),
    dates: tuple = Depends(get_date_range),
    repo: TicketRepository = Depends(_get_repo),
    svc: MetricsService = Depends(_get_service),
):
    df, dt = dates
    tickets = repo.get_purchase_tickets(df, dt)
    return svc.taux_retard(tickets, dimension)


@router.get("/taux-rejet")
def taux_rejet(
    dimension: str = Query("global"),
    dates: tuple = Depends(get_date_range),
    include_deleted: bool = Query(True),
    repo: TicketRepository = Depends(_get_repo),
    svc: MetricsService = Depends(_get_service),
):
    df, dt = dates
    tickets = repo.get_purchase_tickets(df, dt)
    if include_deleted:
        tickets += repo.get_deleted_tickets(df, dt)
    return svc.taux_rejet(tickets, dimension)


@router.get("/delai-moyen")
def delai_moyen(
    dimension: str = Query("global"),
    dates: tuple = Depends(get_date_range),
    repo: TicketRepository = Depends(_get_repo),
    svc: MetricsService = Depends(_get_service),
):
    df, dt = dates
    tickets = repo.get_purchase_tickets(df, dt)
    return svc.delai_moyen(tickets, dimension)


@router.get("/demandes-urgentes")
def demandes_urgentes(
    dimension: str = Query("global"),
    dates: tuple = Depends(get_date_range),
    repo: TicketRepository = Depends(_get_repo),
    svc: MetricsService = Depends(_get_service),
):
    df, dt = dates
    tickets = repo.get_purchase_tickets(df, dt)
    return svc.demandes_urgentes(tickets, dimension)


@router.get("/evolution")
def evolution(
    dimension: str = Query("global"),
    dates: tuple = Depends(get_date_range),
    year: Optional[int] = Query(None),
    repo: TicketRepository = Depends(_get_repo),
    svc: MetricsService = Depends(_get_service),
):
    from datetime import date as d
    df, dt = dates
    tickets = repo.get_purchase_tickets(df, dt)
    return svc.evolution(tickets, dimension, year or d.today().year)