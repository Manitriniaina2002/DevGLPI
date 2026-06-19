"""
api/routes/tickets.py — Endpoints tickets avec filtrage par rôle
================================================================
GET /api/tickets           → liste filtrée selon le rôle de l'utilisateur
GET /api/tickets/{id}      → détail d'un ticket (accès contrôlé)
GET /api/tickets/alerts    → tickets en retard > seuil

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


def _apply_role_filter(
    tickets: list[dict],
    user: Optional[CurrentUser],
    settings: Settings,
) -> list[dict]:
    """
    Filtre les tickets selon le rôle de l'utilisateur.
    En mode mock sans utilisateur authentifié, retourne tout (compatibilité dev).
    """
    if user is None or settings.use_mock_data and user is None:
        return tickets

    if user.is_responsable:
        # Voit tout
        return tickets

    if user.is_acheteur:
        # Ne voit que les tickets qui lui sont assignés
        return [
            t for t in tickets
            if t.get("users_id_assign") == user.user_id
        ]

    # demandeur : ne voit que ses propres demandes
    return [
        t for t in tickets
        if t.get("users_id_requester") == user.user_id
    ]


@router.get("")
def list_tickets(
    dates: tuple = Depends(get_date_range),
    projet: Optional[str] = Query(None, description="Filtre partiel sur le nom du projet"),
    acheteur: Optional[str] = Query(None, description="Filtre partiel sur le nom de l'acheteur"),
    status: Optional[int] = Query(None, description="Filtre exact sur le statut GLPI (1-6)"),
    priority: Optional[int] = Query(None, description="Filtre exact sur la priorité GLPI (1-6)"),
    urgent_only: bool = Query(False, description="Ne retourner que les tickets urgents (priorité 4-6)"),
    late_only: bool = Query(False, description="Ne retourner que les tickets en retard (SLA dépassé)"),
    limit: int = Query(100, ge=1, le=1000, description="Nombre de tickets par page"),
    offset: int = Query(0, ge=0, description="Offset de pagination"),
    repo: TicketRepository = Depends(_get_repo),
    svc: TicketService = Depends(_get_ticket_svc),
    settings: Settings = Depends(get_settings),
    user: Optional[CurrentUser] = Depends(get_current_user_optional),
):
    """
    Liste paginée des tickets d'achat avec filtres cumulables.
    Le périmètre visible dépend du rôle de l'utilisateur authentifié.
    """
    df, dt = dates
    tickets = repo.get_purchase_tickets(df, dt)

    # Filtrage par rôle (demandeur/acheteur/responsable)
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


@router.get("/alerts")
def tickets_alerts(
    dates: tuple = Depends(get_date_range),
    repo: TicketRepository = Depends(_get_repo),
    svc: AlertService = Depends(_get_alert_svc),
    settings: Settings = Depends(get_settings),
    user: Optional[CurrentUser] = Depends(get_current_user_optional),
):
    """
    Tickets ouverts depuis plus de N jours (configurable via LATE_THRESHOLD_DAYS, défaut 5).
    Retournés groupés par acheteur, triés par ancienneté décroissante.
    Filtrés selon le rôle de l'utilisateur.
    """
    df, dt = dates
    tickets = repo.get_purchase_tickets(df, dt)
    tickets = _apply_role_filter(tickets, user, settings)
    return svc.get_alert_summary(tickets)


@router.get("/{ticket_id}")
def get_ticket(
    ticket_id: int,
    dates: tuple = Depends(get_date_range),
    repo: TicketRepository = Depends(_get_repo),
    svc: TicketService = Depends(_get_ticket_svc),
    settings: Settings = Depends(get_settings),
    user: Optional[CurrentUser] = Depends(get_current_user_optional),
):
    """Détail d'un ticket par son ID GLPI. Accès contrôlé par rôle."""
    df, dt = dates
    tickets = repo.get_purchase_tickets(df, dt)
    tickets = _apply_role_filter(tickets, user, settings)

    match = [t for t in tickets if t.get("id") == ticket_id]

    if not match:
        raise HTTPException(status_code=404, detail=f"Ticket #{ticket_id} introuvable ou non accessible")

    result = svc.filter_and_paginate(match, limit=1)
    return result["tickets"][0]


@router.get("/{ticket_id}/workflow")
def ticket_workflow(
    ticket_id: int,
    dates: tuple = Depends(get_date_range),
    repo: TicketRepository = Depends(_get_repo),
    svc: WorkflowService = Depends(lambda: WorkflowService()),
    settings: Settings = Depends(get_settings),
    user: Optional[CurrentUser] = Depends(get_current_user_optional),
):
    """
    Retourne les 5 étapes du cycle de vie achat pour un ticket :

      1. **Création**    — date de création + demandeur
      2. **Validation**  — TicketValidation GLPI (done / pending / refused / unknown)
      3. **Attribution** — assignation à un acheteur (depuis les logs ou users_id_assign)
      4. **Solution**    — ajout d'une solution (log ITILSolution / linked_action=17)
      5. **Résolution**  — clôture (statut 5 ou 6) + date

    Les noms d'acteurs (validateur, créateur, acheteur assigné…) sont résolus
    via l'annuaire GLPI (TicketRepository.get_users()) pour éviter les
    placeholders type "User #2".
    """
    df, dt = dates
    tickets = repo.get_purchase_tickets(df, dt)
    tickets = _apply_role_filter(tickets, user, settings)
    match = [t for t in tickets if t.get("id") == ticket_id]

    if not match:
        raise HTTPException(status_code=404, detail=f"Ticket #{ticket_id} introuvable ou non accessible")

    ticket = match[0]

    # Logs / historique
    logs_raw = repo.get_ticket_history(ticket_id)

    # Validations GLPI (si possible via client)
    validations: list[dict] = []
    try:
        if not settings.use_mock_data and getattr(repo, "_client", None):
            # Délégation via client : méthode dédiée
            validations = repo._client.get_ticket_validations(ticket_id)
    except Exception:
        validations = []

    # Annuaire utilisateurs GLPI (id → nom complet) pour résoudre les acteurs
    # affichés dans le workflow (validateur, créateur, acheteur assigné...).
    # En mode mock, pas d'annuaire GLPI réel disponible.
    users: dict[int, str] = {}
    if not settings.use_mock_data:
        try:
            users = repo.get_users()
        except Exception:
            users = {}

    return svc.build_workflow(ticket, logs_raw, validations, users=users)


@router.get("/{ticket_id}/history")
def ticket_history(
    ticket_id: int,
    limit: int = Query(100, ge=1, le=1000, description="Nombre de lignes d'historique par page"),
    offset: int = Query(0, ge=0, description="Décalage de pagination"),
    dates: tuple = Depends(get_date_range),
    repo: TicketRepository = Depends(_get_repo),
    settings: Settings = Depends(get_settings),
    user: Optional[CurrentUser] = Depends(get_current_user_optional),
):
    """
    Retourne l'historique (followups / changements) d'un ticket si l'utilisateur y a accès.
    """
    df, dt = dates
    tickets = repo.get_purchase_tickets(df, dt)
    tickets = _apply_role_filter(tickets, user, settings)

    match = [t for t in tickets if t.get("id") == ticket_id]

    if not match:
        raise HTTPException(status_code=404, detail=f"Ticket #{ticket_id} introuvable ou non accessible")

    history = repo.get_ticket_history(ticket_id)
    total = len(history)
    page = history[offset:offset + limit]
    return {
        "history": page,
        "total": total,
        "offset": offset,
        "limit": limit,
    }