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

$tickets = @(
    @{ name="Achat PC portable M004";           status=1; priority=3; date="2026-01-10 08:00:00" },
    @{ name="Commande imprimante codes barres";  status=5; priority=4; date="2026-01-15 08:00:00"; closedate="2026-01-25 17:00:00" },
    @{ name="Achat souris sans fil";             status=5; priority=2; date="2026-02-03 08:00:00"; closedate="2026-02-10 17:00:00" },
    @{ name="Achat Switch PoE 6 ports";          status=1; priority=4; date="2026-02-11 08:00:00" },
    @{ name="Commande carburant CDP Tanjombato"; status=5; priority=5; date="2026-02-20 08:00:00"; closedate="2026-02-22 17:00:00" },
    @{ name="Achat materiel reboisement M300";   status=1; priority=3; date="2026-03-01 08:00:00" },
    @{ name="Commande smartphone ADES";          status=5; priority=3; date="2026-03-10 08:00:00"; closedate="2026-03-20 17:00:00" },
    @{ name="Achat groupe electrogene";          status=1; priority=5; date="2026-03-15 08:00:00" },
    @{ name="Fourniture bureau DN Mahasina";     status=5; priority=2; date="2026-04-02 08:00:00"; closedate="2026-04-08 17:00:00" },
    @{ name="Achat jeune plante reboisement";    status=5; priority=3; date="2026-04-10 08:00:00"; closedate="2026-04-15 17:00:00" },
    @{ name="Commande roulement 6205";           status=1; priority=3; date="2026-04-20 08:00:00" },
    @{ name="Achat adapteur HDMI VGA";           status=1; priority=2; date="2026-05-05 08:00:00" },
    @{ name="Fourniture informatique M004";      status=5; priority=4; date="2026-05-10 08:00:00"; closedate="2026-05-18 17:00:00" },
    @{ name="Achat imprimante CDV Majunga";      status=1; priority=3; date="2026-05-15 08:00:00" },
    @{ name="Commande materiel cuisine CI";      status=5; priority=3; date="2026-05-20 08:00:00"; closedate="2026-05-28 17:00:00" },
    @{ name="Achat FER production M101";         status=1; priority=4; date="2026-06-01 08:00:00" },
    @{ name="Commande fourniture M005 Marketing";status=1; priority=2; date="2026-06-03 08:00:00" },
    @{ name="Achat ecran PC equipe vente";       status=5; priority=3; date="2026-06-05 08:00:00"; closedate="2026-06-07 17:00:00" }
)

Write-Host "=== Creation des tickets de test ==="

foreach ($ticket in $tickets) {
    $body = @{ input = $ticket } | ConvertTo-Json -Depth 5
    try {
        $result = Invoke-RestMethod "http://localhost:1080/apirest.php/Ticket" -Method POST -Headers $headers2 -Body $body
        Write-Host "OK : $($ticket.name) (ID: $($result.id))"
    } catch {
        Write-Host "ERREUR : $($ticket.name) - $($_.Exception.Message)"
    }
}

Invoke-RestMethod "http://localhost:1080/apirest.php/killSession" -Headers $headers2 | Out-Null
Write-Host "Termine."