# HyperDrive — Build Script (PowerShell)
# Usage: .\build.ps1
# Creates a standalone HyperDrive.exe

$ErrorActionPreference = "Stop"
$Host.UI.RawUI.WindowTitle = "HyperDrive — Build"

function Write-Step($n, $total, $msg) {
    Write-Host ""
    Write-Host "  [$n/$total] " -ForegroundColor Cyan -NoNewline
    Write-Host $msg -ForegroundColor White
}

function Write-OK($msg) {
    Write-Host "  ✓ " -ForegroundColor Green -NoNewline
    Write-Host $msg -ForegroundColor Gray
}

function Write-Fail($msg) {
    Write-Host "  ✗ " -ForegroundColor Red -NoNewline
    Write-Host $msg -ForegroundColor Red
}

Write-Host ""
Write-Host "  ╔══════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "  ║      HyperDrive — EXE Builder            ║" -ForegroundColor Cyan
Write-Host "  ╚══════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# ── Check we're in the right directory ────────────────────────────────────────
if (-not (Test-Path "app.py")) {
    Write-Fail "app.py not found. D:\HyperDrive folder mein se run karo."
    exit 1
}

# ── Step 1: Frontend build ─────────────────────────────────────────────────────
Write-Step 1 4 "Frontend build (SolidJS + Vite)..."
try {
    & npm run build
    if ($LASTEXITCODE -ne 0) { throw "npm build failed" }
    Write-OK "Frontend ready → dist/"
} catch {
    Write-Fail "Frontend build fail hua: $_"
    exit 1
}

# ── Step 2: Verify dist/index.html exists ──────────────────────────────────────
Write-Step 2 4 "Verifying build output..."
if (-not (Test-Path "dist\index.html")) {
    Write-Fail "dist\index.html nahi mila. Vite build kuch output nahi kiya."
    exit 1
}
$distFiles = (Get-ChildItem "dist" -Recurse | Measure-Object).Count
Write-OK "dist/ mein $distFiles files hain"

# ── Step 3: PyInstaller check / install ────────────────────────────────────────
Write-Step 3 4 "PyInstaller check..."
$piCheck = python -m pip show pyinstaller 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "  Installing PyInstaller..." -ForegroundColor Yellow
    python -m pip install pyinstaller
    if ($LASTEXITCODE -ne 0) {
        Write-Fail "PyInstaller install fail hua."
        exit 1
    }
}
$piVersion = (python -m PyInstaller --version 2>&1)
Write-OK "PyInstaller $piVersion"

# ── Step 4: Build EXE ─────────────────────────────────────────────────────────
Write-Step 4 4 "Building HyperDrive.exe..."
Write-Host "  (Yeh 1-3 minute le sakta hai...)" -ForegroundColor DarkGray
Write-Host ""

try {
    python -m PyInstaller HyperDrive.spec --clean --noconfirm
    if ($LASTEXITCODE -ne 0) { throw "PyInstaller failed" }
} catch {
    Write-Fail "EXE build fail hua: $_"
    exit 1
}

# ── Copy exe to root ───────────────────────────────────────────────────────────
$exePath = "dist\HyperDrive.exe"
if (Test-Path $exePath) {
    $size = [math]::Round((Get-Item $exePath).Length / 1MB, 1)
    Copy-Item $exePath "HyperDrive.exe" -Force

    Write-Host ""
    Write-Host "  ╔══════════════════════════════════════════╗" -ForegroundColor Green
    Write-Host "  ║   ✓  BUILD SUCCESSFUL!                   ║" -ForegroundColor Green
    Write-Host "  ╚══════════════════════════════════════════╝" -ForegroundColor Green
    Write-Host ""
    Write-Host "  📦 Size   : $size MB" -ForegroundColor White
    Write-Host "  📍 Path   : $(Resolve-Path 'HyperDrive.exe')" -ForegroundColor White
    Write-Host ""

    $run = Read-Host "  HyperDrive.exe abhi launch karein? (y/N)"
    if ($run -eq "y" -or $run -eq "Y") {
        Write-Host "  Launching HyperDrive..." -ForegroundColor Cyan
        Start-Process ".\HyperDrive.exe"
    }
} else {
    Write-Fail "EXE file nahi mili: $exePath"
    exit 1
}
