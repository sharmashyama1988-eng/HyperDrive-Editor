import { createSignal, For, Show, onCleanup } from "solid-js";
import { tauriFS } from "@lib/tauriFS";
import { tauriDialog } from "@lib/tauriDialog";
import { editorStore } from "@store/editorStore";
import { fileStore } from "@store/fileStore";
import { projectTemplates, ProjectTemplate } from "@lib/projectTemplates";
import "@styles/welcome.css";

export default function WelcomeScreen() {
  const [isCreatingProject, setIsCreatingProject] = createSignal(false);
  const [selectedTemplate, setSelectedTemplate] = createSignal<ProjectTemplate | null>(null);
  const [newProjectName, setNewProjectName] = createSignal("");
  const [newProjectPath, setNewProjectPath] = createSignal("C:/HyperDrive");
  const [creationError, setCreationError] = createSignal("");

  const handleOpenFolder = async () => {
    try {
      const selected = await tauriDialog.selectFolder("Open Project Folder");
      if (selected) {
        editorStore.openWorkspace(selected);
        fileStore.addRecent(selected);
      }
    } catch (err) {
      console.error("Failed to open folder:", err);
    }
  };

  const selectFolderForNewProject = async () => {
    try {
      const selected = await tauriDialog.selectFolder("Select Parent Folder for Project");
      if (selected) {
        setNewProjectPath(selected);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateProject = async (e: Event) => {
    e.preventDefault();
    setCreationError("");
    const template = selectedTemplate();
    const name = newProjectName().trim();
    const path = newProjectPath();

    if (!template || !name || !path) {
      setCreationError("Please fill out all fields.");
      return;
    }

    const fullPath = `${path}/${name}`.replace(/\\/g, "/");

    try {
      // Create root folder
      await tauriFS.createFolder(fullPath);

      // Write template files
      for (const file of template.files) {
        const filePath = `${fullPath}/${file.name}`;
        
        // Ensure subdirectories exist
        const dirParts = file.name.split("/");
        if (dirParts.length > 1) {
          dirParts.pop(); // Remove file name
          const subDir = `${fullPath}/${dirParts.join("/")}`;
          await tauriFS.createFolder(subDir);
        }

        await tauriFS.saveFile(filePath, file.content);
      }

      // Add to workspace and close dialog
      editorStore.openWorkspace(fullPath);
      fileStore.addRecent(fullPath);
      
      // Auto open first file in template
      const firstFile = template.files[0];
      if (firstFile) {
        editorStore.openFile(`${fullPath}/${firstFile.name}`, firstFile.content, detectLanguage(firstFile.name));
      }

      setIsCreatingProject(false);
      setSelectedTemplate(null);
    } catch (err: any) {
      setCreationError(`Failed to create project: ${err.message || err}`);
    }
  };

  const detectLanguage = (fileName: string): string => {
    const ext = fileName.split(".").pop();
    switch (ext) {
      case "html": return "html";
      case "css": return "css";
      case "js": return "javascript";
      case "ts": return "typescript";
      case "tsx": return "typescript";
      case "py": return "python";
      case "java": return "java";
      case "json": return "json";
      default: return "plaintext";
    }
  };

  const [recentPanelWidth, setRecentPanelWidth] = createSignal(350); // Default width
  let isDraggingRecent = false;

  const startResizeRecent = (e: MouseEvent) => {
    e.preventDefault();
    isDraggingRecent = true;
    document.addEventListener("mousemove", resizeRecent);
    document.addEventListener("mouseup", stopResizeRecent);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  };

  const resizeRecent = (e: MouseEvent) => {
    if (!isDraggingRecent) return;
    const newWidth = Math.max(200, Math.min(window.innerWidth - e.clientX, 600));
    setRecentPanelWidth(newWidth);
  };

  const stopResizeRecent = () => {
    isDraggingRecent = false;
    document.removeEventListener("mousemove", resizeRecent);
    document.removeEventListener("mouseup", stopResizeRecent);
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  };

  onCleanup(() => {
    document.removeEventListener("mousemove", resizeRecent);
    document.removeEventListener("mouseup", stopResizeRecent);
  });

  const openRecent = (path: string) => {
    const normalizedPath = path.replace(/\\/g, "/");
    const cleanPath = normalizedPath.endsWith("/") && normalizedPath.length > 3 ? normalizedPath.slice(0, -1) : normalizedPath;
    editorStore.openWorkspace(cleanPath);
    fileStore.addRecent(cleanPath);
  };

  return (
    <div 
      class="welcome-screen"
      style={{
        display: "grid",
        "grid-template-columns": `1fr ${recentPanelWidth()}px`,
        position: "relative"
      }}
    >
      <div class="welcome-left">
        <div class="welcome-brand">
          <span class="welcome-logo">⚡</span>
          <h1 class="welcome-title">HyperDrive</h1>
        </div>
        <p class="welcome-subtitle">
          An ultra-optimized, high-performance editor designed for Web Developers, Python Coder, Java Engineers, and Creative UI Designers.
        </p>

        <div class="welcome-grid">
          <div class="welcome-card" onClick={handleOpenFolder}>
            <span class="welcome-card-icon">📂</span>
            <div class="welcome-card-title">Open Folder</div>
            <p class="welcome-card-desc">Open an existing workspace folder from your local disk.</p>
          </div>
          <div class="welcome-card" onClick={() => setIsCreatingProject(true)}>
            <span class="welcome-card-icon">✨</span>
            <div class="welcome-card-title">New Project</div>
            <p class="welcome-card-desc">Start coding instantly from pre-designed target templates.</p>
          </div>
        </div>

        <div class="section-title">
          <span>Start from Template</span>
        </div>
        <div class="welcome-grid" style="grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 12px;">
          <For each={projectTemplates}>
            {(template) => (
              <div class="template-item" onClick={() => { setSelectedTemplate(template); setIsCreatingProject(true); }}>
                <span class="template-icon">{template.icon}</span>
                <div class="template-details">
                  <span class="template-name">{template.name}</span>
                  <span class="template-desc truncate" style="max-width: 170px;">{template.description}</span>
                </div>
              </div>
            )}
          </For>
        </div>
      </div>

      <div class="welcome-right" style={{ width: `${recentPanelWidth()}px` }}>
        <div>
          <div class="section-title">
            <span>Recent Projects</span>
            <Show when={fileStore.recentProjects().length > 0}>
              <span class="clear-recent-btn" onClick={() => fileStore.clearRecent()}>Clear All</span>
            </Show>
          </div>

          <Show when={fileStore.recentProjects().length === 0} fallback={
            <div class="recent-list">
              <For each={fileStore.recentProjects()}>
                {(project) => (
                  <div class="recent-item" onClick={() => openRecent(project.path)}>
                    <div class="recent-meta">
                      <span class="recent-name">{project.name}</span>
                      <span class="recent-path truncate">{project.path}</span>
                    </div>
                    <span class="recent-date">{fileStore.timeAgo(project.lastOpened)}</span>
                  </div>
                )}
              </For>
            </div>
          }>
            <p style="color: var(--text-muted); font-size: var(--font-size-sm); font-style: italic;">
              No recent workspaces opened.
            </p>
          </Show>
        </div>
      </div>

      {/* Resize Divider Line */}
      <div
        onMouseDown={startResizeRecent}
        style={{
          position: "absolute",
          top: 0,
          right: `${recentPanelWidth() - 3}px`,
          width: "6px",
          height: "100%",
          cursor: "col-resize",
          "z-index": 100,
          background: "transparent",
          transition: "background var(--transition-fast)"
        }}
        class="welcome-resizer"
        onMouseEnter={(e) => e.currentTarget.style.background = "var(--accent-primary)"}
        onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
      />

      {/* New Project Modal Dialog */}
      <Show when={isCreatingProject()}>
        <div style="position: fixed; inset: 0; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; z-index: var(--z-modal); backdrop-filter: blur(4px);">
          <div style="background: var(--bg-panel); border: 1px solid var(--border-strong); border-radius: var(--radius-lg); width: 450px; padding: 24px; display: flex; flex-direction: column; gap: 16px; box-shadow: 0 20px 50px rgba(0,0,0,0.5);">
            <div class="flex items-center justify-between" style="border-bottom: 1px solid var(--border-subtle); padding-bottom: 10px;">
              <span style="font-size: var(--font-size-lg); font-weight: 600;">Create New Project</span>
              <button onClick={() => { setIsCreatingProject(false); setSelectedTemplate(null); }} style="font-size: 16px; color: var(--text-muted); cursor: pointer;">✕</button>
            </div>

            <form onSubmit={handleCreateProject} style="display: flex; flex-direction: column; gap: 16px;">
              <div class="flex flex-col gap-1">
                <label style="font-size: var(--font-size-xs); color: var(--text-secondary); font-weight: 500;">Select Template</label>
                <select 
                  value={selectedTemplate()?.id ?? ""} 
                  onChange={(e) => setSelectedTemplate(projectTemplates.find(t => t.id === e.currentTarget.value) || null)}
                  style="background: var(--bg-input); border: 1px solid var(--border-default); border-radius: var(--radius-sm); color: var(--text-primary); padding: 8px; outline: none;"
                >
                  <option value="" disabled>Choose a template...</option>
                  <For each={projectTemplates}>
                    {(t) => <option value={t.id}>{t.icon} {t.name} ({t.category})</option>}
                  </For>
                </select>
              </div>

              <div class="flex flex-col gap-1">
                <label style="font-size: var(--font-size-xs); color: var(--text-secondary); font-weight: 500;">Project Name</label>
                <input 
                  type="text" 
                  placeholder="my-awesome-project" 
                  value={newProjectName()} 
                  onInput={(e) => setNewProjectName(e.currentTarget.value)}
                  required 
                  style="background: var(--bg-input); border: 1px solid var(--border-default); border-radius: var(--radius-sm); color: var(--text-primary); padding: 8px;"
                />
              </div>

              <div class="flex flex-col gap-1">
                <label style="font-size: var(--font-size-xs); color: var(--text-secondary); font-weight: 500;">Location</label>
                <div class="flex gap-2">
                  <input 
                    type="text" 
                    placeholder="C:/Users/.../Documents" 
                    value={newProjectPath()} 
                    onInput={(e) => setNewProjectPath(e.currentTarget.value)}
                    required 
                    style="flex: 1; background: var(--bg-input); border: 1px solid var(--border-default); border-radius: var(--radius-sm); color: var(--text-primary); padding: 8px;"
                  />
                  <button type="button" onClick={selectFolderForNewProject} style="background: var(--bg-active); border: 1px solid var(--border-default); border-radius: var(--radius-sm); padding: 0 12px; font-size: var(--font-size-xs); font-weight: 500;">Browse</button>
                </div>
              </div>

              <Show when={creationError()}>
                <div style="color: var(--accent-red); font-size: var(--font-size-xs); background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.2); padding: 8px; border-radius: var(--radius-sm);">
                  {creationError()}
                </div>
              </Show>

              <div class="flex justify-end gap-2" style="border-top: 1px solid var(--border-subtle); padding-top: 14px;">
                <button type="button" onClick={() => { setIsCreatingProject(false); setSelectedTemplate(null); }} style="background: transparent; border: 1px solid var(--border-default); border-radius: var(--radius-sm); padding: 8px 16px; font-size: var(--font-size-sm); font-weight: 500;">Cancel</button>
                <button type="submit" style="background: linear-gradient(135deg, var(--accent-primary), var(--accent-secondary)); color: var(--bg-void); border: none; border-radius: var(--radius-sm); padding: 8px 20px; font-size: var(--font-size-sm); font-weight: 600; cursor: pointer;">Create</button>
              </div>
            </form>
          </div>
        </div>
      </Show>
    </div>
  );
}
