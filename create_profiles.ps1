$appToken  = "vkX3Fgp0HHCf3o4h9QNZwOu6CmEYhl0MI0yoNZ9h"
$userToken = "2PctZhtCg34JubcyaGhtb1aGFyahGQFwZhwgaIAV"

$headers = @{
    "App-Token"     = $appToken
    "Authorization" = "user_token $userToken"
    "Content-Type"  = "application/json"
}
$session      = Invoke-RestMethod "http://localhost:1080/apirest.php/initSession" -Headers $headers
$sessionToken = $session.session_token

$headers2 = @{
    "App-Token"     = $appToken
    "Session-Token" = $sessionToken
    "Content-Type"  = "application/json"
}

# Profils à créer
# interface : "central" (technicien/admin) ou "helpdesk" (self-service)
$profiles = @(
    @{ name="Demande Achat"; interface="helpdesk"; is_default=1 },
    @{ name="Acheteur";      interface="central";  is_default=0 },
    @{ name="Valideur";      interface="central";  is_default=0 },
    @{ name="Lead Achat";    interface="central";  is_default=0 },
    @{ name="CDG";           interface="central";  is_default=0 },
    @{ name="Comptable";     interface="central";  is_default=0 },
    @{ name="Support IT";    interface="helpdesk"; is_default=0 },
    @{ name="IT";            interface="central";  is_default=0 }
)

Write-Host "=== Creation des profils GLPI ===" -ForegroundColor Cyan

foreach ($profile in $profiles) {
    $body = @{ input = $profile } | ConvertTo-Json -Depth 5
    try {
        $result = Invoke-RestMethod "http://localhost:1080/apirest.php/Profile" `
            -Method POST -Headers $headers2 -Body $body
        Write-Host "OK : $($profile.name) (ID: $($result.id))" -ForegroundColor Green
    } catch {
        Write-Host "ERREUR : $($profile.name) - $($_.Exception.Message)" -ForegroundColor Red
    }
}

# Vérification : lister tous les profils
Write-Host "`n=== Profils existants ===" -ForegroundColor Cyan
$existing = Invoke-RestMethod "http://localhost:1080/apirest.php/Profile?range=0-30" -Headers $headers2
$existing | ForEach-Object {
    Write-Host "  ID:$($_.id) | $($_.name) | interface:$($_.interface)"
}

Invoke-RestMethod "http://localhost:1080/apirest.php/killSession" -Headers $headers2 | Out-Null
Write-Host "`nTermine." -ForegroundColor Cyan
