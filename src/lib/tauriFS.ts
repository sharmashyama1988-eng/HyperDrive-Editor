import { isTauri } from "./tauriCheck";

const getPyAPI = () => (window as any).pywebview?.api;

async function waitForPyAPI(): Promise<any> {
  const py = getPyAPI();
  if (py) return py;
  if (typeof window === "undefined") return null;
  if (isTauri()) return null; // In Tauri, we skip python API wait

  return new Promise((resolve) => {
    // Check again just in case it initialized while resolving
    const currentApi = getPyAPI();
    if (currentApi) {
      resolve(currentApi);
      return;
    }

    const onReady = () => {
      window.removeEventListener("pywebviewready", onReady);
      resolve(getPyAPI());
    };
    window.addEventListener("pywebviewready", onReady);

    let checkCount = 0;
    const interval = setInterval(() => {
      const api = getPyAPI();
      checkCount++;
      if (api) {
        clearInterval(interval);
        window.removeEventListener("pywebviewready", onReady);
        resolve(api);
      } else if (checkCount > 100) { // Max 5 seconds fallback
        clearInterval(interval);
        window.removeEventListener("pywebviewready", onReady);
        resolve(null);
      }
    }, 50);
  });
}

export const tauriFS = {
  async listFolder(path: string) {
    const py = await waitForPyAPI();
    if (py) {
      const res = await py.read_dir_recursive(path);
      if (res.error) throw new Error(res.error);
      return res.map((e: any) => ({
        name: e.name,
        path: e.path,
        isDirectory: e.is_dir,
        isFile: !e.is_dir
      }));
    }

    if (isTauri()) {
      try {
        const { readDir } = await import("@tauri-apps/plugin-fs");
        const entries = await readDir(path);
        return entries.map(e => ({
          name: e.name,
          path: `${path}/${e.name}`.replace(/\\/g, "/"),
          isDirectory: e.isDirectory,
          isFile: e.isFile
        }));
      } catch (e) {
        console.error(`TauriFS readDir error on: ${path}`, e);
        throw e;
      }
    }

    console.warn("listFolder called outside Tauri/Python context:", path);
    return [];
  },

  async getFileContent(path: string): Promise<string> {
    const py = await waitForPyAPI();
    if (py) {
      const res = await py.read_file(path);
      if (typeof res === "object" && res.error) throw new Error(res.error);
      return res;
    }

    if (isTauri()) {
      try {
        const { readTextFile } = await import("@tauri-apps/plugin-fs");
        return await readTextFile(path);
      } catch (e) {
        console.error(`TauriFS readTextFile error on: ${path}`, e);
        throw e;
      }
    }

    console.warn("getFileContent called outside Tauri/Python context:", path);
    return "";
  },

  async saveFile(path: string, content: string): Promise<void> {
    const py = await waitForPyAPI();
    if (py) {
      const res = await py.write_file(path, content);
      if (res.error) throw new Error(res.error);
      return;
    }

    if (isTauri()) {
      try {
        const { writeTextFile } = await import("@tauri-apps/plugin-fs");
        await writeTextFile(path, content);
      } catch (e) {
        console.error(`TauriFS writeTextFile error on: ${path}`, e);
        throw e;
      }
    } else {
      console.warn("saveFile called outside Tauri/Python context:", path);
    }
  },

  async createFolder(path: string): Promise<void> {
    const py = await waitForPyAPI();
    if (py) {
      const res = await py.mkdir(path);
      if (res.error) throw new Error(res.error);
      return;
    }

    if (isTauri()) {
      try {
        const { mkdir } = await import("@tauri-apps/plugin-fs");
        await mkdir(path, { recursive: true });
      } catch (e) {
        console.error(`TauriFS mkdir error on: ${path}`, e);
        throw e;
      }
    } else {
      console.warn("createFolder called outside Tauri/Python context:", path);
    }
  },

  async deleteItem(path: string): Promise<void> {
    const py = await waitForPyAPI();
    if (py) {
      const res = await py.delete_item(path);
      if (res.error) throw new Error(res.error);
      return;
    }

    if (isTauri()) {
      try {
        const { remove } = await import("@tauri-apps/plugin-fs");
        await remove(path, { recursive: true });
      } catch (e) {
        console.error(`TauriFS remove error on: ${path}`, e);
        throw e;
      }
    } else {
      console.warn("deleteItem called outside Tauri/Python context:", path);
    }
  },

  async renameItem(oldPath: string, newPath: string): Promise<void> {
    const py = await waitForPyAPI();
    if (py) {
      const res = await py.rename_item(oldPath, newPath);
      if (res.error) throw new Error(res.error);
      return;
    }
    console.warn("renameItem called outside Python context:", oldPath, newPath);
  },

  async revealInExplorer(path: string): Promise<void> {
    const py = await waitForPyAPI();
    if (py && py.reveal_in_explorer) {
      const res = await py.reveal_in_explorer(path);
      if (res.error) throw new Error(res.error);
      return;
    }
    console.warn("revealInExplorer not supported or not running in Python context:", path);
  },

  // ── Convenience aliases used by QuickDialogs / MenuBar ───────────────────
  /** Alias for getFileContent */
  readFile(path: string): Promise<string> {
    return tauriFS.getFileContent(path);
  },

  /** Flat directory listing (top-level only) — alias for listFolder */
  async readDir(dirPath: string): Promise<Array<{ name: string; path: string; is_dir: boolean }>> {
    const py = await waitForPyAPI();
    if (py) {
      const res = await py.read_dir_recursive(dirPath);
      if (res.error) throw new Error(res.error);
      return (res as any[]).map((e: any) => ({
        name: e.name,
        path: e.path,
        is_dir: e.is_dir,
      }));
    }
    return [];
  },

  /** Open a native file-open dialog (pywebview only). Returns path or null. */
  async openFileDialog(): Promise<string | null> {
    const py = await waitForPyAPI();
    if (!py) return null;
    try {
      const result = await py.select_file();
      if (result && typeof result === "string") return result;
      return null;
    } catch {
      return null;
    }
  },
};

