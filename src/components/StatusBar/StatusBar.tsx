import { Show } from "solid-js";
import { editorStore } from "@store/editorStore";

export default function StatusBar() {
  const store = () => editorStore.get();

  return (
    <div
      style={{
        height: "100%",
        background: "var(--bg-panel)",
        "border-top": "1px solid var(--border-subtle)",
        display: "flex",
        "align-items": "center",
        "justify-content": "space-between",
        padding: "0 12px",
        "font-size": "var(--font-size-xs)",
        color: "var(--text-secondary)",
        "user-select": "none"
      }}
      class="status-bar-container"
    >
      <div class="flex items-center gap-2">
        <span 
          style="background: var(--accent-primary); color: var(--bg-void); padding: 1px 6px; border-radius: var(--radius-sm); font-weight: 700; font-size: 10px;"
        >
          STABLE
        </span>
        <span style="color: var(--text-muted);">|</span>
        <span style="cursor: pointer;" title="Active Git branch">
          🌿 main
        </span>
      </div>

      <div class="flex items-center gap-2">
        <span style="font-family: var(--font-mono);" title="Line and Column number">
          Ln {store().cursorLine}, Col {store().cursorCol}
        </span>
        <span style="color: var(--text-muted);">|</span>
        <span style="cursor: pointer;" title="Indentation spacing">Spaces: 2</span>
        <span style="color: var(--text-muted);">|</span>
        <span style="cursor: pointer;" title="Character encoding">{store().encoding}</span>
        <span style="color: var(--text-muted);">|</span>
        <span style="cursor: pointer; text-transform: uppercase; color: var(--accent-primary); font-weight: 500;" title="Select language mode">
          {store().language}
        </span>
      </div>
    </div>
  );
}
