"""
api/routes/tickets.py — Endpoints tickets
GET /api/tickets           → liste filtrée et paginée
GET /api/tickets/{id}      → détail d'un ticket
GET /api/tickets/alerts    → tickets en retard > seuil
"""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from core.config import Settings, get_settings
from core.dependencies import get_date_range
from repositories.ticket_repository import TicketRepository
from services.ticket_service import TicketService
from services.alert_service import AlertService

router = APIRouter(prefix="/api/tickets", tags=["Tickets"])


def _get_repo(settings: Settings = Depends(get_settings)) -> TicketRepository:
    if settings.use_mock_data:
        return TicketRepository(settings)
    from clients.glpi_client import GLPIClient
    return TicketRepository(settings, GLPIClient(settings))


def _get_ticket_svc(settings: Settings = Depends(get_settings)) -> TicketService:
    return TicketService(settings)


def _get_alert_svc(settings: Settings = Depends(get_settings)) -> AlertService:
    return AlertService(settings)


@router.get("")
def list_tickets(
    dates: tuple = Depends(get_date_range),
    projet: Optional[str] = Query(None, description="Filtre partiel sur le nom du projet"),
    acheteur: Optional[str] = Query(None, description="Filtre partiel sur le nom de l'acheteur"),
    status: Optional[int] = Query(None, description="Filtre exact sur le statut GLPI (1-6)"),
    urgent_only: bool = Query(False, description="Ne retourner que les tickets urgents (priorité 4-6)"),
    late_only: bool = Query(False, description="Ne retourner que les tickets en retard (SLA dépassé)"),
    limit: int = Query(100, ge=1, le=1000, description="Nombre de tickets par page"),
    offset: int = Query(0, ge=0, description="Offset de pagination"),
    repo: TicketRepository = Depends(_get_repo),
    svc: TicketService = Depends(_get_ticket_svc),
):
    """
    Liste paginée des tickets d'achat avec filtres cumulables.
    Tous les filtres sont optionnels et combinables.
    """
    df, dt = dates
    tickets = repo.get_purchase_tickets(df, dt)

    return svc.filter_and_paginate(
        tickets,
        projet=projet,
        acheteur=acheteur,
        status=status,
        urgent_only=urgent_only,
        late_only=late_only,
        offset=offset,
        limit=limit,
    )


@router.get("/alerts")
def tickets_alerts(
    dates: tuple = Depends(get_date_range),
    repo: TicketRepository = Depends(_get_repo),
    svc: AlertService = Depends(_get_alert_svc),
):
    """
    Tickets ouverts depuis plus de N jours (configurable via LATE_THRESHOLD_DAYS, défaut 5).
    Retournés groupés par acheteur, triés par ancienneté décroissante.
    """
    df, dt = dates
    tickets = repo.get_purchase_tickets(df, dt)
    return svc.get_alert_summary(tickets)


@router.get("/{ticket_id}")
def get_ticket(
    ticket_id: int,
    dates: tuple = Depends(get_date_range),
    repo: TicketRepository = Depends(_get_repo),
    svc: TicketService = Depends(_get_ticket_svc),
):
    """Détail d'un ticket par son ID GLPI."""
    df, dt = dates
    tickets = repo.get_purchase_tickets(df, dt)
    match = [t for t in tickets if t.get("id") == ticket_id]

    if not match:
        raise HTTPException(status_code=404, detail=f"Ticket #{ticket_id} introuvable")

    # Sérialisation via TicketService (réutilise _serialize)
    result = svc.filter_and_paginate(match, limit=1)
    return result["tickets"][0]
