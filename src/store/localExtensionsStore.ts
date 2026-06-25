// ─────────────────────────────────────────────────────────────────────────────
// HyperDrive — Local Extensions Store
// User apna khud ka folder specify karta hai jisme extension.json hota hai.
// Woh folder ka script seedha editor ke terminal se run hota hai.
// ─────────────────────────────────────────────────────────────────────────────
import { createStore, produce } from "solid-js/store";

// ── Extension Manifest (extension.json schema) ─────────────────────────────
export interface LocalExtensionManifest {
  name: string;
  description: string;
  version: string;
  author?: string;
  icon?: string;        // emoji or URL
  /** Commands the extension provides. {file} = active file path, {dir} = workspace dir */
  commands: {
    id: string;
    label: string;
    run: string;        // shell command, e.g. "python {dir}/lint.py {file}"
    shortcut?: string;
  }[];
  /** Language IDs this extension is active for. ["*"] = all languages */
  activationLanguages?: string[];
}

export interface LocalExtension {
  id: string;           // unique — derived from folder path hash
  folderPath: string;   // absolute path user provided
  manifest: LocalExtensionManifest;
  enabled: boolean;
  loadError?: string;   // set if manifest failed to parse
}

// ── State ─────────────────────────────────────────────────────────────────────
interface LocalExtensionsState {
  extensions: LocalExtension[];
  /** Paths the user has added as extension folders */
  registeredPaths: string[];
}

const [state, setState] = createStore<LocalExtensionsState>({
  extensions: [],
  registeredPaths: [],
});

// ── Persistence ────────────────────────────────────────────────────────────────
const STORAGE_KEY = "hyperdrive_local_extensions";

const persist = () => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      extensions: state.extensions,
      registeredPaths: state.registeredPaths,
    }));
  } catch {}
};

// ── Store API ──────────────────────────────────────────────────────────────────
export const localExtensionsStore = {
  extensions: () => state.extensions,
  registeredPaths: () => state.registeredPaths,

  /** Load an extension.json from the given folder path and register it */
  async addFolder(folderPath: string): Promise<{ success: boolean; error?: string }> {
    const normalised = folderPath.replace(/\\/g, "/").replace(/\/$/, "");

    // Duplicate check
    if (state.registeredPaths.includes(normalised)) {
      return { success: false, error: "This folder is already registered." };
    }

    const py = (window as any).pywebview?.api;
    if (!py) return { success: false, error: "Python API not available." };

    // Read extension.json from the folder
    const manifestPath = `${normalised}/extension.json`;
    let raw: string;
    try {
      raw = await py.read_file(manifestPath);
    } catch {
      return { success: false, error: `extension.json not found in: ${normalised}` };
    }

    if (typeof raw !== "string") {
      return { success: false, error: "Could not read extension.json — file may be missing or empty." };
    }

    let manifest: LocalExtensionManifest;
    try {
      manifest = JSON.parse(raw);
    } catch (e: any) {
      return { success: false, error: `Invalid JSON in extension.json: ${e.message}` };
    }

    // Validate required fields
    if (!manifest.name || !manifest.commands || !Array.isArray(manifest.commands)) {
      return { success: false, error: "extension.json must have 'name' and 'commands' fields." };
    }

    const id = btoa(normalised).replace(/[^a-zA-Z0-9]/g, "").slice(0, 16);

    const ext: LocalExtension = {
      id,
      folderPath: normalised,
      manifest,
      enabled: true,
    };

    setState(produce(s => {
      s.extensions.push(ext);
      s.registeredPaths.push(normalised);
    }));

    persist();
    return { success: true };
  },

  /** Remove a registered extension folder */
  removeFolder(folderPath: string) {
    const normalised = folderPath.replace(/\\/g, "/").replace(/\/$/, "");
    setState(produce(s => {
      s.extensions = s.extensions.filter(e => e.folderPath !== normalised);
      s.registeredPaths = s.registeredPaths.filter(p => p !== normalised);
    }));
    persist();
  },

  /** Toggle enabled/disabled without unregistering */
  toggle(id: string) {
    setState("extensions", e => e.id === id, "enabled", v => !v);
    persist();
  },

  /** Reload manifest from disk for a specific extension */
  async reload(id: string): Promise<{ success: boolean; error?: string }> {
    const ext = state.extensions.find(e => e.id === id);
    if (!ext) return { success: false, error: "Extension not found." };
    await localExtensionsStore.removeFolder(ext.folderPath);
    return localExtensionsStore.addFolder(ext.folderPath);
  },

  /** Load persisted data from localStorage on app start */
  async load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as LocalExtensionsState;

      // Re-validate manifests (user may have edited them)
      for (const path of saved.registeredPaths) {
        await localExtensionsStore.addFolder(path).catch(() => {});
      }
    } catch {}
  },

  /**
   * Run a specific command from a local extension on the active file.
   * @param extId  Extension id
   * @param cmdId  Command id defined in extension.json
   * @param activeFilePath  Current open file path
   * @param workspacePath   Current workspace root
   */
  async runCommand(
    extId: string,
    cmdId: string,
    activeFilePath: string,
    workspacePath: string
  ): Promise<void> {
    const ext = state.extensions.find(e => e.id === extId);
    if (!ext || !ext.enabled) return;

    const cmd = ext.manifest.commands.find(c => c.id === cmdId);
    if (!cmd) return;

    // Interpolate placeholders in the run command
    const resolved = cmd.run
      .replace(/\{file\}/g, `"${activeFilePath}"`)
      .replace(/\{dir\}/g, `"${workspacePath}"`)
      .replace(/\{ext_dir\}/g, `"${ext.folderPath}"`);

    // Push to terminal and open panel
    window.dispatchEvent(
      new CustomEvent("hyperdrive:run-in-terminal", { detail: { cmd: resolved } })
    );
  },
};
