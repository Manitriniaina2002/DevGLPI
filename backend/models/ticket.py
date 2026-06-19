"""
api/routes/tickets.py — Endpoints tickets avec filtrage par rôle
================================================================
GET /api/tickets               → liste filtrée selon le rôle
GET /api/tickets/{id}          → détail d'un ticket (accès contrôlé)
GET /api/tickets/{id}/history  → historique (followups / changements)
GET /api/tickets/{id}/workflow → 4 étapes du cycle de vie achat
GET /api/tickets/alerts        → tickets en retard > seuil

Règles d'accès :
  demandeur   → users_id_requester == current_user.user_id
  acheteur    → users_id_assign    == current_user.user_id
  responsable → tous les tickets
"""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from core.config import Settings, get_settings
from core.dependencies import get_date_range
from core.security import CurrentUser, get_current_user, get_current_user_optional
from repositories.ticket_repository import TicketRepository
from services.ticket_service import TicketService
from services.alert_service import AlertService
from services.workflow_service import WorkflowService

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


def _get_workflow_svc(settings: Settings = Depends(get_settings)) -> WorkflowService:
    return WorkflowService(settings)


def _apply_role_filter(
    tickets: list[dict],
    user: Optional[CurrentUser],
    settings: Settings,
) -> list[dict]:
    if user is None or settings.use_mock_data and user is None:
        return tickets
    if user.is_responsable:
        return tickets
    if user.is_acheteur:
        return [t for t in tickets if t.get("users_id_assign") == user.user_id]
    return [t for t in tickets if t.get("users_id_requester") == user.user_id]


# ── Liste ─────────────────────────────────────────────────────────

@router.get("")
def list_tickets(
    dates: tuple = Depends(get_date_range),
    projet: Optional[str] = Query(None),
    acheteur: Optional[str] = Query(None),
    status: Optional[int] = Query(None),
    priority: Optional[int] = Query(None),
    urgent_only: bool = Query(False),
    late_only: bool = Query(False),
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    repo: TicketRepository = Depends(_get_repo),
    svc: TicketService = Depends(_get_ticket_svc),
    settings: Settings = Depends(get_settings),
    user: Optional[CurrentUser] = Depends(get_current_user_optional),
):
    df, dt = dates
    tickets = repo.get_purchase_tickets(df, dt)
    tickets = _apply_role_filter(tickets, user, settings)
    return svc.filter_and_paginate(
        tickets,
        projet=projet,
        acheteur=acheteur,
        status=status,
        priority=priority,
        urgent_only=urgent_only,
        late_only=late_only,
        offset=offset,
        limit=limit,
    )


# ── Alertes ───────────────────────────────────────────────────────

@router.get("/alerts")
def tickets_alerts(
    dates: tuple = Depends(get_date_range),
    repo: TicketRepository = Depends(_get_repo),
    svc: AlertService = Depends(_get_alert_svc),
    settings: Settings = Depends(get_settings),
    user: Optional[CurrentUser] = Depends(get_current_user_optional),
):
    df, dt = dates
    tickets = repo.get_purchase_tickets(df, dt)
    tickets = _apply_role_filter(tickets, user, settings)
    return svc.get_alert_summary(tickets)


# ── Détail ────────────────────────────────────────────────────────

@router.get("/{ticket_id}")
def get_ticket(
    ticket_id: int,
    dates: tuple = Depends(get_date_range),
    repo: TicketRepository = Depends(_get_repo),
    svc: TicketService = Depends(_get_ticket_svc),
    settings: Settings = Depends(get_settings),
    user: Optional[CurrentUser] = Depends(get_current_user_optional),
):
    df, dt = dates
    tickets = repo.get_purchase_tickets(df, dt)
    tickets = _apply_role_filter(tickets, user, settings)
    match = [t for t in tickets if t.get("id") == ticket_id]
    if not match:
        raise HTTPException(status_code=404, detail=f"Ticket #{ticket_id} introuvable ou non accessible")
    result = svc.filter_and_paginate(match, limit=1)
    return result["tickets"][0]


# ── Historique ────────────────────────────────────────────────────

@router.get("/{ticket_id}/history")
def ticket_history(
    ticket_id: int,
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    dates: tuple = Depends(get_date_range),
    repo: TicketRepository = Depends(_get_repo),
    settings: Settings = Depends(get_settings),
    user: Optional[CurrentUser] = Depends(get_current_user_optional),
):
    df, dt = dates
    tickets = repo.get_purchase_tickets(df, dt)
    tickets = _apply_role_filter(tickets, user, settings)
    match = [t for t in tickets if t.get("id") == ticket_id]
    if not match:
        raise HTTPException(status_code=404, detail=f"Ticket #{ticket_id} introuvable ou non accessible")
    history = repo.get_ticket_history(ticket_id)
    total = len(history)
    page = history[offset:offset + limit]
    return {"history": page, "total": total, "offset": offset, "limit": limit}


# ── Workflow (4 étapes) ───────────────────────────────────────────

@router.get("/{ticket_id}/workflow")
def ticket_workflow(
    ticket_id: int,
    dates: tuple = Depends(get_date_range),
    repo: TicketRepository = Depends(_get_repo),
    svc: WorkflowService = Depends(_get_workflow_svc),
    settings: Settings = Depends(get_settings),
    user: Optional[CurrentUser] = Depends(get_current_user_optional),
):
    """
    Retourne les 4 étapes du workflow achat pour un ticket :

      1. **Création**    — date de création + demandeur
      2. **Validation**  — TicketValidation GLPI (done / pending / refused / unknown)
      3. **Attribution** — assignation à un acheteur (depuis les logs ou users_id_assign)
      4. **Résolution**  — clôture (statut 5 ou 6) + date

    Chaque étape expose :
      - `etape`   : identifiant technique (creation / validation / attribution / resolution)
      - `label`   : libellé lisible
      - `statut`  : done | pending | refused | unknown
      - `date`    : date ISO de l'événement (null si non encore atteint)
      - `acteur`  : nom de la personne concernée
      - `detail`  : information complémentaire (commentaire de validation, statut courant…)
    """
    # Contrôle d'accès
    df, dt = dates
    tickets = repo.get_purchase_tickets(df, dt)
    tickets = _apply_role_filter(tickets, user, settings)
    match = [t for t in tickets if t.get("id") == ticket_id]
    if not match:
        raise HTTPException(
            status_code=404,
            detail=f"Ticket #{ticket_id} introuvable ou non accessible",
        )

    ticket = match[0]

    # Logs d'historique (déjà paginés et mis en cache)
    logs_raw = repo.get_ticket_history(ticket_id)

    # Validations GLPI
    validations: list[dict] = []
    if not settings.use_mock_data and repo._client:
        try:
            validations = repo._client.get_all(
                f"Ticket/{ticket_id}/TicketValidation", {}, 200
            )
            if not validations:
                # Fallback si le sous-type n'est pas exposé en sous-ressource
                validations = repo._client.get_all(
                    "TicketValidation",
                    {"searchText[tickets_id]": ticket_id},
                    200,
                )
        except Exception:
            validations = []

    return svc.build_workflow(ticket, logs_raw, validations)