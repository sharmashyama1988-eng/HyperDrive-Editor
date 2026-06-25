# HyperDrive MSIX Signing Script
# Uses signtool.exe from Windows SDK to sign the generated MSIX package.

$PFXPath = "scripts\HyperDriveDev.pfx"
$PFXPassword = "HyperDrivePassword123"

# Find signtool.exe in standard Windows SDK installation paths
$SignToolPaths = @(
    "${env:ProgramFiles(x86)}\Windows Kits\10\bin\x64\signtool.exe",
    "${env:ProgramFiles(x86)}\Windows Kits\10\bin\10.0.22621.0\x64\signtool.exe",
    "${env:ProgramFiles(x86)}\Windows Kits\10\bin\10.0.19041.0\x64\signtool.exe"
)

$signtool = $null
foreach ($path in $SignToolPaths) {
    if (Test-Path $path) {
        $signtool = $path
        break
    }
}

if ($null -eq $signtool) {
    Write-Error "signtool.exe was not found. Please install the Windows 10/11 SDK to sign MSIX files."
    exit 1
}

# Locate the compiled MSIX file inside Tauri's target bundle directories
$MSIXFiles = Get-ChildItem -Path "src-tauri\target\release\bundle\msix\*.msix" -ErrorAction SilentlyContinue

if ($MSIXFiles.Count -eq 0) {
    Write-Warning "No generated MSIX files found inside target release directories. Run 'npm run tauri:build:msix' first."
    exit 1
}

foreach ($msix in $MSIXFiles) {
    Write-Host "Signing: $($msix.FullName)..." -ForegroundColor Cyan
    
    $args = @(
        "sign",
        "/f", $PFXPath,
        "/p", $PFXPassword,
        "/fd", "SHA256",
        "/a",
        $msix.FullName
    )
    
    & $signtool $args
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Successfully signed: $($msix.Name)" -ForegroundColor Green
    } else {
        Write-Error "Failed to sign: $($msix.Name)"
        exit 1
    }
}
