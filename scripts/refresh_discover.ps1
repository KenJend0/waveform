# Script pour rafraîchir les découvertes via l'API admin
# Usage: .\scripts\refresh_discover.ps1 -Token "eyJ..."

param(
    [string]$Token = $env:ADMIN_TOKEN,
    [string]$ApiUrl = "http://localhost:4000"
)

# Couleurs
$green = "Green"
$blue = "Cyan"
$red = "Red"

Write-Host "`n🎵 Rafraîchissement des découvertes MusicBoxd" -ForegroundColor $blue
Write-Host "==================================" -ForegroundColor $blue

# Vérifier qu'on peut atteindre l'API
Write-Host "Vérification de l'API..." -ForegroundColor $blue
try {
    $null = Invoke-WebRequest -Uri "$ApiUrl/health" -Method Get -TimeoutSec 2 -ErrorAction Stop
    Write-Host "✅ API disponible" -ForegroundColor $green
} catch {
    Write-Host "❌ API non disponible à $ApiUrl" -ForegroundColor $red
    Write-Host "Assurez-vous que le serveur API tourne:"
    Write-Host "  cd api && npm run dev"
    exit 1
}

# Vérifier le token
if ([string]::IsNullOrEmpty($Token)) {
    Write-Host "❌ Token non défini" -ForegroundColor $red
    Write-Host "Options:"
    Write-Host "  1. Passer le token: .\refresh_discover.ps1 -Token 'eyJ...'"
    Write-Host "  2. Exporter la variable: `$env:ADMIN_TOKEN = 'eyJ...'"
    exit 1
}

Write-Host "✅ Token trouvé" -ForegroundColor $green

# Appeler l'endpoint
Write-Host "Rafraîchissement des découvertes..." -ForegroundColor $blue

try {
    $response = Invoke-WebRequest -Uri "$ApiUrl/admin/discover/refresh-enhanced" `
        -Method Post `
        -Headers @{
            "Content-Type" = "application/json"
            "Authorization" = "Bearer $Token"
        } `
        -ErrorAction Stop

    $content = $response.Content | ConvertFrom-Json
    
    Write-Host "`n✅ Résultat:" -ForegroundColor $green
    $content | Format-Table -AutoSize
    
    if ($content.ok -eq $true) {
        Write-Host "`n✅ Découvertes rafraîchies avec succès!" -ForegroundColor $green
        exit 0
    }
} catch {
    Write-Host "`n❌ Erreur lors du rafraîchissement" -ForegroundColor $red
    Write-Host "Détails: $_" -ForegroundColor $red
    exit 1
}
