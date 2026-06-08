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

$users = @(
    @{ name="RANDRIMBOLOLONA";     firstname="Mamindraibe"; login="mamindraibe" },
    @{ name="ANDRIANAIVONAMBININA";firstname="Abel";        login="abel" },
    @{ name="RANDRIAMAMPIANINA";   firstname="Odilon";      login="odilon" },
    @{ name="RAZANAJATOVO";        firstname="Marcel";      login="marcel" },
    @{ name="RAMAHEFASOA";         firstname="Francois";    login="francois" },
    @{ name="RAZAFINDRAVONY";      firstname="Annitah";     login="annitah" },
    @{ name="RANDRIAMIADANA";      firstname="Xavier";      login="xavier" },
    @{ name="ANDRIANANJANIAINA";   firstname="Sendrahasina";login="sendrahasina" },
    @{ name="MARLINE";             firstname="Haja";        login="haja" },
    @{ name="ANDRIAFEHIMIHARISOA"; firstname="Narimanga";   login="narimanga" },
    @{ name="RAKOTONDRABE";        firstname="Domoina";     login="domoina" },
    @{ name="HARILANDY";           firstname="Tahina";      login="tahina" },
    @{ name="RAZAFIMAMONJY";       firstname="Velonkaja";   login="velonkaja" },
    @{ name="RAZAFINIMANANA";      firstname="Henintsoa";   login="henintsoa" },
    @{ name="CLOTILDE";            firstname="Miharisoa";   login="clotilde" }
)

Write-Host "=== Creation des utilisateurs ADES ==="

foreach ($user in $users) {
    $user["password"] = "Glpi2026!"
    $body = @{ input = $user } | ConvertTo-Json -Depth 5
    try {
        $result = Invoke-RestMethod "http://localhost:1080/apirest.php/User" -Method POST -Headers $headers2 -Body $body
        Write-Host "OK : $($user.firstname) $($user.name) (ID: $($result.id))"
    } catch {
        Write-Host "ERREUR : $($user.firstname) $($user.name) - $($_.Exception.Message)"
    }
}

Invoke-RestMethod "http://localhost:1080/apirest.php/killSession" -Headers $headers2 | Out-Null
Write-Host "Termine."