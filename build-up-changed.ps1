# build-up-changed.ps1
# Detect changed frontend/backend files and rebuild only the affected Docker Compose services.

$ErrorActionPreference = 'Stop'

function Get-ChangedFiles {
    $changed = @()
    $staged = @()

    try {
        $changed = & git -c core.autocrlf=false diff --name-only --diff-filter=ACMRTUXB HEAD 2>$null
    } catch {
        Write-Host 'Attention : impossible de lire les fichiers modifiés avec git diff.'
    }

    try {
        $staged = & git -c core.autocrlf=false diff --name-only --cached --diff-filter=ACMRTUXB 2>$null
    } catch {
        Write-Host 'Attention : impossible de lire les fichiers indexés avec git diff --cached.'
    }

    return @($changed + $staged | Where-Object { $_ -ne '' } | Sort-Object -Unique)
}

$files = Get-ChangedFiles
if (-not $files) {
    Write-Host 'Aucune modification détectée dans frontend ou backend.'
    exit 0
}

$services = @()

if ($files -match '^frontend/') { $services += 'frontend' }
if ($files -match '^backend/') { $services += 'backend' }

# If shared Docker config or root-level project files changed, rebuild both services.
if ($files -match '^(docker-compose\.yml|docker-compose\.glpi\.local\.yml|\.env|\.env\.example|\.vscode/|build-up-changed\.ps1)$') {
    $services = @('frontend', 'backend')
}

if (-not $services) {
    Write-Host 'Aucune modification frontend/backend détectée. Aucun rebuild requis.'
    exit 0
}

$services = $services | Select-Object -Unique
Write-Host "Services à rebuild: $($services -join ', ')"

Write-Host 'Build en cours...'
docker compose build @services

Write-Host 'Relance des services...'
docker compose up -d @services

Write-Host 'Terminé.'
