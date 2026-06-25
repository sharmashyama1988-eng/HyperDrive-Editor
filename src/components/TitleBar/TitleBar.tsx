import { Show, createSignal, onMount } from "solid-js";
import { editorStore } from "@store/editorStore";
import { isTauri } from "@lib/tauriCheck";

export default function TitleBar() {
  const [isMaximized, setIsMaximized] = createSignal(false);

  onMount(() => {
    if (isTauri()) {
      import("@tauri-apps/api/window").then(({ getCurrentWindow }) => {
        const appWindow = getCurrentWindow();
        appWindow.isMaximized().then(setIsMaximized);
        appWindow.onResized(() => {
          appWindow.isMaximized().then(setIsMaximized);
        });
      });
    }
  });

  const handleMinimize = () => {
    const py = (window as any).pywebview?.api;
    if (py) {
      py.minimize_window();
    } else if (isTauri()) {
      import("@tauri-apps/api/window").then(({ getCurrentWindow }) => getCurrentWindow().minimize());
    }
  };

  const handleMaximize = () => {
    const py = (window as any).pywebview?.api;
    if (py) {
      if (isMaximized()) {
        py.restore_window();
        setIsMaximized(false);
      } else {
        py.maximize_window();
        setIsMaximized(true);
      }
    } else if (isTauri()) {
      import("@tauri-apps/api/window").then(({ getCurrentWindow }) => getCurrentWindow().toggleMaximize());
    }
  };

  const handleClose = () => {
    const py = (window as any).pywebview?.api;
    if (py) {
      py.close_window();
    } else if (isTauri()) {
      import("@tauri-apps/api/window").then(({ getCurrentWindow }) => getCurrentWindow().close());
    }
  };

  const titleText = () => {
    const ws = editorStore.get().workspaceName;
    return ws ? `${ws} — HyperDrive` : "HyperDrive Code Editor";
  };

  return (
    <div class="titlebar pywebview-drag-region" data-tauri-drag-region>
      <div class="flex items-center gap-2" style="position: absolute; left: 12px; height: 100%; pointer-events: none;">
        <img src="./logo.png" style="width: 16px; height: 16px; object-fit: contain;" alt="HyperDrive" />
        <span style="font-size: var(--font-size-xs); font-weight: 600; color: var(--text-secondary);">HYPERDRIVE</span>
      </div>

      <div class="titlebar-title" style="pointer-events: none;">{titleText()}</div>

      <div class="titlebar-controls" style="pointer-events: auto;">
        <button class="titlebar-btn" onClick={handleMinimize} title="Minimize">
          <svg width="10" height="1" viewBox="0 0 10 1" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="10" height="1" fill="currentColor"/>
          </svg>
        </button>
        <button class="titlebar-btn" onClick={handleMaximize} title={isMaximized() ? "Restore" : "Maximize"}>
          <Show when={isMaximized()} fallback={
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="0.5" y="0.5" width="9" height="9" stroke="currentColor"/>
            </svg>
          }>
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="1.5" y="1.5" width="7" height="7" stroke="currentColor"/>
              <path d="M3 0.5H9.5V7" stroke="currentColor"/>
            </svg>
          </Show>
        </button>
        <button class="titlebar-btn close" onClick={handleClose} title="Close">
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M1 1L9 9M9 1L1 9" stroke="currentColor" stroke-width="1.2"/>
          </svg>
        </button>
      </div>
    </div>
  );
}
