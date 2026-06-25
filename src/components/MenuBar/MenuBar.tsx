import { createSignal, For, Show, onMount, onCleanup, createMemo } from "solid-js";
import { editorStore } from "@store/editorStore";
import { settingsStore } from "@store/settingsStore";
import { notificationStore } from "@store/notificationStore";
import {
  dispatchEditorCommand,
  openCommandPalette,
  openGoToLine,
  openGoToFile,
  EDITOR_COMMANDS,
} from "@lib/editorCommands";
import { tauriFS } from "@lib/tauriFS";

// ── Types ─────────────────────────────────────────────────────────────────────
interface MenuItemDef {
  label?: string;
  shortcut?: string;
  action?: () => void;
  separator?: true;
  checked?: () => boolean;
  disabled?: () => boolean;
}

interface MenuDef {
  id: string;
  label: string;
  items: MenuItemDef[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const getActiveTab = () => {
  const s = editorStore.get();
  const split = s.splits.find(sp => sp.id === s.activeSplitId);
  return split?.tabs.find(t => t.isActive) ?? null;
};

const saveActiveTab = async () => {
  const tab = getActiveTab();
  if (!tab || !tab.isDirty) return;
  const py = (window as any).pywebview?.api;
  if (py) {
    await py.write_file(tab.path, tab.content);
    editorStore.setTabDirty(tab.id, false);
  }
};

const openNewFile = async () => {
  const py = (window as any).pywebview?.api;
  if (py) {
    const files = await py.select_folder?.();
    // Create untitled tab
    const id = crypto.randomUUID();
    editorStore.openFile(`untitled-${id}.txt`, "", "plaintext");
  } else {
    editorStore.openFile(`untitled-${Date.now()}.txt`, "", "plaintext");
  }
};

const openFileDialog = async () => {
  const path = await tauriFS.openFileDialog();
  if (!path) return;
  try {
    const content = await tauriFS.readFile(path);
    const ext = path.split(".").pop()?.toLowerCase() ?? "";
    const langMap: Record<string, string> = {
      ts: "typescript", tsx: "typescript", js: "javascript", jsx: "javascript",
      py: "python", html: "html", css: "css", json: "json", md: "markdown",
      rs: "rust", go: "go", java: "java", cpp: "cpp", c: "c",
      txt: "plaintext", sh: "shell", yaml: "yaml", yml: "yaml",
      toml: "toml", xml: "xml", sql: "sql",
    };
    editorStore.openFile(path, content, langMap[ext] ?? "plaintext");
  } catch (err) {
    console.error("Failed to open file:", err);
  }
};

const openFolderDialog = async () => {
  const py = (window as any).pywebview?.api;
  if (py) {
    const result = await py.select_folder();
    if (result) editorStore.openWorkspace(result);
  }
};

const runCurrentFile = () => {
  const tab = getActiveTab();
  if (!tab) return;
  editorStore.setBottomPanelTab("terminal");
  editorStore.toggleBottomPanel();
  setTimeout(() => {
    const langRunCmd: Record<string, string> = {
      python:     `python "${tab.path}"`,
      javascript: `node "${tab.path}"`,
      typescript: `npx ts-node "${tab.path}"`,
      rust:       `cargo run`,
      go:         `go run "${tab.path}"`,
    };
    const cmd = langRunCmd[tab.language] ?? `echo "No runner for ${tab.language}"`;
    window.dispatchEvent(new CustomEvent("hyperdrive:terminal-run", { detail: { cmd } }));
  }, 200);
};

// ── Menu Definitions ──────────────────────────────────────────────────────────
const buildMenus = (): MenuDef[] => [
  {
    id: "file",
    label: "File",
    items: [
      {
        label: "New File",
        shortcut: "Ctrl+N",
        action: openNewFile,
      },
      { separator: true },
      {
        label: "Open File…",
        shortcut: "Ctrl+O",
        action: openFileDialog,
      },
      {
        label: "Open Folder…",
        shortcut: "Ctrl+K Ctrl+O",
        action: openFolderDialog,
      },
      { separator: true },
      {
        label: "Save",
        shortcut: "Ctrl+S",
        action: saveActiveTab,
        disabled: () => !(getActiveTab()?.isDirty ?? false),
      },
      {
        label: "Save As…",
        shortcut: "Ctrl+Shift+S",
        action: async () => {
          // Save with pywebview file save dialog
          const tab = getActiveTab();
          if (!tab) return;
          await saveActiveTab();
        },
      },
      {
        label: "Auto Save",
        shortcut: "",
        checked: () => settingsStore.settings["files.autoSave"] !== "off",
        action: () => {
          const cur = settingsStore.settings["files.autoSave"];
          settingsStore.update("files.autoSave", cur === "off" ? "afterDelay" : "off");
        },
      },
      { separator: true },
      {
        label: "Close Workspace",
        action: async () => {
          const confirmed = await notificationStore.confirm("Close current workspace?");
          if (confirmed) editorStore.closeWorkspace();
        },
      },
      { separator: true },
      {
        label: "Preferences",
        shortcut: "Ctrl+,",
        action: () => editorStore.setSidebarPanel("settings"),
      },
    ],
  },

  {
    id: "edit",
    label: "Edit",
    items: [
      {
        label: "Undo",
        shortcut: "Ctrl+Z",
        action: () => dispatchEditorCommand(EDITOR_COMMANDS.UNDO),
      },
      {
        label: "Redo",
        shortcut: "Ctrl+Y",
        action: () => dispatchEditorCommand(EDITOR_COMMANDS.REDO),
      },
      { separator: true },
      {
        label: "Find",
        shortcut: "Ctrl+F",
        action: () => dispatchEditorCommand(EDITOR_COMMANDS.FIND),
      },
      {
        label: "Replace",
        shortcut: "Ctrl+H",
        action: () => dispatchEditorCommand(EDITOR_COMMANDS.REPLACE),
      },
      { separator: true },
      {
        label: "Toggle Line Comment",
        shortcut: "Ctrl+/",
        action: () => dispatchEditorCommand(EDITOR_COMMANDS.TOGGLE_COMMENT),
      },
      {
        label: "Select All",
        shortcut: "Ctrl+A",
        action: () => dispatchEditorCommand(EDITOR_COMMANDS.SELECT_ALL),
      },
    ],
  },

  {
    id: "selection",
    label: "Selection",
    items: [
      {
        label: "Add Cursor Above",
        shortcut: "Ctrl+Alt+↑",
        action: () => dispatchEditorCommand(EDITOR_COMMANDS.ADD_CURSOR_ABOVE),
      },
      {
        label: "Add Cursor Below",
        shortcut: "Ctrl+Alt+↓",
        action: () => dispatchEditorCommand(EDITOR_COMMANDS.ADD_CURSOR_BELOW),
      },
      { separator: true },
      {
        label: "Copy Line Up",
        shortcut: "Shift+Alt+↑",
        action: () => dispatchEditorCommand(EDITOR_COMMANDS.COPY_LINE_UP),
      },
      {
        label: "Copy Line Down",
        shortcut: "Shift+Alt+↓",
        action: () => dispatchEditorCommand(EDITOR_COMMANDS.COPY_LINE_DOWN),
      },
    ],
  },

  {
    id: "view",
    label: "View",
    items: [
      {
        label: "Command Palette",
        shortcut: "Ctrl+Shift+P",
        action: openCommandPalette,
      },
      { separator: true },
      {
        label: "Toggle Sidebar",
        shortcut: "Ctrl+B",
        action: () => editorStore.toggleSidebar(),
      },
      {
        label: "Toggle Panel",
        shortcut: "Ctrl+J",
        action: () => editorStore.toggleBottomPanel(),
      },
      { separator: true },
      {
        label: "Word Wrap",
        shortcut: "Alt+Z",
        checked: () => settingsStore.settings["editor.wordWrap"] === "on",
        action: () => {
          const cur = settingsStore.settings["editor.wordWrap"];
          settingsStore.update("editor.wordWrap", cur === "on" ? "off" : "on");
        },
      },
      {
        label: "Minimap",
        checked: () => settingsStore.settings["editor.minimap.enabled"],
        action: () => {
          settingsStore.update(
            "editor.minimap.enabled",
            !settingsStore.settings["editor.minimap.enabled"]
          );
        },
      },
      {
        label: "Line Numbers",
        checked: () => settingsStore.settings["editor.lineNumbers"] === "on",
        action: () => {
          const cur = settingsStore.settings["editor.lineNumbers"];
          settingsStore.update("editor.lineNumbers", cur === "on" ? "off" : "on");
        },
      },
      { separator: true },
      {
        label: "Zen Mode",
        shortcut: "Ctrl+K Z",
        checked: () => settingsStore.settings["workbench.zenMode.enabled"],
        action: () => settingsStore.toggleZenMode(),
      },
      { separator: true },
      {
        label: "Explorer",
        action: () => editorStore.setSidebarPanel("explorer"),
      },
      {
        label: "Search",
        action: () => editorStore.setSidebarPanel("search"),
      },
      {
        label: "Source Control",
        action: () => editorStore.setSidebarPanel("git"),
      },
      {
        label: "AI Assistant",
        action: () => editorStore.setSidebarPanel("ai"),
      },
    ],
  },

  {
    id: "go",
    label: "Go",
    items: [
      {
        label: "Go to File…",
        shortcut: "Ctrl+P",
        action: openGoToFile,
      },
      {
        label: "Go to Line…",
        shortcut: "Ctrl+G",
        action: openGoToLine,
      },
    ],
  },

  {
    id: "terminal",
    label: "Terminal",
    items: [
      {
        label: "New Terminal",
        shortcut: "Ctrl+`",
        action: () => {
          editorStore.setBottomPanelTab("terminal");
          if (!editorStore.get().bottomPanelVisible) {
            editorStore.toggleBottomPanel();
          }
        },
      },
      { separator: true },
      {
        label: "Run Code",
        shortcut: "F5",
        action: runCurrentFile,
        disabled: () => !getActiveTab(),
      },
    ],
  },
];

// ── Component ─────────────────────────────────────────────────────────────────
export default function MenuBar() {
  const [activeMenu, setActiveMenu] = createSignal<string | null>(null);
  const menus = buildMenus();

  const closeAll = () => setActiveMenu(null);

  const handleMenuClick = (id: string) => {
    setActiveMenu(prev => (prev === id ? null : id));
  };

  const handleItemAction = (item: MenuItemDef) => {
    if (item.separator || item.disabled?.()) return;
    item.action?.();
    closeAll();
  };

  onMount(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeAll();

      // Global keyboard shortcuts routed through menu bar
      if ((e.ctrlKey || e.metaKey) && e.key === "b") {
        e.preventDefault();
        editorStore.toggleSidebar();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "j") {
        e.preventDefault();
        editorStore.toggleBottomPanel();
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "P") {
        e.preventDefault();
        openCommandPalette();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "g") {
        e.preventDefault();
        openGoToLine();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === ",") {
        e.preventDefault();
        editorStore.setSidebarPanel("settings");
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        saveActiveTab();
      }
      if (e.key === "F5") {
        e.preventDefault();
        runCurrentFile();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "n") {
        e.preventDefault();
        openNewFile();
      }
    };
    const handleClick = (e: MouseEvent) => {
      const bar = document.getElementById("hyperdrive-menubar");
      if (bar && !bar.contains(e.target as Node)) closeAll();
    };
    window.addEventListener("keydown", handleKey);
    window.addEventListener("mousedown", handleClick);
    onCleanup(() => {
      window.removeEventListener("keydown", handleKey);
      window.removeEventListener("mousedown", handleClick);
    });
  });

  return (
    <div
      id="hyperdrive-menubar"
      class="pywebview-drag-region"
      style={{
        height: "var(--menubar-height)",
        background: "var(--bg-void)",
        "border-bottom": "1px solid var(--border-subtle)",
        display: "flex",
        "align-items": "center",
        "flex-shrink": 0,
        "z-index": "var(--z-above)",
        padding: "0 4px",
        gap: "0px",
        position: "relative",
      }}
    >
      {/* Menu Buttons */}
      <For each={menus}>
        {(menu) => (
          <div style={{ position: "relative" }}>
            <button
              onClick={() => handleMenuClick(menu.id)}
              onMouseEnter={() => {
                if (activeMenu() && activeMenu() !== menu.id) setActiveMenu(menu.id);
              }}
              style={{
                height: "var(--menubar-height)",
                padding: "0 10px",
                background:
                  activeMenu() === menu.id
                    ? "var(--bg-active)"
                    : "transparent",
                color:
                  activeMenu() === menu.id
                    ? "var(--text-primary)"
                    : "var(--text-secondary)",
                border: "none",
                cursor: "pointer",
                "font-size": "var(--font-size-sm)",
                "font-family": "var(--font-ui)",
                "border-radius": "var(--radius-sm)",
                transition: "background var(--transition-fast), color var(--transition-fast)",
                "pointer-events": "auto",
                "-webkit-app-region": "no-drag",
              }}
              class="menu-bar-btn"
            >
              {menu.label}
            </button>

            {/* Dropdown */}
            <Show when={activeMenu() === menu.id}>
              <div
                style={{
                  position: "fixed",
                  top: "calc(var(--titlebar-height) + var(--menubar-height))",
                  background: "var(--bg-elevated)",
                  border: "1px solid var(--border-strong)",
                  "border-radius": "var(--radius-md)",
                  "box-shadow": "0 12px 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04)",
                  "min-width": "230px",
                  padding: "4px 0",
                  "z-index": "var(--z-modal)",
                  animation: "menu-drop-in 80ms cubic-bezier(0.4,0,0.2,1)",
                }}
              >
                <For each={menu.items}>
                  {(item) => (
                    <Show
                      when={!item.separator}
                      fallback={
                        <div
                          style={{
                            height: "1px",
                            background: "var(--border-subtle)",
                            margin: "4px 0",
                          }}
                        />
                      }
                    >
                      <button
                        onClick={() => handleItemAction(item)}
                        disabled={item.disabled?.() ?? false}
                        style={{
                          display: "flex",
                          "align-items": "center",
                          width: "100%",
                          padding: "7px 14px",
                          background: "transparent",
                          border: "none",
                          cursor: item.disabled?.() ? "default" : "pointer",
                          color: item.disabled?.()
                            ? "var(--text-muted)"
                            : "var(--text-primary)",
                          "font-size": "var(--font-size-sm)",
                          "font-family": "var(--font-ui)",
                          "text-align": "left",
                          gap: "8px",
                          opacity: item.disabled?.() ? 0.5 : 1,
                          transition: "background var(--transition-fast)",
                        }}
                        onMouseEnter={(e) => {
                          if (!item.disabled?.())
                            e.currentTarget.style.background = "var(--bg-active)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = "transparent";
                        }}
                        class="menu-dropdown-item"
                      >
                        {/* Checkmark for toggled items */}
                        <span
                          style={{
                            width: "14px",
                            "font-size": "10px",
                            color: "var(--accent-primary)",
                            "flex-shrink": 0,
                          }}
                        >
                          {item.checked?.() ? "✓" : ""}
                        </span>

                        {/* Label */}
                        <span style={{ flex: 1 }}>{item.label}</span>

                        {/* Shortcut */}
                        {item.shortcut && (
                          <span
                            style={{
                              "font-size": "10px",
                              color: "var(--text-muted)",
                              "font-family": "var(--font-mono)",
                              "flex-shrink": 0,
                            }}
                          >
                            {item.shortcut}
                          </span>
                        )}
                      </button>
                    </Show>
                  )}
                </For>
              </div>
            </Show>
          </div>
        )}
      </For>
    </div>
  );
}
