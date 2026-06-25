import { Show, createMemo, onCleanup } from "solid-js";
import { editorStore } from "@store/editorStore";
import { settingsStore } from "@store/settingsStore";
import FileTree from "./FileTree";
import GitPanel from "./GitPanel";
import SearchPanel from "./SearchPanel";
import SettingsPanel from "./SettingsPanel";
import AIPanel from "../AIPanel/AIPanel";
import WebPreview from "../WebPreview/WebPreview";
import RecentPanel from "./RecentPanel";

export default function Sidebar() {
  const store = () => editorStore.get();
  let isDragging = false;

  const title = createMemo(() => {
    switch (store().sidebarPanel) {
      case "explorer": return "Explorer";
      case "search": return "Search Workspace";
      case "git": return "Source Control";
      case "ai": return "Gemini AI Agent";
      case "preview": return "Live Web Preview";
      case "settings": return "Settings";
      case "recent": return "Recent Workspaces";
      default: return "";
    }
  });

  const startResize = (e: MouseEvent) => {
    e.preventDefault();
    isDragging = true;
    document.addEventListener("mousemove", resize);
    document.addEventListener("mouseup", stopResize);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  };

  const resize = (e: MouseEvent) => {
    if (!isDragging) return;
    const isActivityBarVisible = settingsStore.settings["workbench.activityBar.visible"];
    const activityBarWidth = isActivityBarVisible ? 48 : 0;
    const newWidth = Math.max(150, Math.min(e.clientX - activityBarWidth, 600));
    settingsStore.update("workbench.sideBar.width", newWidth);
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

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        background: "var(--bg-panel)",
        "border-right": "1px solid var(--border-subtle)",
        display: "flex",
        "flex-direction": "column",
        overflow: "hidden",
        position: "relative"
      }}
    >
      <div 
        style={{
          padding: "10px 14px",
          display: "flex",
          "justify-content": "space-between",
          "align-items": "center",
          "border-bottom": "1px solid var(--border-subtle)",
          "flex-shrink": 0
        }}
      >
        <span style="font-size: var(--font-size-xs); font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-secondary);">
          {title()}
        </span>
        <button 
          onClick={() => editorStore.toggleSidebar()} 
          style="cursor:pointer; font-size:12px; color:var(--text-muted);"
          title="Collapse Sidebar"
        >
          ◀
        </button>
      </div>

      <div style="flex: 1; overflow-y: auto; display: flex; flex-direction: column;">
        <Show when={store().sidebarPanel === "explorer"}>
          <FileTree />
        </Show>
        <Show when={store().sidebarPanel === "git"}>
          <GitPanel />
        </Show>
        <Show when={store().sidebarPanel === "search"}>
          <SearchPanel />
        </Show>
        <Show when={store().sidebarPanel === "settings"}>
          <SettingsPanel />
        </Show>
        <Show when={store().sidebarPanel === "ai"}>
          <AIPanel />
        </Show>
        <Show when={store().sidebarPanel === "preview"}>
          <WebPreview />
        </Show>
        <Show when={store().sidebarPanel === "recent"}>
          <RecentPanel />
        </Show>
      </div>

      {/* Resize handle */}
      <div
        onMouseDown={startResize}
        style={{
          position: "absolute",
          top: 0,
          right: "-3px",
          width: "6px",
          height: "100%",
          cursor: "col-resize",
          "z-index": 100,
          background: "transparent",
          transition: "background var(--transition-fast)"
        }}
        class="sidebar-resizer"
        onMouseEnter={(e) => e.currentTarget.style.background = "var(--accent-primary)"}
        onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
      />
    </div>
  );
}
