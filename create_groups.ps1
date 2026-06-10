$appToken  = "3eb0995b74d348d50ac331233bc89a6dcd7aee58"
$userToken = "If5wJsBe9skoudqYR3oJ8XO4UOll8h5VUDZzNSx0"

$glpiUrl = "http://localhost:1080/apirest.php"

# ==========================================
# Connexion GLPI
# ==========================================
$headers = @{
    "App-Token"     = $appToken
    "Authorization" = "user_token $userToken"
    "Content-Type"  = "application/json"
}

$session = Invoke-RestMethod "$glpiUrl/initSession" -Headers $headers
$sessionToken = $session.session_token

$headers2 = @{
    "App-Token"     = $appToken
    "Session-Token" = $sessionToken
    "Content-Type"  = "application/json"
}

# ==========================================
# Recherche de l'entitÃ© ACHAT
# ==========================================
$entities = Invoke-RestMethod "$glpiUrl/Entity?range=0-999" -Headers $headers2

$entity = $entities | Where-Object {
    $_.completename -eq "Root (ADES) > ACHAT"
}

if (-not $entity) {
    Write-Host "EntitÃ© 'Root (ADES) > ACHAT' introuvable." -ForegroundColor Red
    exit
}

$entityId = $entity.id

Write-Host "EntitÃ© trouvÃ©e : $($entity.completename) (ID=$entityId)" -ForegroundColor Green

# ==========================================
# Groupes Ã  crÃ©er
# ==========================================
$groupsToCreate = @(
    "Co2 & Direction",
    "Cuisine Institutionnelle (CI)",
    "Finance",
    "Informatique",
    "Logistique",
    "Production",
    "Programme-Ecole (PE)",
    "Ressources Humaines (RH)",
    "Vente/Marketing",
    "Reboisement",
    "Projet CEPF",
    "Maryn MOHN DROUET",
    "Velonkaja RAZAFIMAMONJY",
    "Mbolatiana RASOAMAHEFA",
    "Nantenaina RAKOTOSON"
)

# ==========================================
# Lecture des groupes existants
# ==========================================
Write-Host "`nLecture des groupes existants..." -ForegroundColor Cyan

$existingGroups = Invoke-RestMethod "$glpiUrl/Group?range=0-999" -Headers $headers2

$existingNames = @()
$existingGroups | ForEach-Object {
    $existingNames += $_.name
}

# ==========================================
# CrÃ©ation des groupes manquants
# ==========================================
Write-Host "`nCrÃ©ation des groupes..." -ForegroundColor Cyan

foreach ($groupName in $groupsToCreate) {

    if ($existingNames -contains $groupName) {
        Write-Host "[EXISTE] $groupName" -ForegroundColor Yellow
        continue
    }

    $body = @{
        input = @{
            name        = $groupName
            entities_id = $entityId
            comment     = ""
        }
    } | ConvertTo-Json -Depth 5

    try {
        $result = Invoke-RestMethod `
            "$glpiUrl/Group" `
            -Method POST `
            -Headers $headers2 `
            -Body $body

        Write-Host "[CRÃ‰Ã‰] $groupName (ID=$($result.id))" -ForegroundColor Green
    }
    catch {
        Write-Host "[ERREUR] $groupName" -ForegroundColor Red
        Write-Host $_.Exception.Message
    }
}

# ==========================================
# VÃ©rification finale
# ==========================================
Write-Host "`n===== GROUPES ACHAT =====" -ForegroundColor Cyan

$groups = Invoke-RestMethod "$glpiUrl/Group?range=0-999" -Headers $headers2

$groups |
    Where-Object { $groupsToCreate -contains $_.name } |
    Sort-Object name |
    ForEach-Object {
        Write-Host "$($_.id) - $($_.name)"
    }

# ==========================================
# DÃ©connexion
# ==========================================
Invoke-RestMethod "$glpiUrl/killSession" -Headers $headers2 | Out-Null

Write-Host "`nTerminÃ©." -ForegroundColor Cyan




