"""
tools/check_cache.py — Diagnostic et test du cache Redis
=========================================================
Vérifie que Redis est accessible et que le cache fonctionne
correctement avec le backend.

Utilisation :
  docker exec -it dashbord-achat-backend python /app/tools/check_cache.py

Options :
  --flush     Vide entièrement le cache Redis
  --stats     Affiche les statistiques Redis
  --test      Teste get/set/delete
"""
from __future__ import annotations

import asyncio
import sys
import os

APP_DIR = "/app"
if APP_DIR not in sys.path:
    sys.path.insert(0, APP_DIR)

from core.cache import (
    cache_get,
    cache_set,
    cache_delete,
    cache_invalidate_all,
    cache_stats,
)


async def test_cache():
    print("=" * 50)
    print("Test du cache Redis")
    print("=" * 50)

    # Test SET
    ok = await cache_set("test:key", {"hello": "world", "number": 42}, ttl=60)
    print(f"SET  test:key → {'✓' if ok else '✗ (Redis indisponible)'}")

    # Test GET
    val = await cache_get("test:key")
    if val:
        assert val["hello"] == "world", "Valeur inattendue"
        assert val["number"] == 42, "Type incorrect"
        print(f"GET  test:key → ✓ ({val})")
    else:
        print("GET  test:key → ✗ (None retourné)")

    # Test DELETE
    deleted = await cache_delete("test:key")
    print(f"DEL  test:key → {'✓' if deleted else '✗'}")

    # Vérifier que la clé n'existe plus
    val = await cache_get("test:key")
    print(f"GET  test:key après DEL → {'✓ None' if val is None else f'✗ {val}'}")


async def show_stats():
    print("=" * 50)
    print("Statistiques Redis")
    print("=" * 50)
    stats = await cache_stats()
    for k, v in stats.items():
        print(f"  {k}: {v}")


async def flush():
    print("Vidage du cache Redis...")
    await cache_invalidate_all()
    print("✓ Cache vidé")


async def main():
    args = sys.argv[1:]

    if "--flush" in args:
        await flush()
    elif "--stats" in args:
        await show_stats()
    elif "--test" in args:
        await test_cache()
    else:
        # Par défaut : stats + test
        await show_stats()
        print()
        await test_cache()

    print()
    print("Terminé.")


if __name__ == "__main__":
    asyncio.run(main())
