"""
api/routes/referentiels.py — Endpoints référentiels
GET /api/referentiels/acheteurs   → liste des acheteurs
GET /api/referentiels/projets     → liste des projets
GET /api/referentiels/statuts     → table des statuts GLPI
GET /api/referentiels/categories  → catégories ITIL GLPI
GET /api/referentiels/priorites   → table des priorités
"""
from __future__ import annotations

from fastapi import APIRouter, Depends

from core.config import Settings, get_settings
from core.dependencies import get_date_range
from repositories.ticket_repository import TicketRepository
from repositories.referentiel_repository import ReferentielRepository

router = APIRouter(prefix="/api/referentiels", tags=["Référentiels"])


def _get_ticket_repo(settings: Settings = Depends(get_settings)) -> TicketRepository:
    if settings.use_mock_data:
        return TicketRepository(settings)
    from clients.glpi_client import GLPIClient
    return TicketRepository(settings, GLPIClient(settings))


def _get_ref_repo(settings: Settings = Depends(get_settings)) -> ReferentielRepository:
    if settings.use_mock_data:
        return ReferentielRepository(settings)
    from clients.glpi_client import GLPIClient
    return ReferentielRepository(settings, GLPIClient(settings))


@router.get("/acheteurs")
def list_acheteurs(
    dates: tuple = Depends(get_date_range),
    ticket_repo: TicketRepository = Depends(_get_ticket_repo),
    ref_repo: ReferentielRepository = Depends(_get_ref_repo),
):
    """
    Liste des acheteurs présents dans les tickets sur la période donnée.
    Sans filtre de date → tous les acheteurs connus.
    """
    df, dt = dates
    tickets = ticket_repo.get_purchase_tickets(df, dt)
    return {"acheteurs": ref_repo.get_acheteurs(tickets)}


@router.get("/acheteurs/all")
def list_all_acheteurs(
    ref_repo: ReferentielRepository = Depends(_get_ref_repo),
):
    """
    Tous les utilisateurs GLPI actifs (indépendamment des tickets).
    Utile pour remplir les selects de filtres du frontend.
    """
    return {"acheteurs": ref_repo.get_all_acheteurs()}


@router.get("/projets")
def list_projets(
    dates: tuple = Depends(get_date_range),
    ticket_repo: TicketRepository = Depends(_get_ticket_repo),
    ref_repo: ReferentielRepository = Depends(_get_ref_repo),
):
    """
    Liste des projets présents dans les tickets sur la période donnée.
    """
    df, dt = dates
    tickets = ticket_repo.get_purchase_tickets(df, dt)
    return {"projets": ref_repo.get_projets(tickets)}


@router.get("/projets/all")
def list_all_projets(
    ref_repo: ReferentielRepository = Depends(_get_ref_repo),
):
    """Tous les projets GLPI (avec id et name), indépendamment des tickets."""
    return {"projets": ref_repo.get_all_projets()}


@router.get("/statuts")
def list_statuts(
    ref_repo: ReferentielRepository = Depends(_get_ref_repo),
):
    """
    Table complète des statuts GLPI avec flags is_resolved et is_rejected.
    """
    return {"statuts": ref_repo.get_statuts()}


@router.get("/categories")
def list_categories(
    ref_repo: ReferentielRepository = Depends(_get_ref_repo),
):
    """
    Catégories ITIL GLPI — utile pour identifier GLPI_PURCHASE_CATEGORY_ID.
    """
    return {"categories": ref_repo.get_categories()}


@router.get("/priorites")
def list_priorites(
    ref_repo: ReferentielRepository = Depends(_get_ref_repo),
):
    """Table des priorités GLPI avec flag is_urgent."""
    return {"priorites": ref_repo.get_priorites()}
