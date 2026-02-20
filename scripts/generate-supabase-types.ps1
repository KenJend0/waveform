# scripts/generate-supabase-types.ps1
# Génère les types TypeScript depuis Supabase (source de vérité)
# À exécuter une seule fois après validation du schéma BDD

param(
    [string]$ProjectId = "aypyrwqghxkgehibkfob"
)

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$OutputFile = Join-Path $ProjectRoot "frontend/types/database.ts"

Write-Host "Generating types from Supabase..." -ForegroundColor Cyan

if (-not (Get-Command npx -ErrorAction SilentlyContinue)) {
    Write-Host "npx not found in PATH. Please install Node.js/npm or use the bash script." -ForegroundColor Red
    exit 1
}

# Run the supabase generator and capture both stdout and stderr, then write to the output file
$cmd = @("supabase","gen","types","typescript","--project-id",$ProjectId,"--schema","public")
$output = & npx @cmd 2>&1

# Ensure output directory exists
$outDir = Split-Path -Parent $OutputFile
if (-not (Test-Path $outDir)) { New-Item -ItemType Directory -Path $outDir | Out-Null }

$output | Out-File -FilePath $OutputFile -Encoding utf8

if ($LASTEXITCODE -eq 0) {
    Write-Host "Types generated: $OutputFile" -ForegroundColor Green
    Write-Host "This file is READ-ONLY (generated from DB)" -ForegroundColor Yellow
    Write-Host "Do NOT edit manually" -ForegroundColor Red
} else {
    Write-Host "Error during generation. Contents of the output file:" -ForegroundColor Red
    Get-Content -Path $OutputFile -Raw | Write-Host
    exit $LASTEXITCODE
}
