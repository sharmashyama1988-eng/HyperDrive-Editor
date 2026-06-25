import { Show, For } from "solid-js";
import { editorStore, OpenTab } from "@store/editorStore";
import TabBar from "./TabBar";
import EditorPane from "./EditorPane";
import Minimap from "./Minimap";
import WebPreview from "../WebPreview/WebPreview";

export default function EditorArea() {
  const store = () => editorStore.get();
  
  // Fetch active tab in main split
  const activeTab = (): OpenTab | null => {
    const mainSplit = store().splits.find(s => s.id === "main");
    if (!mainSplit) return null;
    return mainSplit.tabs.find(t => t.id === mainSplit.activeTabId) || null;
  };

  const activeBreadcrumbs = () => {
    const tab = activeTab();
    if (!tab) return "";
    return tab.path.replace(/\\/g, "/").replace(/\//g, " ➔ ");
  };

  return (
    <div style="flex: 1; display: flex; flex-direction: column; height: 100%; overflow: hidden; background: var(--bg-base);">
      <Show when={activeTab()} fallback={
        <div style="flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: var(--space-4); color: var(--text-muted); text-align: center;">
          <span style="font-size: 48px;">⚡</span>
          <span style="font-weight: 500; font-size: var(--font-size-md);">HyperDrive Code Editor</span>
          <p style="font-size: var(--font-size-xs); max-width: 240px; line-height: 1.5;">
            Select a file from the explorer, create a new project, or ask the AI assistant to write code.
          </p>
        </div>
      }>
        {/* Tab strip */}
        <TabBar splitId="main" tabs={store().splits.find(s => s.id === "main")?.tabs || []} />

        {/* Breadcrumbs bar */}
        <div 
          style={{
            padding: "6px 14px",
            background: "var(--bg-base)",
            "border-bottom": "1px solid var(--border-subtle)",
            "font-size": "11px",
            color: "var(--text-muted)",
            "font-family": "var(--font-mono)",
            display: "flex",
            "align-items": "center",
            "flex-shrink": 0
          }}
          class="breadcrumbs-bar"
        >
          <span>📁</span>
          <span style="margin-left: 6px;" class="truncate">{activeBreadcrumbs()}</span>
        </div>

        {/* Workspace body: Editor + Minimap + optional side-by-side WebPreview */}
        <div style="flex: 1; display: flex; flex-direction: row; overflow: hidden; position: relative;">
          <div style="flex: 1; height: 100%; overflow: hidden; display: flex; flex-direction: row;">
            <div style="flex: 1; height: 100%; overflow: hidden; position: relative;">
              <EditorPane tab={activeTab()!} splitId="main" />
            </div>

            <Show when={store().previewVisible}>
              <div style="width: 50%; height: 100%; border-left: 1px solid var(--border-default); display: flex; flex-direction: column; overflow: hidden; background: var(--bg-panel);">
                <WebPreview />
              </div>
            </Show>
          </div>

          {/* Minimap overlay */}
          <Show when={(store() as any)["editor.minimap.enabled"]}>
            <Minimap
              content={activeTab()?.content || ""}
              viewportTop={0}
              viewportHeight={30}
              onScrollTo={(percent) => console.log(`Scroll to: ${percent}`)}
            />
          </Show>
        </div>
      </Show>
    </div>
  );
}
