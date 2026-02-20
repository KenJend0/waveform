# scripts/generate-supabase-types.ps1
# Génère les types TypeScript depuis Supabase (source de vérité)
# À exécuter une seule fois après validation du schéma BDD

param(
    [string]$ProjectId = "aypyrwqghxkgehibkfob"
)

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$OutputFile = Join-Path $ProjectRoot "frontend/types/database.ts"

Write-Host "Generating types from Supabase..." -ForegroundColor Cyan

& npx supabase gen types typescript `
    --project-id $ProjectId `
    --schema public `
    > $OutputFile 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host "Types generated: $OutputFile" -ForegroundColor Green
    Write-Host "This file is READ-ONLY (generated from DB)" -ForegroundColor Yellow
    Write-Host "Do NOT edit manually" -ForegroundColor Red
} else {
    Write-Host "Error during generation" -ForegroundColor Red
    exit 1
}
