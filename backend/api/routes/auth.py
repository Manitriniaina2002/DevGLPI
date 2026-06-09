"""
api/routes/auth.py — Authentification JWT via GLPI (user_token)
===============================================================
POST /api/auth/login  → échange user_token GLPI contre un JWT backend
GET  /api/auth/me     → profil de l'utilisateur connecté
POST /api/auth/logout → révocation côté client (JWT stateless)

Flux :
  Frontend envoie { "user_token": "<token GLPI de l'utilisateur>" }
  Backend ouvre une session GLPI avec ce token + App-Token
  Récupère user_id, nom complet, profils GLPI
  Résout le rôle (demandeur / acheteur / responsable)
  Émet un JWT signé valable 8h
"""
from __future__ import annotations

import logging

import requests
import urllib3
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from core.config import Settings, get_settings
from core.security import (
    CurrentUser,
    create_access_token,
    get_current_user,
    resolve_role_from_glpi_profiles,
)

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
log = logging.getLogger("auth")

router = APIRouter(prefix="/api/auth", tags=["Authentification"])


# ── Schémas ───────────────────────────────────────────────────────
class LoginRequest(BaseModel):
    user_token: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: int
    login: str
    full_name: str
    role: str


# ── Helpers GLPI ─────────────────────────────────────────────────
def _glpi_open_session(
    api_url: str,
    app_token: str,
    user_token: str,
    verify_ssl: bool,
) -> str:
    """Ouvre une session GLPI avec user_token et retourne le session_token."""
    resp = requests.get(
        f"{api_url}/initSession",
        headers={
            "Content-Type": "application/json",
            "App-Token": app_token,
            "Authorization": f"user_token {user_token}",
        },
        verify=verify_ssl,
        timeout=15,
    )
    if resp.status_code == 401:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="user_token invalide ou expiré",
        )
    if not resp.ok:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"GLPI indisponible ({resp.status_code})",
        )
    token = resp.json().get("session_token")
    if not token:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="GLPI n'a pas retourné de session_token",
        )
    return token


def _glpi_get_user_info(
    api_url: str,
    app_token: str,
    session_token: str,
    verify_ssl: bool,
) -> dict:
    """Récupère user_id, nom complet et profils depuis la session GLPI ouverte."""
    headers = {
        "Content-Type": "application/json",
        "App-Token": app_token,
        "Session-Token": session_token,
    }

    # Infos session complète
    session_resp = requests.get(
        f"{api_url}/getFullSession",
        headers=headers,
        verify=verify_ssl,
        timeout=10,
    )
    glpi_session = {}
    if session_resp.ok:
        glpi_session = session_resp.json().get("session", {})

    user_id   = int(glpi_session.get("glpiID") or 0)
    firstname = glpi_session.get("glpifirstname") or ""
    realname  = glpi_session.get("glpirealname") or ""
    composed  = f"{firstname} {realname}".strip()
    full_name = composed or glpi_session.get("glpifriendlyname") or glpi_session.get("glpiname") or f"user_{user_id}"
    login     = glpi_session.get("glpiname", f"user_{user_id}")

    # Profils actifs de l'utilisateur
    profiles_resp = requests.get(
        f"{api_url}/getMyProfiles",
        headers=headers,
        verify=verify_ssl,
        timeout=10,
    )
    profiles = []
    if profiles_resp.ok:
        data = profiles_resp.json()
        if isinstance(data, list):
            profiles = data
        elif isinstance(data, dict):
            # Certaines versions GLPI retournent {"myprofiles": {...}} ou {"myprofiles": [...]}
            mp = data.get("myprofiles", [])
            profiles = list(mp.values()) if isinstance(mp, dict) else mp

    log.debug("Profils GLPI pour %s : %s", login, [p.get("name") for p in profiles])

    # Fermer la session GLPI (on travaille ensuite avec le JWT)
    requests.get(
        f"{api_url}/killSession",
        headers=headers,
        verify=verify_ssl,
        timeout=5,
    )

    return {
        "user_id":  user_id,
        "login":    login,
        "full_name": full_name,
        "profiles": profiles,
    }


# ── Routes ────────────────────────────────────────────────────────
@router.post("/login", response_model=LoginResponse)
def login(body: LoginRequest, settings: Settings = Depends(get_settings)):
    """
    Authentifie l'utilisateur via son user_token GLPI et retourne un JWT.

    Le user_token se trouve dans GLPI :
      Profil utilisateur → API → Régénérer le token d'identification

    En mode mock (USE_MOCK_DATA=true), trois tokens de test :
      mock-responsable  → rôle responsable (voit tout)
      mock-acheteur     → rôle acheteur (ses tickets assignés)
      mock-demandeur    → rôle demandeur (ses propres demandes)
    """
    if settings.use_mock_data:
        return _mock_login(body.user_token, settings)

    session_token = _glpi_open_session(
        settings.glpi_api_url,
        settings.glpi_app_token,
        body.user_token,
        settings.glpi_verify_ssl,
    )

    user_info = _glpi_get_user_info(
        settings.glpi_api_url,
        settings.glpi_app_token,
        session_token,
        settings.glpi_verify_ssl,
    )

    role = resolve_role_from_glpi_profiles(user_info["profiles"])

    log.info(
        "Login OK : %s (id=%s, role=%s, profils=%s)",
        user_info["login"],
        user_info["user_id"],
        role,
        [p.get("name") for p in user_info["profiles"]],
    )

    token = create_access_token(
        {
            "sub":       user_info["user_id"],
            "login":     user_info["login"],
            "full_name": user_info["full_name"],
            "role":      role,
        },
        settings,
    )

    return LoginResponse(
        access_token=token,
        user_id=user_info["user_id"],
        login=user_info["login"],
        full_name=user_info["full_name"],
        role=role,
    )


@router.get("/me")
def me(user: CurrentUser = Depends(get_current_user)):
    """Retourne le profil de l'utilisateur authentifié."""
    return {
        "user_id":   user.user_id,
        "login":     user.login,
        "full_name": user.full_name,
        "role":      user.role,
        "permissions": {
            "can_see_all_tickets":  user.is_responsable,
            "can_assign_tickets":   user.is_responsable,
            "can_update_status":    user.role in ("acheteur", "responsable"),
            "can_add_followup":     user.role in ("acheteur", "responsable"),
        },
    }


@router.post("/logout")
def logout(user: CurrentUser = Depends(get_current_user)):
    """Logout côté client — le JWT est simplement abandonné (stateless)."""
    log.info("Logout : %s", user.login)
    return {"detail": "Déconnexion effectuée"}


# ── Mock login ────────────────────────────────────────────────────
def _mock_login(user_token: str, settings: Settings) -> LoginResponse:
    """Tokens de démonstration pour le mode mock (USE_MOCK_DATA=true)."""
    mock_users = {
        "mock-responsable": {"user_id": 1, "login": "responsable",
                             "full_name": "Responsable Achat Demo", "role": "responsable"},
        "mock-acheteur":    {"user_id": 2, "login": "acheteur",
                             "full_name": "Acheteur Demo",          "role": "acheteur"},
        "mock-demandeur":   {"user_id": 3, "login": "demandeur",
                             "full_name": "Demandeur Demo",         "role": "demandeur"},
    }

    user = mock_users.get(user_token)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=(
                "Token mock inconnu. "
                "Tokens valides : mock-responsable, mock-acheteur, mock-demandeur"
            ),
        )

    token = create_access_token(
        {"sub": user["user_id"], "login": user["login"],
         "full_name": user["full_name"], "role": user["role"]},
        settings,
    )
    return LoginResponse(
        access_token=token,
        user_id=user["user_id"],
        login=user["login"],
        full_name=user["full_name"],
        role=user["role"],
    )