import { createSignal, Show, For, onMount, onCleanup } from "solid-js";
import { editorStore } from "@store/editorStore";
import { tauriFS } from "@lib/tauriFS";

// ── GoToLine Dialog ───────────────────────────────────────────────────────────
export function GoToLineDialog() {
  const [isOpen, setIsOpen] = createSignal(false);
  const [value, setValue] = createSignal("");
  let inputRef: HTMLInputElement | undefined;

  const open = () => {
    setIsOpen(true);
    setValue("");
    setTimeout(() => inputRef?.focus(), 50);
  };

  const close = () => setIsOpen(false);

  const commit = () => {
    const n = parseInt(value(), 10);
    if (!isNaN(n)) {
      window.dispatchEvent(
        new CustomEvent("hyperdrive:editor-command", {
          detail: { command: "goToLine", payload: n },
        })
      );
    }
    close();
  };

  onMount(() => {
    const h1 = () => open();
    const h2 = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("hyperdrive:open-goto-line", h1);
    window.addEventListener("keydown", h2);
    onCleanup(() => {
      window.removeEventListener("hyperdrive:open-goto-line", h1);
      window.removeEventListener("keydown", h2);
    });
  });

  return (
    <Show when={isOpen()}>
      <div
        style="position:fixed;inset:0;z-index:var(--z-modal);display:flex;justify-content:center;align-items:flex-start;padding-top:15vh;background:rgba(0,0,0,0.4);backdrop-filter:blur(2px);"
        onClick={close}
      >
        <div
          style="background:var(--bg-elevated);border:1px solid var(--border-strong);border-radius:var(--radius-md);width:360px;padding:16px;box-shadow:0 12px 40px rgba(0,0,0,0.6);"
          onClick={(e) => e.stopPropagation()}
        >
          <div style="font-size:var(--font-size-xs);color:var(--text-secondary);margin-bottom:10px;text-transform:uppercase;letter-spacing:0.5px;">
            Go to Line
          </div>
          <input
            ref={inputRef}
            type="number"
            min="1"
            placeholder="Enter line number…"
            value={value()}
            onInput={(e) => setValue(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") commit();
              if (e.key === "Escape") close();
            }}
            style="width:100%;background:var(--bg-input);border:1px solid var(--border-accent);border-radius:var(--radius-sm);color:var(--text-primary);font-size:var(--font-size-base);padding:8px 12px;outline:none;box-shadow:var(--glow-focus);"
          />
          <div style="display:flex;gap:8px;margin-top:12px;justify-content:flex-end;">
            <button
              onClick={close}
              style="padding:6px 14px;background:transparent;border:1px solid var(--border-default);border-radius:var(--radius-sm);color:var(--text-secondary);font-size:var(--font-size-sm);cursor:pointer;"
            >
              Cancel
            </button>
            <button
              onClick={commit}
              style="padding:6px 14px;background:var(--accent-primary);border:none;border-radius:var(--radius-sm);color:var(--bg-void);font-size:var(--font-size-sm);font-weight:600;cursor:pointer;"
            >
              Go
            </button>
          </div>
        </div>
      </div>
    </Show>
  );
}

// ── GoToFile (Quick Open) Dialog ─────────────────────────────────────────────
export function GoToFileDialog() {
  const [isOpen, setIsOpen] = createSignal(false);
  const [query, setQuery] = createSignal("");
  const [files, setFiles] = createSignal<string[]>([]);
  const [selectedIdx, setSelectedIdx] = createSignal(0);
  let inputRef: HTMLInputElement | undefined;

  const open = async () => {
    setIsOpen(true);
    setQuery("");
    setSelectedIdx(0);
    setTimeout(() => inputRef?.focus(), 50);

    // Load file list from workspace
    const ws = editorStore.get().workspacePath;
    if (!ws) return;
    try {
      const tree = await tauriFS.readDir(ws);
      const flat: string[] = [];
      const flatten = (items: any[], prefix = "") => {
        for (const item of items) {
          if (item.is_dir) flatten(item.children ?? [], prefix + item.name + "/");
          else flat.push(prefix + item.name + "|" + item.path);
        }
      };
      flatten(tree);
      setFiles(flat);
    } catch {
      setFiles([]);
    }
  };

  const close = () => setIsOpen(false);

  const filtered = () => {
    const q = query().toLowerCase();
    if (!q) return files().slice(0, 20);
    return files()
      .filter((f) => f.split("|")[0]?.toLowerCase().includes(q))
      .slice(0, 20);
  };

  const selectFile = (item: string) => {
    const [, path] = item.split("|");
    if (!path) return;
    const ext = path.split(".").pop() ?? "";
    const langMap: Record<string, string> = {
      ts: "typescript", tsx: "typescript", js: "javascript", jsx: "javascript",
      py: "python", html: "html", css: "css", json: "json", md: "markdown",
      rs: "rust", go: "go",
    };
    tauriFS.readFile(path).then((content) => {
      editorStore.openFile(path, content, langMap[ext] ?? "plaintext");
      close();
    }).catch(() => close());
  };

  onMount(() => {
    const h1 = () => open();
    window.addEventListener("hyperdrive:open-goto-file", h1);
    onCleanup(() => window.removeEventListener("hyperdrive:open-goto-file", h1));
  });

  return (
    <Show when={isOpen()}>
      <div
        style="position:fixed;inset:0;z-index:var(--z-modal);display:flex;justify-content:center;align-items:flex-start;padding-top:12vh;background:rgba(0,0,0,0.45);backdrop-filter:blur(2px);"
        onClick={close}
      >
        <div
          style="background:var(--bg-elevated);border:1px solid var(--border-strong);border-radius:var(--radius-lg);width:500px;max-height:380px;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 12px 40px rgba(0,0,0,0.65);"
          onClick={(e) => e.stopPropagation()}
        >
          <div style="padding:10px;border-bottom:1px solid var(--border-subtle);display:flex;align-items:center;gap:8px;">
            <span style="font-size:13px;color:var(--text-muted);">🔍</span>
            <input
              ref={inputRef}
              type="text"
              placeholder="Type filename to open…"
              value={query()}
              onInput={(e) => { setQuery(e.currentTarget.value); setSelectedIdx(0); }}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") { e.preventDefault(); setSelectedIdx(i => Math.min(filtered().length - 1, i + 1)); }
                if (e.key === "ArrowUp")   { e.preventDefault(); setSelectedIdx(i => Math.max(0, i - 1)); }
                if (e.key === "Enter") { const f = filtered()[selectedIdx()]; if (f) selectFile(f); }
                if (e.key === "Escape") close();
              }}
              style="flex:1;background:transparent;border:none;outline:none;color:var(--text-primary);font-size:var(--font-size-base);"
            />
          </div>
          <div style="flex:1;overflow-y:auto;padding:4px 0;">
            <For each={filtered()}>
              {(item, idx) => {
                const [name, path] = item.split("|");
                return (
                  <div
                    onClick={() => selectFile(item)}
                    onMouseEnter={() => setSelectedIdx(idx())}
                    style={{
                      padding: "8px 14px",
                      cursor: "pointer",
                      background: idx() === selectedIdx() ? "var(--bg-active)" : "transparent",
                      display: "flex",
                      "flex-direction": "column",
                      gap: "2px",
                    }}
                  >
                    <span style="font-size:var(--font-size-sm);color:var(--text-primary);">{name}</span>
                    <span style="font-size:10px;color:var(--text-muted);">{path}</span>
                  </div>
                );
              }}
            </For>
            <Show when={filtered().length === 0}>
              <div style="padding:20px;text-align:center;color:var(--text-muted);font-size:var(--font-size-sm);">
                No files found
              </div>
            </Show>
          </div>
        </div>
      </div>
    </Show>
  );
}
