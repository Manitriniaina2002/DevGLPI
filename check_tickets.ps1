$appToken  = "vkX3Fgp0HHCf3o4h9QNZwOu6CmEYhl0MI0yoNZ9h"
$userToken = "2PctZhtCg34JubcyaGhtb1aGFyahGQFwZhwgaIAV"

$headers = @{
    "App-Token"     = $appToken
    "Authorization" = "user_token $userToken"
    "Content-Type"  = "application/json"
}
$session = Invoke-RestMethod "http://localhost:1080/apirest.php/initSession" -Headers $headers
$sessionToken = $session.session_token

$headers2 = @{
    "App-Token"     = $appToken
    "Session-Token" = $sessionToken
    "Content-Type"  = "application/json"
}

# Voir tous les tickets
$tickets = Invoke-RestMethod "http://localhost:1080/apirest.php/Ticket?range=0-10" -Headers $headers2
$tickets | ForEach-Object { Write-Host "ID:$($_.id) | Statut:$($_.status) | Cat:$($_.itilcategories_id) | Titre:$($_.name)" }

Invoke-RestMethod "http://localhost:1080/apirest.php/killSession" -Headers $headers2 | Out-Null