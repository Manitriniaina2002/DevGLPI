"""
models/metrics.py — Schémas Pydantic pour les métriques et KPI
"""
from __future__ import annotations

from typing import Any, Optional
from pydantic import BaseModel


class MonthlyPoint(BaseModel):
    month: str
    total: int = 0
    resolved: int = 0
    taux_realisation_pct: float = 0.0


class RetardPoint(BaseModel):
    month: str
    total: int = 0
    open: int = 0
    late: int = 0
    taux_retard_pct: float = 0.0


class RejetPoint(BaseModel):
    month: str
    total: int = 0
    rejected: int = 0
    deleted: int = 0
    taux_rejet_pct: float = 0.0


class DelaiPoint(BaseModel):
    month: str
    tickets_resolus: int = 0
    delai_moyen_jours: float = 0.0


class UrgencePoint(BaseModel):
    month: str
    total: int = 0
    urgent: int = 0
    taux_urgence_pct: float = 0.0


class EvolutionPoint(BaseModel):
    month: str
    received: int = 0
    resolved: int = 0
    resolution_rate_pct: float = 0.0


class YTDSummary(BaseModel):
    year: int
    received: int = 0
    resolved: int = 0
    resolution_rate_pct: float = 0.0


class EvolutionGroup(BaseModel):
    monthly: list[EvolutionPoint]
    ytd: YTDSummary


class KPISummary(BaseModel):
    total_tickets: int = 0
    resolved: int = 0
    open: int = 0
    late: int = 0
    urgent: int = 0
    rejected: int = 0
    taux_realisation_pct: float = 0.0
    taux_retard_pct: float = 0.0
    taux_rejet_pct: float = 0.0
    taux_urgence_pct: float = 0.0
    delai_moyen_jours: float = 0.0


class TopItem(BaseModel):
    name: str
    count: int


class YTDMonthly(BaseModel):
    year: int
    monthly: list[dict]


class DashboardSummary(BaseModel):
    period: dict
    mode: str
    kpis: KPISummary
    ytd: YTDMonthly
    top_buyers: list[TopItem]
    top_projects: list[TopItem]


class AlertTicket(BaseModel):
    id: int
    name: str
    acheteur: str
    projet: str
    date_creation: Optional[str]
    jours_en_cours: int
    status_label: str