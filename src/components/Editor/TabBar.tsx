import { For, Show, createSignal, onMount, onCleanup } from "solid-js";
import { editorStore, OpenTab } from "@store/editorStore";
import { tauriFS } from "@lib/tauriFS";
import { notificationStore } from "@store/notificationStore";

interface TabBarProps {
  splitId: string;
  tabs: OpenTab[];
}

export default function TabBar(props: TabBarProps) {
  const [contextMenu, setContextMenu] = createSignal<{ x: number; y: number; tabId: string } | null>(null);

  const runAIQuickFix = async () => {
    const mainSplit = editorStore.get().splits.find(s => s.id === "main");
    if (!mainSplit || !mainSplit.activeTabId) return;
    const tab = mainSplit.tabs.find(t => t.id === mainSplit.activeTabId);
    if (!tab) return;

    const fileDiags = editorStore.get().diagnostics.filter(d => d.filePath === tab.path);
    if (fileDiags.length === 0) {
      notificationStore.showToast("No syntax errors detected in this file.", "info");
      return;
    }

    const py = (window as any).pywebview?.api;
    if (!py || !py.ai_quick_fix) {
      notificationStore.showToast("Python backend bridge not ready or loaded.", "error");
      return;
    }

    try {
      const creds = await py.get_credentials();
      const apiKey = creds.gemini_api_key || "";
      if (!apiKey) {
        notificationStore.showToast("Please configure your Gemini API Key in the AI Panel first.", "warning");
        editorStore.setSidebarPanel("ai");
        return;
      }

      const origContent = tab.content;
      editorStore.updateTabContent(tab.id, `/* AI is fixing errors in ${tab.name}... Please wait */\n\n` + tab.content);
      
      const res = await py.ai_quick_fix(
        origContent,
        tab.language,
        JSON.stringify(fileDiags),
        apiKey,
        creds.api_type || "gemini",
        creds.api_base_url || "",
        creds.model_name || ""
      );

      if (res.success && res.corrected) {
        editorStore.updateTabContent(tab.id, res.corrected);
        await tauriFS.saveFile(tab.path, res.corrected);
        notificationStore.showToast("AI successfully fixed syntax errors!", "success");
      } else {
        editorStore.updateTabContent(tab.id, origContent);
        notificationStore.showToast("AI error: " + (res.error || "Failed to resolve errors."), "error");
      }
    } catch (err: any) {
      notificationStore.showToast("Error invoking AI Quick-Fix: " + (err.message || err), "error");
    }
  };

  onMount(() => {
    const closeMenu = () => setContextMenu(null);
    window.addEventListener("click", closeMenu);
    onCleanup(() => window.removeEventListener("click", closeMenu));
  });

  const handleTabClick = (tabId: string) => {
    editorStore.openFile(
      props.tabs.find(t => t.id === tabId)?.path || "",
      props.tabs.find(t => t.id === tabId)?.content || "",
      props.tabs.find(t => t.id === tabId)?.language || "plaintext"
    );
  };

  const handleCloseClick = (e: Event, tabId: string) => {
    e.stopPropagation();
    editorStore.closeTab(tabId, props.splitId);
  };

  const handleContextMenu = (e: MouseEvent, tabId: string) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, tabId });
  };

  const handleCopyPath = (path: string) => {
    navigator.clipboard.writeText(path);
  };

  const handleCopyRelativePath = (path: string) => {
    const root = editorStore.get().workspacePath;
    let relPath = path;
    if (root) {
      const normalizedRoot = root.replace(/\\/g, "/");
      const normalizedPath = path.replace(/\\/g, "/");
      if (normalizedPath.startsWith(normalizedRoot)) {
        relPath = normalizedPath.substring(normalizedRoot.length);
        if (relPath.startsWith("/")) {
          relPath = relPath.substring(1);
        }
      }
    }
    navigator.clipboard.writeText(relPath);
  };

  const handleRevealInExplorer = async (path: string) => {
    try {
      await tauriFS.revealInExplorer(path);
    } catch (err: any) {
      notificationStore.showToast(`Could not reveal in explorer: ${err.message || err}`, "error");
    }
  };

  return (
    <div 
      style={{
        height: "var(--tab-bar-height)",
        background: "var(--bg-panel)",
        "border-bottom": "1px solid var(--border-subtle)",
        display: "flex",
        "align-items": "center",
        "justify-content": "space-between",
        "flex-shrink": 0,
        position: "relative",
        width: "100%",
        overflow: "hidden"
      }}
      class="tab-bar-container"
    >
      <div style="display: flex; align-items: center; overflow-x: auto; flex: 1; height: 100%;">
        <For each={props.tabs}>
          {(tab) => (
            <div
              onClick={() => handleTabClick(tab.id)}
              onContextMenu={(e) => handleContextMenu(e, tab.id)}
              style={{
                height: "100%",
                padding: "0 16px",
                display: "flex",
                "align-items": "center",
                gap: "8px",
                background: tab.isActive ? "var(--bg-base)" : "var(--bg-tab-inactive)",
                color: tab.isActive ? "var(--text-primary)" : "var(--text-secondary)",
                "border-right": "1px solid var(--border-subtle)",
                "border-top": tab.isActive ? "2px solid var(--accent-primary)" : "2px solid transparent",
                cursor: "pointer",
                "font-size": "var(--font-size-sm)",
                "user-select": "none",
                transition: "background var(--transition-fast)"
              }}
              class="tab-item"
            >
              <span style="font-size: 13px;">
                {tab.language === "html" ? "🌐" : tab.language === "python" ? "🐍" : "📄"}
              </span>
              <span style={{ "font-weight": tab.isActive ? "600" : "400" }}>{tab.name}</span>
              
              {/* Dirty / Close state */}
              <div style="display: flex; align-items: center; justify-content: center; width: 14px; height: 14px;">
                <Show when={tab.isDirty} fallback={
                  <button 
                    onClick={(e) => handleCloseClick(e, tab.id)}
                    style="font-size: 10px; color: var(--text-muted); cursor: pointer;"
                    class="close-tab-btn"
                  >
                    ✕
                  </button>
                }>
                  <span style="width: 6px; height: 6px; border-radius: 50%; background: var(--accent-primary); box-shadow: var(--glow-primary);"></span>
                </Show>
              </div>
            </div>
          )}
        </For>
      </div>

      {/* Editor TabBar Actions Toolbar */}
      <div style="display: flex; align-items: center; gap: 8px; padding: 0 12px; flex-shrink: 0; height: 100%; border-left: 1px solid var(--border-subtle);">
        <button
          onClick={runAIQuickFix}
          style="background: rgba(0, 212, 170, 0.12); color: var(--accent-primary); border: 1px solid rgba(0, 212, 170, 0.25); border-radius: var(--radius-sm); padding: 4px 10px; font-size: 11px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 4px;"
          title="Fix all syntax errors in this file using AI"
        >
          ⚡ AI Fix
        </button>
        <button
          onClick={() => editorStore.togglePreview()}
          style={{
            background: editorStore.get().previewVisible ? "var(--bg-active)" : "transparent",
            color: editorStore.get().previewVisible ? "var(--accent-primary)" : "var(--text-secondary)",
            border: "1px solid var(--border-default)",
            "border-radius": "var(--radius-sm)",
            padding: "4px 10px",
            "font-size": "11px",
            "font-weight": "600",
            cursor: "pointer"
          }}
          title="Toggle Split Live Web Preview"
        >
          🖥️ Preview
        </button>
      </div>

      {/* Right-click Context Menu */}
      <Show when={contextMenu()}>
        {(menu) => (
          <div
            style={{
              position: "fixed",
              top: `${menu().y}px`,
              left: `${menu().x}px`,
              background: "var(--bg-panel)",
              border: "1px solid var(--border-strong)",
              "border-radius": "var(--radius-sm)",
              "box-shadow": "0 10px 30px rgba(0,0,0,0.5)",
              "z-index": 1000,
              padding: "4px 0",
              display: "flex",
              "flex-direction": "column",
              "min-width": "140px"
            }}
          >
            <button
              onClick={() => {
                const id = menu().tabId;
                setContextMenu(null);
                setTimeout(() => editorStore.closeTab(id, props.splitId), 0);
              }}
              style={{
                padding: "8px 14px",
                "text-align": "left",
                background: "transparent",
                color: "var(--text-primary)",
                border: "none",
                cursor: "pointer",
                "font-size": "var(--font-size-xs)"
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = "var(--bg-hover)"}
              onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
            >
              Close
            </button>
            <button
              onClick={() => {
                const id = menu().tabId;
                setContextMenu(null);
                setTimeout(() => editorStore.closeOthers(id, props.splitId), 0);
              }}
              style={{
                padding: "8px 14px",
                "text-align": "left",
                background: "transparent",
                color: "var(--text-primary)",
                border: "none",
                cursor: "pointer",
                "font-size": "var(--font-size-xs)"
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = "var(--bg-hover)"}
              onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
            >
              Close Others
            </button>
            <button
              onClick={() => {
                const id = menu().tabId;
                setContextMenu(null);
                setTimeout(() => editorStore.closeTabsToTheRight(id, props.splitId), 0);
              }}
              style={{
                padding: "8px 14px",
                "text-align": "left",
                background: "transparent",
                color: "var(--text-primary)",
                border: "none",
                cursor: "pointer",
                "font-size": "var(--font-size-xs)"
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = "var(--bg-hover)"}
              onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
            >
              Close to the Right
            </button>
            <button
              onClick={() => {
                setContextMenu(null);
                setTimeout(() => editorStore.closeSavedTabs(props.splitId), 0);
              }}
              style={{
                padding: "8px 14px",
                "text-align": "left",
                background: "transparent",
                color: "var(--text-primary)",
                border: "none",
                cursor: "pointer",
                "font-size": "var(--font-size-xs)"
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = "var(--bg-hover)"}
              onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
            >
              Close Saved
            </button>
            <button
              onClick={() => {
                setContextMenu(null);
                setTimeout(() => editorStore.closeAllTabs(props.splitId), 0);
              }}
              style={{
                padding: "8px 14px",
                "text-align": "left",
                background: "transparent",
                color: "var(--text-primary)",
                border: "none",
                cursor: "pointer",
                "font-size": "var(--font-size-xs)"
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = "var(--bg-hover)"}
              onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
            >
              Close All
            </button>

            <div style="height: 1px; background: var(--border-subtle); margin: 4px 0;"></div>

            <button
              onClick={() => {
                const target = props.tabs.find(t => t.id === menu().tabId);
                if (target) handleCopyPath(target.path);
              }}
              style={{
                padding: "8px 14px",
                "text-align": "left",
                background: "transparent",
                color: "var(--text-primary)",
                border: "none",
                cursor: "pointer",
                "font-size": "var(--font-size-xs)"
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = "var(--bg-hover)"}
              onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
            >
              Copy Path
            </button>
            <button
              onClick={() => {
                const target = props.tabs.find(t => t.id === menu().tabId);
                if (target) handleCopyRelativePath(target.path);
              }}
              style={{
                padding: "8px 14px",
                "text-align": "left",
                background: "transparent",
                color: "var(--text-primary)",
                border: "none",
                cursor: "pointer",
                "font-size": "var(--font-size-xs)"
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = "var(--bg-hover)"}
              onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
            >
              Copy Relative Path
            </button>
            <button
              onClick={() => {
                const target = props.tabs.find(t => t.id === menu().tabId);
                if (target) handleRevealInExplorer(target.path);
              }}
              style={{
                padding: "8px 14px",
                "text-align": "left",
                background: "transparent",
                color: "var(--text-primary)",
                border: "none",
                cursor: "pointer",
                "font-size": "var(--font-size-xs)"
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = "var(--bg-hover)"}
              onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
            >
              Reveal in File Explorer
            </button>
          </div>
        )}
      </Show>
    </div>
  );
}
