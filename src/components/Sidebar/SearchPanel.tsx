import { createSignal, For, Show } from "solid-js";
import { editorStore } from "@store/editorStore";
import { tauriFS } from "@lib/tauriFS";

interface SearchResult {
  path: string;
  name: string;
  line: number;
  content: string;
}

export default function SearchPanel() {
  const [query, setQuery] = createSignal("");
  const [results, setResults] = createSignal<SearchResult[]>([]);
  const [isSearching, setIsSearching] = createSignal(false);

  const handleSearch = async (e: Event) => {
    e.preventDefault();
    if (!query().trim()) return;
    setIsSearching(true);

    const py = (window as any).pywebview?.api;
    if (!py || !py.search_workspace) {
      console.warn("Python search API not ready.");
      setIsSearching(false);
      return;
    }

    const ws = editorStore.get().workspacePath;
    if (!ws) {
      console.warn("No workspace path active.");
      setIsSearching(false);
      return;
    }

    try {
      const res = await py.search_workspace(query().trim(), ws);
      setResults(res || []);
    } catch (err) {
      console.error("Search workspace error:", err);
    } finally {
      setIsSearching(false);
    }
  };

  const handleResultClick = async (res: SearchResult) => {
    try {
      const content = await tauriFS.readFile(res.path);
      const ext = res.path.split(".").pop()?.toLowerCase() ?? "";
      const langMap: Record<string, string> = {
        ts: "typescript", tsx: "typescript", js: "javascript", jsx: "javascript",
        py: "python", html: "html", css: "css", json: "json", md: "markdown",
        rs: "rust", go: "go", java: "java", cpp: "cpp", c: "c",
        txt: "plaintext", sh: "shell", yaml: "yaml", yml: "yaml",
        toml: "toml", xml: "xml", sql: "sql",
      };
      editorStore.openFile(res.path, content, langMap[ext] ?? "plaintext");
      
      // Delay slightly to let the editor pane render and initialize the editor view
      setTimeout(() => {
        editorStore.setCursor(res.line, 1);
        window.dispatchEvent(new CustomEvent("hyperdrive:editor-reveal-line", {
          detail: { line: res.line }
        }));
      }, 50);
    } catch (err) {
      console.error("Failed to open search result file:", err);
    }
  };

  return (
    <div style="padding: 12px; display: flex; flex-direction: column; gap: 12px; height: 100%;">
      <form onSubmit={handleSearch} class="flex-col gap-2">
        <input 
          type="text" 
          placeholder="Search text..." 
          value={query()} 
          onInput={(e) => setQuery(e.currentTarget.value)}
          style="width: 100%; background: var(--bg-input); border: 1px solid var(--border-default); border-radius: var(--radius-sm); color: var(--text-primary); padding: 6px; font-size: var(--font-size-sm);"
        />
        <button 
          type="submit" 
          style="background: var(--accent-primary); color: var(--bg-void); border-radius: var(--radius-sm); padding: 6px; font-size: var(--font-size-xs); font-weight: 600; cursor: pointer; width: 100%;"
        >
          {isSearching() ? "Searching..." : "Search"}
        </button>
      </form>

      <div style="flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 8px;">
        <span style="font-size: 11px; font-weight: 600; text-transform: uppercase; color: var(--text-muted); letter-spacing: 0.5px;">Results</span>
        
        <Show when={results().length > 0} fallback={
          <p style="color: var(--text-muted); font-size: var(--font-size-xs); font-style: italic;">No results found.</p>
        }>
          <For each={results()}>
            {(res) => (
              <div 
                onClick={() => handleResultClick(res)}
                style="display: flex; flex-direction: column; gap: 2px; padding: 6px; cursor: pointer; border-radius: var(--radius-sm);"
                onMouseEnter={(e) => e.currentTarget.style.background = "var(--bg-hover)"}
                onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
              >
                <div class="flex items-center justify-between">
                  <span style="font-size: var(--font-size-sm); color: var(--accent-primary); font-weight: 500;">{res.name}</span>
                  <span style="font-size: 10px; color: var(--text-muted); font-family: var(--font-mono);">Line {res.line}</span>
                </div>
                <span style="font-size: var(--font-size-xs); color: var(--text-secondary); font-family: var(--font-mono); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; padding: 2px 0;">
                  {res.content}
                </span>
                <span style="font-size: 9px; color: var(--text-muted);" class="truncate">{res.path}</span>
              </div>
            )}
          </For>
        </Show>
      </div>
    </div>
  );
}
