import { createSignal, onMount, For, Show, onCleanup, createEffect } from "solid-js";
import { editorStore } from "@store/editorStore";
import { tauriFS } from "@lib/tauriFS";
import { notificationStore } from "@store/notificationStore";

interface FileNode {
  name: string;
  path: string;
  isDir: boolean;
  isOpen?: boolean;
  children?: FileNode[];
  level: number;
}

export default function FileTree() {
  const store = () => editorStore.get();
  const [treeData, setTreeData] = createSignal<FileNode[]>([]);
  const [error, setError] = createSignal("");
  const [contextMenu, setContextMenu] = createSignal<{ x: number; y: number; node: FileNode } | null>(null);

  const scanDirectory = async (dirPath: string, level: number = 0): Promise<FileNode[]> => {
    const entries = await tauriFS.listFolder(dirPath);
    const nodes: FileNode[] = entries.map((entry: any) => ({
      name: entry.name,
      path: entry.path,
      isDir: entry.isDirectory,
      isOpen: false,
      level,
      children: entry.isDirectory ? [] : undefined
    }));
    
    // Sort: Directories first, then files alphabetically
    return nodes.sort((a, b) => {
      if (a.isDir && !b.isDir) return -1;
      if (!a.isDir && b.isDir) return 1;
      return a.name.localeCompare(b.name);
    });
  };

  const loadRoot = async () => {
    const rootPath = store().workspacePath;
    if (!rootPath) return;
    setError("");
    try {
      const data = await scanDirectory(rootPath, 0);
      if (data.length === 0) {
        setError("Empty workspace.");
      } else {
        setError("");
      }
      setTreeData(data);
    } catch (err: any) {
      console.error("Failed to load workspace:", err);
      setError(err.message || "Failed to load workspace or permission denied.");
      setTreeData([]);
    }
  };

  // Reactively reload directory tree when workspace path changes
  createEffect(() => {
    const rootPath = store().workspacePath;
    if (rootPath) {
      loadRoot();
    } else {
      setTreeData([]);
      setError("");
    }
  });

  onMount(() => {
    const closeMenu = () => setContextMenu(null);
    window.addEventListener("click", closeMenu);
    onCleanup(() => window.removeEventListener("click", closeMenu));
  });

  const toggleDirectory = async (node: FileNode, index: number, list: FileNode[]) => {
    if (!node.isDir) {
      // Open file in Editor
      try {
        const content = await tauriFS.getFileContent(node.path);
        const ext = node.name.split(".").pop() || "plaintext";
        editorStore.openFile(node.path, content, detectLanguage(ext));
      } catch (err: any) {
        notificationStore.showToast(`Could not open file: ${err.message || err}`, "error");
      }
      return;
    }

    // Toggle folder expansion
    node.isOpen = !node.isOpen;
    if (node.isOpen && node.children && node.children.length === 0) {
      try {
        node.children = await scanDirectory(node.path, node.level + 1);
      } catch (err) {
        console.error(err);
        node.children = [];
      }
    }

    // Trigger state refresh
    setTreeData([...treeData()]);
  };

  const getParentDir = (filePath: string): string => {
    const normalized = filePath.replace(/\\/g, "/");
    const parts = normalized.split("/");
    parts.pop();
    return parts.join("/");
  };

  const handleNewFile = async (node: FileNode | null) => {
    const root = store().workspacePath;
    if (!root) return;
    const targetDir = node ? (node.isDir ? node.path : getParentDir(node.path)) : root;
    
    const name = await notificationStore.prompt("Enter new file name:");
    if (!name || name.trim() === "") return;
    
    const newPath = `${targetDir}/${name.trim()}`.replace(/\\/g, "/");
    try {
      await tauriFS.saveFile(newPath, "");
      await loadRoot();
      const ext = name.split(".").pop() || "plaintext";
      editorStore.openFile(newPath, "", detectLanguage(ext));
    } catch (err: any) {
      notificationStore.showToast(`Error creating file: ${err.message || err}`, "error");
    }
  };

  const handleNewFolder = async (node: FileNode | null) => {
    const root = store().workspacePath;
    if (!root) return;
    const targetDir = node ? (node.isDir ? node.path : getParentDir(node.path)) : root;
    
    const name = await notificationStore.prompt("Enter new folder name:");
    if (!name || name.trim() === "") return;
    
    const newPath = `${targetDir}/${name.trim()}`.replace(/\\/g, "/");
    try {
      await tauriFS.createFolder(newPath);
      await loadRoot();
    } catch (err: any) {
      notificationStore.showToast(`Error creating folder: ${err.message || err}`, "error");
    }
  };

  const handleRename = async (node: FileNode) => {
    const parentDir = getParentDir(node.path);
    const oldName = node.name;
    const name = await notificationStore.prompt("Enter new name:", oldName);
    if (!name || name.trim() === "" || name.trim() === oldName) return;
    
    const newPath = `${parentDir}/${name.trim()}`.replace(/\\/g, "/");
    try {
      await tauriFS.renameItem(node.path, newPath);
      await loadRoot();
    } catch (err: any) {
      notificationStore.showToast(`Error renaming: ${err.message || err}`, "error");
    }
  };

  const handleDelete = async (node: FileNode) => {
    const confirmed = await notificationStore.confirm(`Are you sure you want to delete ${node.name}?`);
    if (!confirmed) return;
    
    try {
      await tauriFS.deleteItem(node.path);
      await loadRoot();
    } catch (err: any) {
      notificationStore.showToast(`Error deleting: ${err.message || err}`, "error");
    }
  };

  const handleRevealInExplorer = async (node: FileNode) => {
    try {
      await tauriFS.revealInExplorer(node.path);
    } catch (err: any) {
      notificationStore.showToast(`Could not reveal in explorer: ${err.message || err}`, "error");
    }
  };

  const handleCopyPath = (path: string) => {
    navigator.clipboard.writeText(path);
  };

  const handleCopyRelativePath = (path: string) => {
    const root = store().workspacePath;
    let relPath = path;
    if (root) {
      const normalizedRoot = root.replace(/\\/g, "/");
      const normalizedPath = path.replace(/\\/g, "/");
      if (normalizedPath.startsWith(normalizedRoot)) {
        relPath = normalizedPath.substring(normalizedRoot.length);
        if (relPath.startsWith("/")) {
          relPath = relPath.substring(1);
        }
      }
    }
    navigator.clipboard.writeText(relPath);
  };

  const detectLanguage = (ext: string): string => {
    switch (ext) {
      case "html": return "html";
      case "css": return "css";
      case "js": return "javascript";
      case "ts": return "typescript";
      case "tsx": return "typescript";
      case "py": return "python";
      case "java": return "java";
      case "json": return "json";
      case "rs": return "rust";
      case "cpp": return "cpp";
      case "h": return "cpp";
      case "md": return "markdown";
      default: return "plaintext";
    }
  };

  // Render node tree recursively
  const TreeNode = (props: { node: FileNode }) => {
    const icon = () => {
      if (props.node.isDir) return props.node.isOpen ? "📂" : "📁";
      const ext = props.node.name.split(".").pop();
      switch (ext) {
        case "html": return "🌐";
        case "css": return "🎨";
        case "js":
        case "ts":
        case "tsx": return "⚛️";
        case "py": return "🐍";
        case "java": return "☕";
        case "json": return "⚙️";
        case "md": return "📝";
        default: return "📄";
      }
    };

    return (
      <div class="flex-col">
        <div
          onClick={() => toggleDirectory(props.node, 0, [])}
          onContextMenu={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setContextMenu({ x: e.clientX, y: e.clientY, node: props.node });
          }}
          style={{
            display: "flex",
            "align-items": "center",
            gap: "6px",
            padding: "4px 8px",
            "padding-left": `${props.node.level * 12 + 8}px`,
            cursor: "pointer",
            "font-size": "var(--font-size-sm)",
            transition: "background var(--transition-fast)",
            "border-radius": "var(--radius-sm)",
            "user-select": "none"
          }}
          class="file-tree-item"
          onMouseEnter={(e) => e.currentTarget.style.background = "var(--bg-hover)"}
          onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
        >
          <span style="font-size: 14px;">{icon()}</span>
          <span style="color: var(--text-primary); text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">
            {props.node.name}
          </span>
        </div>

        <Show when={props.node.isDir && props.node.isOpen && props.node.children}>
          <For each={props.node.children}>
            {(child) => <TreeNode node={child} />}
          </For>
        </Show>
      </div>
    );
  };

  const ctxBtnStyle: any = {
    padding: "8px 14px",
    textAlign: "left",
    background: "transparent",
    color: "var(--text-primary)",
    border: "none",
    cursor: "pointer",
    fontSize: "var(--font-size-xs)"
  };

  return (
    <div style="display: flex; flex-direction: column; width: 100%; height: 100%; overflow: hidden;">
      {/* Explorer Toolbar */}
      <div 
        style={{
          display: "flex",
          "align-items": "center",
          "justify-content": "space-between",
          padding: "4px 14px 8px 14px",
          "border-bottom": "1px solid var(--border-subtle)",
          background: "var(--bg-panel)",
          "flex-shrink": 0
        }}
      >
        <span style="font-size: var(--font-size-xs); color: var(--text-muted); font-weight: 500;">Workspace files</span>
        <div style="display: flex; gap: 8px;">
          <button 
            onClick={() => handleNewFile(null)} 
            title="New File"
            style="background: transparent; border: none; color: var(--text-secondary); cursor: pointer; font-size: 14px; padding: 2px; transition: color var(--transition-fast);"
            onMouseEnter={(e) => e.currentTarget.style.color = "var(--accent-primary)"}
            onMouseLeave={(e) => e.currentTarget.style.color = "var(--text-secondary)"}
          >
            📄
          </button>
          <button 
            onClick={() => handleNewFolder(null)} 
            title="New Folder"
            style="background: transparent; border: none; color: var(--text-secondary); cursor: pointer; font-size: 14px; padding: 2px; transition: color var(--transition-fast);"
            onMouseEnter={(e) => e.currentTarget.style.color = "var(--accent-primary)"}
            onMouseLeave={(e) => e.currentTarget.style.color = "var(--text-secondary)"}
          >
            📁
          </button>
          <button 
            onClick={loadRoot} 
            title="Refresh"
            style="background: transparent; border: none; color: var(--text-secondary); cursor: pointer; font-size: 14px; padding: 2px; transition: color var(--transition-fast);"
            onMouseEnter={(e) => e.currentTarget.style.color = "var(--accent-primary)"}
            onMouseLeave={(e) => e.currentTarget.style.color = "var(--text-secondary)"}
          >
            🔄
          </button>
        </div>
      </div>

      <div style="flex: 1; overflow-y: auto; padding: 6px 0; overflow-x: hidden; display: flex; flex-direction: column; width: 100%;">
        <Show when={error()}>
          <div style="color: var(--accent-red); font-size: var(--font-size-xs); padding: 8px 14px;">
            {error()}
          </div>
        </Show>
        <For each={treeData()}>
          {(node) => <TreeNode node={node} />}
        </For>
      </div>

      {/* Right-click Context Menu */}
      <Show when={contextMenu()}>
        {(menu) => (
          <div
            style={{
              position: "fixed",
              top: `${menu().y}px`,
              left: `${menu().x}px`,
              background: "var(--bg-panel)",
              border: "1px solid var(--border-strong)",
              "border-radius": "var(--radius-sm)",
              "box-shadow": "0 10px 30px rgba(0,0,0,0.5)",
              "z-index": 1000,
              padding: "4px 0",
              display: "flex",
              "flex-direction": "column",
              "min-width": "160px"
            }}
          >
            <button
              onClick={() => handleNewFile(menu().node)}
              style={ctxBtnStyle}
              onMouseEnter={(e) => e.currentTarget.style.background = "var(--bg-hover)"}
              onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
            >
              New File...
            </button>
            <button
              onClick={() => handleNewFolder(menu().node)}
              style={ctxBtnStyle}
              onMouseEnter={(e) => e.currentTarget.style.background = "var(--bg-hover)"}
              onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
            >
              New Folder...
            </button>
            <div style="height: 1px; background: var(--border-subtle); margin: 4px 0;"></div>
            <button
              onClick={() => handleRename(menu().node)}
              style={ctxBtnStyle}
              onMouseEnter={(e) => e.currentTarget.style.background = "var(--bg-hover)"}
              onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
            >
              Rename...
            </button>
            <button
              onClick={() => handleDelete(menu().node)}
              style={{ ...ctxBtnStyle, color: "var(--accent-red)" }}
              onMouseEnter={(e) => e.currentTarget.style.background = "var(--bg-hover)"}
              onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
            >
              Delete
            </button>
            <div style="height: 1px; background: var(--border-subtle); margin: 4px 0;"></div>
            <button
              onClick={() => handleCopyPath(menu().node.path)}
              style={ctxBtnStyle}
              onMouseEnter={(e) => e.currentTarget.style.background = "var(--bg-hover)"}
              onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
            >
              Copy Path
            </button>
            <button
              onClick={() => handleCopyRelativePath(menu().node.path)}
              style={ctxBtnStyle}
              onMouseEnter={(e) => e.currentTarget.style.background = "var(--bg-hover)"}
              onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
            >
              Copy Relative Path
            </button>
            <button
              onClick={() => handleRevealInExplorer(menu().node)}
              style={ctxBtnStyle}
              onMouseEnter={(e) => e.currentTarget.style.background = "var(--bg-hover)"}
              onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
            >
              Reveal in File Explorer
            </button>
          </div>
        )}
      </Show>
    </div>
  );
}
