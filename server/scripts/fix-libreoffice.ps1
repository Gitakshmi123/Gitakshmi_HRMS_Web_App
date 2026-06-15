param(
  [string]$SofficePath = "C:\Program Files\LibreOffice\program\soffice.exe",
  [switch]$SafeMode
)

$ErrorActionPreference = "SilentlyContinue"

Write-Host "== LibreOffice Repair Script ==" -ForegroundColor Cyan

# STEP 1: Kill all LibreOffice processes
Write-Host "[1/9] Killing LibreOffice processes..." -ForegroundColor Yellow
taskkill /F /IM soffice.bin /T | Out-Null
taskkill /F /IM soffice.exe /T | Out-Null

# STEP 2: Reset LibreOffice user profile
Write-Host "[2/9] Resetting LibreOffice user profile..." -ForegroundColor Yellow
$loProfileRoot = Join-Path $env:APPDATA "LibreOffice"
$loProfile4 = Join-Path $loProfileRoot "4"
if (Test-Path $loProfile4) {
  $backup = Join-Path $loProfileRoot ("4_old_" + (Get-Date -Format "yyyyMMdd_HHmmss"))
  Rename-Item -Path $loProfile4 -NewName (Split-Path $backup -Leaf) | Out-Null
  Write-Host "Renamed profile folder to: $backup" -ForegroundColor Green
} else {
  Write-Host "Profile folder not found, skipping." -ForegroundColor DarkGray
}

# STEP 3/4: Verify installation + validate soffice path
Write-Host "[3/9] Checking soffice path..." -ForegroundColor Yellow
if (-not (Test-Path $SofficePath)) {
  Write-Host "Default path not found. Searching with 'where soffice'..." -ForegroundColor Yellow
  $found = (where.exe soffice 2>$null | Select-Object -First 1)
  if ($found -and (Test-Path $found)) {
    $SofficePath = $found
    Write-Host "Found soffice at: $SofficePath" -ForegroundColor Green
  } else {
    Write-Host "LibreOffice not found. Please reinstall LibreOffice." -ForegroundColor Red
    Write-Host "Download: https://www.libreoffice.org/download/download/" -ForegroundColor Red
    exit 1
  }
} else {
  Write-Host "Found soffice at: $SofficePath" -ForegroundColor Green
}

# STEP 5: Run LibreOffice in safe mode (optional, interactive)
if ($SafeMode) {
  Write-Host "[5/9] Starting LibreOffice safe mode (interactive)..." -ForegroundColor Yellow
  Start-Process -FilePath $SofficePath -ArgumentList "--safe-mode" -Verb RunAs
  Write-Host "LibreOffice safe mode started. Use 'Reset to factory settings' if needed." -ForegroundColor Green
}

# STEP 6: Permission hint
Write-Host "[6/9] Permission check..." -ForegroundColor Yellow
Write-Host "If conversion fails, run your Node.js service as Administrator or grant execute permission on soffice.exe." -ForegroundColor DarkGray

Write-Host "Done." -ForegroundColor Cyan

