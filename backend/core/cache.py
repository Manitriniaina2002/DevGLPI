"""
core/cache.py — Client Redis centralisé pour le Dashboard Achat GLPI
=====================================================================
Fournit des helpers simples (cache_get / cache_set / cache_delete / cache_invalidate)
utilisés par les repositories pour éviter les appels répétés à l'API GLPI.

Stratégie de clés :
  ticket_history:{ticket_id}      → logs d'un ticket (TTL court, 5 min)
  ticket_assignees_map            → map {ticket_id: [user_ids]} (TTL 2 min)
  purchase_tickets                → liste complète des tickets (TTL 2 min)
  glpi_users                      → annuaire {id: nom} (TTL 30 min)
  glpi_projects                   → {id: nom} (TTL 30 min)
  ticket_validations:{ticket_id}  → validations GLPI (TTL 5 min)

Dégradation gracieuse :
  Si Redis est indisponible, toutes les fonctions retournent None (get) ou
  ne font rien (set/delete) — le backend continue à fonctionner sans cache,
  comme avant l'intégration.
"""
from __future__ import annotations

import json
import logging
from typing import Any, Optional

log = logging.getLogger("cache")

_redis_client = None


async def _get_client():
    """Retourne le client Redis (connexion lazy, singleton)."""
    global _redis_client
    if _redis_client is not None:
        return _redis_client

    try:
        import redis.asyncio as aioredis
        from core.config import get_settings
        settings = get_settings()
        _redis_client = aioredis.from_url(
            settings.redis_url,
            encoding="utf-8",
            decode_responses=True,
            socket_connect_timeout=2,
            socket_timeout=2,
        )
        # Ping pour valider la connexion au démarrage
        await _redis_client.ping()
        log.info("Redis connecté : %s", settings.redis_url)
    except Exception as exc:
        log.warning("Redis indisponible (%s) — cache désactivé", exc)
        _redis_client = None

    return _redis_client


async def cache_get(key: str) -> Optional[Any]:
    """
    Récupère une valeur depuis Redis.
    Retourne None si la clé n'existe pas ou si Redis est indisponible.
    """
    try:
        client = await _get_client()
        if client is None:
            return None
        raw = await client.get(key)
        if raw is None:
            return None
        return json.loads(raw)
    except Exception as exc:
        log.debug("cache_get(%s) échoué : %s", key, exc)
        return None


async def cache_set(key: str, value: Any, ttl: int) -> bool:
    """
    Stocke une valeur dans Redis avec un TTL en secondes.
    Retourne True si succès, False sinon.
    """
    try:
        client = await _get_client()
        if client is None:
            return False
        serialized = json.dumps(value, default=str, ensure_ascii=False)
        await client.setex(key, ttl, serialized)
        return True
    except Exception as exc:
        log.debug("cache_set(%s) échoué : %s", key, exc)
        return False


async def cache_delete(key: str) -> bool:
    """Supprime une clé Redis (invalidation manuelle)."""
    try:
        client = await _get_client()
        if client is None:
            return False
        await client.delete(key)
        return True
    except Exception as exc:
        log.debug("cache_delete(%s) échoué : %s", key, exc)
        return False


async def cache_invalidate_ticket(ticket_id: int) -> None:
    """
    Invalide toutes les clés liées à un ticket donné.
    À appeler quand un ticket est modifié (ex: après une action GLPI).
    """
    keys = [
        f"ticket_history:{ticket_id}",
        f"ticket_validations:{ticket_id}",
        "ticket_assignees_map",
        "purchase_tickets",
    ]
    for key in keys:
        await cache_delete(key)
    log.info("Cache invalidé pour le ticket #%s", ticket_id)


async def cache_invalidate_all() -> None:
    """
    Vide tout le cache Redis (utile pour forcer un refresh complet).
    À utiliser avec précaution en production.
    """
    try:
        client = await _get_client()
        if client is None:
            return
        await client.flushdb()
        log.info("Cache Redis vidé entièrement")
    except Exception as exc:
        log.warning("cache_invalidate_all échoué : %s", exc)


async def cache_stats() -> dict:
    """
    Retourne des statistiques sur le cache Redis.
    Utilisé par l'endpoint /health.
    """
    try:
        client = await _get_client()
        if client is None:
            return {"available": False, "reason": "Redis non connecté"}
        info = await client.info("stats")
        memory = await client.info("memory")
        return {
            "available": True,
            "hits": info.get("keyspace_hits", 0),
            "misses": info.get("keyspace_misses", 0),
            "used_memory_human": memory.get("used_memory_human", "?"),
        }
    except Exception as exc:
        return {"available": False, "reason": str(exc)}
