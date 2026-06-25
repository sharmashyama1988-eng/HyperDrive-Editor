; Inno Setup Script for HyperDrive Code Editor
; Bundles HyperDrive, Smooth Engine C++ DLL, Ollama Setup, and Offline Models.

[Setup]
AppName=HyperDrive
AppVersion=1.0.0
DefaultDirName={commonpf}\HyperDrive
DefaultGroupName=HyperDrive
UninstallDisplayIcon={app}\HyperDrive.exe
Compression=zip/1
SolidCompression=no
OutputDir=setup_out
OutputBaseFilename=HyperDrive_Offline_Setup
SetupIconFile=logo.ico
PrivilegesRequired=admin

[Files]
; Main Executable and C++ Smooth Engine DLL
Source: "dist\HyperDrive.exe"; DestDir: "{app}"; Flags: ignoreversion
Source: "smooth_engine.dll"; DestDir: "{app}"; Flags: ignoreversion

; Offline Ollama Setup Installer
Source: "OllamaSetup.exe"; DestDir: "{tmp}"; Flags: deleteafterinstall

; Offline Ollama Models - Copies sha256 blobs and manifests to target user profile
Source: "{#GetEnv('USERPROFILE')}\.ollama\models\*"; DestDir: "{%USERPROFILE}\.ollama\models"; Flags: recursesubdirs createallsubdirs ignoreversion

[Icons]
Name: "{group}\HyperDrive"; Filename: "{app}\HyperDrive.exe"
Name: "{commondesktop}\HyperDrive"; Filename: "{app}\HyperDrive.exe"

[Run]
; Install Ollama silently in the background
Filename: "{tmp}\OllamaSetup.exe"; Parameters: "/silent /verysilent /sp- /norestart"; StatusMsg: "Installing Ollama AI Core (this may take a few seconds)..."; Flags: runhidden

; Run HyperDrive post-install
Filename: "{app}\HyperDrive.exe"; Description: "Launch HyperDrive Code Editor"; Flags: nowait postinstall skipifsilent
