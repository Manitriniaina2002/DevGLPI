# start.ps1 - Demarre la stack Dashboard Achat GLPI
param(
    [switch]$Glpi,
    [switch]$Build,
    [switch]$Stop
)

Write-Host "Verification du reseau Docker glpi-frontend..." -ForegroundColor Cyan
docker network create glpi-frontend 2>$null

if ($Stop) {
    Write-Host "Arret de la stack..." -ForegroundColor Yellow
    docker compose down
    if ($Glpi) { docker compose -f docker-compose.glpi.local.yml down }
    exit 0
}

if ($Glpi) {
    Write-Host "Demarrage de GLPI..." -ForegroundColor Cyan
    docker compose -f docker-compose.glpi.local.yml up -d
    Write-Host "Attente de GLPI (10s)..." -ForegroundColor Gray
    Start-Sleep -Seconds 10
}

Write-Host "Demarrage backend + frontend..." -ForegroundColor Cyan

if ($Build) {
    docker compose up -d --build
} else {
    docker compose up -d
}

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "Stack demarree !" -ForegroundColor Green
    Write-Host "  Frontend  : http://localhost:3000"
    Write-Host "  Backend   : http://localhost:9000"
    Write-Host "  API docs  : http://localhost:9000/docs"
    if ($Glpi) { Write-Host "  GLPI      : http://localhost:1080" }
    Write-Host ""
    Write-Host "  Logs : docker compose logs -f frontend" -ForegroundColor Gray
} else {
    Write-Host "Erreur au demarrage." -ForegroundColor Red
}