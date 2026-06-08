$base = "http://localhost:8000"
$ok = 0
$fail = 0

function Test-Endpoint {
    param($method, $url, $desc)
    try {
        $result = Invoke-RestMethod -Method $method -Uri $url
        Write-Host "OK  $desc" -ForegroundColor Green
        $global:ok++
    } catch {
        Write-Host "ERR $desc - $($_.Exception.Message)" -ForegroundColor Red
        $global:fail++
    }
}

Write-Host "`n=== Tests Dashboard Achat GLPI ===" -ForegroundColor Cyan

# Systeme
Test-Endpoint GET "$base/health"                                                    "GET /health"
Test-Endpoint GET "$base/api/config"                                                "GET /api/config"

# Metriques - global
Test-Endpoint GET "$base/api/metrics/taux-realisation?dimension=global"             "GET /taux-realisation global"
Test-Endpoint GET "$base/api/metrics/taux-realisation?dimension=acheteur"           "GET /taux-realisation acheteur"
Test-Endpoint GET "$base/api/metrics/taux-realisation?dimension=projet"             "GET /taux-realisation projet"

Test-Endpoint GET "$base/api/metrics/taux-retard?dimension=global"                 "GET /taux-retard global"
Test-Endpoint GET "$base/api/metrics/taux-retard?dimension=acheteur"               "GET /taux-retard acheteur"
Test-Endpoint GET "$base/api/metrics/taux-retard?dimension=projet"                 "GET /taux-retard projet"

Test-Endpoint GET "$base/api/metrics/taux-rejet?dimension=global"                  "GET /taux-rejet global"
Test-Endpoint GET "$base/api/metrics/taux-rejet?dimension=acheteur"                "GET /taux-rejet acheteur"
Test-Endpoint GET "$base/api/metrics/taux-rejet?dimension=projet"                  "GET /taux-rejet projet"

Test-Endpoint GET "$base/api/metrics/delai-moyen?dimension=global"                 "GET /delai-moyen global"
Test-Endpoint GET "$base/api/metrics/delai-moyen?dimension=acheteur"               "GET /delai-moyen acheteur"
Test-Endpoint GET "$base/api/metrics/delai-moyen?dimension=projet"                 "GET /delai-moyen projet"

Test-Endpoint GET "$base/api/metrics/demandes-urgentes?dimension=global"           "GET /demandes-urgentes global"
Test-Endpoint GET "$base/api/metrics/demandes-urgentes?dimension=acheteur"         "GET /demandes-urgentes acheteur"
Test-Endpoint GET "$base/api/metrics/demandes-urgentes?dimension=projet"           "GET /demandes-urgentes projet"

Test-Endpoint GET "$base/api/metrics/evolution?dimension=global"                   "GET /evolution global"
Test-Endpoint GET "$base/api/metrics/evolution?dimension=acheteur"                 "GET /evolution acheteur"
Test-Endpoint GET "$base/api/metrics/evolution?dimension=projet"                   "GET /evolution projet"

# Avec filtres de date
Test-Endpoint GET "$base/api/metrics/taux-realisation?dimension=global&date_from=2026-01-01&date_to=2026-12-31" "GET /taux-realisation avec dates"
Test-Endpoint GET "$base/api/metrics/evolution?dimension=global&year=2026"         "GET /evolution YTD 2026"

# Dashboard
Test-Endpoint GET "$base/api/dashboard/summary"                                    "GET /dashboard/summary"
Test-Endpoint GET "$base/api/dashboard/summary?year=2026"                          "GET /dashboard/summary YTD 2026"
Test-Endpoint GET "$base/api/dashboard/summary?date_from=2026-01-01&date_to=2026-06-30" "GET /dashboard/summary S1 2026"

# Tickets
Test-Endpoint GET "$base/api/tickets"                                              "GET /tickets"
Test-Endpoint GET "$base/api/tickets?limit=5"                                      "GET /tickets limit=5"
Test-Endpoint GET "$base/api/tickets?urgent_only=true"                             "GET /tickets urgents"
Test-Endpoint GET "$base/api/tickets?status=1"                                     "GET /tickets status=1 (Nouveau)"
Test-Endpoint GET "$base/api/tickets?status=5"                                     "GET /tickets status=5 (Resolu)"

# Referentiels
Test-Endpoint GET "$base/api/referentiels/acheteurs"                               "GET /referentiels/acheteurs"
Test-Endpoint GET "$base/api/referentiels/projets"                                 "GET /referentiels/projets"
Test-Endpoint GET "$base/api/referentiels/statuts"                                 "GET /referentiels/statuts"

Write-Host "`n=== Resultats : $ok OK / $fail erreurs ===" -ForegroundColor Cyan