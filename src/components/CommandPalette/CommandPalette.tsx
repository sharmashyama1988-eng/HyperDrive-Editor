import { createSignal, onMount, onCleanup, For, Show } from "solid-js";
import { editorStore } from "@store/editorStore";
import { settingsStore } from "@store/settingsStore";
import { extensionsStore } from "@store/extensionsStore";

export default function CommandPalette() {
  const [isOpen, setIsOpen] = createSignal(false);
  const [query, setQuery] = createSignal("");
  const [selectedIndex, setSelectedIndex] = createSignal(0);

  // Default commands listing
  const commands = [
    { id: "zen", name: "Toggle Zen Mode", action: () => settingsStore.toggleZenMode() },
    { id: "sidebar", name: "Toggle Sidebar Panel", action: () => editorStore.toggleSidebar() },
    { id: "bottom", name: "Toggle Bottom Console Drawer", action: () => editorStore.toggleBottomPanel() },
    { id: "theme-vscode", name: "Switch Theme: VS Code Dark", action: () => settingsStore.update("workbench.colorTheme", "vscode-dark") },
    { id: "theme-github", name: "Switch Theme: GitHub Dark", action: () => settingsStore.update("workbench.colorTheme", "github-dark") },
    { id: "theme-terminal", name: "Switch Theme: Black Terminal", action: () => settingsStore.update("workbench.colorTheme", "black-terminal") },
    { id: "theme-neon", name: "Switch Theme: Neon Blue", action: () => settingsStore.update("workbench.colorTheme", "neon-blue") },
    { id: "theme-light", name: "Switch Theme: White Light", action: () => settingsStore.update("workbench.colorTheme", "white-light") },
    { id: "ext-vim", name: "Toggle Extension: Vim Keybindings", action: () => extensionsStore.toggleExtension("vim") },
    { id: "ext-prettier", name: "Toggle Extension: Prettier Formatter", action: () => extensionsStore.toggleExtension("prettier") }
  ];

  const filteredCommands = () => {
    const q = query().toLowerCase().trim();
    if (!q) return commands;
    return commands.filter(c => c.name.toLowerCase().includes(q));
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    // Ctrl+P / Command+P to toggle
    if ((e.ctrlKey || e.metaKey) && e.key === "p") {
      e.preventDefault();
      setIsOpen(!isOpen());
      setQuery("");
      setSelectedIndex(0);
      return;
    }

    if (!isOpen()) return;

    if (e.key === "Escape") {
      setIsOpen(false);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(filteredCommands().length - 1, prev + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(0, prev - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const cmd = filteredCommands()[selectedIndex()];
      if (cmd) {
        cmd.action();
        setIsOpen(false);
      }
    }
  };

  onMount(() => {
    window.addEventListener("keydown", handleKeyDown);

    // Also listen to programmatic open from MenuBar
    const handleOpen = () => {
      setIsOpen(true);
      setQuery("");
      setSelectedIndex(0);
    };
    window.addEventListener("hyperdrive:open-command-palette", handleOpen);

    onCleanup(() => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("hyperdrive:open-command-palette", handleOpen);
    });
  });

  return (
    <Show when={isOpen()}>
      <div 
        style="position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: var(--z-overlay); display: flex; justify-content: center; align-items: flex-start; padding-top: 10vh; backdrop-filter: blur(2px);"
        onClick={() => setIsOpen(false)}
      >
        <div 
          style="background: var(--bg-panel); border: 1px solid var(--border-strong); border-radius: var(--radius-lg); width: 500px; max-height: 330px; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 10px 40px rgba(0,0,0,0.5);"
          onClick={(e) => e.stopPropagation()}
        >
          <div style="padding: 10px; border-bottom: 1px solid var(--border-subtle); display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 14px; color: var(--text-muted);">❯</span>
            <input
              type="text"
              placeholder="Type a command or setting to execute..."
              value={query()}
              onInput={(e) => { setQuery(e.currentTarget.value); setSelectedIndex(0); }}
              style="flex: 1; background: transparent; border: none; outline: none; color: var(--text-primary); font-size: var(--font-size-base); padding: 0; box-shadow: none;"
              ref={(el) => setTimeout(() => el?.focus(), 50)}
            />
          </div>

          <div style="flex: 1; overflow-y: auto; padding: 6px 0;">
            <For each={filteredCommands()}>
              {(cmd, index) => (
                <div
                  onClick={() => { cmd.action(); setIsOpen(false); }}
                  style={{
                    padding: "8px 14px",
                    cursor: "pointer",
                    background: index() === selectedIndex() ? "var(--bg-active)" : "transparent",
                    color: index() === selectedIndex() ? "var(--accent-primary)" : "var(--text-primary)",
                    "font-size": "var(--font-size-sm)",
                    display: "flex",
                    "justify-content": "space-between",
                    "align-items": "center"
                  }}
                  onMouseEnter={() => setSelectedIndex(index())}
                >
                  <span>{cmd.name}</span>
                  <Show when={index() === selectedIndex()}>
                    <span style="font-size: 10px; color: var(--text-muted); font-family: var(--font-mono);">Enter</span>
                  </Show>
                </div>
              )}
            </For>
          </div>
          
          <div style="padding: 6px 12px; border-top: 1px solid var(--border-subtle); background: var(--bg-void); display: flex; justify-content: space-between; font-size: 10px; color: var(--text-muted);">
            <span>Use ↑↓ keys to navigate, Esc to close</span>
            <span>Press <kbd style="background:var(--bg-active); padding: 1px 4px; border-radius:2px; font-family:var(--font-mono);">Ctrl+P</kbd> anywhere</span>
          </div>
        </div>
      </div>
    </Show>
  );
}
