import { isTauri } from "./tauriCheck";

const getPyAPI = () => (window as any).pywebview?.api;

async function waitForPyAPI(): Promise<any> {
  const py = getPyAPI();
  if (py) return py;
  if (typeof window === "undefined") return null;
  if (isTauri()) return null;

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

export const tauriDialog = {
  /**
   * Opens folder dialog natively and returns path or null
   */
  async selectFolder(title: string): Promise<string | null> {
    const py = await waitForPyAPI();
    if (py) {
      const selected = await py.select_folder();
      return selected || null;
    }

    if (isTauri()) {
      try {
        const { open } = await import("@tauri-apps/plugin-dialog");
        const selected = await open({
          directory: true,
          multiple: false,
          title
        });
        return typeof selected === "string" ? selected : null;
      } catch (err) {
        console.error("Tauri dialog open error:", err);
      }
    }

    // Browser mockup or prompt fallback
    const mockPath = prompt(`Enter mock workspace directory path for browser testing:`, "C:/HyperDrive");
    return mockPath || null;
  }
};
