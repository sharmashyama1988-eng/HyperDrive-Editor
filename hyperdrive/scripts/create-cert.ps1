# HyperDrive Developer Certificate Generator
# Creates a self-signed code signing certificate and exports it to a .pfx file

$CertSubject = "CN=Amit, O=HyperDrive, C=IN"
$CertPath = "Cert:\CurrentUser\My"
$PFXPath = "scripts\HyperDriveDev.pfx"
$PFXPassword = "HyperDrivePassword123"

Write-Host "Creating self-signed certificate..." -ForegroundColor Cyan

$cert = New-SelfSignedCertificate -Subject $CertSubject `
                                  -Type CodeSigning `
                                  -CertStoreLocation $CertPath `
                                  -KeyUsage DigitalSignature `
                                  -FriendlyName "HyperDrive Developer Cert" `
                                  -NotAfter (Get-Date).AddYears(2)

Write-Host "Exporting certificate to PFX..." -ForegroundColor Cyan
$pwd = ConvertTo-SecureString -String $PFXPassword -Force -AsPlainText
$cert | Export-PfxCertificate -FilePath $PFXPath -Password $pwd

Write-Host "Certificate generated successfully at: $PFXPath" -ForegroundColor Green
Write-Host "Note: Double click on the generated PFX to install it in 'Trusted People' on your local machine before sideloading." -ForegroundColor Yellow
