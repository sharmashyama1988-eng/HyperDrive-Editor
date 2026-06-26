# HyperDrive 🌌
### The High-Performance, Offline-First AI Code Editor

HyperDrive is an enterprise-grade desktop code editor featuring native, fully-offline AI agentic capabilities, an integrated VS Code extension marketplace, auto-LSP server orchestration, and a gorgeous glassmorphism UI.

Developed to combine the customizability of VS Code with the extreme speed of native code compile structures, HyperDrive runs locally on your machine with no external telemetry dependencies.

---

## 🚀 Key Features

* **Offline AI Copilot**: Bundles Ollama out-of-the-box, running lightweight coding models (`qwen2.5-coder:1.5b`) directly on your machine.
* **Open VSX Marketplace Support**: Native search, download, and execution of VS Code `.vsix` extensions from the Open VSX Registry.
* **Auto-LSP Orchestration**: Dynamically scans installed extension paths, starts language server binaries (e.g. `pyright`, `rust-analyzer`), and bridges them to the editor.
* **Glassmorphism UI**: High-framerate, state-driven UI built with SolidJS, featuring responsive layouts, custom notifications, and chat history.
* **Git Integrations**: Built-in Git version control panel for staging, committing, and pushing code.
* **Automated Packaging**: Configured compilation pipeline that compiles the Python backend to a standalone `.exe` using PyInstaller, and generates an offline installer containing Ollama and the AI models via Inno Setup.

---

## 🛠️ Tech Stack

* **Frontend**: SolidJS, Vite, TypeScript, CodeMirror 6, GSAP.
* **Backend**: Python 3.12, PyWebView (Native Win32 shell), PyInstaller.
* **Core DLL**: Custom compiled C++ helper (`smooth_engine.dll`) for handling window rendering buffers and micro-animations.
* **Bundler & Installer**: Inno Setup 6 compiler script.

---

## 💻 Getting Started (Local Development)

### Prerequisites
* **Node.js** (v20 or higher)
* **Python** (v3.12)
* **Ollama Desktop** (For offline AI inference)

### 1. Clone & Install Dependencies
```bash
# Clone the repository
git clone https://github.com/sharmashyama1988-eng/HyperDrive-Editor.git
cd HyperDrive-Editor

# Install frontend packages
npm install

# Install python dependencies
python -m pip install --upgrade pip
pip install pyinstaller pywebview
```

### 2. Run the Development Server
```bash
# Start frontend dev server
npm run dev
```

In another terminal window:
```bash
# Start python desktop shell
python app.py
```

---

## 📦 Building & Compilation

### Automated CI/CD (Recommended)
This repository is configured with a GitHub Actions workflow. Every push to the `main` branch will automatically:
1. Compile the SolidJS frontend.
2. Package the Python backend using PyInstaller.
3. Cache/Download the 1.29 GB Ollama offline installer.
4. Download the `qwen2.5-coder:1.5b` model.
5. Package all files into a single Windows installer: `HyperDrive_Offline_Setup.exe` (using Inno Setup 6).
6. Upload the setup executable as an action artifact.

### Local Windows Compilation
Run the PowerShell build script:
```powershell
./build.ps1
```
Or run the batch file:
```cmd
build.bat
```

---

## 📄 License
This project is proprietary. Created by **Amit**.
All rights reserved.
