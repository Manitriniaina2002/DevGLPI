"""
api/routes/export.py — Endpoint export Excel
GET /api/export/excel  → fichier .xlsx des tickets avec métriques
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from fastapi.responses import Response

from core.config import Settings, get_settings
from core.dependencies import get_date_range
from repositories.ticket_repository import TicketRepository
from services.export_service import ExportService

router = APIRouter(prefix="/api/export", tags=["Export"])


def _get_repo(settings: Settings = Depends(get_settings)) -> TicketRepository:
    if settings.use_mock_data:
        return TicketRepository(settings)
    from clients.glpi_client import GLPIClient
    return TicketRepository(settings, GLPIClient(settings))


def _get_export_svc(settings: Settings = Depends(get_settings)) -> ExportService:
    return ExportService(settings)


@router.get("/excel")
def export_excel(
    dates: tuple = Depends(get_date_range),
    include_deleted: bool = Query(False, description="Inclure les tickets supprimés"),
    repo: TicketRepository = Depends(_get_repo),
    svc: ExportService = Depends(_get_export_svc),
):
    """
    Génère et retourne un fichier Excel (.xlsx) contenant :
    - Feuille « Tickets » : tous les tickets de la période avec leurs métriques
    - Feuille « Résumé »  : KPI globaux et date d'export

    Le fichier est retourné directement en binaire (Content-Disposition: attachment).
    """
    from datetime import date

    df, dt = dates
    tickets = repo.get_purchase_tickets(df, dt)

    if include_deleted:
        deleted = repo.get_deleted_tickets(df, dt)
        tickets = tickets + deleted

    xlsx_bytes = svc.export_tickets_excel(tickets)

    # Nom de fichier dynamique selon la période
    period = ""
    if df and dt:
        period = f"_{df}_{dt}"
    elif df:
        period = f"_depuis_{df}"
    elif dt:
        period = f"_jusqu_{dt}"

    filename = f"tickets_achat{period}_{date.today()}.xlsx"

    return Response(
        content=xlsx_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
