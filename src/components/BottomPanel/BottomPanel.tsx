import { Show, For, onCleanup } from "solid-js";
import { editorStore } from "@store/editorStore";
import { settingsStore } from "@store/settingsStore";
import { tauriFS } from "@lib/tauriFS";
import Terminal from "../Terminal/Terminal";

export default function BottomPanel() {
  const store = () => editorStore.get();
  let isDragging = false;

  const startResize = (e: MouseEvent) => {
    e.preventDefault();
    isDragging = true;
    document.addEventListener("mousemove", resize);
    document.addEventListener("mouseup", stopResize);
    document.body.style.cursor = "row-resize";
    document.body.style.userSelect = "none";
  };

  const resize = (e: MouseEvent) => {
    if (!isDragging) return;
    const isStatusBarVisible = settingsStore.settings["workbench.statusBar.visible"];
    const statusBarHeight = isStatusBarVisible ? 22 : 0;
    const newHeight = Math.max(100, Math.min(window.innerHeight - e.clientY - statusBarHeight, window.innerHeight - 100));
    editorStore.setBottomPanelHeight(newHeight);
  };

  const stopResize = () => {
    isDragging = false;
    document.removeEventListener("mousemove", resize);
    document.removeEventListener("mouseup", stopResize);
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  };

  onCleanup(() => {
    document.removeEventListener("mousemove", resize);
    document.removeEventListener("mouseup", stopResize);
  });

  const tabs = [
    { id: "terminal", label: "Terminal" },
    { id: "problems", label: "Problems" },
    { id: "output", label: "Output Logs" },
    { id: "debugConsole", label: "Debug Console" }
  ] as const;

  const isActive = (id: any) => store().bottomPanelTab === id;

  const handleTabClick = (id: any) => {
    editorStore.setBottomPanelTab(id);
  };

  const handleProblemClick = async (prob: any) => {
    try {
      const content = await tauriFS.getFileContent(prob.filePath);
      const ext = prob.fileName.split(".").pop() || "plaintext";
      const langMap: Record<string, string> = {
        ts: "typescript", tsx: "typescript", js: "javascript", jsx: "javascript",
        py: "python", html: "html", css: "css", json: "json", md: "markdown",
        rs: "rust", go: "go", java: "java", cpp: "cpp", c: "c",
      };
      editorStore.openFile(prob.filePath, content, langMap[ext] ?? "plaintext");
      
      // Wait for editor pane layout and dispatch navigate command
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent("hyperdrive:editor-command", {
          detail: {
            command: "hyperdrive:go-to-line",
            payload: prob.line
          }
        }));
      }, 120);
    } catch (err) {
      console.error("Failed to open file from problems panel:", err);
    }
  };

  return (
    <div
      style={{
        height: `${store().bottomPanelHeight}px`,
        background: "var(--bg-panel)",
        "border-top": "1px solid var(--border-subtle)",
        display: "flex",
        "flex-direction": "column",
        "flex-shrink": 0,
        overflow: "hidden",
        position: "relative"
      }}
      class="bottom-panel-container"
    >
      {/* Horizontal resize handle */}
      <div
        onMouseDown={startResize}
        style={{
          position: "absolute",
          top: "-3px",
          left: 0,
          right: 0,
          height: "6px",
          cursor: "row-resize",
          "z-index": 100,
          background: "transparent",
          transition: "background var(--transition-fast)"
        }}
        class="bottom-panel-resizer"
        onMouseEnter={(e) => e.currentTarget.style.background = "var(--accent-primary)"}
        onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
      />
      <div 
        style="display: flex; align-items: center; justify-content: space-between; padding: 0 12px; border-bottom: 1px solid var(--border-subtle); background: var(--bg-panel); flex-shrink: 0; height: 32px;"
      >
        <div class="flex gap-2">
          <For each={tabs}>
            {(tab) => (
              <button
                onClick={() => handleTabClick(tab.id)}
                style={{
                  padding: "6px 12px",
                  "font-size": "var(--font-size-xs)",
                  color: isActive(tab.id) ? "var(--text-primary)" : "var(--text-muted)",
                  "border-bottom": isActive(tab.id) ? "2px solid var(--accent-primary)" : "2px solid transparent",
                  "font-weight": isActive(tab.id) ? "600" : "400",
                  cursor: "pointer",
                  transition: "color var(--transition-fast)"
                }}
              >
                {tab.label}
              </button>
            )}
          </For>
        </div>

        <button 
          onClick={() => editorStore.toggleBottomPanel()} 
          style="font-size: 12px; color: var(--text-muted); cursor: pointer;"
          title="Collapse Panel"
        >
          ✕
        </button>
      </div>

      <div style="flex: 1; overflow: hidden; position: relative;">
        <Show when={store().bottomPanelTab === "terminal"}>
          <Terminal />
        </Show>

        <Show when={store().bottomPanelTab === "problems"}>
          <div style="font-size: var(--font-size-xs); color: var(--text-secondary); height: 100%; overflow-y: auto; display: flex; flex-direction: column;">
            <Show when={store().diagnostics.length === 0} fallback={
              <div style="display: flex; flex-direction: column; width: 100%;">
                {/* Header listing total problems count */}
                <div style="padding: 10px 14px; border-bottom: 1px solid var(--border-subtle); color: var(--text-muted); font-weight: 500; display: flex; align-items: center; gap: 6px; background: var(--bg-hover);">
                  <span>⚠️</span>
                  <span>{store().diagnostics.length} {store().diagnostics.length === 1 ? "problem" : "problems"} detected in active files</span>
                </div>
                
                {/* Problems list */}
                <div style="display: flex; flex-direction: column; width: 100%;">
                  <For each={store().diagnostics}>
                    {(prob) => (
                      <div 
                        onClick={() => handleProblemClick(prob)}
                        style={{
                          display: "flex",
                          "align-items": "center",
                          "justify-content": "space-between",
                          padding: "8px 14px",
                          cursor: "pointer",
                          transition: "background var(--transition-fast)",
                          "border-bottom": "1px solid var(--border-subtle)",
                          "font-family": "var(--font-mono)"
                        }}
                        class="problem-item"
                        onMouseEnter={(e) => e.currentTarget.style.background = "var(--bg-hover)"}
                        onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                      >
                        <div style="display: flex; align-items: center; gap: 10px; max-width: 80%;">
                          <span style="font-size: 10px; color: var(--accent-red);">🔴</span>
                          <span style="color: var(--text-primary); font-weight: 500;">{prob.message}</span>
                        </div>
                        <div style="display: flex; align-items: center; gap: 8px; font-size: 11px; color: var(--text-muted);">
                          <span style="color: var(--accent-primary);">{prob.fileName}</span>
                          <span>[{prob.line}, {prob.col}]</span>
                        </div>
                      </div>
                    )}
                  </For>
                </div>
              </div>
            }>
              <div style="padding: 20px; display: flex; align-items: center; justify-content: center; height: 100%;">
                <p style="color: var(--text-muted); font-style: italic; font-size: var(--font-size-sm);">No problems have been detected in the workspace.</p>
              </div>
            </Show>
          </div>
        </Show>

        <Show when={store().bottomPanelTab === "output"}>
          <div style="padding: 14px; font-family: var(--font-mono); font-size: var(--font-size-xs); color: var(--text-secondary); height: 100%; overflow-y: auto;">
            <p style="color: var(--accent-primary);">[info] HyperDrive editor initialized successfully.</p>
            <p>[info] Connected to local IPC bridge.</p>
            <p>[info] Project templates loaded.</p>
          </div>
        </Show>

        <Show when={store().bottomPanelTab === "debugConsole"}>
          <div style="padding: 14px; font-family: var(--font-mono); font-size: var(--font-size-xs); color: var(--text-secondary); height: 100%; overflow-y: auto;">
            <p style="color: var(--text-muted); font-style: italic;">Debug console is idle.</p>
          </div>
        </Show>
      </div>
    </div>
  );
}
