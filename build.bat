@echo off
title HyperDrive — Build EXE
color 0A

echo.
echo  ██╗  ██╗██╗   ██╗██████╗ ███████╗██████╗ ██████╗ ██████╗ ██╗██╗   ██╗███████╗
echo  ██║  ██║╚██╗ ██╔╝██╔══██╗██╔════╝██╔══██╗██╔══██╗██╔══██╗██║██║   ██║██╔════╝
echo  ███████║ ╚████╔╝ ██████╔╝█████╗  ██████╔╝██║  ██║██████╔╝██║██║   ██║█████╗
echo  ██╔══██║  ╚██╔╝  ██╔═══╝ ██╔══╝  ██╔══██╗██║  ██║██╔══██╗██║╚██╗ ██╔╝██╔══╝
echo  ██║  ██║   ██║   ██║     ███████╗██║  ██║██████╔╝██║  ██║██║ ╚████╔╝ ███████╗
echo  ╚═╝  ╚═╝   ╚═╝   ╚═╝     ╚══════╝╚═╝  ╚═╝╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═══╝  ╚══════╝
echo.
echo  [BUILD] Starting production build...
echo  ============================================================
echo.

:: ── Step 1: Frontend Build ──────────────────────────────────────────────────
echo  [1/3] Building frontend (SolidJS + Vite)...
echo.
call npm run build
if %ERRORLEVEL% NEQ 0 (
    color 0C
    echo.
    echo  [ERROR] Frontend build failed! Check errors above.
    pause
    exit /b 1
)
echo.
echo  [OK] Frontend build complete.
echo.

:: ── Step 2: Check PyInstaller ───────────────────────────────────────────────
echo  [2/3] Checking PyInstaller...
python -m pip show pyinstaller >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo  [INFO] PyInstaller not found, installing...
    python -m pip install pyinstaller
    if %ERRORLEVEL% NEQ 0 (
        color 0C
        echo  [ERROR] Could not install PyInstaller.
        pause
        exit /b 1
    )
)
echo  [OK] PyInstaller ready.
echo.

:: ── Step 3: PyInstaller EXE Build ───────────────────────────────────────────
echo  [3/3] Building HyperDrive.exe with PyInstaller...
echo.
pyinstaller HyperDrive.spec --clean --noconfirm
if %ERRORLEVEL% NEQ 0 (
    color 0C
    echo.
    echo  [ERROR] EXE build failed! Check errors above.
    pause
    exit /b 1
)

:: ── Done ────────────────────────────────────────────────────────────────────
echo.
echo  ============================================================
color 0A
echo  [SUCCESS] HyperDrive.exe built successfully!
echo.
echo  Location: %CD%\dist\HyperDrive.exe
echo.

:: Copy exe to root for quick access
if exist "dist\HyperDrive.exe" (
    copy /Y "dist\HyperDrive.exe" "HyperDrive.exe" >nul
    echo  [INFO] Copied to: %CD%\HyperDrive.exe
)

echo.
echo   Done!
