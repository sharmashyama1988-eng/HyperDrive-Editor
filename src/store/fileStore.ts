import { createStore } from "solid-js/store";
import { createSignal } from "solid-js";

export interface RecentProject {
  path: string;
  name: string;
  lastOpened: number; // timestamp
  type: "web" | "python" | "java" | "node" | "other";
}

const STORAGE_KEY = "hyperdrive_recent_projects";
const MAX_RECENT = 10;

function load(): RecentProject[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as RecentProject[]) : [];
  } catch { return []; }
}

function save(projects: RecentProject[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(projects)); } catch {}
}

function detectType(path: string): RecentProject["type"] {
  const p = path.toLowerCase().replace(/\\/g, "/");
  if (p.includes("python") || p.endsWith(".py")) return "python";
  if (p.includes("java") || p.includes("spring")) return "java";
  if (p.includes("node") || p.includes("express")) return "node";
  return "web";
}

const [recentProjects, setRecentProjects] = createSignal<RecentProject[]>(load());

export const fileStore = {
  recentProjects,

  async sync() {
    const py = (window as any).pywebview?.api;
    if (py) {
      try {
        if (py.get_recent_projects) {
          const recents = await py.get_recent_projects();
          if (Array.isArray(recents)) {
            setRecentProjects(recents);
            save(recents);
          }
        }
        if (py.get_credentials) {
          const creds = await py.get_credentials();
          if (creds) {
            if (creds.github_username) localStorage.setItem("hyperdrive_github_username", creds.github_username);
            if (creds.github_token) localStorage.setItem("hyperdrive_github_token", creds.github_token);
            if (creds.gemini_api_key) localStorage.setItem("hyperdrive_gemini_api_key", creds.gemini_api_key);
            if (creds.api_type) localStorage.setItem("hyperdrive_api_type", creds.api_type);
            if (creds.api_base_url) localStorage.setItem("hyperdrive_api_base_url", creds.api_base_url);
            if (creds.model_name) localStorage.setItem("hyperdrive_model_name", creds.model_name);
          }
        }
      } catch (e) {
        console.error("Failed to sync fileStore with python backend:", e);
      }
    }
  },

  async addRecent(path: string) {
    const normalizedPath = path.replace(/\\/g, "/");
    const cleanPath = normalizedPath.endsWith("/") && normalizedPath.length > 3 ? normalizedPath.slice(0, -1) : normalizedPath;
    const name = cleanPath.split("/").pop() ?? cleanPath;
    const type = detectType(cleanPath);
    const existing = recentProjects().filter(p => p.path !== cleanPath);
    const updated = [{ path: cleanPath, name, lastOpened: Date.now(), type }, ...existing].slice(0, MAX_RECENT);
    setRecentProjects(updated);
    save(updated);

    const py = (window as any).pywebview?.api;
    if (py && py.add_recent_project) {
      try {
        const res = await py.add_recent_project(cleanPath);
        if (res && res.recent_projects) {
          setRecentProjects(res.recent_projects);
          save(res.recent_projects);
        }
      } catch (e) {
        console.error(e);
      }
    }
  },

  async removeRecent(path: string) {
    const updated = recentProjects().filter(p => p.path !== path);
    setRecentProjects(updated);
    save(updated);

    const py = (window as any).pywebview?.api;
    if (py && py.remove_recent_project) {
      try {
        const res = await py.remove_recent_project(path);
        if (res && res.recent_projects) {
          setRecentProjects(res.recent_projects);
          save(res.recent_projects);
        }
      } catch (e) {
        console.error(e);
      }
    }
  },

  async clearRecent() {
    setRecentProjects([]);
    save([]);

    const py = (window as any).pywebview?.api;
    if (py && py.clear_recent_projects) {
      try {
        const res = await py.clear_recent_projects();
        if (res && res.recent_projects) {
          setRecentProjects(res.recent_projects);
          save(res.recent_projects);
        }
      } catch (e) {
        console.error(e);
      }
    }
  },

  timeAgo(ts: number): string {
    const diff = Date.now() - ts;
    const m = Math.floor(diff / 60000);
    if (m < 1) return "just now";
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24);
    if (d < 7) return `${d}d ago`;
    return new Date(ts).toLocaleDateString();
  },
};
