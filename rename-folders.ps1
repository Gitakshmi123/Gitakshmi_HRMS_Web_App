# Run this script AFTER stopping npm run dev and any process using backend/ or frontend/
# Usage: .\rename-folders.ps1
$root = $PSScriptRoot
if (Test-Path (Join-Path $root "backend")) {
    Rename-Item -Path (Join-Path $root "backend") -NewName "server"
    Write-Host "Renamed backend -> server"
} else {
    Write-Host "backend folder not found (already renamed?)"
}
if (Test-Path (Join-Path $root "frontend")) {
    Rename-Item -Path (Join-Path $root "frontend") -NewName "client"
    Write-Host "Renamed frontend -> client"
} else {
    Write-Host "frontend folder not found (already renamed?)"
}
Write-Host "Done. Run: npm install && npm run dev"
