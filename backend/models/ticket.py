"""
models/ticket.py — Schémas Pydantic pour les tickets
"""
from __future__ import annotations

from datetime import date, datetime
from typing import Any, Optional

from pydantic import BaseModel, field_validator


class TicketRaw(BaseModel):
    """Ticket tel que retourné par l'API GLPI."""
    id: int
    name: str = ""
    status: int = 1
    priority: int = 3
    date: Optional[str] = None
    closedate: Optional[str] = None
    solvedate: Optional[str] = None
    time_to_resolve: Optional[str] = None
    itilcategories_id: int = 0
    users_id_assign: int = 0
    users_id_requester: int = 0
    projects_id: int = 0
    entities_id: int = 0

    model_config = {"extra": "allow"}


class TicketEnriched(BaseModel):
    """Ticket enrichi avec noms acheteur et projet."""
    id: int
    name: str = ""
    status: int = 1
    status_label: str = ""
    priority: int = 3
    date_creation: Optional[str] = None
    date_resolution: Optional[str] = None
    time_to_resolve: Optional[str] = None
    is_late: bool = False
    delai_jours: Optional[float] = None
    acheteur: str = "Non assigné"
    projet: str = "Sans projet"
    category_id: int = 0
    is_deleted: bool = False

    model_config = {"extra": "allow"}


class TicketListResponse(BaseModel):
    total: int
    offset: int
    limit: int
    tickets: list[TicketEnriched]