"""
services/metrics_service.py — Calcul de toutes les métriques KPI
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


def _month_key(d: date) -> str:
    return d.strftime("%Y-%m")


def _group_key(ticket: dict, dimension: str) -> str:
    if dimension == "projet":
        return str(ticket.get("_project_name") or "Sans projet")
    if dimension == "acheteur":
        return str(ticket.get("_buyer_name") or "Non assigné")
    return "global"


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


class MetricsService:
    def __init__(self, settings: Settings):
        self._s = settings

    # ── Taux de réalisation ───────────────────────────────────────
    def taux_realisation(self, tickets: list[dict], dimension: str) -> dict:
        groups: dict[str, dict[str, dict]] = {}
        for t in tickets:
            d = _parse_date(t.get("date"))
            if not d:
                continue
            m, k = _month_key(d), _group_key(t, dimension)
            groups.setdefault(k, {}).setdefault(m, {"total": 0, "resolved": 0})
            groups[k][m]["total"] += 1
            if t.get("status") in self._s.resolved_statuses:
                groups[k][m]["resolved"] += 1

        result = {}
        for grp, months in groups.items():
            result[grp] = [
                {
                    "month": m,
                    "total": c["total"],
                    "resolved": c["resolved"],
                    "taux_realisation_pct": round(c["resolved"] / c["total"] * 100, 1) if c["total"] else 0,
                }
                for m, c in sorted(months.items())
            ]

        total_all = sum(r["total"] for g in result.values() for r in g)
        resolved_all = sum(r["resolved"] for g in result.values() for r in g)
        return {
            "dimension": dimension,
            "taux_global_pct": round(resolved_all / total_all * 100, 1) if total_all else 0,
            "total_tickets": total_all,
            "total_resolus": resolved_all,
            "by_group": result,
        }

    # ── Taux de retard ────────────────────────────────────────────
    def taux_retard(self, tickets: list[dict], dimension: str) -> dict:
        groups: dict[str, dict[str, dict]] = {}
        for t in tickets:
            d = _parse_date(t.get("date"))
            if not d:
                continue
            m, k = _month_key(d), _group_key(t, dimension)
            groups.setdefault(k, {}).setdefault(m, {"total": 0, "open": 0, "late": 0})
            groups[k][m]["total"] += 1
            if t.get("status") not in self._s.resolved_statuses:
                groups[k][m]["open"] += 1
                if _is_late(t, self._s.resolved_statuses):
                    groups[k][m]["late"] += 1

        result = {}
        for grp, months in groups.items():
            result[grp] = [
                {
                    "month": m,
                    "total": c["total"],
                    "open": c["open"],
                    "late": c["late"],
                    "taux_retard_pct": round(c["late"] / c["open"] * 100, 1) if c["open"] else 0,
                }
                for m, c in sorted(months.items())
            ]

        open_all = sum(r["open"] for g in result.values() for r in g)
        late_all = sum(r["late"] for g in result.values() for r in g)
        return {
            "dimension": dimension,
            "taux_retard_global_pct": round(late_all / open_all * 100, 1) if open_all else 0,
            "tickets_ouverts": open_all,
            "tickets_en_retard": late_all,
            "by_group": result,
        }

    # ── Taux de rejet ─────────────────────────────────────────────
    def taux_rejet(self, tickets: list[dict], dimension: str) -> dict:
        groups: dict[str, dict[str, dict]] = {}
        for t in tickets:
            d = _parse_date(t.get("date"))
            if not d:
                continue
            m, k = _month_key(d), _group_key(t, dimension)
            groups.setdefault(k, {}).setdefault(m, {"total": 0, "rejected": 0, "deleted": 0})
            groups[k][m]["total"] += 1
            if t.get("_deleted"):
                groups[k][m]["deleted"] += 1
                groups[k][m]["rejected"] += 1
            elif t.get("status") in self._s.rejected_statuses:
                groups[k][m]["rejected"] += 1

        result = {}
        for grp, months in groups.items():
            result[grp] = [
                {
                    "month": m,
                    "total": c["total"],
                    "rejected": c["rejected"],
                    "deleted": c["deleted"],
                    "taux_rejet_pct": round(c["rejected"] / c["total"] * 100, 1) if c["total"] else 0,
                }
                for m, c in sorted(months.items())
            ]

        total_all = sum(r["total"] for g in result.values() for r in g)
        rejected_all = sum(r["rejected"] for g in result.values() for r in g)
        return {
            "dimension": dimension,
            "taux_rejet_global_pct": round(rejected_all / total_all * 100, 1) if total_all else 0,
            "total_tickets": total_all,
            "total_rejetes": rejected_all,
            "by_group": result,
        }

    # ── Délai moyen ───────────────────────────────────────────────
    def delai_moyen(self, tickets: list[dict], dimension: str) -> dict:
        groups: dict[str, dict[str, dict]] = {}
        for t in tickets:
            if t.get("status") not in self._s.resolved_statuses:
                continue
            d = _parse_date(t.get("date"))
            delay = _processing_days(t)
            if not d or delay is None:
                continue
            m, k = _month_key(d), _group_key(t, dimension)
            groups.setdefault(k, {}).setdefault(m, {"total_days": 0.0, "count": 0})
            groups[k][m]["total_days"] += delay
            groups[k][m]["count"] += 1

        result = {}
        for grp, months in groups.items():
            result[grp] = [
                {
                    "month": m,
                    "tickets_resolus": c["count"],
                    "delai_moyen_jours": round(c["total_days"] / c["count"], 1) if c["count"] else 0,
                }
                for m, c in sorted(months.items())
            ]

        total_cnt = sum(r["tickets_resolus"] for g in result.values() for r in g)
        total_days = sum(r["delai_moyen_jours"] * r["tickets_resolus"] for g in result.values() for r in g)
        return {
            "dimension": dimension,
            "delai_moyen_global_jours": round(total_days / total_cnt, 1) if total_cnt else 0,
            "tickets_resolus_total": total_cnt,
            "by_group": result,
        }

    # ── Demandes urgentes ─────────────────────────────────────────
    def demandes_urgentes(self, tickets: list[dict], dimension: str) -> dict:
        groups: dict[str, dict[str, dict]] = {}
        for t in tickets:
            d = _parse_date(t.get("date"))
            if not d:
                continue
            m, k = _month_key(d), _group_key(t, dimension)
            groups.setdefault(k, {}).setdefault(m, {"total": 0, "urgent": 0})
            groups[k][m]["total"] += 1
            if t.get("priority", 0) in self._s.urgent_priorities:
                groups[k][m]["urgent"] += 1

        result = {}
        for grp, months in groups.items():
            result[grp] = [
                {
                    "month": m,
                    "total": c["total"],
                    "urgent": c["urgent"],
                    "taux_urgence_pct": round(c["urgent"] / c["total"] * 100, 1) if c["total"] else 0,
                }
                for m, c in sorted(months.items())
            ]

        urgent_all = sum(r["urgent"] for g in result.values() for r in g)
        total_all = sum(r["total"] for g in result.values() for r in g)
        return {
            "dimension": dimension,
            "urgent_total": urgent_all,
            "taux_urgence_global_pct": round(urgent_all / total_all * 100, 1) if total_all else 0,
            "by_group": result,
        }

    # ── Évolution mensuelle + YTD ─────────────────────────────────
    def evolution(self, tickets: list[dict], dimension: str, year: int) -> dict:
        groups: dict[str, dict[str, dict]] = {}
        for t in tickets:
            d = _parse_date(t.get("date"))
            if not d:
                continue
            m, k = _month_key(d), _group_key(t, dimension)
            groups.setdefault(k, {}).setdefault(m, {"received": 0, "resolved": 0})
            groups[k][m]["received"] += 1
            if t.get("status") in self._s.resolved_statuses:
                groups[k][m]["resolved"] += 1

        result = {}
        for grp, months in groups.items():
            monthly = []
            ytd_recv = ytd_res = 0
            for m, c in sorted(months.items()):
                monthly.append({
                    "month": m,
                    "received": c["received"],
                    "resolved": c["resolved"],
                    "resolution_rate_pct": round(c["resolved"] / c["received"] * 100, 1) if c["received"] else 0,
                })
                if m.startswith(str(year)):
                    ytd_recv += c["received"]
                    ytd_res += c["resolved"]
            result[grp] = {
                "monthly": monthly,
                "ytd": {
                    "year": year,
                    "received": ytd_recv,
                    "resolved": ytd_res,
                    "resolution_rate_pct": round(ytd_res / ytd_recv * 100, 1) if ytd_recv else 0,
                },
            }
        return {"dimension": dimension, "ytd_year": year, "by_group": result}

    # ── Dashboard summary ─────────────────────────────────────────
    def dashboard_summary(self, tickets: list[dict], year: int, df: date | None, dt: date | None) -> dict:
        total = len(tickets)
        resolved = sum(1 for t in tickets if t.get("status") in self._s.resolved_statuses)
        open_cnt = total - resolved
        late = sum(1 for t in tickets if _is_late(t, self._s.resolved_statuses))
        urgent = sum(1 for t in tickets if t.get("priority", 0) in self._s.urgent_priorities)
        rejected = sum(1 for t in tickets if t.get("status") in self._s.rejected_statuses)

        delays = [_processing_days(t) for t in tickets]
        delays = [d for d in delays if d is not None]
        avg_delay = round(sum(delays) / len(delays), 1) if delays else 0

        buyer_vol: dict[str, int] = {}
        for t in tickets:
            b = t.get("_buyer_name", "Non assigné")
            buyer_vol[b] = buyer_vol.get(b, 0) + 1

        proj_vol: dict[str, int] = {}
        for t in tickets:
            p = t.get("_project_name", "Sans projet")
            proj_vol[p] = proj_vol.get(p, 0) + 1

        monthly: dict[str, dict] = {}
        for t in tickets:
            d = _parse_date(t.get("date"))
            if not d or d.year != year:
                continue
            m = _month_key(d)
            monthly.setdefault(m, {"received": 0, "resolved": 0})
            monthly[m]["received"] += 1
            if t.get("status") in self._s.resolved_statuses:
                monthly[m]["resolved"] += 1

        return {
            "period": {"from": str(df) if df else None, "to": str(dt) if dt else None},
            "mode": "mock" if self._s.use_mock_data else "live",
            "kpis": {
                "total_tickets": total,
                "resolved": resolved,
                "open": open_cnt,
                "late": late,
                "urgent": urgent,
                "rejected": rejected,
                "taux_realisation_pct": round(resolved / total * 100, 1) if total else 0,
                "taux_retard_pct": round(late / open_cnt * 100, 1) if open_cnt else 0,
                "taux_rejet_pct": round(rejected / total * 100, 1) if total else 0,
                "taux_urgence_pct": round(urgent / total * 100, 1) if total else 0,
                "delai_moyen_jours": avg_delay,
            },
            "ytd": {
                "year": year,
                "monthly": [{"month": m, **v} for m, v in sorted(monthly.items())],
            },
            "top_buyers": [{"name": b, "count": c} for b, c in sorted(buyer_vol.items(), key=lambda x: -x[1])[:10]],
            "top_projects": [{"name": p, "count": c} for p, c in sorted(proj_vol.items(), key=lambda x: -x[1])[:10]],
        }