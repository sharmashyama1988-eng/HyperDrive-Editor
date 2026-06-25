import { Show, createMemo, onMount, onCleanup } from "solid-js";
import { editorStore } from "@store/editorStore";
import { settingsStore } from "@store/settingsStore";
import ActivityBar from "./ActivityBar/ActivityBar";
import Sidebar from "./Sidebar/Sidebar";
import EditorArea from "./Editor/EditorArea";
import BottomPanel from "./BottomPanel/BottomPanel";
import StatusBar from "./StatusBar/StatusBar";

export default function WorkspaceLayout() {
  const store = () => editorStore.get() as any;

  onMount(() => {
    const handleGlobalKeys = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "`") {
        e.preventDefault();
        editorStore.toggleBottomPanel();
        editorStore.setBottomPanelTab("terminal");
      }
    };
    window.addEventListener("keydown", handleGlobalKeys);
    onCleanup(() => window.removeEventListener("keydown", handleGlobalKeys));
  });

  return (
    <div 
      style={{
        display: "flex",
        "flex-direction": "column",
        height: "calc(100vh - var(--titlebar-height) - var(--menubar-height))",
        width: "100vw",
        overflow: "hidden",
        background: "var(--bg-void)"
      }}
    >
      {/* Main Content Area */}
      <div 
        style={{
          display: "flex",
          "flex-direction": "row",
          flex: 1,
          "min-height": 0,
          width: "100%",
          overflow: "hidden"
        }}
      >
        {/* Activity Bar */}
        <Show when={!settingsStore.settings["workbench.zenMode.enabled"] && settingsStore.settings["workbench.activityBar.visible"]}>
          <ActivityBar />
        </Show>

        {/* Primary Side Bar */}
        <Show when={!settingsStore.settings["workbench.zenMode.enabled"] && store().sidebarVisible}>
          <div 
            style={{ 
              width: `${settingsStore.settings["workbench.sideBar.width"]}px`, 
              "flex-shrink": 0, 
              height: "100%", 
              overflow: "hidden" 
            }}
          >
            <Sidebar />
          </div>
        </Show>

        {/* Editor & Panels Area */}
        <div style="flex: 1; min-width: 0; display: flex; flex-direction: column; height: 100%; overflow: hidden; position: relative;">
          <div style="flex: 1; min-height: 0; display: flex; width: 100%; overflow: hidden;">
            <EditorArea />
          </div>
          
          {/* Bottom Panel Drawer */}
          <Show when={store().bottomPanelVisible}>
            <BottomPanel />
          </Show>
        </div>
      </div>

      {/* Status Bar */}
      <Show when={!settingsStore.settings["workbench.zenMode.enabled"] && settingsStore.settings["workbench.statusBar.visible"]}>
        <StatusBar />
      </Show>
    </div>
  );
}
