"""
Dashboard Achat GLPI — Backend FastAPI
========================================
Adapté à la vraie architecture du projet dashbord-achat :

  Stack projet :
    docker-compose.yml (ce repo)
      ├── postgres:16-alpine  → postgresql://dashboard:dashboard@postgres:5432/dashboard_achat
      └── backend (ce service) → port 8000

  Stack GLPI (docker-compose.glpi.local.yml, réseau séparé) :
      ├── glpi (new-glpi)  → expose :80 sur glpi-frontend
      ├── nginx (glpi-nginx) → hôte 1080:80 / 1443:443
      └── base (glpi-db)   → MySQL interne uniquement

  Connexion inter-stacks :
    docker compose -f docker-compose.yml -f docker-compose.glpi.local.yml up -d
    → GLPI_BASE_URL=http://nginx  (hostname Docker interne nginx GLPI)

  Auth GLPI :
    - App-Token  : GLPI_APP_TOKEN  (généré via regen_token.php)
    - User-Token : GLPI_USER_TOKEN (token personnel GLPI, pas user/password)
    - USE_MOCK_DATA=true  → données simulées (dev sans GLPI)
    - USE_MOCK_DATA=false → API GLPI réelle

  Métriques :
    Taux de réalisation, retard, rejet/suppression,
    délai moyen, demandes urgentes, évolution mensuelle + YTD
    — tout queryable par dimension : global / projet / acheteur / date
"""

from __future__ import annotations

import os
import logging
from datetime import datetime, date, timedelta
from typing import Any, Optional

import requests
import urllib3
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query, Depends
from fastapi.middleware.cors import CORSMiddleware

# ─────────────────────────────────────────────────────────────────
# Initialisation
# ─────────────────────────────────────────────────────────────────
load_dotenv()
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
)
log = logging.getLogger("glpi-dashboard")

# ─────────────────────────────────────────────────────────────────
# Configuration (variables d'environnement du docker-compose.yml)
# ─────────────────────────────────────────────────────────────────

# Mode mock : USE_MOCK_DATA=true → pas besoin de GLPI (dev local)
USE_MOCK_DATA = os.getenv("USE_MOCK_DATA", "true").lower() == "true"

# GLPI — URL interne Docker ou hôte selon le mode de déploiement
# Inter-stacks Docker : http://nginx  (hostname du service nginx GLPI)
# Hôte direct         : http://localhost:1080
# Distant             : http://IP_SERVEUR:1080
GLPI_BASE_URL = os.getenv("GLPI_BASE_URL", "http://nginx").rstrip("/")
GLPI_URL      = f"{GLPI_BASE_URL}/apirest.php"

# Auth GLPI par tokens (généré via regen_token.php pour APP_TOKEN)
GLPI_APP_TOKEN  = os.getenv("GLPI_APP_TOKEN", "")
GLPI_USER_TOKEN = os.getenv("GLPI_USER_TOKEN", "")  # Token personnel GLPI

# PostgreSQL (persistance locale — cache / historique)
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://dashboard:dashboard@postgres:5432/dashboard_achat")

# CORS — liste JSON des origines autorisées
import json
_cors_raw = os.getenv("CORS_ORIGINS", '["http://localhost:3000","http://127.0.0.1:3000"]')
try:
    CORS_ORIGINS: list[str] = json.loads(_cors_raw)
except Exception:
    CORS_ORIGINS = ["*"]

# Fuseau horaire serveur
os.environ.setdefault("TZ", "Indian/Antananarivo")
try:
    import time; time.tzset()
except AttributeError:
    pass

# ─────────────────────────────────────────────────────────────────
# Constantes métier GLPI
# ─────────────────────────────────────────────────────────────────
STATUS_MAP = {
    1: "Nouveau",
    2: "En cours (assigné)",
    3: "En cours (planifié)",
    4: "En attente",
    5: "Résolu",
    6: "Clos",
}
RESOLVED_STATUSES  = {5, 6}    # Ticket "réalisé"
REJECTED_STATUSES  = {6}       # ⚠ À ajuster selon workflow GLPI réel
URGENT_PRIORITIES  = {4, 5, 6} # Haute / Très haute / Majeure

# ID catégorie GLPI « Demande d'achat » (0 = détection par mots-clés)
PURCHASE_CATEGORY_ID: Optional[int] = (
    int(os.getenv("GLPI_PURCHASE_CATEGORY_ID", "0")) or None
)

# ─────────────────────────────────────────────────────────────────
# Application FastAPI
# ─────────────────────────────────────────────────────────────────
import sys
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
app = FastAPI(
    title="Dashboard Achat GLPI",
    version="3.0.0",
    description=(
        "API analytique pour le suivi des demandes d'achat. "
        "Supporte le mode mock (USE_MOCK_DATA=true) et l'API GLPI réelle."
    ),
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─────────────────────────────────────────────────────────────────
# Couche GLPI REST — session avec User-Token (pas user/password)
# ─────────────────────────────────────────────────────────────────
class GLPIClient:
    """
    Client GLPI REST authentifié par User-Token.
    Le App-Token est généré via regen_token.php et stocké chiffré en base.
    Cf. https://glpi-user-documentation.readthedocs.io/fr/latest/modules/configuration/generalconfig/api.html
    """

    def __init__(self):
        self._session_token: str | None = None
        self._expires_at: datetime = datetime.min

    def _init_session(self) -> str:
        """Ouvre une session GLPI avec le User-Token personnel."""
        if not GLPI_APP_TOKEN:
            raise HTTPException(
                status_code=503,
                detail="GLPI_APP_TOKEN non configuré. Générez-le via regen_token.php.",
            )
        if not GLPI_USER_TOKEN:
            raise HTTPException(
                status_code=503,
                detail="GLPI_USER_TOKEN non configuré. Créez un token dans GLPI → Profil → API.",
            )

        resp = requests.get(
            f"{GLPI_URL}/initSession",
            headers={
                "Content-Type":  "application/json",
                "App-Token":     GLPI_APP_TOKEN,
                "Authorization": f"user_token {GLPI_USER_TOKEN}",
            },
            verify=False,  # cert auto-signé nginx
            timeout=15,
        )

        if resp.status_code != 200:
            raise HTTPException(
                status_code=502,
                detail=f"Échec initSession GLPI ({resp.status_code}) : {resp.text[:300]}",
            )

        token = resp.json().get("session_token")
        if not token:
            raise HTTPException(status_code=502, detail="session_token vide dans la réponse GLPI")

        log.info("Session GLPI ouverte via %s", GLPI_URL)
        return token

    def _ensure(self):
        if not self._session_token or datetime.utcnow() >= self._expires_at:
            self._session_token = self._init_session()
            self._expires_at = datetime.utcnow() + timedelta(minutes=50)

    def _headers(self) -> dict:
        self._ensure()
        return {
            "Content-Type":  "application/json",
            "App-Token":     GLPI_APP_TOKEN,
            "Session-Token": self._session_token,
        }

    def _get(self, endpoint: str, params: dict | None = None) -> requests.Response:
        return requests.get(
            f"{GLPI_URL}/{endpoint}",
            headers=self._headers(),
            params=params or {},
            verify=False,
            timeout=30,
        )

    def get_all(self, endpoint: str, params: dict | None = None, page_size: int = 500) -> list[dict]:
        """Récupère tous les enregistrements en gérant la pagination GLPI (206 Partial)."""
        items: list[dict] = []
        offset = 0
        base = dict(params or {})

        while True:
            base["range"] = f"{offset}-{offset + page_size - 1}"
            resp = self._get(endpoint, base)

            if resp.status_code == 401:
                # Token expiré → reset + retry une fois
                self._session_token = None
                resp = self._get(endpoint, base)

            if resp.status_code in (200, 206):
                data = resp.json()
                if not isinstance(data, list):
                    break
                items.extend(data)
                if resp.status_code == 200 or len(data) < page_size:
                    break  # dernière page
                offset += page_size
                continue

            log.warning("GET %s → HTTP %s : %s", endpoint, resp.status_code, resp.text[:200])
            break

        return items

    def get_one(self, endpoint: str, item_id: int) -> dict:
        resp = self._get(f"{endpoint}/{item_id}")
        return resp.json() if resp.ok else {}


glpi = GLPIClient()


# ─────────────────────────────────────────────────────────────────
# Données mock (USE_MOCK_DATA=true)
# ─────────────────────────────────────────────────────────────────
def _generate_mock_tickets() -> list[dict]:
    """Génère ~120 tickets de test réalistes pour le dev sans GLPI."""
    import random, hashlib

    rng = random.Random(42)
    acheteurs = [
        (10, "Rakoto Jean"),
        (11, "Rasoa Marie"),
        (12, "Rabe Paul"),
        (13, "Randria Hery"),
        (14, "Rakotondrabe Solo"),
    ]
    projets = [
        (1, "Projet Alpha"),
        (2, "Projet Beta"),
        (3, "Infrastructure IT"),
        (4, "Fournitures Bureau"),
        (0, "Sans projet"),
    ]
    keywords = ["Achat ", "Commande ", "Approvisionement ", "Fourniture "]
    items = ["PC portable", "Écran", "Clavier", "Souris", "Imprimante", "Câbles réseau",
             "Serveur NAS", "Switch 24 ports", "UPS", "Bureau", "Chaise ergonomique"]

    tickets = []
    base_date = date(2024, 1, 1)
    for i in range(1, 121):
        created = base_date + timedelta(days=rng.randint(0, 540))
        uid, uname = rng.choice(acheteurs)
        pid, pname = rng.choice(projets)
        status = rng.choices([1, 2, 3, 4, 5, 6], weights=[5, 15, 10, 8, 45, 17])[0]
        priority = rng.choices([1, 2, 3, 4, 5, 6], weights=[5, 20, 35, 25, 10, 5])[0]

        closedate = None
        if status in RESOLVED_STATUSES:
            closedate = created + timedelta(days=rng.randint(1, 30))

        # SLA : deadline 15 jours après création
        ttr = created + timedelta(days=15)

        tickets.append({
            "id": i,
            "name": rng.choice(keywords) + rng.choice(items) + f" #{i:03d}",
            "status": status,
            "priority": priority,
            "date": str(created) + " 08:00:00",
            "closedate": str(closedate) + " 17:00:00" if closedate else None,
            "solvedate": str(closedate) + " 16:00:00" if closedate else None,
            "time_to_resolve": str(ttr) + " 17:00:00",
            "itilcategories_id": 1,  # catégorie achat simulée
            "users_id_assign": uid,
            "users_id_requester": uid,
            "projects_id": pid,
            "_project_name": pname,
            "_buyer_name": uname,
        })

    return tickets


# ─────────────────────────────────────────────────────────────────
# Helpers communs
# ─────────────────────────────────────────────────────────────────
def _parse_date(val: Any) -> date | None:
    if not val or val in ("NULL", "0000-00-00 00:00:00"):
        return None
    try:
        return datetime.fromisoformat(str(val).replace(" ", "T")).date()
    except ValueError:
        return None


def _is_purchase(ticket: dict) -> bool:
    if USE_MOCK_DATA:
        return True
    if PURCHASE_CATEGORY_ID:
        return ticket.get("itilcategories_id") == PURCHASE_CATEGORY_ID
    name = (ticket.get("name") or "").lower()
    return any(k in name for k in ("achat", "purchase", "commande", "approvision", "fourniture"))


def _is_late(ticket: dict) -> bool:
    if ticket.get("status") in RESOLVED_STATUSES:
        return False
    due = _parse_date(ticket.get("time_to_resolve"))
    return bool(due and date.today() > due)


def _processing_days(ticket: dict) -> float | None:
    created = _parse_date(ticket.get("date"))
    if not created:
        return None
    closed = _parse_date(ticket.get("closedate")) or _parse_date(ticket.get("solvedate"))
    return max(0.0, (closed - created).days) if closed else None


def _month_key(d: date) -> str:
    return d.strftime("%Y-%m")


def _group_key(ticket: dict, dimension: str) -> str:
    if dimension == "projet":
        return str(ticket.get("_project_name") or "Sans projet")
    if dimension == "acheteur":
        return str(ticket.get("_buyer_name") or "Non assigné")
    return "global"


def _apply_date_filter(tickets: list[dict], df: date | None, dt: date | None) -> list[dict]:
    if not df and not dt:
        return tickets
    out = []
    for t in tickets:
        d = _parse_date(t.get("date"))
        if d is None:
            continue
        if df and d < df:
            continue
        if dt and d > dt:
            continue
        out.append(t)
    return out


# ─────────────────────────────────────────────────────────────────
# Enrichissement des tickets (noms projets & acheteurs)
# ─────────────────────────────────────────────────────────────────
def _enrich(tickets: list[dict]) -> list[dict]:
    """Ajoute _project_name et _buyer_name depuis les API GLPI."""
    if USE_MOCK_DATA:
        return tickets  # déjà enrichis dans le mock

    # Cache projets
    projects: dict[int, str] = {0: "Sans projet"}
    for p in glpi.get_all("Project", {"fields": "id,name"}):
        projects[p["id"]] = p.get("name", "")

    # Cache utilisateurs
    users: dict[int, str] = {0: "Non assigné"}
    for u in glpi.get_all("User", {"fields": "id,name,realname,firstname"}):
        uid = u["id"]
        full = " ".join(filter(None, [u.get("firstname"), u.get("realname")])) or u.get("name", str(uid))
        users[uid] = full

    for t in tickets:
        pid = t.get("projects_id") or 0
        t["_project_name"] = projects.get(pid, f"Projet #{pid}")
        uid = t.get("users_id_assign") or t.get("users_id_requester") or 0
        t["_buyer_name"] = users.get(uid, f"User #{uid}")

    return tickets


# ─────────────────────────────────────────────────────────────────
# Point d'entrée central : récupérer les tickets d'achat
# ─────────────────────────────────────────────────────────────────
def _fetch_tickets(df: date | None = None, dt: date | None = None) -> list[dict]:
    if USE_MOCK_DATA:
        tickets = _generate_mock_tickets()
    else:
        params: dict[str, Any] = {"is_deleted": 0, "sort": "date", "order": "ASC"}
        if PURCHASE_CATEGORY_ID:
            params["searchText[itilcategories_id]"] = PURCHASE_CATEGORY_ID
        raw = glpi.get_all("Ticket", params)
        tickets = [t for t in raw if _is_purchase(t)]
        tickets = _enrich(tickets)

    return _apply_date_filter(tickets, df, dt)


def _fetch_tickets_with_deleted(df: date | None, dt: date | None) -> list[dict]:
    """Récupère tickets normaux + supprimés (pour le taux de rejet)."""
    normal = _fetch_tickets(df, dt)
    if USE_MOCK_DATA:
        return normal  # mock intègre déjà des rejets via statut

    params: dict[str, Any] = {"is_deleted": 1}
    if PURCHASE_CATEGORY_ID:
        params["searchText[itilcategories_id]"] = PURCHASE_CATEGORY_ID
    deleted_raw = glpi.get_all("Ticket", params)
    deleted = [t for t in deleted_raw if _is_purchase(t)]
    deleted = _apply_date_filter(deleted, df, dt)
    for t in deleted:
        t["_deleted"] = True
    deleted = _enrich(deleted)
    return normal + deleted


# ─────────────────────────────────────────────────────────────────
# Dépendance FastAPI : parse des dates
# ─────────────────────────────────────────────────────────────────
def date_range(
    date_from: Optional[str] = Query(None, description="Date début YYYY-MM-DD"),
    date_to:   Optional[str] = Query(None, description="Date fin YYYY-MM-DD"),
) -> tuple[date | None, date | None]:
    try:
        df = datetime.strptime(date_from, "%Y-%m-%d").date() if date_from else None
        dt = datetime.strptime(date_to,   "%Y-%m-%d").date() if date_to   else None
    except ValueError as e:
        raise HTTPException(status_code=422, detail=f"Format de date invalide : {e}")
    return df, dt


# ═══════════════════════════════════════════════════════════════════
#  ENDPOINTS
# ═══════════════════════════════════════════════════════════════════

# ── 0. Santé ──────────────────────────────────────────────────────
@app.get("/health", tags=["Système"])
def health():
    glpi_ok, glpi_error, glpi_version = False, None, None
    if not USE_MOCK_DATA:
        try:
            resp = requests.get(
                GLPI_URL,
                headers={"App-Token": GLPI_APP_TOKEN, "Content-Type": "application/json"},
                verify=False, timeout=5,
            )
            glpi_ok = resp.ok
            if glpi_ok:
                glpi_version = resp.json().get("api_version")
        except requests.exceptions.ConnectionError:
            glpi_error = f"Connexion refusée — GLPI_BASE_URL={GLPI_BASE_URL}"
        except Exception as e:
            glpi_error = str(e)
    else:
        glpi_ok = True

    return {
        "status": "ok" if glpi_ok else "degraded",
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "timezone": "Indian/Antananarivo (UTC+3)",
        "mode": "mock" if USE_MOCK_DATA else "glpi_live",
        "glpi": {
            "base_url": GLPI_BASE_URL,
            "api_url":  GLPI_URL,
            "reachable": glpi_ok,
            "version":   glpi_version,
            "error":     glpi_error,
        },
        "auth": {
            "method":          "User-Token + App-Token",
            "app_token_set":   bool(GLPI_APP_TOKEN),
            "user_token_set":  bool(GLPI_USER_TOKEN),
        },
    }


@app.get("/api/config", tags=["Système"])
def get_config():
    return {
        "mode":                 "mock" if USE_MOCK_DATA else "live",
        "glpi_base_url":        GLPI_BASE_URL,
        "purchase_category_id": PURCHASE_CATEGORY_ID,
        "resolved_statuses":    sorted(RESOLVED_STATUSES),
        "rejected_statuses":    sorted(REJECTED_STATUSES),
        "urgent_priorities":    sorted(URGENT_PRIORITIES),
        "status_map":           STATUS_MAP,
        "cors_origins":         CORS_ORIGINS,
        "docker": {
            "backend_network":  "dashbord-achat (postgres + backend)",
            "glpi_network":     "glpi-frontend + glpi-backend (stack séparée)",
            "glpi_hostname":    "nginx (via merge docker-compose) ou localhost:1080",
            "auth":             "User-Token / App-Token (regen_token.php)",
        },
    }


# ── 1. Taux de réalisation ────────────────────────────────────────
@app.get("/api/metrics/taux-realisation", tags=["Métriques"])
def taux_realisation(
    dimension: str = Query("global", description="global | projet | acheteur"),
    dates: tuple = Depends(date_range),
):
    """
    Taux de réalisation = tickets résolus / total × 100
    Retourné par mois pour chaque valeur de la dimension choisie.
    """
    df, dt = dates
    tickets = _fetch_tickets(df, dt)
    groups: dict[str, dict[str, dict]] = {}

    for t in tickets:
        d = _parse_date(t.get("date"))
        if not d:
            continue
        m = _month_key(d)
        k = _group_key(t, dimension)
        groups.setdefault(k, {}).setdefault(m, {"total": 0, "resolved": 0})
        groups[k][m]["total"] += 1
        if t.get("status") in RESOLVED_STATUSES:
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

    total_all    = sum(r["total"]    for g in result.values() for r in g)
    resolved_all = sum(r["resolved"] for g in result.values() for r in g)

    return {
        "dimension":           dimension,
        "taux_global_pct":     round(resolved_all / total_all * 100, 1) if total_all else 0,
        "total_tickets":       total_all,
        "total_resolus":       resolved_all,
        "by_group":            result,
    }


# ── 2. Taux de retard ─────────────────────────────────────────────
@app.get("/api/metrics/taux-retard", tags=["Métriques"])
def taux_retard(
    dimension: str = Query("global"),
    dates: tuple = Depends(date_range),
):
    """
    Taux de retard = tickets en retard (non résolus, SLA dépassé) / tickets ouverts × 100
    """
    df, dt = dates
    tickets = _fetch_tickets(df, dt)
    groups: dict[str, dict[str, dict]] = {}

    for t in tickets:
        d = _parse_date(t.get("date"))
        if not d:
            continue
        m = _month_key(d)
        k = _group_key(t, dimension)
        groups.setdefault(k, {}).setdefault(m, {"total": 0, "open": 0, "late": 0})
        groups[k][m]["total"] += 1
        if t.get("status") not in RESOLVED_STATUSES:
            groups[k][m]["open"] += 1
            if _is_late(t):
                groups[k][m]["late"] += 1

    result = {}
    for grp, months in groups.items():
        result[grp] = [
            {
                "month": m,
                "total": c["total"],
                "open":  c["open"],
                "late":  c["late"],
                "taux_retard_pct": round(c["late"] / c["open"] * 100, 1) if c["open"] else 0,
            }
            for m, c in sorted(months.items())
        ]

    open_all = sum(r["open"] for g in result.values() for r in g)
    late_all = sum(r["late"] for g in result.values() for r in g)

    return {
        "dimension":                dimension,
        "taux_retard_global_pct":   round(late_all / open_all * 100, 1) if open_all else 0,
        "tickets_ouverts":          open_all,
        "tickets_en_retard":        late_all,
        "by_group":                 result,
    }


# ── 3. Taux de rejet / suppression ───────────────────────────────
@app.get("/api/metrics/taux-rejet", tags=["Métriques"])
def taux_rejet(
    dimension: str = Query("global"),
    dates: tuple = Depends(date_range),
    include_deleted: bool = Query(True, description="Inclure tickets supprimés (is_deleted=1)"),
):
    """
    Taux de rejet = (tickets en statut rejeté + tickets supprimés) / total × 100
    """
    df, dt = dates
    tickets = _fetch_tickets_with_deleted(df, dt) if include_deleted else _fetch_tickets(df, dt)
    groups: dict[str, dict[str, dict]] = {}

    for t in tickets:
        d = _parse_date(t.get("date"))
        if not d:
            continue
        m = _month_key(d)
        k = _group_key(t, dimension)
        groups.setdefault(k, {}).setdefault(m, {"total": 0, "rejected": 0, "deleted": 0})
        groups[k][m]["total"] += 1
        if t.get("_deleted"):
            groups[k][m]["deleted"] += 1
            groups[k][m]["rejected"] += 1
        elif t.get("status") in REJECTED_STATUSES:
            groups[k][m]["rejected"] += 1

    result = {}
    for grp, months in groups.items():
        result[grp] = [
            {
                "month":            m,
                "total":            c["total"],
                "rejected":         c["rejected"],
                "deleted":          c["deleted"],
                "taux_rejet_pct":   round(c["rejected"] / c["total"] * 100, 1) if c["total"] else 0,
            }
            for m, c in sorted(months.items())
        ]

    total_all    = sum(r["total"]    for g in result.values() for r in g)
    rejected_all = sum(r["rejected"] for g in result.values() for r in g)

    return {
        "dimension":              dimension,
        "taux_rejet_global_pct":  round(rejected_all / total_all * 100, 1) if total_all else 0,
        "total_tickets":          total_all,
        "total_rejetes":          rejected_all,
        "by_group":               result,
    }


# ── 4. Délai moyen de traitement ──────────────────────────────────
@app.get("/api/metrics/delai-moyen", tags=["Métriques"])
def delai_moyen(
    dimension: str = Query("global"),
    dates: tuple = Depends(date_range),
):
    """
    Délai moyen = moyenne(closedate − date_creation) sur tickets résolus.
    Exprimé en jours calendaires.
    """
    df, dt = dates
    tickets = _fetch_tickets(df, dt)
    groups: dict[str, dict[str, dict]] = {}

    for t in tickets:
        if t.get("status") not in RESOLVED_STATUSES:
            continue
        d = _parse_date(t.get("date"))
        delay = _processing_days(t)
        if not d or delay is None:
            continue
        m = _month_key(d)
        k = _group_key(t, dimension)
        groups.setdefault(k, {}).setdefault(m, {"total_days": 0.0, "count": 0})
        groups[k][m]["total_days"] += delay
        groups[k][m]["count"] += 1

    result = {}
    for grp, months in groups.items():
        result[grp] = [
            {
                "month":               m,
                "tickets_resolus":     c["count"],
                "delai_moyen_jours":   round(c["total_days"] / c["count"], 1) if c["count"] else 0,
            }
            for m, c in sorted(months.items())
        ]

    total_cnt  = sum(r["tickets_resolus"]  for g in result.values() for r in g)
    total_days = sum(r["delai_moyen_jours"] * r["tickets_resolus"] for g in result.values() for r in g)

    return {
        "dimension":                 dimension,
        "delai_moyen_global_jours":  round(total_days / total_cnt, 1) if total_cnt else 0,
        "tickets_resolus_total":     total_cnt,
        "by_group":                  result,
    }


# ── 5. Demandes urgentes ──────────────────────────────────────────
@app.get("/api/metrics/demandes-urgentes", tags=["Métriques"])
def demandes_urgentes(
    dimension: str = Query("global"),
    dates: tuple = Depends(date_range),
):
    """
    Nombre et taux de demandes urgentes (priority ∈ {4, 5, 6}).
    """
    df, dt = dates
    tickets = _fetch_tickets(df, dt)
    groups: dict[str, dict[str, dict]] = {}

    for t in tickets:
        d = _parse_date(t.get("date"))
        if not d:
            continue
        m = _month_key(d)
        k = _group_key(t, dimension)
        groups.setdefault(k, {}).setdefault(m, {"total": 0, "urgent": 0})
        groups[k][m]["total"] += 1
        if t.get("priority", 0) in URGENT_PRIORITIES:
            groups[k][m]["urgent"] += 1

    result = {}
    for grp, months in groups.items():
        result[grp] = [
            {
                "month":              m,
                "total":              c["total"],
                "urgent":             c["urgent"],
                "taux_urgence_pct":   round(c["urgent"] / c["total"] * 100, 1) if c["total"] else 0,
            }
            for m, c in sorted(months.items())
        ]

    urgent_all = sum(r["urgent"] for g in result.values() for r in g)
    total_all  = sum(r["total"]  for g in result.values() for r in g)

    return {
        "dimension":                dimension,
        "urgent_total":             urgent_all,
        "taux_urgence_global_pct":  round(urgent_all / total_all * 100, 1) if total_all else 0,
        "by_group":                 result,
    }


# ── 6. Évolution mensuelle + YTD ─────────────────────────────────
@app.get("/api/metrics/evolution", tags=["Métriques"])
def evolution_mensuelle(
    dimension: str = Query("global"),
    dates: tuple = Depends(date_range),
    year: Optional[int] = Query(None, description="Année pour le YTD (défaut = année courante)"),
):
    """
    Évolution mensuelle des tickets reçus et résolus + cumul Year-to-Date.
    """
    df, dt = dates
    tickets = _fetch_tickets(df, dt)
    ytd_year = year or date.today().year
    groups: dict[str, dict[str, dict]] = {}

    for t in tickets:
        d = _parse_date(t.get("date"))
        if not d:
            continue
        m = _month_key(d)
        k = _group_key(t, dimension)
        groups.setdefault(k, {}).setdefault(m, {"received": 0, "resolved": 0})
        groups[k][m]["received"] += 1
        if t.get("status") in RESOLVED_STATUSES:
            groups[k][m]["resolved"] += 1

    result = {}
    for grp, months in groups.items():
        monthly = []
        ytd_recv = ytd_res = 0
        for m, c in sorted(months.items()):
            monthly.append({
                "month":                m,
                "received":             c["received"],
                "resolved":             c["resolved"],
                "resolution_rate_pct":  round(c["resolved"] / c["received"] * 100, 1) if c["received"] else 0,
            })
            if m.startswith(str(ytd_year)):
                ytd_recv += c["received"]
                ytd_res  += c["resolved"]

        result[grp] = {
            "monthly": monthly,
            "ytd": {
                "year":                ytd_year,
                "received":            ytd_recv,
                "resolved":            ytd_res,
                "resolution_rate_pct": round(ytd_res / ytd_recv * 100, 1) if ytd_recv else 0,
            },
        }

    return {"dimension": dimension, "ytd_year": ytd_year, "by_group": result}


# ── 7. Synthèse KPI (écran principal dashboard) ───────────────────
@app.get("/api/dashboard/summary", tags=["Dashboard"])
def dashboard_summary(
    dates: tuple = Depends(date_range),
    year: Optional[int] = Query(None),
):
    """
    Tous les KPI en un seul appel — optimisé pour l'écran d'accueil.
    """
    df, dt = dates
    tickets = _fetch_tickets(df, dt)
    ytd_year = year or date.today().year

    total    = len(tickets)
    resolved = sum(1 for t in tickets if t.get("status") in RESOLVED_STATUSES)
    open_cnt = total - resolved
    late     = sum(1 for t in tickets if _is_late(t))
    urgent   = sum(1 for t in tickets if t.get("priority", 0) in URGENT_PRIORITIES)
    rejected = sum(1 for t in tickets if t.get("status") in REJECTED_STATUSES)

    delays = [_processing_days(t) for t in tickets]
    delays = [d for d in delays if d is not None]
    avg_delay = round(sum(delays) / len(delays), 1) if delays else 0

    # Top 10 acheteurs
    buyer_vol: dict[str, int] = {}
    for t in tickets:
        b = t.get("_buyer_name", "Non assigné")
        buyer_vol[b] = buyer_vol.get(b, 0) + 1
    top_buyers = [{"name": b, "count": c} for b, c in sorted(buyer_vol.items(), key=lambda x: -x[1])[:10]]

    # Top 10 projets
    proj_vol: dict[str, int] = {}
    for t in tickets:
        p = t.get("_project_name", "Sans projet")
        proj_vol[p] = proj_vol.get(p, 0) + 1
    top_projects = [{"name": p, "count": c} for p, c in sorted(proj_vol.items(), key=lambda x: -x[1])[:10]]

    # Évolution mensuelle YTD
    monthly: dict[str, dict] = {}
    for t in tickets:
        d = _parse_date(t.get("date"))
        if not d or d.year != ytd_year:
            continue
        m = _month_key(d)
        monthly.setdefault(m, {"received": 0, "resolved": 0})
        monthly[m]["received"] += 1
        if t.get("status") in RESOLVED_STATUSES:
            monthly[m]["resolved"] += 1

    return {
        "period":       {"from": str(df) if df else None, "to": str(dt) if dt else None},
        "mode":         "mock" if USE_MOCK_DATA else "live",
        "kpis": {
            "total_tickets":        total,
            "resolved":             resolved,
            "open":                 open_cnt,
            "late":                 late,
            "urgent":               urgent,
            "rejected":             rejected,
            "taux_realisation_pct": round(resolved / total * 100, 1) if total else 0,
            "taux_retard_pct":      round(late / open_cnt * 100, 1) if open_cnt else 0,
            "taux_rejet_pct":       round(rejected / total * 100, 1) if total else 0,
            "taux_urgence_pct":     round(urgent / total * 100, 1) if total else 0,
            "delai_moyen_jours":    avg_delay,
        },
        "ytd": {
            "year":    ytd_year,
            "monthly": [{"month": m, **v} for m, v in sorted(monthly.items())],
        },
        "top_buyers":   top_buyers,
        "top_projects": top_projects,
    }


# ── 8. Liste des tickets ──────────────────────────────────────────
@app.get("/api/tickets", tags=["Tickets"])
def list_tickets(
    dates: tuple = Depends(date_range),
    projet:       Optional[str] = Query(None),
    acheteur:     Optional[str] = Query(None),
    status:       Optional[int] = Query(None),
    urgent_only:  bool          = Query(False),
    limit:        int           = Query(100, le=1000),
    offset:       int           = Query(0, ge=0),
):
    df, dt = dates
    tickets = _fetch_tickets(df, dt)

    if projet:
        tickets = [t for t in tickets if projet.lower() in (t.get("_project_name") or "").lower()]
    if acheteur:
        tickets = [t for t in tickets if acheteur.lower() in (t.get("_buyer_name") or "").lower()]
    if status is not None:
        tickets = [t for t in tickets if t.get("status") == status]
    if urgent_only:
        tickets = [t for t in tickets if t.get("priority", 0) in URGENT_PRIORITIES]

    total = len(tickets)
    page  = tickets[offset: offset + limit]

    return {
        "total":   total,
        "offset":  offset,
        "limit":   limit,
        "tickets": [
            {
                "id":               t.get("id"),
                "name":             t.get("name"),
                "status":           t.get("status"),
                "status_label":     STATUS_MAP.get(t.get("status", 0), "Inconnu"),
                "priority":         t.get("priority"),
                "date_creation":    t.get("date"),
                "date_resolution":  t.get("closedate") or t.get("solvedate"),
                "time_to_resolve":  t.get("time_to_resolve"),
                "is_late":          _is_late(t),
                "delai_jours":      _processing_days(t),
                "acheteur":         t.get("_buyer_name"),
                "projet":           t.get("_project_name"),
                "category_id":      t.get("itilcategories_id"),
            }
            for t in page
        ],
    }


# ── 9. Référentiels ───────────────────────────────────────────────
@app.get("/api/referentiels/acheteurs", tags=["Référentiels"])
def list_acheteurs(dates: tuple = Depends(date_range)):
    df, dt = dates
    tickets = _fetch_tickets(df, dt)
    return {"acheteurs": sorted(set(t.get("_buyer_name", "Non assigné") for t in tickets))}


@app.get("/api/referentiels/projets", tags=["Référentiels"])
def list_projets(dates: tuple = Depends(date_range)):
    df, dt = dates
    tickets = _fetch_tickets(df, dt)
    return {"projets": sorted(set(t.get("_project_name", "Sans projet") for t in tickets))}


@app.get("/api/referentiels/statuts", tags=["Référentiels"])
def list_statuts():
    return {
        "statuts": [
            {"id": k, "label": v, "is_resolved": k in RESOLVED_STATUSES, "is_rejected": k in REJECTED_STATUSES}
            for k, v in STATUS_MAP.items()
        ]
    }
