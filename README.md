# HyperDrive Editor

**HyperDrive** is a high-performance, native code editor engineered for developers who prioritize speed and low-latency interaction. Built with a robust C++ core and a modern frontend, it leverages the [Tauri](https://tauri.app/) framework to deliver a seamless, lightweight, and highly responsive development environment.

## 🚀 Key Features
* **Native Performance:** Powered by a C++ core engine designed to handle large codebases and complex operations without lag.
* **Optimized Resource Usage:** Built with a minimal memory footprint for fast startup and efficient execution.
* **Extensible Architecture:** Designed to be modular, allowing for future expansion through plugins and extensions.
* **Cross-Platform Ready:** Engineered for consistency across Windows and other desktop environments.

## 🛠 Tech Stack
* **Core Engine:** C++
* **Desktop Framework:** [Tauri](https://tauri.app/)
* **Frontend:** TypeScript, Vite
* **Automation:** PowerShell, GitHub Actions

## 🏗 Project Structure
```text
.
├── src-cpp/       # High-performance C++ backend logic
├── src-tauri/     # Tauri application configuration
├── src/           # TypeScript/React frontend
├── .github/       # CI/CD workflows and automation
├── scripts/       # Build and maintenance utilities
└── build.ps1      # PowerShell build script for Windows
