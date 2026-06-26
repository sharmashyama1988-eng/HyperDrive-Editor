# HyperDrive MSIX Packager Script
# Usage: powershell -ExecutionPolicy Bypass -File scripts/build-msix.ps1

$ErrorActionPreference = "Stop"

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "   HyperDrive - MSIX Packaging and Signing Script   " -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

$StageDir = "dist\msix_stage"
$AssetsDir = "$StageDir\Assets"
$OutPackage = "dist\HyperDrive.msix"
$PFXPath = "scripts\HyperDriveDev.pfx"
$PFXPassword = "HyperDrivePassword123"

# 1. Verify requirements
if (-not (Test-Path "dist\HyperDrive.exe")) {
    Write-Error "dist\HyperDrive.exe not found. Please run PyInstaller build first."
    exit 1
}

# 2. Check Developer Certificate
if (-not (Test-Path $PFXPath)) {
    Write-Host "[INFO] Developer PFX certificate not found. Generating..." -ForegroundColor Yellow
    & powershell -ExecutionPolicy Bypass -File scripts\create-cert.ps1
}

# 3. Clean and create staging directories
if (Test-Path $StageDir) {
    Remove-Item $StageDir -Recurse -Force
}
New-Item -ItemType Directory -Path $AssetsDir -Force > $null

# 4. Copy binaries
Write-Host "[INFO] Copying executable and DLLs to staging..." -ForegroundColor Gray
Copy-Item "dist\HyperDrive.exe" "$StageDir\HyperDrive.exe" -Force
if (Test-Path "smooth_engine.dll") {
    Copy-Item "smooth_engine.dll" "$StageDir\smooth_engine.dll" -Force
}

# 5. Copy icons and assets
Write-Host "[INFO] Staging assets..." -ForegroundColor Gray
$IconSource = "src-tauri\icons"
if (Test-Path $IconSource) {
    Copy-Item "$IconSource\StoreLogo.png" "$AssetsDir\StoreLogo.png" -Force
    Copy-Item "$IconSource\Square150x150Logo.png" "$AssetsDir\Square150x150Logo.png" -Force
    Copy-Item "$IconSource\Square44x44Logo.png" "$AssetsDir\Square44x44Logo.png" -Force
    
    # Fallback/default images for other manifest requirements
    Copy-Item "$IconSource\Square150x150Logo.png" "$AssetsDir\Wide310x150Logo.png" -Force
    Copy-Item "$IconSource\Square150x150Logo.png" "$AssetsDir\SplashScreen.png" -Force
} else {
    Write-Error "Source icons not found in $IconSource."
    exit 1
}

# 6. Write AppxManifest.xml
Write-Host "[INFO] Creating AppxManifest.xml..." -ForegroundColor Gray
$ManifestContent = @"
<?xml version="1.0" encoding="utf-8"?>
<Package
  xmlns="http://schemas.microsoft.com/appx/manifest/foundation/windows10"
  xmlns:uap="http://schemas.microsoft.com/appx/manifest/uap/windows10"
  xmlns:rescap="http://schemas.microsoft.com/appx/manifest/foundation/windows10/restrictedcapabilities"
  IgnorableNamespaces="uap rescap">

  <Identity
    Name="com.hyperdrive.editor"
    Publisher="CN=Amit, O=HyperDrive, C=IN"
    Version="1.0.0.0"
    ProcessorArchitecture="x64" />

  <Properties>
    <DisplayName>HyperDrive Code Editor</DisplayName>
    <PublisherDisplayName>HyperDrive Core Team</PublisherDisplayName>
    <Logo>Assets\StoreLogo.png</Logo>
  </Properties>

  <Resources>
    <Resource Language="en-us" />
  </Resources>

  <Dependencies>
    <TargetDeviceFamily Name="Windows.Universal" MinVersion="10.0.17763.0" MaxVersionTested="10.0.22621.0" />
  </Dependencies>

  <Capabilities>
    <rescap:Capability Name="runFullTrust" />
  </Capabilities>

  <Applications>
    <Application Id="HyperDrive"
      Executable="HyperDrive.exe"
      EntryPoint="Windows.FullTrustApplication">
      <uap:VisualElements
        DisplayName="HyperDrive"
        Description="Ultra-optimized developer editor."
        BackgroundColor="#0b0b0d"
        Square150x150Logo="Assets\Square150x150Logo.png"
        Square44x44Logo="Assets\Square44x44Logo.png">
        <uap:DefaultTile Wide310x150Logo="Assets\Wide310x150Logo.png" />
        <uap:SplashScreen Image="Assets\SplashScreen.png" />
      </uap:VisualElements>
    </Application>
  </Applications>
</Package>
"@

$ManifestContent | Out-File -FilePath "$StageDir\AppxManifest.xml" -Encoding utf8

# 7. Package using MSIX Hero CLI
Write-Host "[INFO] Packaging folder to MSIX..." -ForegroundColor Gray
if (Test-Path $OutPackage) {
    Remove-Item $OutPackage -Force
}
& MSIXHeroCLI.exe pack -d $StageDir -p $OutPackage

if (-not (Test-Path $OutPackage)) {
    Write-Error "MSIX packaging failed."
    exit 1
}
Write-Host "[SUCCESS] MSIX Package created at $OutPackage" -ForegroundColor Green

# 8. Sign MSIX using MSIX Hero CLI
Write-Host "[INFO] Signing MSIX Package..." -ForegroundColor Gray
& MSIXHeroCLI.exe sign -f $PFXPath -p $PFXPassword -t http://timestamp.digicert.com $OutPackage

Write-Host "==================================================" -ForegroundColor Green
Write-Host "MSIX Build and Signing Complete!" -ForegroundColor Green
Write-Host "Package: $OutPackage" -ForegroundColor White
Write-Host "==================================================" -ForegroundColor Green
