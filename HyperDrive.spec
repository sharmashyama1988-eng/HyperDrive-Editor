# -*- mode: python ; coding: utf-8 -*-
# HyperDrive — PyInstaller Build Spec
# Run: pyinstaller HyperDrive.spec

import sys
from pathlib import Path

block_cipher = None

a = Analysis(
    ['app.py'],
    pathex=[str(Path('.').resolve())],
    binaries=[],
    datas=[
        # Frontend build output (SolidJS + Vite)
        ('dist', 'dist'),
        # App icon
        ('logo.ico', '.'),
        ('logo.png',  '.'),
        # Settings defaults
        ('settings.json', '.'),
        # Smooth Engine C++ DLL
        ('smooth_engine.dll', '.'),
    ],
    hiddenimports=[
        # PyWebView backends
        'webview',
        'webview.platforms.winforms',
        'webview.platforms.edgechromium',
        'webview.guilib',
        'clr',
        # Std library items sometimes missed
        'json',
        'os',
        'sys',
        'pathlib',
        'threading',
        'subprocess',
        'shutil',
        'glob',
        'fnmatch',
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[
        # Keep bundle lean
        'tkinter',
        'matplotlib',
        'numpy',
        'pandas',
        'scipy',
        'PIL',
        'cv2',
    ],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name='HyperDrive',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[
        'vcruntime140.dll',
        'python3*.dll',
    ],
    runtime_tmpdir=None,
    console=False,          # No black terminal window
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon='logo.ico',        # App icon
    version_file=None,
)
