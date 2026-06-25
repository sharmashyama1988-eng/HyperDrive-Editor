import { createSignal, For, Show, onMount } from "solid-js";
import { editorStore } from "@store/editorStore";
import { notificationStore } from "@store/notificationStore";

interface GitFile {
  path: string;
  name: string;
  status: "added" | "modified" | "deleted";
}

export default function GitPanel() {
  const store = () => editorStore.get();
  const [isRepo, setIsRepo] = createSignal(true);
  const [gitStatus, setGitStatus] = createSignal<{ branch: string; files: GitFile[] } | null>(null);
  const [commitMsg, setCommitMsg] = createSignal("");
  const [username, setUsername] = createSignal(localStorage.getItem("hyperdrive_github_username") || "");
  const [token, setToken] = createSignal(localStorage.getItem("hyperdrive_github_token") || "");
  const [showCreds, setShowCreds] = createSignal(false);
  const [isSyncing, setIsSyncing] = createSignal(false);
  const [statusMsg, setStatusMsg] = createSignal("");

  const refreshStatus = async () => {
    const ws = store().workspacePath;
    if (!ws) return;

    const py = (window as any).pywebview?.api;
    if (py && py.git_status) {
      setStatusMsg("Checking git status...");
      try {
        const res = await py.git_status(ws);
        if (res.error) {
          console.error("Git status error:", res.error);
          setIsRepo(false);
        } else if (res.is_repo === false) {
          setIsRepo(false);
        } else {
          setIsRepo(true);
          setGitStatus({
            branch: res.branch || "main",
            files: res.files || []
          });
        }
      } catch (err) {
        console.error(err);
        setIsRepo(false);
      } finally {
        setStatusMsg("");
      }
    }
  };

  onMount(() => {
    refreshStatus();
  });

  const handleInitRepository = async () => {
    const ws = store().workspacePath;
    if (!ws) return;

    const py = (window as any).pywebview?.api;
    if (py && py.git_init) {
      try {
        setStatusMsg("Initializing git repository...");
        const res = await py.git_init(ws);
        if (res.error) {
          notificationStore.showToast(`Failed to initialize git repository: ${res.error}`, "error");
        } else {
          notificationStore.showToast("Successfully initialized git repository!", "success");
          refreshStatus();
        }
      } catch (err: any) {
        notificationStore.showToast(`Error: ${err.message || err}`, "error");
      } finally {
        setStatusMsg("");
      }
    }
  };

  const handleCommit = async (e: Event) => {
    e.preventDefault();
    if (!commitMsg().trim()) return;

    const ws = store().workspacePath;
    if (!ws) return;

    const py = (window as any).pywebview?.api;
    if (py && py.git_commit) {
      try {
        setStatusMsg("Committing changes...");
        const res = await py.git_commit(ws, commitMsg().trim());
        if (res.error) {
          notificationStore.showToast(`Failed to commit: ${res.error}`, "error");
        } else {
          notificationStore.showToast("Changes committed successfully!", "success");
          setCommitMsg("");
          refreshStatus();
        }
      } catch (err: any) {
        notificationStore.showToast(`Error: ${err.message || err}`, "error");
      } finally {
        setStatusMsg("");
      }
    }
  };

  const handleSync = async () => {
    const ws = store().workspacePath;
    if (!ws) return;

    // Save credentials locally
    localStorage.setItem("hyperdrive_github_username", username().trim());
    localStorage.setItem("hyperdrive_github_token", token().trim());

    const py = (window as any).pywebview?.api;
    if (py) {
      if (py.save_credentials) {
        try {
          await py.save_credentials(username().trim(), token().trim(), null);
        } catch (err) {
          console.error("Failed to save git credentials to backend:", err);
        }
      }
      if (py.git_sync) {
        setIsSyncing(true);
        setStatusMsg("Syncing (pulling and pushing) with GitHub remote origin...");
        try {
          const res = await py.git_sync(ws, username().trim(), token().trim());
          if (res.error) {
            notificationStore.showToast(`Sync failed: ${res.error}`, "error");
          } else {
            notificationStore.showToast("Successfully synced with GitHub!", "success");
            refreshStatus();
          }
        } catch (err: any) {
          notificationStore.showToast(`Sync Error: ${err.message || err}`, "error");
        } finally {
          setIsSyncing(false);
          setStatusMsg("");
        }
      }
    }
  };

  const handleClearKey = async () => {
    setUsername("");
    setToken("");
    localStorage.removeItem("hyperdrive_github_username");
    localStorage.removeItem("hyperdrive_github_token");
    notificationStore.showToast("GitHub credentials cleared!", "info");

    const py = (window as any).pywebview?.api;
    if (py && py.save_credentials) {
      try {
        await py.save_credentials("", "", null);
      } catch (err) {
        console.error("Failed to clear git credentials on backend:", err);
      }
    }
  };

  return (
    <div style="padding: 12px; display: flex; flex-direction: column; gap: 12px; height: 100%; overflow-y: auto;">
      {/* ── Status Message Banner ────────────────────────────── */}
      <Show when={statusMsg()}>
        <div style="background: rgba(0,212,170,0.1); border: 1px solid rgba(0,212,170,0.25); color: var(--accent-primary); font-size: 10px; font-family: var(--font-mono); padding: 6px 10px; border-radius: var(--radius-sm);">
          <span>⏳ {statusMsg()}</span>
        </div>
      </Show>

      <Show when={isRepo()} fallback={
        <div class="flex-col gap-2 items-center text-center" style="margin-top: 40px; padding: 0 10px;">
          <span style="font-size: 32px;">🌿</span>
          <span style="font-weight: 500; font-size: var(--font-size-sm); color: var(--text-primary);">No Git Repository Detected</span>
          <p style="font-size: 11px; color: var(--text-muted); line-height: 1.4; margin-bottom: 8px;">
            Initialize a local Git repository to track your changes.
          </p>
          <button 
            onClick={handleInitRepository} 
            style="background: var(--accent-primary); color: var(--bg-void); border-radius: var(--radius-sm); border: none; padding: 8px 14px; font-size: var(--font-size-xs); font-weight: 600; cursor: pointer; width: 100%;"
          >
            Initialize Repository
          </button>
        </div>
      }>
        {/* Active Repository view */}
        <div class="flex items-center justify-between" style="border-bottom: 1px solid var(--border-subtle); padding-bottom: 6px; flex-shrink: 0;">
          <span style="font-size: var(--font-size-xs); color: var(--text-secondary);">Branch: <strong style="color: var(--accent-primary);">{gitStatus()?.branch}</strong></span>
          <button onClick={refreshStatus} style="font-size: 11px; color: var(--text-muted); cursor: pointer; background: transparent; border: none;">Refresh</button>
        </div>

        {/* Commit Message Box */}
        <form onSubmit={handleCommit} class="flex-col gap-2" style="flex-shrink: 0;">
          <input 
            type="text" 
            placeholder="Commit message (Enter to commit)" 
            value={commitMsg()} 
            onInput={(e) => setCommitMsg(e.currentTarget.value)}
            required
            style="width: 100%; background: var(--bg-input); border: 1px solid var(--border-default); border-radius: var(--radius-sm); color: var(--text-primary); padding: 8px; font-size: var(--font-size-xs);"
          />
        </form>

        {/* GitHub Credentials Collapsible panel */}
        <div style="border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); padding: 8px; display: flex; flex-direction: column; gap: 8px; flex-shrink: 0;">
          <div 
            onClick={() => setShowCreds(!showCreds())}
            style="display: flex; align-items: center; justify-content: space-between; cursor: pointer; font-size: var(--font-size-xs); font-weight: 600; color: var(--text-secondary);"
          >
            <span>🔑 GitHub Sync Setup</span>
            <span>{showCreds() ? "▲" : "▼"}</span>
          </div>

          <Show when={showCreds()}>
            <div style="display: flex; flex-direction: column; gap: 8px; margin-top: 4px;">
              <div class="flex flex-col gap-1">
                <label style="font-size: 9px; color: var(--text-muted); font-weight: 500;">Username</label>
                <input 
                  type="text" 
                  placeholder="github-username" 
                  value={username()}
                  onInput={(e) => setUsername(e.currentTarget.value)}
                  style="width: 100%; background: var(--bg-input); border: 1px solid var(--border-default); border-radius: var(--radius-sm); color: var(--text-primary); padding: 6px; font-size: 11px;"
                />
              </div>
              <div class="flex flex-col gap-1">
                <label style="font-size: 9px; color: var(--text-muted); font-weight: 500;">Personal Access Token (PAT)</label>
                <input 
                  type="password" 
                  placeholder="ghp_..." 
                  value={token()}
                  onInput={(e) => setToken(e.currentTarget.value)}
                  style="width: 100%; background: var(--bg-input); border: 1px solid var(--border-default); border-radius: var(--radius-sm); color: var(--text-primary); padding: 6px; font-size: 11px;"
                />
              </div>
              <button 
                onClick={handleSync}
                disabled={isSyncing()}
                style="background: linear-gradient(135deg, var(--accent-primary), var(--accent-secondary)); color: var(--bg-void); border: none; border-radius: var(--radius-sm); padding: 6px 12px; font-size: var(--font-size-xs); font-weight: 600; cursor: pointer; margin-top: 4px;"
              >
                {isSyncing() ? "Syncing..." : "Sync with GitHub"}
              </button>
              <Show when={username() && token()}>
                <button 
                  onClick={handleClearKey}
                  style="background: transparent; border: 1px solid var(--border-default); color: var(--accent-red); border-radius: var(--radius-sm); padding: 4px; font-size: 9px; cursor: pointer;"
                >
                  Clear GitHub Credentials
                </button>
              </Show>
            </div>
          </Show>
          <Show when={!showCreds()}>
            <button 
              onClick={handleSync}
              disabled={isSyncing()}
              style="background: linear-gradient(135deg, var(--accent-primary), var(--accent-secondary)); color: var(--bg-void); border: none; border-radius: var(--radius-sm); padding: 6px 12px; font-size: var(--font-size-xs); font-weight: 600; cursor: pointer;"
            >
              {isSyncing() ? "Syncing..." : "Quick Sync / Pull & Push"}
            </button>
          </Show>
        </div>

        {/* Changed Files List */}
        <div style="flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 8px; min-height: 150px;">
          <span style="font-size: 11px; font-weight: 600; text-transform: uppercase; color: var(--text-muted); letter-spacing: 0.5px; border-bottom: 1px solid var(--border-subtle); padding-bottom: 4px;">Changes ({gitStatus()?.files.length || 0})</span>
          
          <Show when={gitStatus()?.files && gitStatus()!.files.length > 0} fallback={
            <div style="padding: 10px; font-style: italic; color: var(--text-muted); font-size: var(--font-size-xs);">
              No changes detected.
            </div>
          }>
            <For each={gitStatus()?.files}>
              {(file) => {
                const statusColor = () => {
                  if (file.status === "added") return "var(--accent-green)";
                  if (file.status === "modified") return "var(--accent-amber)";
                  return "var(--accent-red)";
                };
                
                const statusLetter = () => file.status[0]?.toUpperCase() ?? "M";

                return (
                  <div 
                    style="display: flex; align-items: center; justify-content: space-between; padding: 6px 8px; cursor: pointer; border-radius: var(--radius-sm); transition: background var(--transition-fast);"
                    onMouseEnter={(e) => e.currentTarget.style.background = "var(--bg-hover)"}
                    onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                  >
                    <div class="flex-col" style="max-width: 80%; pointer-events: none;">
                      <span style="font-size: var(--font-size-xs); font-weight: 500; color: var(--text-primary);">{file.name}</span>
                      <span style="font-size: 9px; color: var(--text-muted); font-family: var(--font-mono);" class="truncate">{file.path}</span>
                    </div>
                    <span style={{ color: statusColor(), "font-weight": "700", "font-size": "11px", width: "16px", "text-align": "center" }}>
                      {statusLetter()}
                    </span>
                  </div>
                );
              }}
            </For>
          </Show>
        </div>
      </Show>
    </div>
  );
}
