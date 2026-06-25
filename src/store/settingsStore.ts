import { createStore } from "solid-js/store";

// ─────────────────────────────────────────────────────────────────────────────
// HyperDrive — Complete Settings Store
// ─────────────────────────────────────────────────────────────────────────────
export interface EditorSettings {
  // ── 1. ACTIVITY BAR ───────────────────────────────────────────────────────
  "workbench.activityBar.visible": boolean;
  "workbench.activityBar.iconSize": number;
  "workbench.activityBar.location": "left" | "right";

  // ── 2. SIDEBAR ────────────────────────────────────────────────────────────
  "workbench.sideBar.visible": boolean;
  "workbench.sideBar.location": "left" | "right";
  "workbench.sideBar.width": number;
  "workbench.sideBar.sections": { openEditors: boolean; outline: boolean; timeline: boolean };

  // ── 3. EDITOR — CURSOR ───────────────────────────────────────────────────
  "editor.cursorStyle": "line" | "block" | "underline" | "line-thin";
  "editor.cursorBlinking": "blink" | "smooth" | "phase" | "expand" | "solid";
  "editor.cursorSmoothCaretAnimation": "off" | "explicit" | "on";
  "editor.cursorWidth": number;

  // ── 4. EDITOR — FONT ─────────────────────────────────────────────────────
  "editor.fontSize": number;
  "editor.fontFamily": string;
  "editor.fontWeight": string;
  "editor.fontLigatures": boolean;
  "editor.lineHeight": number;

  // ── 5. EDITOR — FIND ─────────────────────────────────────────────────────
  "editor.find.seedSearchStringFromSelection": "never" | "always" | "selection";
  "editor.find.matchBackground": string;

  // ── 6. EDITOR — FORMATTING ───────────────────────────────────────────────
  "editor.formatOnSave": boolean;
  "editor.formatOnPaste": boolean;
  "editor.formatOnType": boolean;
  "editor.defaultFormatter.python": string;
  "editor.defaultFormatter.javascript": string;
  "editor.defaultFormatter.html": string;
  "editor.defaultFormatter.css": string;
  "editor.defaultFormatter.json": string;

  // ── 7. EDITOR — DISPLAY ──────────────────────────────────────────────────
  "editor.wordWrap": "off" | "on" | "wordWrapColumn" | "bounded";
  "editor.lineNumbers": "on" | "off" | "relative";
  "editor.minimap.enabled": boolean;
  "editor.minimap.side": "right" | "left";
  "editor.minimap.maxColumn": number;
  "editor.minimap.maxWidth": number;
  "editor.minimap.renderCharacters": boolean;
  "editor.renderWhitespace": "none" | "boundary" | "selection" | "all";
  "editor.breadcrumbs.enabled": boolean;
  "editor.multiCursorModifier": "ctrlCmd" | "alt";
  "editor.tabSize": number;
  "editor.insertSpaces": boolean;

  // ── 8. DIFF EDITOR ───────────────────────────────────────────────────────
  "diffEditor.ignoreTrimWhitespace": boolean;
  "diffEditor.renderSideBySide": boolean;

  // ── 9. FILES ─────────────────────────────────────────────────────────────
  "files.autoSave": "off" | "afterDelay" | "onFocusChange" | "onWindowChange";
  "files.autoSaveDelay": number;
  "files.encoding": string;
  "files.insertFinalNewline": boolean;
  "files.trimTrailingWhitespace": boolean;
  "files.exclude": string;

  // ── 10. WORKBENCH — APPEARANCE ───────────────────────────────────────────
  "workbench.colorTheme": "neon-blue" | "white-light" | "black-terminal" | "github-dark" | "vscode-dark";
  "workbench.iconTheme": "none" | "material" | "seti";
  "workbench.productIconTheme": "default" | "fluent";
  "workbench.statusBar.visible": boolean;
  "workbench.statusBar.gitBranch": boolean;
  "workbench.statusBar.feedbackCounters": boolean;
  "workbench.statusBar.lineCol": boolean;

  // ── 11. WORKBENCH — EDITOR TABS ──────────────────────────────────────────
  "workbench.editor.tabsMode": "multiple" | "single" | "none";
  "workbench.editor.tabSizing": "fit" | "shrink" | "fixed";
  "workbench.editor.showIcons": boolean;

  // ── 12. WORKBENCH — BREADCRUMBS ──────────────────────────────────────────
  "breadcrumbs.enabled": boolean;
  "breadcrumbs.filePath": "on" | "off" | "last";

  // ── 13. WORKBENCH — ZEN MODE ─────────────────────────────────────────────
  "workbench.zenMode.enabled": boolean;
  "workbench.zenMode.hideActivityBar": boolean;
  "workbench.zenMode.hideStatusBar": boolean;
  "workbench.zenMode.hideSideBar": boolean;
  "workbench.zenMode.fullScreen": boolean;
  "workbench.commandPalette.historyLimit": number;

  // ── 14. WINDOW ───────────────────────────────────────────────────────────
  "window.openFoldersInNewWindow": "on" | "off" | "default";
  "window.openFilesInNewWindow": "on" | "off" | "default";
  "window.titleBarStyle": "native" | "custom";
  "window.restoreWindows": "all" | "none" | "folders" | "one";
  "window.zoomLevel": number;

  // ── 15. TERMINAL ─────────────────────────────────────────────────────────
  "terminal.integrated.fontFamily": string;
  "terminal.integrated.fontSize": number;
  "terminal.integrated.cursorStyle": "block" | "line" | "underline";
  "terminal.integrated.defaultProfile.windows": "PowerShell" | "Command Prompt" | "Git Bash" | "WSL";
  "terminal.integrated.scrollback": number;

  // ── 16. SEARCH ───────────────────────────────────────────────────────────
  "search.exclude": string;
  "search.useIgnoreFiles": boolean;

  // ── 17. EXPLORER ─────────────────────────────────────────────────────────
  "explorer.autoReveal": boolean;
  "explorer.confirmDelete": boolean;
  "explorer.confirmDragAndDrop": boolean;

  // ── 18. GIT / SOURCE CONTROL ─────────────────────────────────────────────
  "git.enabled": boolean;
  "git.autofetch": boolean;
  "git.confirmSync": boolean;

  // ── 19. SECURITY ─────────────────────────────────────────────────────────
  "security.workspace.trust.enabled": boolean;
  "telemetry.telemetryLevel": "all" | "error" | "crash" | "off";

  // ── 20. EXTENSIONS ───────────────────────────────────────────────────────
  "extensions.autoUpdate": boolean;

  // ── 21. PERFORMANCE ──────────────────────────────────────────────────────
  "editor.hardwareAcceleration": boolean;
  "workbench.animationSpeed": "normal" | "fast" | "off";

  // ── 22. LANGUAGE & RUNTIMES ──────────────────────────────────────────────
  "python.interpreterPath": string;
  "go.goroot": string;
  "node.execPath": string;

  // ── 23. AI INTELLIGENCE ──────────────────────────────────────────────────
  "editor.autoFixOnType": boolean;
  "editor.aiAutoFix": boolean;
}

// ── Default values ────────────────────────────────────────────────────────────
const defaultSettings: EditorSettings = {
  "workbench.activityBar.visible": true,
  "workbench.activityBar.iconSize": 22,
  "workbench.activityBar.location": "left",

  "workbench.sideBar.visible": true,
  "workbench.sideBar.location": "left",
  "workbench.sideBar.width": 240,
  "workbench.sideBar.sections": { openEditors: true, outline: true, timeline: true },

  "editor.cursorStyle": "line",
  "editor.cursorBlinking": "blink",
  "editor.cursorSmoothCaretAnimation": "off",
  "editor.cursorWidth": 2,

  "editor.fontSize": 13,
  "editor.fontFamily": "'JetBrains Mono', 'Fira Code', monospace",
  "editor.fontWeight": "400",
  "editor.fontLigatures": true,
  "editor.lineHeight": 1.6,

  "editor.find.seedSearchStringFromSelection": "always",
  "editor.find.matchBackground": "#3a3d41",

  "editor.formatOnSave": false,
  "editor.formatOnPaste": false,
  "editor.formatOnType": false,
  "editor.defaultFormatter.python": "black",
  "editor.defaultFormatter.javascript": "prettier",
  "editor.defaultFormatter.html": "prettier",
  "editor.defaultFormatter.css": "prettier",
  "editor.defaultFormatter.json": "prettier",

  "editor.wordWrap": "on",
  "editor.lineNumbers": "on",
  "editor.autoFixOnType": true,
  "editor.aiAutoFix": true,
  "editor.minimap.enabled": true,
  "editor.minimap.side": "right",
  "editor.minimap.maxColumn": 80,
  "editor.minimap.maxWidth": 120,
  "editor.minimap.renderCharacters": true,
  "editor.renderWhitespace": "none",
  "editor.breadcrumbs.enabled": true,
  "editor.multiCursorModifier": "alt",
  "editor.tabSize": 2,
  "editor.insertSpaces": true,

  "diffEditor.ignoreTrimWhitespace": true,
  "diffEditor.renderSideBySide": true,

  "files.autoSave": "off",
  "files.autoSaveDelay": 1000,
  "files.encoding": "utf8",
  "files.insertFinalNewline": false,
  "files.trimTrailingWhitespace": false,
  "files.exclude": "node_modules, .git, __pycache__, dist, build",

  "workbench.colorTheme": "neon-blue",
  "workbench.iconTheme": "none",
  "workbench.productIconTheme": "default",
  "workbench.statusBar.visible": true,
  "workbench.statusBar.gitBranch": true,
  "workbench.statusBar.feedbackCounters": true,
  "workbench.statusBar.lineCol": true,

  "workbench.editor.tabsMode": "multiple",
  "workbench.editor.tabSizing": "fit",
  "workbench.editor.showIcons": true,

  "breadcrumbs.enabled": true,
  "breadcrumbs.filePath": "on",

  "workbench.zenMode.enabled": false,
  "workbench.zenMode.hideActivityBar": true,
  "workbench.zenMode.hideStatusBar": true,
  "workbench.zenMode.hideSideBar": true,
  "workbench.zenMode.fullScreen": false,
  "workbench.commandPalette.historyLimit": 50,

  "window.openFoldersInNewWindow": "default",
  "window.openFilesInNewWindow": "off",
  "window.titleBarStyle": "custom",
  "window.restoreWindows": "all",
  "window.zoomLevel": 0,

  "terminal.integrated.fontFamily": "monospace",
  "terminal.integrated.fontSize": 13,
  "terminal.integrated.cursorStyle": "block",
  "terminal.integrated.defaultProfile.windows": "PowerShell",
  "terminal.integrated.scrollback": 1000,

  "search.exclude": "**/node_modules, **/dist, **/.git",
  "search.useIgnoreFiles": true,

  "explorer.autoReveal": true,
  "explorer.confirmDelete": true,
  "explorer.confirmDragAndDrop": true,

  "git.enabled": true,
  "git.autofetch": false,
  "git.confirmSync": true,

  "security.workspace.trust.enabled": true,
  "telemetry.telemetryLevel": "off",

  "extensions.autoUpdate": true,

  "editor.hardwareAcceleration": true,
  "workbench.animationSpeed": "normal",

  "python.interpreterPath": "python",
  "go.goroot": "",
  "node.execPath": "node",
};

// ── Store ─────────────────────────────────────────────────────────────────────
const [settings, setSettings] = createStore<EditorSettings>(defaultSettings);

const applyVscodeTheme = (theme: any) => {
  if (typeof document === "undefined") return;
  const colors = theme.colors || {};
  const root = document.body;

  const mapping: Record<string, string> = {
    "editor.background": "--bg-base",
    "editor.foreground": "--text-primary",
    "sideBar.background": "--bg-panel",
    "activityBar.background": "--bg-panel",
    "statusBar.background": "--bg-void",
    "editor.lineHighlightBackground": "--bg-hover",
    "list.hoverBackground": "--bg-hover",
    "list.activeSelectionBackground": "--bg-active",
    "editorCursor.foreground": "--accent-primary",
    "button.background": "--accent-primary",
  };

  // Strip existing theme classes so they don't override variables
  document.body.className = document.body.className
    .split(" ").filter(c => !c.startsWith("theme-")).join(" ");

  Object.entries(mapping).forEach(([vscodeKey, cssVar]) => {
    if (colors[vscodeKey]) {
      root.style.setProperty(cssVar, colors[vscodeKey]);
    }
  });
};

const applyTheme = (themeName: string) => {
  if (typeof document === "undefined") return;

  // Check if it matches an installed VS Code theme
  const vscodeThemes = (window as any)._vscode_themes || [];
  const found = vscodeThemes.find((t: any) => t.label === themeName);
  if (found) {
    applyVscodeTheme(found);
    return;
  }

  document.body.className = document.body.className
    .split(" ").filter(c => !c.startsWith("theme-")).join(" ");
  document.body.classList.add(`theme-${themeName}`);
};

const applyAnimationSpeed = (speed: string) => {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (speed === "off") {
    root.style.setProperty("--transition-fast",   "0ms");
    root.style.setProperty("--transition-normal", "0ms");
    root.style.setProperty("--transition-slow",   "0ms");
  } else if (speed === "fast") {
    root.style.setProperty("--transition-fast",   "40ms cubic-bezier(0.4,0,0.2,1)");
    root.style.setProperty("--transition-normal", "80ms cubic-bezier(0.4,0,0.2,1)");
    root.style.setProperty("--transition-slow",   "150ms cubic-bezier(0.4,0,0.2,1)");
  } else {
    root.style.removeProperty("--transition-fast");
    root.style.removeProperty("--transition-normal");
    root.style.removeProperty("--transition-slow");
  }
};

export const settingsStore = {
  settings,
  get: <K extends keyof EditorSettings>(key: K): EditorSettings[K] => settings[key],
  update: <K extends keyof EditorSettings>(key: K, value: EditorSettings[K]) => {
    setSettings(key, value);
    if (key === "workbench.colorTheme")    applyTheme(value as string);
    if (key === "workbench.animationSpeed") applyAnimationSpeed(value as string);
    try { localStorage.setItem("hyperdrive_settings", JSON.stringify(settings)); } catch {}
  },
  async syncVscodeThemes() {
    const py = (window as any).pywebview?.api;
    if (py && py.get_extension_contributions) {
      try {
        const contribs = await py.get_extension_contributions();
        if (contribs && Array.isArray(contribs.themes)) {
          (window as any)._vscode_themes = contribs.themes;
          
          // Trigger theme re-apply if current theme is custom VS Code theme
          const currentTheme = settings["workbench.colorTheme"];
          const found = contribs.themes.find((t: any) => t.label === currentTheme);
          if (found) {
            applyVscodeTheme(found);
          }
        }
      } catch (err) {
        console.error("Failed to sync vscode themes:", err);
      }
    }
  },
  load() {
    try {
      const raw = localStorage.getItem("hyperdrive_settings");
      if (raw) {
        const parsed = JSON.parse(raw);
        Object.keys(parsed).forEach(k => setSettings(k as keyof EditorSettings, parsed[k]));
      }
      this.syncVscodeThemes().then(() => {
        applyTheme(settings["workbench.colorTheme"] || "neon-blue");
      });
      applyAnimationSpeed(settings["workbench.animationSpeed"] || "normal");
    } catch {}
  },
  toggleZenMode() {
    setSettings("workbench.zenMode.enabled", !settings["workbench.zenMode.enabled"]);
  },
};
