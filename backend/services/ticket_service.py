"""
services/ticket_service.py — Filtre, pagination et présentation des tickets
Transforme les dicts bruts du repository en réponses API propres.
"""
from __future__ import annotations

from datetime import date, datetime
from typing import Any, Optional

from core.config import Settings


def _parse_date(val: Any) -> date | None:
    if not val or val in ("NULL", "0000-00-00 00:00:00"):
        return None
    try:
        return datetime.fromisoformat(str(val).replace(" ", "T")).date()
    except ValueError:
        return None


def _is_late(ticket: dict, resolved_statuses: frozenset) -> bool:
    if ticket.get("status") in resolved_statuses:
        return False
    due = _parse_date(ticket.get("time_to_resolve"))
    return bool(due and date.today() > due)


def _processing_days(ticket: dict) -> float | None:
    created = _parse_date(ticket.get("date"))
    if not created:
        return None
    closed = _parse_date(ticket.get("closedate")) or _parse_date(ticket.get("solvedate"))
    return max(0.0, (closed - created).days) if closed else None


class TicketService:
    def __init__(self, settings: Settings):
        self._s = settings

    # ── Sérialisation ─────────────────────────────────────────────
    def _serialize(self, ticket: dict) -> dict:
        """Transforme un ticket brut en dict API uniforme."""
        status = ticket.get("status", 0)
        return {
            "id": ticket.get("id"),
            "name": ticket.get("name", ""),
            "status": status,
            "status_label": self._s.status_map.get(status, "Inconnu"),
            "priority": ticket.get("priority", 0),
            "date_creation": ticket.get("date"),
            "date_resolution": ticket.get("closedate") or ticket.get("solvedate"),
            "date_livraison": ticket.get("_date_livraison") or None,
            "time_to_resolve": ticket.get("time_to_resolve"),
            "is_late": _is_late(ticket, self._s.resolved_statuses),
            "delai_jours": _processing_days(ticket),
            "acheteur": ticket.get("_buyer_name", "Non assigné"),
            "projet": ticket.get("_project_name", "Sans projet"),
            "category_id": ticket.get("itilcategories_id", 0),
            "is_deleted": bool(ticket.get("_deleted", False)),
        }

    # ── Filtres ───────────────────────────────────────────────────
    def filter(
        self,
        tickets: list[dict],
        *,
        projet: Optional[str] = None,
        acheteur: Optional[str] = None,
        status: Optional[int] = None,
        priority: Optional[int] = None,
        urgent_only: bool = False,
        late_only: bool = False,
    ) -> list[dict]:
        result = tickets

        if projet:
            result = [
                t for t in result
                if projet.lower() in (t.get("_project_name") or "").lower()
            ]
        if acheteur:
            result = [
                t for t in result
                if acheteur.lower() in (t.get("_buyer_name") or "").lower()
            ]
        if status is not None:
            result = [t for t in result if t.get("status") == status]
        if priority is not None:
            result = [t for t in result if t.get("priority") == priority]
        if urgent_only:
            result = [
                t for t in result
                if t.get("priority", 0) in self._s.urgent_priorities
            ]
        if late_only:
            result = [
                t for t in result
                if _is_late(t, self._s.resolved_statuses)
            ]

        return result

    # ── Pagination ────────────────────────────────────────────────
    def paginate(
        self,
        tickets: list[dict],
        offset: int = 0,
        limit: int = 100,
    ) -> dict:
        total = len(tickets)
        page = tickets[offset: offset + limit]
        return {
            "total": total,
            "offset": offset,
            "limit": limit,
            "tickets": [self._serialize(t) for t in page],
        }

    # ── Raccourci tout-en-un ──────────────────────────────────────
    def filter_and_paginate(
        self,
        tickets: list[dict],
        *,
        projet: Optional[str] = None,
        acheteur: Optional[str] = None,
        status: Optional[int] = None,
        priority: Optional[int] = None,
        urgent_only: bool = False,
        late_only: bool = False,
        offset: int = 0,
        limit: int = 100,
    ) -> dict:
        filtered = self.filter(
            tickets,
            projet=projet,
            acheteur=acheteur,
            status=status,
            priority=priority,
            urgent_only=urgent_only,
            late_only=late_only,
        )
        return self.paginate(filtered, offset=offset, limit=limit)
