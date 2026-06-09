# ============================================================
#  test_all.ps1 - Tests complets Dashboard Achat GLPI v5.0.0
#  Usage : .\test_all.ps1
#          .\test_all.ps1 -Base "https://xxx.trycloudflare.com"
# ============================================================
param(
    [string]$Base = "http://localhost:9000"
)

$ok   = 0
$fail = 0
$warn = 0

# ── Helpers ──────────────────────────────────────────────────
function Test-Endpoint {
    param($method, $url, $desc, $headers = @{}, $body = $null, $expectCode = 200)
    try {
        $params = @{
            Method  = $method
            Uri     = $url
            Headers = $headers
        }
        if ($body) {
            $params.Body        = ($body | ConvertTo-Json -Depth 5)
            $params.ContentType = "application/json"
        }
        $result = Invoke-RestMethod @params
        Write-Host "OK  $desc" -ForegroundColor Green
        $global:ok++
        return $result
    }
    catch {
        $code = $_.Exception.Response.StatusCode.value__
        if ($code -eq $expectCode) {
            Write-Host "OK  $desc (attendu $expectCode)" -ForegroundColor DarkGreen
            $global:ok++
        } else {
            Write-Host "ERR $desc - HTTP $code - $($_.Exception.Message)" -ForegroundColor Red
            $global:fail++
        }
        return $null
    }
}

function Section { param($title)
    Write-Host ""
    Write-Host ("=" * 60) -ForegroundColor Cyan
    Write-Host "  $title" -ForegroundColor Cyan
    Write-Host ("=" * 60) -ForegroundColor Cyan
}

# ============================================================
Write-Host ""
Write-Host "  Dashboard Achat GLPI v5.0.0 - Test Suite" -ForegroundColor White
Write-Host "  Base URL : $Base" -ForegroundColor Gray

# ── 1. Systeme ───────────────────────────────────────────────
Section "1. SYSTEME"
Test-Endpoint GET "$Base/health"     "GET /health"
Test-Endpoint GET "$Base/api/config" "GET /api/config"

# ── 2. Authentification ──────────────────────────────────────
Section "2. AUTHENTIFICATION"

$loginResp = Test-Endpoint POST "$Base/api/auth/login" `
    "POST /api/auth/login (mock-responsable)" `
    -body @{ user_token = "mock-responsable" }
$tokenResponsable = $loginResp.access_token

$loginAcheteur = Test-Endpoint POST "$Base/api/auth/login" `
    "POST /api/auth/login (mock-acheteur)" `
    -body @{ user_token = "mock-acheteur" }
$tokenAcheteur = $loginAcheteur.access_token

$loginDemandeur = Test-Endpoint POST "$Base/api/auth/login" `
    "POST /api/auth/login (mock-demandeur)" `
    -body @{ user_token = "mock-demandeur" }
$tokenDemandeur = $loginDemandeur.access_token

Test-Endpoint POST "$Base/api/auth/login" `
    "POST /api/auth/login (token invalide - 401 attendu)" `
    -body @{ user_token = "token-invalide-xxx" } `
    -expectCode 401

$authResp = @{ "Authorization" = "Bearer $tokenResponsable" }
$authAch  = @{ "Authorization" = "Bearer $tokenAcheteur"   }
$authDem  = @{ "Authorization" = "Bearer $tokenDemandeur"  }

Test-Endpoint GET  "$Base/api/auth/me"     "GET  /api/auth/me (responsable)"       -headers $authResp
Test-Endpoint GET  "$Base/api/auth/me"     "GET  /api/auth/me (acheteur)"          -headers $authAch
Test-Endpoint GET  "$Base/api/auth/me"     "GET  /api/auth/me (demandeur)"         -headers $authDem
Test-Endpoint GET  "$Base/api/auth/me"     "GET  /api/auth/me (sans token - 401)"  -expectCode 401
Test-Endpoint POST "$Base/api/auth/logout" "POST /api/auth/logout"                 -headers $authResp

# ── 3. Metriques ─────────────────────────────────────────────
Section "3. METRIQUES"

foreach ($dim in @("global", "acheteur", "projet")) {
    Test-Endpoint GET "$Base/api/metrics/taux-realisation?dimension=$dim"  "GET /taux-realisation  dimension=$dim"
    Test-Endpoint GET "$Base/api/metrics/taux-retard?dimension=$dim"       "GET /taux-retard       dimension=$dim"
    Test-Endpoint GET "$Base/api/metrics/taux-rejet?dimension=$dim"        "GET /taux-rejet        dimension=$dim"
    Test-Endpoint GET "$Base/api/metrics/delai-moyen?dimension=$dim"       "GET /delai-moyen       dimension=$dim"
    Test-Endpoint GET "$Base/api/metrics/demandes-urgentes?dimension=$dim" "GET /demandes-urgentes dimension=$dim"
    Test-Endpoint GET "$Base/api/metrics/evolution?dimension=$dim"         "GET /evolution         dimension=$dim"
}

Test-Endpoint GET "$Base/api/metrics/taux-realisation?dimension=global&date_from=2026-01-01&date_to=2026-12-31" `
    "GET /taux-realisation avec dates"
Test-Endpoint GET "$Base/api/metrics/evolution?dimension=global&year=2026" `
    "GET /evolution YTD 2026"
Test-Endpoint GET "$Base/api/metrics/taux-retard?dimension=acheteur&date_from=2025-01-01" `
    "GET /taux-retard acheteur date_from"

# ── 4. Dashboard ─────────────────────────────────────────────
Section "4. DASHBOARD"
Test-Endpoint GET "$Base/api/dashboard/summary"                                           "GET /dashboard/summary"
Test-Endpoint GET "$Base/api/dashboard/summary?year=2026"                                 "GET /dashboard/summary year=2026"
Test-Endpoint GET "$Base/api/dashboard/summary?date_from=2026-01-01&date_to=2026-06-30"  "GET /dashboard/summary S1 2026"
Test-Endpoint GET "$Base/api/dashboard/summary?date_from=2025-01-01&date_to=2025-12-31"  "GET /dashboard/summary annee 2025"

# ── 5. Tickets sans auth ─────────────────────────────────────
Section "5. TICKETS (sans authentification)"
Test-Endpoint GET "$Base/api/tickets"                     "GET /tickets (sans auth)"
Test-Endpoint GET "$Base/api/tickets?limit=5"             "GET /tickets limit=5"
Test-Endpoint GET "$Base/api/tickets?limit=5&offset=10"   "GET /tickets pagination offset=10"
Test-Endpoint GET "$Base/api/tickets?status=1"            "GET /tickets status=1 (Nouveau)"
Test-Endpoint GET "$Base/api/tickets?status=2"            "GET /tickets status=2 (En cours)"
Test-Endpoint GET "$Base/api/tickets?status=5"            "GET /tickets status=5 (Resolu)"
Test-Endpoint GET "$Base/api/tickets?status=6"            "GET /tickets status=6 (Clos)"
Test-Endpoint GET "$Base/api/tickets?urgent_only=true"    "GET /tickets urgent_only=true"
Test-Endpoint GET "$Base/api/tickets?priority=4"          "GET /tickets priority=4 (Haute)"
Test-Endpoint GET "$Base/api/tickets?priority=5"          "GET /tickets priority=5 (Tres haute)"
Test-Endpoint GET "$Base/api/tickets?late_only=true"      "GET /tickets late_only=true"
Test-Endpoint GET "$Base/api/tickets/alerts"              "GET /tickets/alerts"
Test-Endpoint GET "$Base/api/tickets/1"                   "GET /tickets/1 (detail)"
Test-Endpoint GET "$Base/api/tickets/999"                 "GET /tickets/999 (inexistant - 404)" -expectCode 404

# ── 6. Tickets avec auth par role ────────────────────────────
Section "6. TICKETS (filtrage par role JWT)"
Test-Endpoint GET "$Base/api/tickets?limit=10" "GET /tickets (responsable - voit tout)"  -headers $authResp
Test-Endpoint GET "$Base/api/tickets?limit=10" "GET /tickets (acheteur - ses assignes)"  -headers $authAch
Test-Endpoint GET "$Base/api/tickets?limit=10" "GET /tickets (demandeur - ses demandes)" -headers $authDem
Test-Endpoint GET "$Base/api/tickets/1"        "GET /tickets/1 (responsable JWT)"        -headers $authResp
Test-Endpoint GET "$Base/api/tickets/alerts"   "GET /tickets/alerts (responsable JWT)"   -headers $authResp
Test-Endpoint GET "$Base/api/tickets?status=5&limit=5"        "GET /tickets status=5 + auth"     -headers $authResp
Test-Endpoint GET "$Base/api/tickets?urgent_only=true&limit=5" "GET /tickets urgents + auth"      -headers $authResp
Test-Endpoint GET "$Base/api/tickets?priority=4&limit=5"      "GET /tickets priority=4 + auth"   -headers $authResp

# ── 7. Referentiels ──────────────────────────────────────────
Section "7. REFERENTIELS"
Test-Endpoint GET "$Base/api/referentiels/acheteurs"     "GET /referentiels/acheteurs"
Test-Endpoint GET "$Base/api/referentiels/acheteurs/all" "GET /referentiels/acheteurs/all"
Test-Endpoint GET "$Base/api/referentiels/projets"       "GET /referentiels/projets"
Test-Endpoint GET "$Base/api/referentiels/projets/all"   "GET /referentiels/projets/all"
Test-Endpoint GET "$Base/api/referentiels/statuts"       "GET /referentiels/statuts"
Test-Endpoint GET "$Base/api/referentiels/categories"    "GET /referentiels/categories"
Test-Endpoint GET "$Base/api/referentiels/priorites"     "GET /referentiels/priorites"

# ── 8. Export Excel ──────────────────────────────────────────
Section "8. EXPORT EXCEL"
try {
    $resp = Invoke-WebRequest "$Base/api/export/excel" -UseBasicParsing
    if ($resp.StatusCode -eq 200 -and $resp.Content.Length -gt 1000) {
        $kb = [math]::Round($resp.Content.Length / 1024, 1)
        Write-Host "OK  GET /api/export/excel ($kb KB)" -ForegroundColor Green
        $global:ok++
    } else {
        Write-Host "WARN GET /api/export/excel - taille suspecte ($($resp.Content.Length) bytes)" -ForegroundColor Yellow
        $global:warn++
    }
} catch {
    Write-Host "ERR GET /api/export/excel - $($_.Exception.Message)" -ForegroundColor Red
    $global:fail++
}

try {
    $resp2 = Invoke-WebRequest "$Base/api/export/excel?date_from=2026-01-01&date_to=2026-06-30" -UseBasicParsing
    $kb2 = [math]::Round($resp2.Content.Length / 1024, 1)
    Write-Host "OK  GET /api/export/excel S1 2026 ($kb2 KB)" -ForegroundColor Green
    $global:ok++
} catch {
    Write-Host "ERR GET /api/export/excel S1 2026 - $($_.Exception.Message)" -ForegroundColor Red
    $global:fail++
}

# ── Resume ────────────────────────────────────────────────────
$total = $ok + $fail + $warn
Write-Host ""
Write-Host ("=" * 60) -ForegroundColor Cyan
$color = if ($fail -eq 0) { "Green" } else { "Yellow" }
Write-Host "  RESULTATS : $ok OK  /  $fail ERREURS  /  $warn WARNINGS  /  $total TOTAL" -ForegroundColor $color
Write-Host ("=" * 60) -ForegroundColor Cyan
Write-Host ""