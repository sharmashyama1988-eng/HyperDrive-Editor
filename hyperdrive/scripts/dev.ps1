# HyperDrive Local Dev Bootstrapper
# Automatically configures local Rust path, verifies Node.js, generates PNG assets,
# installs dependencies, and boots up Tauri live hot-reload server.
# One-click execution for perfect user setup.

$ErrorActionPreference = "Stop"

Write-Host "==============================================" -ForegroundColor Green
Write-Host "   ⚡ Bootstrapping HyperDrive Dev Environment   " -ForegroundColor Green
Write-Host "==============================================" -ForegroundColor Green

# 1. PATH configurations
Write-Host "[1/5] Configuring environment paths..." -ForegroundColor Cyan
$env:PATH = "$env:USERPROFILE\.cargo\bin;$env:PATH"

# 2. Verify requirements
Write-Host "[2/5] Verifying toolchains..." -ForegroundColor Cyan
if ($null -eq (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Error "Node.js was not found. Please install Node.js from https://nodejs.org"
    exit 1
}
if ($null -eq (Get-Command cargo -ErrorAction SilentlyContinue)) {
    Write-Host "Rust toolchain not on path. Attempting to install via rustup..." -ForegroundColor Yellow
    winget install Rustlang.Rustup --accept-source-agreements --accept-package-agreements
    $env:PATH = "$env:USERPROFILE\.cargo\bin;$env:PATH"
}

Write-Host "✓ Node.js version: $(node --version)" -ForegroundColor Green
Write-Host "✓ Cargo version: $(cargo --version)" -ForegroundColor Green

# 3. NPM package installs
Write-Host "[3/5] Installing frontend packages..." -ForegroundColor Cyan
npm install

# 4. Icon Generation
Write-Host "[4/5] Building app asset icons..." -ForegroundColor Cyan
node scripts/generate-icon.js
npx -p @tauri-apps/cli tauri icon src-tauri/icons/icon.png

# 5. Spawning Tauri hot reload dev server
Write-Host "[5/5] Launching hot-reload development mode..." -ForegroundColor Cyan
Write-Host "Spawning dev window... Press Ctrl+C in this shell to stop." -ForegroundColor Yellow
npm run tauri dev
