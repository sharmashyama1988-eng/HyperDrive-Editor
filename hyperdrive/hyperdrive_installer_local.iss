; Inno Setup Script for HyperDrive Code Editor (Local Lightweight Version)
; Bundles HyperDrive and Smooth Engine C++ DLL only.

[Setup]
AppName=HyperDrive-Editor
AppVersion=1.0.0
DefaultDirName={commonpf}\HyperDrive-Editor
DefaultGroupName=HyperDrive-Editor
UninstallDisplayIcon={app}\HyperDrive-Editor.exe
Compression=zip
SolidCompression=yes
OutputDir={#GetEnv('USERPROFILE')}\Desktop
OutputBaseFilename=HyperDrive-Editor_Setup
SetupIconFile=logo.ico
PrivilegesRequired=admin

[Files]
; Main Executable and C++ Smooth Engine DLL
Source: "dist\HyperDrive-Editor.exe"; DestDir: "{app}"; Flags: ignoreversion
Source: "smooth_engine.dll"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{group}\HyperDrive-Editor"; Filename: "{app}\HyperDrive-Editor.exe"
Name: "{commondesktop}\HyperDrive-Editor"; Filename: "{app}\HyperDrive-Editor.exe"

[Run]
; Run HyperDrive-Editor post-install
Filename: "{app}\HyperDrive-Editor.exe"; Description: "Launch HyperDrive Code Editor"; Flags: nowait postinstall skipifsilent
