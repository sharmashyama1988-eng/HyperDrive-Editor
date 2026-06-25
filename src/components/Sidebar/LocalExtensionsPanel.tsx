import { createSignal, For, Show, onMount } from "solid-js";
import { localExtensionsStore, LocalExtension } from "@store/localExtensionsStore";
import { editorStore } from "@store/editorStore";
import { settingsStore } from "@store/settingsStore";
import { notificationStore } from "@store/notificationStore";

// ── Helpers ───────────────────────────────────────────────────────────────────
const getActiveFile = () => {
  const s = editorStore.get();
  const split = s.splits.find(sp => sp.id === s.activeSplitId);
  return split?.tabs.find(t => t.isActive) ?? null;
};

// ── Extension Card ────────────────────────────────────────────────────────────
function ExtensionCard(props: { ext: LocalExtension }) {
  const [running, setRunning] = createSignal<string | null>(null);
  const [expanded, setExpanded] = createSignal(false);

  const handleRun = async (cmdId: string) => {
    const tab = getActiveFile();
    const ws = editorStore.get().workspacePath;

    if (!tab) {
      alert("Pehle koi file open karo editor mein.");
      return;
    }

    setRunning(cmdId);
    await localExtensionsStore.runCommand(
      props.ext.id,
      cmdId,
      tab.path,
      ws ?? ""
    );
    setTimeout(() => setRunning(null), 1500);
  };

  const langBadge = () => {
    const langs = props.ext.manifest.activationLanguages;
    if (!langs || langs[0] === "*") return "All Languages";
    return langs.join(", ");
  };

  return (
    <div
      style={{
        background: props.ext.enabled ? "var(--bg-input)" : "var(--bg-panel)",
        border: `1px solid ${props.ext.enabled ? "var(--border-accent)" : "var(--border-subtle)"}`,
        "border-radius": "var(--radius-md)",
        margin: "0 12px 10px",
        overflow: "hidden",
        opacity: props.ext.enabled ? 1 : 0.55,
        transition: "all var(--transition-fast)",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          "align-items": "center",
          gap: "10px",
          padding: "10px 12px",
          cursor: "pointer",
        }}
        onClick={() => setExpanded(v => !v)}
      >
        <span style="font-size:20px;flex-shrink:0;">
          {props.ext.manifest.icon ?? "🧩"}
        </span>
        <div style="flex:1;min-width:0;">
          <div style="font-size:var(--font-size-sm);font-weight:600;color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
            {props.ext.manifest.name}
          </div>
          <div style="font-size:10px;color:var(--text-muted);margin-top:1px;">
            v{props.ext.manifest.version ?? "1.0.0"}
            {props.ext.manifest.author ? ` · by ${props.ext.manifest.author}` : ""}
          </div>
        </div>
        {/* Toggle switch */}
        <button
          onClick={(e) => { e.stopPropagation(); localExtensionsStore.toggle(props.ext.id); }}
          style={{
            width: "34px",
            height: "18px",
            background: props.ext.enabled ? "var(--accent-primary)" : "var(--bg-hover)",
            border: "1px solid var(--border-default)",
            "border-radius": "18px",
            cursor: "pointer",
            position: "relative",
            "flex-shrink": 0,
            transition: "background var(--transition-fast)",
          }}
          title={props.ext.enabled ? "Disable" : "Enable"}
        >
          <span
            style={{
              position: "absolute",
              width: "12px",
              height: "12px",
              background: props.ext.enabled ? "var(--bg-void)" : "var(--text-muted)",
              "border-radius": "50%",
              top: "2px",
              left: props.ext.enabled ? "18px" : "2px",
              transition: "left var(--transition-fast)",
            }}
          />
        </button>
        <span style="font-size:10px;color:var(--text-muted);">{expanded() ? "▲" : "▼"}</span>
      </div>

      {/* Description + lang badge */}
      <div style="padding:0 12px 8px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
        <span style="font-size:var(--font-size-xs);color:var(--text-secondary);flex:1;">
          {props.ext.manifest.description}
        </span>
        <span
          style={{
            "font-size": "9px",
            padding: "2px 6px",
            background: "var(--bg-active)",
            border: "1px solid var(--border-subtle)",
            "border-radius": "20px",
            color: "var(--accent-primary)",
            "white-space": "nowrap",
          }}
        >
          {langBadge()}
        </span>
      </div>

      {/* Expanded: Commands + path */}
      <Show when={expanded()}>
        <div
          style={{
            "border-top": "1px solid var(--border-subtle)",
            padding: "10px 12px",
            display: "flex",
            "flex-direction": "column",
            gap: "6px",
          }}
        >
          {/* Commands */}
          <div style="font-size:var(--font-size-xs);color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;font-weight:600;">
            Commands
          </div>
          <For each={props.ext.manifest.commands}>
            {(cmd) => (
              <div
                style={{
                  display: "flex",
                  "align-items": "center",
                  gap: "8px",
                  padding: "6px 8px",
                  background: "var(--bg-active)",
                  "border-radius": "var(--radius-sm)",
                  border: "1px solid var(--border-subtle)",
                }}
              >
                <div style="flex:1;min-width:0;">
                  <div style="font-size:var(--font-size-sm);color:var(--text-primary);">{cmd.label}</div>
                  <div
                    style={{
                      "font-size": "9px",
                      "font-family": "var(--font-mono)",
                      color: "var(--text-muted)",
                      "margin-top": "2px",
                      "white-space": "nowrap",
                      overflow: "hidden",
                      "text-overflow": "ellipsis",
                    }}
                  >
                    {cmd.run}
                  </div>
                </div>
                {cmd.shortcut && (
                  <kbd
                    style={{
                      "font-size": "9px",
                      "font-family": "var(--font-mono)",
                      padding: "2px 5px",
                      background: "var(--bg-panel)",
                      border: "1px solid var(--border-strong)",
                      "border-radius": "3px",
                      color: "var(--accent-primary)",
                      "flex-shrink": 0,
                    }}
                  >
                    {cmd.shortcut}
                  </kbd>
                )}
                <button
                  onClick={() => handleRun(cmd.id)}
                  disabled={!props.ext.enabled || running() === cmd.id}
                  style={{
                    padding: "5px 10px",
                    background: running() === cmd.id
                      ? "var(--accent-green)"
                      : "var(--accent-primary)",
                    border: "none",
                    "border-radius": "var(--radius-sm)",
                    color: "var(--bg-void)",
                    "font-size": "var(--font-size-xs)",
                    "font-weight": "700",
                    cursor: props.ext.enabled ? "pointer" : "default",
                    opacity: props.ext.enabled ? 1 : 0.5,
                    transition: "background var(--transition-fast)",
                    "flex-shrink": 0,
                  }}
                >
                  {running() === cmd.id ? "✓ Running" : "▶ Run"}
                </button>
              </div>
            )}
          </For>

          {/* Folder path */}
          <div
            style={{
              "margin-top": "4px",
              "font-size": "9px",
              "font-family": "var(--font-mono)",
              color: "var(--text-muted)",
              padding: "4px 6px",
              background: "var(--bg-panel)",
              "border-radius": "var(--radius-sm)",
              "white-space": "nowrap",
              overflow: "hidden",
              "text-overflow": "ellipsis",
            }}
          >
            📂 {props.ext.folderPath}
          </div>

          {/* Actions */}
          <div style="display:flex;gap:6px;margin-top:4px;">
            <button
              onClick={() => localExtensionsStore.reload(props.ext.id)}
              style={{
                padding: "4px 10px",
                background: "transparent",
                border: "1px solid var(--border-default)",
                "border-radius": "var(--radius-sm)",
                color: "var(--text-secondary)",
                "font-size": "var(--font-size-xs)",
                cursor: "pointer",
              }}
            >
              🔄 Reload
            </button>
            <button
              onClick={() => {
                if (confirm(`Remove "${props.ext.manifest.name}"?`)) {
                  localExtensionsStore.removeFolder(props.ext.folderPath);
                }
              }}
              style={{
                padding: "4px 10px",
                background: "transparent",
                border: "1px solid var(--border-subtle)",
                "border-radius": "var(--radius-sm)",
                color: "var(--accent-red)",
                "font-size": "var(--font-size-xs)",
                cursor: "pointer",
              }}
            >
              🗑 Remove
            </button>
          </div>
        </div>
      </Show>
    </div>
  );
}

// ── Add Folder Form ───────────────────────────────────────────────────────────
function AddExtensionForm() {
  const [path, setPath] = createSignal("");
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal("");
  const [success, setSuccess] = createSignal("");

  const handleBrowse = async () => {
    const py = (window as any).pywebview?.api;
    if (!py) return;
    const result = await py.select_folder();
    if (result) setPath(result);
  };

  const handleAdd = async () => {
    const p = path().trim();
    if (!p) { setError("Folder path khali nahi ho sakta."); return; }
    setLoading(true);
    setError("");
    setSuccess("");
    const result = await localExtensionsStore.addFolder(p);
    setLoading(false);
    if (result.success) {
      setSuccess("✅ Extension successfully loaded!");
      setPath("");
      setTimeout(() => setSuccess(""), 3000);
    } else {
      setError(result.error ?? "Unknown error");
    }
  };

  return (
    <div
      style={{
        margin: "0 12px 14px",
        padding: "12px",
        background: "var(--bg-input)",
        border: "1px solid var(--border-default)",
        "border-radius": "var(--radius-md)",
      }}
    >
      <div style="font-size:var(--font-size-xs);font-weight:700;color:var(--text-secondary);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:10px;">
        ➕ Add Local Extension Folder
      </div>

      <div style="display:flex;gap:6px;margin-bottom:8px;">
        <input
          type="text"
          value={path()}
          onInput={(e) => setPath(e.currentTarget.value)}
          placeholder="C:/MyTools/my-extension"
          style={{
            flex: 1,
            background: "var(--bg-active)",
            border: "1px solid var(--border-default)",
            color: "var(--text-primary)",
            padding: "7px 10px",
            "border-radius": "var(--radius-sm)",
            "font-size": "var(--font-size-xs)",
            "font-family": "var(--font-mono)",
            outline: "none",
          }}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
        />
        <button
          onClick={handleBrowse}
          style={{
            padding: "7px 10px",
            background: "var(--bg-active)",
            border: "1px solid var(--border-default)",
            "border-radius": "var(--radius-sm)",
            color: "var(--text-secondary)",
            "font-size": "var(--font-size-xs)",
            cursor: "pointer",
            "flex-shrink": 0,
          }}
          title="Browse for folder"
        >
          📁
        </button>
      </div>

      <button
        onClick={handleAdd}
        disabled={loading()}
        style={{
          width: "100%",
          padding: "8px",
          background: loading() ? "var(--bg-active)" : "var(--accent-primary)",
          border: "none",
          "border-radius": "var(--radius-sm)",
          color: "var(--bg-void)",
          "font-size": "var(--font-size-sm)",
          "font-weight": "700",
          cursor: loading() ? "default" : "pointer",
          transition: "background var(--transition-fast)",
        }}
      >
        {loading() ? "Loading extension.json…" : "Load Extension"}
      </button>

      <Show when={error()}>
        <div style="margin-top:8px;font-size:var(--font-size-xs);color:var(--accent-red);padding:6px 8px;background:rgba(239,68,68,0.08);border-radius:var(--radius-sm);border:1px solid rgba(239,68,68,0.2);">
          ⚠ {error()}
        </div>
      </Show>
      <Show when={success()}>
        <div style="margin-top:8px;font-size:var(--font-size-xs);color:var(--accent-green);padding:6px 8px;background:rgba(16,185,129,0.08);border-radius:var(--radius-sm);border:1px solid rgba(16,185,129,0.2);">
          {success()}
        </div>
      </Show>
    </div>
  );
}

// ── Template Generator ────────────────────────────────────────────────────────
function ExtensionTemplate() {
  const [show, setShow] = createSignal(false);

  const template = `{
  "name": "My Custom Tool",
  "description": "Apna tool yahan describe karo",
  "version": "1.0.0",
  "author": "Your Name",
  "icon": "🛠",
  "activationLanguages": ["*"],
  "commands": [
    {
      "id": "run",
      "label": "Run Tool on Current File",
      "run": "python {ext_dir}/run.py {file}",
      "shortcut": "Ctrl+Alt+R"
    },
    {
      "id": "lint",
      "label": "Lint Current File",
      "run": "python {ext_dir}/lint.py {file}"
    }
  ]
}`;

  const copy = () => {
    navigator.clipboard.writeText(template);
  };

  return (
    <div style="margin:0 12px 14px;">
      <button
        onClick={() => setShow(v => !v)}
        style={{
          width: "100%",
          padding: "7px",
          background: "transparent",
          border: "1px dashed var(--border-default)",
          "border-radius": "var(--radius-sm)",
          color: "var(--text-muted)",
          "font-size": "var(--font-size-xs)",
          cursor: "pointer",
        }}
      >
        {show() ? "▲ Hide" : "📋 View extension.json template"}
      </button>

      <Show when={show()}>
        <div style="margin-top:8px;position:relative;">
          <pre
            style={{
              background: "var(--bg-void)",
              border: "1px solid var(--border-subtle)",
              "border-radius": "var(--radius-sm)",
              padding: "10px",
              "font-size": "10px",
              "font-family": "var(--font-mono)",
              color: "var(--syntax-string)",
              overflow: "auto",
              margin: 0,
              "white-space": "pre",
            }}
          >
            {template}
          </pre>
          <button
            onClick={copy}
            style={{
              position: "absolute",
              top: "6px",
              right: "6px",
              padding: "3px 8px",
              background: "var(--bg-active)",
              border: "1px solid var(--border-default)",
              "border-radius": "var(--radius-sm)",
              color: "var(--accent-primary)",
              "font-size": "10px",
              cursor: "pointer",
            }}
          >
            Copy
          </button>
        </div>
        <div
          style={{
            "margin-top": "6px",
            "font-size": "9px",
            color: "var(--text-muted)",
            "line-height": "1.6",
            padding: "6px 8px",
            background: "var(--bg-input)",
            "border-radius": "var(--radius-sm)",
          }}
        >
          <strong style="color:var(--text-secondary);">Placeholders:</strong>
          <br />• <code style="color:var(--accent-primary);">{"{file}"}</code> → Active file ka full path
          <br />• <code style="color:var(--accent-primary);">{"{dir}"}</code>  → Workspace root folder
          <br />• <code style="color:var(--accent-primary);">{"{ext_dir}"}</code> → Extension folder path
        </div>
      </Show>
    </div>
  );
}

// ── Main Panel ────────────────────────────────────────────────────────────────

export default function LocalExtensionsPanel() {
  const extensions = () => localExtensionsStore.extensions();
  const [vsixExtensions, setVsixExtensions] = createSignal<any[]>([]);
  const [installing, setInstalling] = createSignal(false);
  
  // Tab management: "installed" or "marketplace"
  const [activeSubTab, setActiveSubTab] = createSignal<"installed" | "marketplace">("installed");

  // Marketplace search signals
  const [searchQuery, setSearchQuery] = createSignal("");
  const [searchResults, setSearchResults] = createSignal<any[]>([]);
  const [searching, setSearching] = createSignal(false);
  const [installingId, setInstallingId] = createSignal<string | null>(null);

  const refreshVsixExtensions = async () => {
    const py = (window as any).pywebview?.api;
    if (py && py.list_installed_extensions) {
      try {
        const res = await py.list_installed_extensions();
        if (Array.isArray(res)) {
          setVsixExtensions(res);
        }
      } catch (err) {
        console.error("Failed to list installed vsix extensions:", err);
      }
    }
  };

  onMount(() => {
    refreshVsixExtensions();
  });

  const handleInstallVsix = async () => {
    const py = (window as any).pywebview?.api;
    if (!py || !py.select_file || !py.install_vsix) {
      notificationStore.showToast("Python VSIX API not ready.", "error");
      return;
    }
    
    // Select VSIX file
    const file = await py.select_file(["VS Code Extension (*.vsix)"]);
    if (!file) return;

    setInstalling(true);
    notificationStore.showToast("Extracting and installing VSIX...", "info");
    try {
      const res = await py.install_vsix(file);
      if (res.error) {
        notificationStore.showToast("Failed to install VSIX: " + res.error, "error");
      } else {
        notificationStore.showToast(`Successfully installed extension: ${res.extension.name}`, "success");
        refreshVsixExtensions();
        await settingsStore.syncVscodeThemes();
      }
    } catch (err: any) {
      notificationStore.showToast("Error installing VSIX: " + (err.message || err), "error");
    } finally {
      setInstalling(false);
    }
  };

  const handleOnlineSearch = async () => {
    const query = searchQuery().trim();
    if (!query) return;
    setSearching(true);
    setSearchResults([]);
    try {
      const py = (window as any).pywebview?.api;
      if (py && py.search_online_extensions) {
        const res = await py.search_online_extensions(query);
        if (res && !res.error) {
          setSearchResults(res);
          if (res.length === 0) {
            notificationStore.showToast("No extensions found matching your search.", "info");
          }
        } else {
          notificationStore.showToast("Failed to query Open VSX: " + (res?.error || "Unknown error"), "error");
        }
      }
    } catch (err: any) {
      console.error("Marketplace search error:", err);
      notificationStore.showToast("Network error searching extensions.", "error");
    } finally {
      setSearching(false);
    }
  };

  const handleInstallOnline = async (ext: any) => {
    const py = (window as any).pywebview?.api;
    if (!py || !py.download_and_install_extension) {
      notificationStore.showToast("Python download API not ready.", "error");
      return;
    }
    setInstallingId(ext.id);
    notificationStore.showToast(`Downloading & installing ${ext.name}...`, "info", 5000);
    try {
      const res = await py.download_and_install_extension(ext.download_url);
      if (res.error) {
        notificationStore.showToast("Failed to install extension: " + res.error, "error");
      } else {
        notificationStore.showToast(`Successfully installed ${ext.name}!`, "success");
        refreshVsixExtensions();
        await settingsStore.syncVscodeThemes();
      }
    } catch (err: any) {
      notificationStore.showToast("Error installing extension: " + (err.message || err), "error");
    } finally {
      setInstallingId(null);
    }
  };

  const isInstalled = (id: string) => {
    return vsixExtensions().some((ext) => ext.id.toLowerCase() === id.toLowerCase());
  };

  const handleRevealDir = async () => {
    const py = (window as any).pywebview?.api;
    if (py && py.reveal_in_explorer && py.get_extensions_dir) {
      const extDir = await py.get_extensions_dir();
      py.reveal_in_explorer(extDir);
    }
  };

  return (
    <div
      style={{
        display: "flex",
        "flex-direction": "column",
        height: "100%",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "14px 12px 10px",
          "border-bottom": "1px solid var(--border-subtle)",
          "flex-shrink": 0,
        }}
      >
        <div style="font-size:var(--font-size-base);font-weight:700;color:var(--text-primary);display:flex;align-items:center;gap:8px;">
          <span>🧩</span> Extensions Manager
        </div>
        <div style="font-size:var(--font-size-xs);color:var(--text-muted);margin-top:4px;line-height:1.5;">
          Manage custom scripting tools or search and install VS Code extensions directly.
        </div>
      </div>

      {/* Tabs */}
      <div
        style={{
          display: "flex",
          padding: "6px 12px 0",
          background: "var(--bg-panel)",
          "border-bottom": "1px solid var(--border-subtle)",
          gap: "8px",
          "flex-shrink": 0,
        }}
      >
        <button
          onClick={() => setActiveSubTab("installed")}
          style={{
            padding: "8px 12px",
            background: "transparent",
            border: "none",
            "border-bottom": activeSubTab() === "installed" ? "2px solid var(--accent-primary)" : "2px solid transparent",
            color: activeSubTab() === "installed" ? "var(--text-primary)" : "var(--text-muted)",
            "font-size": "var(--font-size-xs)",
            "font-weight": activeSubTab() === "installed" ? "600" : "normal",
            cursor: "pointer",
            transition: "all var(--transition-fast)",
          }}
        >
          Installed
        </button>
        <button
          onClick={() => setActiveSubTab("marketplace")}
          style={{
            padding: "8px 12px",
            background: "transparent",
            border: "none",
            "border-bottom": activeSubTab() === "marketplace" ? "2px solid var(--accent-primary)" : "2px solid transparent",
            color: activeSubTab() === "marketplace" ? "var(--text-primary)" : "var(--text-muted)",
            "font-size": "var(--font-size-xs)",
            "font-weight": activeSubTab() === "marketplace" ? "600" : "normal",
            cursor: "pointer",
            transition: "all var(--transition-fast)",
          }}
        >
          Marketplace 🌐
        </button>
      </div>

      {/* Scrollable body */}
      <div style="flex:1;overflow-y:auto;padding-top:12px;">
        <Show when={activeSubTab() === "installed"}>
          {/* 1. VS Code VSIX Extensions section */}
          <div
            style={{
              margin: "0 12px 14px",
              padding: "12px",
              background: "var(--bg-input)",
              border: "1px solid var(--border-default)",
              "border-radius": "var(--radius-md)",
            }}
          >
            <div style="font-size:var(--font-size-xs);font-weight:700;color:var(--text-secondary);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:10px;display:flex;justify-content:space-between;align-items:center;">
              <span>📦 VS Code Extensions</span>
              <button
                onClick={handleRevealDir}
                style="background:transparent;border:none;color:var(--accent-primary);cursor:pointer;font-size:10px;"
                title="Open folder in File Explorer"
              >
                📁 Folder
              </button>
            </div>

            <button
              onClick={handleInstallVsix}
              disabled={installing()}
              style={{
                width: "100%",
                padding: "8px",
                background: installing() ? "var(--bg-active)" : "var(--accent-primary)",
                border: "none",
                "border-radius": "var(--radius-sm)",
                color: "var(--bg-void)",
                "font-size": "var(--font-size-sm)",
                "font-weight": "700",
                cursor: installing() ? "default" : "pointer",
                transition: "background var(--transition-fast)",
                "margin-bottom": "8px",
              }}
            >
              {installing() ? "Installing VSIX Extension..." : "Install VSIX from file..."}
            </button>

            {/* VSIX list */}
            <div style="display:flex;flex-direction:column;gap:6px;max-height:220px;overflow-y:auto;">
              <Show
                when={vsixExtensions().length > 0}
                fallback={
                  <div style="font-size:11px;color:var(--text-muted);text-align:center;padding:10px 0;font-style:italic;">
                    No VSIX extensions installed. Go to Marketplace tab to search online.
                  </div>
                }
              >
                <For each={vsixExtensions()}>
                  {(vsix) => (
                    <div style="display:flex;align-items:center;justify-content:space-between;padding:6px;background:var(--bg-active);border-radius:var(--radius-sm);border:1px solid var(--border-subtle);font-size:var(--font-size-xs);">
                      <div style="flex:1;min-width:0;margin-right:6px;">
                        <div style="font-weight:600;color:var(--text-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
                          {vsix.name}
                        </div>
                        <div style="font-size:9px;color:var(--text-muted);">
                          {vsix.publisher} v{vsix.version}
                        </div>
                      </div>
                      <span style="font-size:11px;color:var(--accent-green);">✓ Installed</span>
                    </div>
                  )}
                </For>
              </Show>
            </div>
          </div>

          <div style="height:1px;background:var(--border-subtle);margin:8px 12px 14px;"></div>

          {/* 2. Custom Script Extensions */}
          <AddExtensionForm />

          <Show
            when={extensions().length > 0}
            fallback={
              <div
                style={{
                  margin: "0 12px 14px",
                  padding: "24px 16px",
                  "text-align": "center",
                  background: "var(--bg-input)",
                  border: "1px dashed var(--border-subtle)",
                  "border-radius": "var(--radius-md)",
                }}
              >
                <div style="font-size:28px;margin-bottom:8px;">🧩</div>
                <div style="font-size:var(--font-size-sm);color:var(--text-secondary);font-weight:600;margin-bottom:6px;">
                  No Custom Scripts Loaded
                </div>
                <div style="font-size:var(--font-size-xs);color:var(--text-muted);line-height:1.6;">
                  Specify a folder path with extension.json to map custom local script commands.
                </div>
              </div>
            }
          >
            <div style="font-size:var(--font-size-xs);color:var(--text-muted);padding:0 12px 8px;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;">
              Custom Scripts — {extensions().length}
            </div>
            <For each={extensions()}>
              {(ext) => <ExtensionCard ext={ext} />}
            </For>
          </Show>

          <ExtensionTemplate />
        </Show>

        <Show when={activeSubTab() === "marketplace"}>
          {/* Online marketplace search */}
          <div
            style={{
              margin: "0 12px 14px",
              padding: "12px",
              background: "var(--bg-input)",
              border: "1px solid var(--border-default)",
              "border-radius": "var(--radius-md)",
            }}
          >
            <div style="font-size:var(--font-size-xs);font-weight:700;color:var(--text-secondary);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:10px;">
              🔍 Search Open VSX Registry
            </div>

            <div style="display:flex;gap:6px;margin-bottom:12px;">
              <input
                type="text"
                value={searchQuery()}
                onInput={(e) => setSearchQuery(e.currentTarget.value)}
                placeholder="e.g. python, rust, github, theme"
                style={{
                  flex: 1,
                  background: "var(--bg-active)",
                  border: "1px solid var(--border-default)",
                  color: "var(--text-primary)",
                  padding: "7px 10px",
                  "border-radius": "var(--radius-sm)",
                  "font-size": "var(--font-size-xs)",
                  outline: "none",
                }}
                onKeyDown={(e) => e.key === "Enter" && handleOnlineSearch()}
              />
              <button
                onClick={handleOnlineSearch}
                disabled={searching()}
                style={{
                  padding: "7px 14px",
                  background: "var(--accent-primary)",
                  border: "none",
                  "border-radius": "var(--radius-sm)",
                  color: "var(--bg-void)",
                  "font-size": "var(--font-size-xs)",
                  "font-weight": "700",
                  cursor: searching() ? "default" : "pointer",
                }}
              >
                {searching() ? "..." : "Search"}
              </button>
            </div>

            {/* Results stack */}
            <div style="display:flex;flex-direction:column;gap:8px;max-height:450px;overflow-y:auto;">
              <Show
                when={searchResults().length > 0}
                fallback={
                  <div style="font-size:11px;color:var(--text-muted);text-align:center;padding:20px 0;font-style:italic;">
                    {searching() ? "Searching marketplace..." : "Type a query to search extensions online."}
                  </div>
                }
              >
                <For each={searchResults()}>
                  {(ext) => (
                    <div
                      style={{
                        padding: "10px",
                        background: "var(--bg-active)",
                        border: "1px solid var(--border-subtle)",
                        "border-radius": "var(--radius-sm)",
                        display: "flex",
                        "flex-direction": "column",
                        gap: "6px",
                      }}
                    >
                      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">
                        <div style="min-width:0;flex:1;">
                          <div
                            style="font-weight:600;color:var(--text-primary);font-size:var(--font-size-sm);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;"
                            title={ext.name}
                          >
                            {ext.name}
                          </div>
                          <div style="font-size:10px;color:var(--text-muted);">
                            By {ext.publisher} · v{ext.version}
                          </div>
                        </div>

                        <Show
                          when={isInstalled(ext.id)}
                          fallback={
                            <button
                              onClick={() => handleInstallOnline(ext)}
                              disabled={installingId() !== null}
                              style={{
                                padding: "4px 8px",
                                background: installingId() === ext.id ? "var(--bg-active)" : "var(--accent-primary)",
                                border: "none",
                                "border-radius": "var(--radius-sm)",
                                color: "var(--bg-void)",
                                "font-size": "10px",
                                "font-weight": "700",
                                cursor: installingId() !== null ? "default" : "pointer",
                                "flex-shrink": 0,
                              }}
                            >
                              {installingId() === ext.id ? "Installing..." : "Install"}
                            </button>
                          }
                        >
                          <span
                            style={{
                              "font-size": "10px",
                              color: "var(--accent-green)",
                              "font-weight": "600",
                              "flex-shrink": 0,
                            }}
                          >
                            ✓ Installed
                          </span>
                        </Show>
                      </div>

                      <div style="font-size:11px;color:var(--text-secondary);line-height:1.4;">
                        {ext.description}
                      </div>

                      <div style="font-size:9px;color:var(--text-muted);display:flex;align-items:center;gap:6px;">
                        <span>📥 {ext.downloads.toLocaleString()} downloads</span>
                      </div>
                    </div>
                  )}
                </For>
              </Show>
            </div>
          </div>
        </Show>
      </div>
    </div>
  );
}
