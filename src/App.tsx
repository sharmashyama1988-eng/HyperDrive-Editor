import { Show, onMount } from "solid-js";
import WelcomeScreen from "./screens/WelcomeScreen";
import WorkspaceLayout from "./components/WorkspaceLayout";
import TitleBar from "./components/TitleBar/TitleBar";
import MenuBar from "./components/MenuBar/MenuBar";
import CommandPalette from "./components/CommandPalette/CommandPalette";
import { GoToLineDialog, GoToFileDialog } from "./components/MenuBar/QuickDialogs";
import { editorStore } from "./store/editorStore";
import { fileStore } from "./store/fileStore";
import NotificationOverlay from "./components/NotificationOverlay";

export default function App() {
  onMount(() => {
    // Sync credentials and recent projects on startup
    if ((window as any).pywebview?.api) {
      fileStore.sync();
    } else {
      const syncOnReady = () => {
        window.removeEventListener("pywebviewready", syncOnReady);
        fileStore.sync();
      };
      window.addEventListener("pywebviewready", syncOnReady);
      
      let checkCount = 0;
      const interval = setInterval(() => {
        checkCount++;
        if ((window as any).pywebview?.api) {
          clearInterval(interval);
          window.removeEventListener("pywebviewready", syncOnReady);
          fileStore.sync();
        } else if (checkCount > 100) {
          clearInterval(interval);
          window.removeEventListener("pywebviewready", syncOnReady);
        }
      }, 50);
    }
  });

  return (
    <div style="display:flex;flex-direction:column;height:100vh;overflow:hidden;">
      <TitleBar />
      <Show when={editorStore.workspacePath()}>
        <MenuBar />
      </Show>
      <Show when={editorStore.workspacePath()} fallback={<WelcomeScreen />}>
        <WorkspaceLayout />
      </Show>
      <CommandPalette />
      <GoToLineDialog />
      <GoToFileDialog />
      <NotificationOverlay />
    </div>
  );
}
