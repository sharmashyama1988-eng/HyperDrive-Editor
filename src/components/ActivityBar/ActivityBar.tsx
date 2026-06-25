import { For } from "solid-js";
import { editorStore } from "@store/editorStore";
import { notificationStore } from "@store/notificationStore";

export default function ActivityBar() {
  const store = () => editorStore.get();

  const items = [
    { id: "explorer", label: "Explorer", icon: "🗂️" },
    { id: "search", label: "Search", icon: "🔍" },
    { id: "git", label: "Source Control", icon: "🌿" },
    { id: "ai", label: "AI Assistant", icon: "🤖" },
    { id: "preview", label: "Web Preview", icon: "🌐" },
    { id: "recent", label: "Recent Workspaces", icon: "🕒" },
  ] as const;

  const isActive = (id: any) => {
    return store().sidebarPanel === id && store().sidebarVisible;
  };

  const handleClick = (id: any) => {
    editorStore.setSidebarPanel(id);
  };

  const handleCloseProject = async () => {
    const confirmed = await notificationStore.confirm("Are you sure you want to close this workspace?");
    if (confirmed) {
      editorStore.closeWorkspace();
    }
  };

  return (
    <div 
      style={{
        width: "var(--activity-bar-width)",
        height: "100%",
        background: "var(--bg-panel)",
        "border-right": "1px solid var(--border-subtle)",
        display: "flex",
        "flex-direction": "column",
        "align-items": "center",
        "justify-content": "space-between",
        padding: "8px 0"
      }}
    >
      <div style="display: flex; flex-direction: column; gap: 8px; width: 100%; align-items: center;">
        <For each={items}>
          {(item) => (
            <button
              onClick={() => handleClick(item.id)}
              title={item.label}
              style={{
                width: "36px",
                height: "36px",
                display: "flex",
                "align-items": "center",
                "justify-content": "center",
                "border-radius": "var(--radius-sm)",
                "font-size": "20px",
                background: isActive(item.id) ? "var(--bg-active)" : "transparent",
                color: isActive(item.id) ? "var(--accent-primary)" : "var(--text-secondary)",
                border: isActive(item.id) ? "1px solid var(--border-accent)" : "1px solid transparent",
                "box-shadow": isActive(item.id) ? "var(--glow-primary)" : "none",
                transition: "all var(--transition-fast)",
                cursor: "pointer"
              }}
              class="activity-bar-icon-btn"
            >
              {item.icon}
            </button>
          )}
        </For>
      </div>

      <div style="display: flex; flex-direction: column; gap: 8px; width: 100%; align-items: center;">
        {/* Settings button */}
        <button
          onClick={() => handleClick("settings")}
          title="Settings"
          style={{
            width: "36px",
            height: "36px",
            display: "flex",
            "align-items": "center",
            "justify-content": "center",
            "border-radius": "var(--radius-sm)",
            "font-size": "20px",
            background: isActive("settings") ? "var(--bg-active)" : "transparent",
            color: isActive("settings") ? "var(--accent-primary)" : "var(--text-secondary)",
            border: isActive("settings") ? "1px solid var(--border-accent)" : "1px solid transparent",
            "box-shadow": isActive("settings") ? "var(--glow-primary)" : "none",
            transition: "all var(--transition-fast)",
            cursor: "pointer"
          }}
        >
          ⚙️
        </button>

        {/* Toggle Terminal Button */}
        <button
          onClick={() => {
            const visible = store().bottomPanelVisible;
            const tab = store().bottomPanelTab;
            if (visible && tab === "terminal") {
              editorStore.toggleBottomPanel();
            } else {
              editorStore.setBottomPanelTab("terminal");
            }
          }}
          title="Toggle Terminal"
          style={{
            width: "36px",
            height: "36px",
            display: "flex",
            "align-items": "center",
            "justify-content": "center",
            "border-radius": "var(--radius-sm)",
            "font-size": "18px",
            background: (store().bottomPanelVisible && store().bottomPanelTab === "terminal") ? "var(--bg-active)" : "transparent",
            color: (store().bottomPanelVisible && store().bottomPanelTab === "terminal") ? "var(--accent-primary)" : "var(--text-secondary)",
            border: (store().bottomPanelVisible && store().bottomPanelTab === "terminal") ? "1px solid var(--border-accent)" : "1px solid transparent",
            "box-shadow": (store().bottomPanelVisible && store().bottomPanelTab === "terminal") ? "var(--glow-primary)" : "none",
            transition: "all var(--transition-fast)",
            cursor: "pointer"
          }}
        >
          💻
        </button>
      </div>
    </div>
  );
}
