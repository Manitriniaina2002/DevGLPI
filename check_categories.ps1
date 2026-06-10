$appToken  = "3eb0995b74d348d50ac331233bc89a6dcd7aee58"
$userToken = "If5wJsBe9skoudqYR3oJ8XO4UOll8h5VUDZzNSx0"

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

$cats = Invoke-RestMethod "http://localhost:1080/apirest.php/ITILCategory?range=0-50" -Headers $headers2
$cats | ForEach-Object { Write-Host "ID:$($_.id) | Nom:$($_.name) | CompleteName:$($_.completename)" }

Invoke-RestMethod "http://localhost:1080/apirest.php/killSession" -Headers $headers2 | Out-Null




