"""
core/security.py — JWT, rôles et résolution du profil GLPI
=========================================================
Rôles supportés :
  demandeur   → ne voit que ses tickets (users_id_requester == soi)
  acheteur    → ne voit que les tickets assignés (users_id_assign == soi)
  responsable → voit tout (admin / super-admin GLPI)
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from core.config import Settings, get_settings

log = logging.getLogger("security")

# ── Constantes ────────────────────────────────────────────────────
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 480  # 8 h

# Profils GLPI → rôle backend
# On mappe par le nom du profil GLPI (completename ou name)
GLPI_PROFILE_ROLE_MAP: dict[str, str] = {
    # Profils Self-Service / utilisateurs standard → demandeur
    "self-service": "demandeur",
    "self service": "demandeur",
    # Profils acheteurs (groupe ou profil nommé "Achat")
    "achat": "acheteur",
    "acheteur": "acheteur",
    # Admins / super-admins → responsable
    "super-admin": "responsable",
    "super admin": "responsable",
    "admin": "responsable",
    "administrateur": "responsable",
    "responsable achat": "responsable",
    "responsable": "responsable",
}

bearer_scheme = HTTPBearer(auto_error=False)


# ── Modèle utilisateur courant ────────────────────────────────────
class CurrentUser:
    def __init__(
        self,
        user_id: int,
        login: str,
        full_name: str,
        role: str,
        glpi_session_token: Optional[str] = None,
    ):
        self.user_id = user_id
        self.login = login
        self.full_name = full_name
        self.role = role
        self.glpi_session_token = glpi_session_token

    @property
    def is_responsable(self) -> bool:
        return self.role == "responsable"

    @property
    def is_acheteur(self) -> bool:
        return self.role == "acheteur"

    @property
    def is_demandeur(self) -> bool:
        return self.role == "demandeur"


# ── JWT ───────────────────────────────────────────────────────────
def create_access_token(
    payload: dict,
    settings: Settings,
    expires_minutes: int = ACCESS_TOKEN_EXPIRE_MINUTES,
) -> str:
    data = payload.copy()
    data["exp"] = datetime.now(timezone.utc) + timedelta(minutes=expires_minutes)
    data["iat"] = datetime.now(timezone.utc)
    return jwt.encode(data, settings.jwt_secret, algorithm=ALGORITHM)


def decode_access_token(token: str, settings: Settings) -> dict:
    try:
        return jwt.decode(token, settings.jwt_secret, algorithms=[ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token expiré — veuillez vous reconnecter",
        )
    except jwt.InvalidTokenError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Token invalide : {e}",
        )


# ── Résolution du rôle depuis les profils GLPI ───────────────────
def resolve_role_from_glpi_profiles(profiles: list[dict]) -> str:
    """
    Parcourt les profils GLPI de l'utilisateur et retourne le rôle
    le plus élevé selon GLPI_PROFILE_ROLE_MAP.

    Hiérarchie : responsable > acheteur > demandeur
    """
    priority = {"responsable": 3, "acheteur": 2, "demandeur": 1}
    best_role = "demandeur"
    best_priority = 1

    for profile in profiles:
        name = (profile.get("name") or "").lower().strip()
        role = GLPI_PROFILE_ROLE_MAP.get(name)
        if role and priority.get(role, 0) > best_priority:
            best_role = role
            best_priority = priority[role]

    return best_role


# ── Dépendance FastAPI ────────────────────────────────────────────
def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
    settings: Settings = Depends(get_settings),
) -> CurrentUser:
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentification requise",
            headers={"WWW-Authenticate": "Bearer"},
        )

    payload = decode_access_token(credentials.credentials, settings)

    return CurrentUser(
        user_id=payload["sub"],
        login=payload["login"],
        full_name=payload.get("full_name", ""),
        role=payload.get("role", "demandeur"),
        glpi_session_token=payload.get("glpi_session_token"),
    )


def get_current_user_optional(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
    settings: Settings = Depends(get_settings),
) -> Optional[CurrentUser]:
    """Variante optionnelle — ne lève pas d'exception si absent (mode mock)."""
    if credentials is None:
        return None
    try:
        return get_current_user(credentials, settings)
    except HTTPException:
        return None


# ── Guards de rôle ────────────────────────────────────────────────
def require_acheteur_or_above(user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
    if user.role not in ("acheteur", "responsable"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Accès réservé aux acheteurs et responsables",
        )
    return user


def require_responsable(user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
    if not user.is_responsable:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Accès réservé au responsable achat",
        )
    return user
