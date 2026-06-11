#!/bin/bash
# start.sh — Démarre toute la stack Dashboard Achat GLPI
# Usage:
#   ./start.sh          → backend + frontend (sans GLPI local)
#   ./start.sh --glpi   → avec GLPI local (mysql, nginx, glpi)
#   ./start.sh --build  → force rebuild des images
#   ./start.sh --stop   → arrête tout

set -e

WITH_GLPI=false
BUILD=""
STOP=false

for arg in "$@"; do
  case $arg in
    --glpi)  WITH_GLPI=true ;;
    --build) BUILD="--build" ;;
    --stop)  STOP=true ;;
  esac
done

if [ "$STOP" = true ]; then
  echo "🛑 Arrêt de la stack..."
  docker compose down
  if [ "$WITH_GLPI" = true ]; then
    docker compose -f docker-compose.glpi.local.yml down
  fi
  exit 0
fi

# Créer le réseau partagé si nécessaire
docker network create glpi-frontend 2>/dev/null || true

if [ "$WITH_GLPI" = true ]; then
  echo "🚀 Démarrage de la stack GLPI..."
  docker compose -f docker-compose.glpi.local.yml up -d
  echo "⏳ Attente de GLPI (10s)..."
  sleep 10
fi

echo "🚀 Démarrage du backend + frontend..."
docker compose up -d $BUILD

echo ""
echo "✅ Stack démarrée !"
echo ""
echo "  Frontend  → http://localhost:3000"
echo "  Backend   → http://localhost:9000"
echo "  API docs  → http://localhost:9000/docs"
if [ "$WITH_GLPI" = true ]; then
  echo "  GLPI      → http://localhost:1080"
fi
echo ""
echo "  Logs frontend : docker compose logs -f frontend"
echo "  Logs backend  : docker compose logs -f backend"
