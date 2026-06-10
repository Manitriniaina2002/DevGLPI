# ============================================================
#  test_form_parser.ps1
#  Récupère le content réel des tickets GLPI et teste le parser
# ============================================================
param(
    [string]$GlpiUrl   = "http://localhost:1080",
    [string]$AppToken  = "3eb0995b74d348d50ac331233bc89a6dcd7aee58",
    [string]$UserToken = "If5wJsBe9skoudqYR3oJ8XO4UOll8h5VUDZzNSx0"
)

# ── Connexion GLPI ─────────────────────────────────────────
$headers = @{
    "App-Token"     = $AppToken
    "Authorization" = "user_token $UserToken"
    "Content-Type"  = "application/json"
}
$session      = Invoke-RestMethod "$GlpiUrl/apirest.php/initSession" -Headers $headers
$sessionToken = $session.session_token
Write-Host "Session OK : $sessionToken" -ForegroundColor Green

$h = @{
    "App-Token"     = $AppToken
    "Session-Token" = $sessionToken
    "Content-Type"  = "application/json"
}

# ── Récupérer les tickets avec leur content ────────────────
Write-Host "`n=== ANALYSE DU CONTENT DES TICKETS ===" -ForegroundColor Cyan

$tickets = Invoke-RestMethod "$GlpiUrl/apirest.php/Ticket?range=0-5&expand_dropdowns=1" -Headers $h

foreach ($t in $tickets) {
    Write-Host ""
    Write-Host "--- Ticket ID:$($t.id) | $($t.name) ---" -ForegroundColor Yellow
    Write-Host "  status   : $($t.status)"
    Write-Host "  urgency  : $($t.urgency)"
    Write-Host "  priority : $($t.priority)"
    Write-Host "  category : $($t.itilcategories_id)"
    Write-Host "  assign   : $($t.users_id_assign)"
    Write-Host "  requester: $($t.users_id_requester)"

    if ($t.content) {
        Write-Host "`n  CONTENT HTML :" -ForegroundColor Cyan

        # Extraire les champs avec regex (simule le form_parser Python)
        $content = $t.content

        # Nettoyer le HTML basiquement
        $text = $content -replace '<[^>]+>', ' '
        $text = [System.Web.HttpUtility]::HtmlDecode($text)
        $text = $text -replace '\s+', ' '

        Write-Host "  (brut nettoyé) : $($text.Substring(0, [Math]::Min(300, $text.Length)))" -ForegroundColor Gray

        # Parser les champs clés
        $fields = @("Projet", "Service demandeur", "Urgence", "Objet",
                    "Description", "Beneficiaire", "Lieu de livraison", "A valider par")

        Write-Host "`n  CHAMPS EXTRAITS :" -ForegroundColor Green
        foreach ($field in $fields) {
            $pattern = "$field\s*:\s*([^\n<]{1,80})"
            if ($text -match $pattern) {
                Write-Host "  $field : $($Matches[1].Trim())" -ForegroundColor White
            }
        }
    } else {
        Write-Host "  CONTENT : (vide)" -ForegroundColor Red
    }
}

# ── Test du backend enrichi ────────────────────────────────
Write-Host "`n=== TEST VIA BACKEND API ===" -ForegroundColor Cyan

$backendTickets = Invoke-RestMethod "http://localhost:9000/api/tickets?limit=5" -Headers @{ "Content-Type" = "application/json" }

Write-Host "Total tickets backend : $($backendTickets.total)"
foreach ($t in $backendTickets.tickets) {
    Write-Host ""
    Write-Host "  ID:$($t.id) | $($t.name)" -ForegroundColor Yellow
    Write-Host "  acheteur : $($t.acheteur)"
    Write-Host "  projet   : $($t.projet)"
    Write-Host "  status   : $($t.status_label)"
}

# ── Déconnexion ────────────────────────────────────────────
Invoke-RestMethod "$GlpiUrl/apirest.php/killSession" -Headers $h | Out-Null
Write-Host "`nTermine." -ForegroundColor Green
