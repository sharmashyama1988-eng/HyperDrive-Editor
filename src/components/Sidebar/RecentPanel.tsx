import { For, Show } from "solid-js";
import { editorStore } from "@store/editorStore";
import { fileStore } from "@store/fileStore";

export default function RecentPanel() {
  const handleOpenRecent = (path: string) => {
    editorStore.openWorkspace(path);
  };

  const handleRemoveRecent = (e: MouseEvent, path: string) => {
    e.stopPropagation();
    fileStore.removeRecent(path);
  };

  return (
    <div style="display: flex; flex-direction: column; width: 100%; height: 100%; overflow: hidden;">
      {/* Header with Clear All button */}
      <div 
        style={{
          display: "flex",
          "align-items": "center",
          "justify-content": "space-between",
          padding: "10px 14px 8px 14px",
          "border-bottom": "1px solid var(--border-subtle)",
          background: "var(--bg-panel)",
          "flex-shrink": 0
        }}
      >
        <span style="font-size: var(--font-size-xs); color: var(--text-muted); font-weight: 500;">History</span>
        <Show when={fileStore.recentProjects().length > 0}>
          <button 
            onClick={() => fileStore.clearRecent()}
            style="background: transparent; border: none; color: var(--text-muted); cursor: pointer; font-size: var(--font-size-xs); font-weight: 500; transition: color var(--transition-fast);"
            onMouseEnter={(e) => e.currentTarget.style.color = "var(--accent-red)"}
            onMouseLeave={(e) => e.currentTarget.style.color = "var(--text-muted)"}
          >
            Clear All
          </button>
        </Show>
      </div>

      {/* Recent List */}
      <div style="flex: 1; overflow-y: auto; padding: 6px 0; display: flex; flex-direction: column; width: 100%; gap: 4px;">
        <Show when={fileStore.recentProjects().length === 0} fallback={
          <For each={fileStore.recentProjects()}>
            {(project) => (
              <div 
                onClick={() => handleOpenRecent(project.path)}
                style={{
                  display: "flex",
                  "align-items": "center",
                  "justify-content": "space-between",
                  padding: "8px 14px",
                  cursor: "pointer",
                  transition: "background var(--transition-fast)",
                  position: "relative"
                }}
                class="recent-panel-item"
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "var(--bg-hover)";
                  const closeBtn = e.currentTarget.querySelector(".remove-recent-btn") as HTMLElement;
                  if (closeBtn) closeBtn.style.opacity = "1";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                  const closeBtn = e.currentTarget.querySelector(".remove-recent-btn") as HTMLElement;
                  if (closeBtn) closeBtn.style.opacity = "0";
                }}
              >
                <div style="display: flex; flex-direction: column; gap: 2px; max-width: 85%; pointer-events: none;">
                  <span style="font-size: var(--font-size-sm); font-weight: 500; color: var(--text-primary); text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">
                    {project.name}
                  </span>
                  <span style="font-size: var(--font-size-xs); color: var(--text-muted); font-family: var(--font-mono); text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">
                    {project.path}
                  </span>
                </div>
                
                <button
                  class="remove-recent-btn"
                  onClick={(e) => handleRemoveRecent(e, project.path)}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "var(--text-muted)",
                    cursor: "pointer",
                    "font-size": "12px",
                    padding: "4px",
                    opacity: "0",
                    transition: "opacity var(--transition-fast), color var(--transition-fast)"
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.color = "var(--accent-red)"}
                  onMouseLeave={(e) => e.currentTarget.style.color = "var(--text-muted)"}
                  title="Remove from history"
                >
                  ✕
                </button>
              </div>
            )}
          </For>
        }>
          <div style="padding: 14px; font-style: italic; color: var(--text-muted); font-size: var(--font-size-xs);">
            No recent workspaces opened.
          </div>
        </Show>
      </div>
    </div>
  );
}
