"""
services/alert_service.py — Alertes tickets en retard
Tickets en statut "En cours" depuis plus de N jours sans mise à jour.
"""
from __future__ import annotations

from datetime import date, datetime
from typing import Any

from core.config import Settings


def _parse_date(val: Any) -> date | None:
    if not val or val in ("NULL", "0000-00-00 00:00:00"):
        return None
    try:
        return datetime.fromisoformat(str(val).replace(" ", "T")).date()
    except ValueError:
        return None


class AlertService:
    def __init__(self, settings: Settings):
        self._s = settings

    def get_late_tickets(self, tickets: list[dict]) -> list[dict]:
        """
        Retourne les tickets ouverts depuis plus de N jours (défaut: 5).
        Ces tickets nécessitent un rappel à l'acheteur.
        """
        today = date.today()
        threshold = self._s.late_threshold_days
        alerts = []

        for t in tickets:
            if t.get("status") in self._s.resolved_statuses:
                continue

            created = _parse_date(t.get("date"))
            if not created:
                continue

            jours = (today - created).days
            if jours >= threshold:
                alerts.append({
                    "id": t.get("id"),
                    "name": t.get("name", ""),
                    "acheteur": t.get("_buyer_name", "Non assigné"),
                    "projet": t.get("_project_name", "Sans projet"),
                    "date_creation": t.get("date"),
                    "jours_en_cours": jours,
                    "status": t.get("status"),
                    "status_label": self._s.status_map.get(t.get("status", 0), "Inconnu"),
                    "priority": t.get("priority", 0),
                })

        return sorted(alerts, key=lambda x: -x["jours_en_cours"])

    def get_alert_summary(self, tickets: list[dict]) -> dict:
        """Résumé des alertes par acheteur."""
        late = self.get_late_tickets(tickets)
        by_buyer: dict[str, list] = {}
        for t in late:
            b = t["acheteur"]
            by_buyer.setdefault(b, []).append(t)

        return {
            "total_alerts": len(late),
            "threshold_days": self._s.late_threshold_days,
            "by_buyer": [
                {
                    "acheteur": buyer,
                    "count": len(items),
                    "tickets": items,
                }
                for buyer, items in sorted(by_buyer.items(), key=lambda x: -len(x[1]))
            ],
        }