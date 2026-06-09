$appToken  = "vkX3Fgp0HHCf3o4h9QNZwOu6CmEYhl0MI0yoNZ9h"
$userToken = "2PctZhtCg34JubcyaGhtb1aGFyahGQFwZhwgaIAV"

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
# Recherche de l'entité ACHAT
# ==========================================
$entities = Invoke-RestMethod "$glpiUrl/Entity?range=0-999" -Headers $headers2

$entity = $entities | Where-Object {
    $_.completename -eq "Root (ADES) > ACHAT"
}

if (-not $entity) {
    Write-Host "Entité 'Root (ADES) > ACHAT' introuvable." -ForegroundColor Red
    exit
}

$entityId = $entity.id

Write-Host "Entité trouvée : $($entity.completename) (ID=$entityId)" -ForegroundColor Green

# ==========================================
# Groupes à créer
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
# Création des groupes manquants
# ==========================================
Write-Host "`nCréation des groupes..." -ForegroundColor Cyan

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

        Write-Host "[CRÉÉ] $groupName (ID=$($result.id))" -ForegroundColor Green
    }
    catch {
        Write-Host "[ERREUR] $groupName" -ForegroundColor Red
        Write-Host $_.Exception.Message
    }
}

# ==========================================
# Vérification finale
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
# Déconnexion
# ==========================================
Invoke-RestMethod "$glpiUrl/killSession" -Headers $headers2 | Out-Null

Write-Host "`nTerminé." -ForegroundColor Cyan