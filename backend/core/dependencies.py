"""
core/dependencies.py — Injection de dépendances FastAPI
"""
from __future__ import annotations

from datetime import date, datetime
from typing import Optional

from fastapi import Depends, HTTPException, Query

from core.config import Settings, get_settings


def get_date_range(
    date_from: Optional[str] = Query(None, description="Date début YYYY-MM-DD"),
    date_to: Optional[str] = Query(None, description="Date fin YYYY-MM-DD"),
) -> tuple[date | None, date | None]:
    try:
        df = datetime.strptime(date_from, "%Y-%m-%d").date() if date_from else None
        dt = datetime.strptime(date_to, "%Y-%m-%d").date() if date_to else None
    except ValueError as e:
        raise HTTPException(status_code=422, detail=f"Format de date invalide : {e}")
    return df, dt


SettingsDep = Depends(get_settings)
DateRangeDep = Depends(get_date_range)