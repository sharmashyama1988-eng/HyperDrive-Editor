export interface ProjectTemplateFile {
  name: string;
  content: string;
}

export interface ProjectTemplate {
  id: string;
  name: string;
  description: string;
  category: "web" | "python" | "java" | "ui-designer";
  icon: string;
  files: ProjectTemplateFile[];
}

export const projectTemplates: ProjectTemplate[] = [
  {
    id: "ui-neon-landing",
    name: "Neon Glow Portfolio/Landing",
    description: "Ultra-optimized, highly interactive landing page for designers. 100/100 Lighthouse score, premium animations, and custom typography.",
    category: "ui-designer",
    icon: "✨",
    files: [
      {
        name: "index.html",
        content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Aether — Premium Interactive Portfolio</title>
  <meta name="description" content="Aether is a high-performance, dark-themed interactive portfolio featuring fluid physics, custom typography, and lightning-fast loading speeds.">
  <meta name="robots" content="index, follow">
  <link rel="canonical" href="https://aether.design">
  
  <!-- Preload fonts for zero layout shift -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;800&family=Space+Mono&display=swap" rel="stylesheet">

  <style>
    :root {
      --bg-black: #050508;
      --neon-cyan: #00f0ff;
      --neon-purple: #bd00ff;
      --text-gray: #94a3b8;
      --text-white: #f8fafc;
      --font-ui: 'Outfit', sans-serif;
      --font-mono: 'Space Mono', monospace;
    }
    
    * { box-sizing: border-box; margin: 0; padding: 0; }
    
    body {
      background-color: var(--bg-black);
      color: var(--text-white);
      font-family: var(--font-ui);
      overflow-x: hidden;
      line-height: 1.6;
    }

    header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 2rem 5%;
      border-bottom: 1px solid rgba(255,255,255,0.03);
    }

    .logo {
      font-size: 1.5rem;
      font-weight: 800;
      letter-spacing: -1px;
      background: linear-gradient(135deg, var(--neon-cyan), var(--neon-purple));
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    .nav-links { display: flex; gap: 2rem; list-style: none; }
    .nav-links a {
      color: var(--text-gray);
      text-decoration: none;
      font-size: 0.95rem;
      transition: color 0.3s;
    }
    .nav-links a:hover { color: var(--neon-cyan); }

    .hero {
      min-height: 80vh;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      text-align: center;
      padding: 0 1rem;
      position: relative;
    }

    .hero::before {
      content: '';
      position: absolute;
      width: 300px;
      height: 300px;
      background: radial-gradient(circle, rgba(0,240,255,0.15) 0%, transparent 70%);
      top: 10%;
      left: 20%;
      pointer-events: none;
    }

    .hero-tag {
      font-family: var(--font-mono);
      font-size: 0.85rem;
      color: var(--neon-cyan);
      border: 1px solid rgba(0,240,255,0.2);
      padding: 0.3rem 1rem;
      border-radius: 50px;
      margin-bottom: 1.5rem;
      letter-spacing: 2px;
      text-transform: uppercase;
      background: rgba(0,240,255,0.02);
    }

    h1 {
      font-size: clamp(3rem, 8vw, 6rem);
      font-weight: 800;
      line-height: 1.1;
      margin-bottom: 1.5rem;
      letter-spacing: -2px;
    }

    h1 span {
      background: linear-gradient(135deg, var(--neon-cyan) 30%, var(--neon-purple) 85%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    .hero-desc {
      max-width: 600px;
      color: var(--text-gray);
      font-size: 1.2rem;
      margin-bottom: 2.5rem;
    }

    .cta-btn {
      padding: 1rem 2.5rem;
      font-size: 1rem;
      font-weight: 600;
      background: linear-gradient(135deg, var(--neon-cyan), var(--neon-purple));
      color: var(--bg-black);
      border: none;
      border-radius: 8px;
      cursor: pointer;
      box-shadow: 0 10px 30px rgba(0,240,255,0.2);
      transition: transform 0.2s, box-shadow 0.2s;
    }

    .cta-btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 15px 40px rgba(0,240,255,0.4);
    }
  </style>
</head>
<body>
  <header>
    <div class="logo">ÆTHER.</div>
    <ul class="nav-links">
      <li><a href="#work">Work</a></li>
      <li><a href="#about">About</a></li>
      <li><a href="#contact">Contact</a></li>
    </ul>
  </header>
  
  <main class="hero">
    <div class="hero-tag">Design meets engineering</div>
    <h1>The Next Dimension of <span>Digital Spaces</span></h1>
    <p class="hero-desc">We build lightning-fast web applications, creative interactive experiences, and state-of-the-art UI models for progressive teams.</p>
    <button class="cta-btn" onclick="alert('Exploring Aether!')">Explore Space</button>
  </main>
</body>
</html>`
      }
    ]
  },
  {
    id: "web-react-vite",
    name: "React + Vite (TypeScript)",
    description: "Highly performant web app setup with React + TypeScript + CSS Variables.",
    category: "web",
    icon: "⚛️",
    files: [
      {
        name: "package.json",
        content: `{
  "name": "react-vite-app",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@types/react": "^18.3.3",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.1",
    "typescript": "^5.4.5",
    "vite": "^5.2.11"
  }
}`
      },
      {
        name: "index.html",
        content: `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Vite + React + TS</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>`
      },
      {
        name: "src/main.tsx",
        content: `import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)`
      },
      {
        name: "src/App.tsx",
        content: `import React, { useState } from 'react'

export default function App() {
  const [count, setCount] = useState(0)

  return (
    <div style={{ textAlign: 'center', marginTop: '100px', fontFamily: 'sans-serif' }}>
      <h1>React + Vite + TypeScript</h1>
      <p>Loaded and running inside HyperDrive Code Editor!</p>
      <button onClick={() => setCount(count + 1)} style={{ padding: '10px 20px', fontSize: '16px' }}>
        Count is {count}
      </button>
    </div>
  )
}`
      },
      {
        name: "src/index.css",
        content: `body {
  margin: 0;
  background-color: #0b0f19;
  color: #f1f5f9;
  font-family: system-ui, sans-serif;
}`
      },
      {
        name: "vite.config.ts",
        content: `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
})`
      },
      {
        name: "tsconfig.json",
        content: `{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["DOM", "DOM.Iterable", "ES2020"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src"]
}`
      }
    ]
  },
  {
    id: "python-fastapi",
    name: "Python FastAPI App",
    description: "High-performance Python backend template with FastAPI, hot reloading, structured routes, and database models.",
    category: "python",
    icon: "🐍",
    files: [
      {
        name: "main.py",
        content: `from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn

app = FastAPI(title="HyperDrive Python API", version="1.0.0")

# Enable CORS for frontend requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class Item(BaseModel):
    name: str
    description: str | None = None
    price: float
    tax: float | None = None

@app.get("/")
def read_root():
    return {"message": "Welcome to HyperDrive local API", "status": "online"}

@app.get("/items/{item_id}")
def read_item(item_id: int, q: str | None = None):
    return {"item_id": item_id, "q": q}

@app.post("/items/")
def create_item(item: Item):
    return {"message": "Item created successfully", "item": item}

if __name__ == "__main__":
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
`
      },
      {
        name: "requirements.txt",
        content: `fastapi>=0.110.0
uvicorn>=0.28.0
pydantic>=2.6.0
`
      },
      {
        name: "readme.md",
        content: `# FastAPI Project

To run this backend project:

1. Install requirements:
   \`\`\`bash
   pip install -r requirements.txt
   \`\`\`
2. Start the server:
   \`\`\`bash
   python main.py
   \`\`\`
`
      }
    ]
  },
  {
    id: "java-spring",
    name: "Java Spring Boot API",
    description: "Enterprise ready Java REST API template featuring Spring Boot, Maven config, and standard directory layouts.",
    category: "java",
    icon: "☕",
    files: [
      {
        name: "pom.xml",
        content: `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
	xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 https://maven.apache.org/xsd/maven-4.0.0.xsd">
	<modelVersion>4.0.0</modelVersion>
	<parent>
		<groupId>org.springframework.boot</groupId>
		<artifactId>spring-boot-starter-parent</artifactId>
		<version>3.2.4</version>
		<relativePath/> <!-- lookup parent from repository -->
	</parent>
	<groupId>com.hyperdrive</groupId>
	<artifactId>editorapp</artifactId>
	<version>0.0.1-SNAPSHOT</version>
	<name>editorapp</name>
	<description>Demo project for Spring Boot inside HyperDrive</description>
	<properties>
		<java.version>17</java.version>
	</properties>
	<dependencies>
		<dependency>
			<groupId>org.springframework.boot</groupId>
			<artifactId>spring-boot-starter-web</artifactId>
		</dependency>
		<dependency>
			<groupId>org.springframework.boot</groupId>
			<artifactId>spring-boot-starter-test</artifactId>
			<scope>test</scope>
		</dependency>
	</dependencies>
	<build>
		<plugins>
			<plugin>
				<groupId>org.springframework.boot</groupId>
				<artifactId>spring-boot-maven-plugin</artifactId>
			</plugin>
		</plugins>
	</build>
</project>`
      },
      {
        name: "src/main/java/com/hyperdrive/editorapp/EditorappApplication.java",
        content: `package com.hyperdrive.editorapp;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@SpringBootApplication
@RestController
public class EditorappApplication {

	public static void main(String[] args) {
		SpringApplication.run(EditorappApplication.class, args);
	}

	@GetMapping("/")
	public String hello() {
		return "Hello from Spring Boot running in HyperDrive!";
	}
}`
      },
      {
        name: "src/main/resources/application.properties",
        content: `server.port=8080
spring.application.name=editorapp
`
      }
    ]
  }
];
