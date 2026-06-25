import { createStore, produce } from "solid-js/store";
import { createSignal } from "solid-js";
import { fileStore } from "./fileStore";

// ── Types ────────────────────────────────────────────────────
export interface OpenTab {
  id: string;
  path: string;
  name: string;
  language: string;
  content: string;
  isDirty: boolean;
  isActive: boolean;
}

export interface SplitPane {
  id: string;
  tabs: OpenTab[];
  activeTabId: string | null;
}

export interface DiagnosticItem {
  id: string;
  filePath: string;
  fileName: string;
  line: number;
  col: number;
  message: string;
  severity: "error" | "warning";
  source?: string;
}

export interface EditorState {
  workspacePath: string | null;
  workspaceName: string | null;
  splits: SplitPane[];
  activeSplitId: string | null;
  sidebarPanel: "explorer" | "search" | "git" | "ai" | "preview" | "settings" | "recent" | null;
  sidebarVisible: boolean;
  bottomPanelTab: "terminal" | "output" | "problems" | "preview" | "debugConsole";
  bottomPanelVisible: boolean;
  bottomPanelHeight: number;
  previewUrl: string;
  previewVisible: boolean;
  cursorLine: number;
  cursorCol: number;
  language: string;
  encoding: string;
  gitBranch: string;
  diagnostics: DiagnosticItem[];
  [key: string]: any; // Allow indexing settings
}

const initialState: EditorState = {
  workspacePath: null,
  workspaceName: null,
  splits: [{ id: "main", tabs: [], activeTabId: null }],
  activeSplitId: "main",
  sidebarPanel: "explorer",
  sidebarVisible: true,
  bottomPanelTab: "terminal",
  bottomPanelVisible: false,
  bottomPanelHeight: 220,
  previewUrl: "http://localhost:5173",
  previewVisible: false,
  cursorLine: 1,
  cursorCol: 1,
  language: "plaintext",
  encoding: "UTF-8",
  gitBranch: "",
  diagnostics: [],
};

const [state, setState] = createStore<EditorState>(initialState);

// ── Reactive signals for fine-grained reads ──────────────────
const [workspacePathSig, setWorkspacePathSig] = createSignal<string | null>(null);

// ── Actions ──────────────────────────────────────────────────
export const editorStore = {
  // Reads
  workspacePath: workspacePathSig,
  get: () => state,

  // Workspace
  openWorkspace(path: string) {
    const normalizedPath = path.replace(/\\/g, "/");
    const cleanPath = normalizedPath.endsWith("/") && normalizedPath.length > 3 ? normalizedPath.slice(0, -1) : normalizedPath;
    const parts = cleanPath.split("/");
    const name = parts[parts.length - 1] ?? cleanPath;
    setState("workspacePath", cleanPath);
    setState("workspaceName", name);
    setWorkspacePathSig(cleanPath);
    setState("sidebarPanel", "explorer");
    setState("sidebarVisible", true);
    
    // Automatically add to recent projects list!
    fileStore.addRecent(cleanPath);

    // Auto-initialize the workspace AI directory structure and notify python backend
    const py = (window as any).pywebview?.api;
    if (py) {
      if (py.set_workspace_path) {
        py.set_workspace_path(cleanPath);
      }
      if (py.init_ai_workspace) {
        py.init_ai_workspace(cleanPath);
      }
    }
  },

  closeWorkspace() {
    setState(produce(s => {
      s.workspacePath = null;
      s.workspaceName = null;
      s.splits = [{ id: "main", tabs: [], activeTabId: null }];
      s.diagnostics = [];
    }));
    setWorkspacePathSig(null);
  },

  // Diagnostics
  setDiagnosticsForFile(filePath: string, items: DiagnosticItem[]) {
    const normalizedPath = filePath.replace(/\\/g, "/");
    const cleanItems = items.map(item => ({
      ...item,
      filePath: item.filePath.replace(/\\/g, "/")
    }));
    setState("diagnostics", prev => {
      const filtered = prev.filter(d => d.filePath !== normalizedPath);
      return [...filtered, ...cleanItems];
    });
  },

  clearDiagnosticsForFile(filePath: string) {
    const normalizedPath = filePath.replace(/\\/g, "/");
    setState("diagnostics", prev => prev.filter(d => d.filePath !== normalizedPath));
  },

  clearAllDiagnostics() {
    setState("diagnostics", []);
  },

  // Tabs
  openFile(path: string, content: string, lang: string) {
    const normalizedPath = path.replace(/\\/g, "/");
    const name = normalizedPath.split("/").pop() ?? normalizedPath;
    const splitId = state.activeSplitId ?? "main";
    setState("splits", s => s.id === splitId, produce((split: SplitPane) => {
      const existing = split.tabs.find(t => t.path === normalizedPath);
      if (existing) {
        split.tabs.forEach(t => t.isActive = t.path === normalizedPath);
        split.activeTabId = existing.id;
        return;
      }
      const id = crypto.randomUUID();
      split.tabs.forEach(t => t.isActive = false);
      split.tabs.push({ id, path: normalizedPath, name, language: lang, content, isDirty: false, isActive: true });
      split.activeTabId = id;
    }));
    setState("language", lang);

    // Request preview URL from Python backend for HTML/CSS/JS/TS files
    const langLower = lang.toLowerCase();
    if (["html", "css", "javascript", "typescript"].includes(langLower)) {
      const py = (window as any).pywebview?.api;
      if (py && py.get_preview_url) {
        py.get_preview_url(normalizedPath).then((url: string) => {
          if (url) {
            editorStore.setPreviewUrl(url);
          }
        }).catch((err: any) => console.error("Failed to get preview url from python backend:", err));
      }
    }
  },

  closeTab(tabId: string, splitId: string) {
    const split = state.splits.find(s => s.id === splitId);
    const tab = split?.tabs.find(t => t.id === tabId);
    if (tab) {
      editorStore.clearDiagnosticsForFile(tab.path);
    }
    setState("splits", s => s.id === splitId, produce((split: SplitPane) => {
      const idx = split.tabs.findIndex(t => t.id === tabId);
      if (idx === -1) return;
      const wasActive = split.tabs[idx]?.isActive;
      split.tabs.splice(idx, 1);
      if (wasActive && split.tabs.length > 0) {
        const newActive = split.tabs[Math.max(0, idx - 1)];
        if (newActive) { newActive.isActive = true; split.activeTabId = newActive.id; }
      } else if (split.tabs.length === 0) {
        split.activeTabId = null;
      }
    }));
  },

  closeOthers(tabId: string, splitId: string) {
    setState("splits", s => s.id === splitId, produce((split: SplitPane) => {
      const target = split.tabs.find(t => t.id === tabId);
      if (!target) return;
      split.tabs = [target];
      target.isActive = true;
      split.activeTabId = tabId;
    }));
  },

  closeAllTabs(splitId: string) {
    setState("splits", s => s.id === splitId, produce((split: SplitPane) => {
      split.tabs = [];
      split.activeTabId = null;
    }));
  },

  closeSavedTabs(splitId: string) {
    setState("splits", s => s.id === splitId, produce((split: SplitPane) => {
      const activeTab = split.tabs.find(t => t.id === split.activeTabId);
      split.tabs = split.tabs.filter(t => t.isDirty);
      if (split.tabs.length > 0) {
        if (activeTab && split.tabs.some(t => t.id === activeTab.id)) {
          // Keep active tab active
        } else {
        const firstTab = split.tabs[0];
        if (firstTab) {
          firstTab.isActive = true;
          split.activeTabId = firstTab.id;
        }
        }
      } else {
        split.activeTabId = null;
      }
    }));
  },

  closeTabsToTheRight(tabId: string, splitId: string) {
    setState("splits", s => s.id === splitId, produce((split: SplitPane) => {
      const idx = split.tabs.findIndex(t => t.id === tabId);
      if (idx === -1) return;
      const activeTab = split.tabs.find(t => t.id === split.activeTabId);
      split.tabs = split.tabs.slice(0, idx + 1);
      if (activeTab && split.tabs.some(t => t.id === activeTab.id)) {
        // Keep active tab active
      } else {
        const targetTab = split.tabs[idx];
        if (targetTab) {
          split.tabs.forEach(t => t.isActive = t.id === tabId);
          split.activeTabId = tabId;
        }
      }
    }));
  },

  setTabDirty(tabId: string, dirty: boolean) {
    setState("splits", () => true, "tabs", t => t.id === tabId, "isDirty", dirty);
  },

  updateTabContent(tabId: string, content: string) {
    setState("splits", () => true, "tabs", t => t.id === tabId, "content", content);
  },

  // Sidebar
  toggleSidebar() { setState("sidebarVisible", v => !v); },
  setSidebarPanel(panel: EditorState["sidebarPanel"]) {
    if (state.sidebarPanel === panel && state.sidebarVisible) {
      setState("sidebarVisible", false);
    } else {
      setState("sidebarPanel", panel);
      setState("sidebarVisible", true);
    }
  },

  // Bottom panel
  toggleBottomPanel() { setState("bottomPanelVisible", v => !v); },
  setBottomPanelTab(tab: EditorState["bottomPanelTab"]) {
    setState("bottomPanelTab", tab);
    setState("bottomPanelVisible", true);
  },
  setBottomPanelHeight(h: number) { setState("bottomPanelHeight", Math.max(100, Math.min(h, 600))); },

  // Preview
  setPreviewUrl(url: string) { setState("previewUrl", url); },
  togglePreview() { setState("previewVisible", v => !v); },
  showPreview(url?: string) {
    if (url) setState("previewUrl", url);
    setState("previewVisible", true);
    setState("bottomPanelTab", "preview");
    setState("bottomPanelVisible", true);
  },

  // Status bar
  setCursor(line: number, col: number) { setState("cursorLine", line); setState("cursorCol", col); },
  setLanguage(lang: string) { setState("language", lang); },
  setGitBranch(branch: string) { setState("gitBranch", branch); },
};
