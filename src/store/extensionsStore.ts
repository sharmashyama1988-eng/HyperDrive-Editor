import { createStore } from "solid-js/store";

export interface EditorExtension {
  id: string;
  name: string;
  description: string;
  category: "formatting" | "keymaps" | "git" | "productivity" | "languages" | "theme";
  enabled: boolean;
  icon: string;
}

export interface ExtensionsState {
  extensions: EditorExtension[];
}

const defaultExtensions: EditorExtension[] = [
  {
    id: "prettier",
    name: "Prettier Formatter",
    description: "Opinionated code formatter. Automatically formats HTML, CSS, JavaScript, and TypeScript on save.",
    category: "formatting",
    enabled: true,
    icon: "✨"
  },
  {
    id: "vim",
    name: "Vim Keybindings",
    description: "Vim modal editing keybindings for power users. Supports standard motion, visual, and normal modes.",
    category: "keymaps",
    enabled: false,
    icon: "⌨️"
  },
  {
    id: "gitlens",
    name: "GitLens Lite",
    description: "Visualize code authorship at a glance via inline Git blame annotations and historical line logs.",
    category: "git",
    enabled: true,
    icon: "🌿"
  },
  {
    id: "bracket-colorizer",
    name: "Bracket Pair Colorizer",
    description: "Colorizes matching bracket pairs to make nested blocks easy to read at a glance.",
    category: "productivity",
    enabled: true,
    icon: "🌈"
  },
  {
    id: "code-runner",
    name: "Code Runner",
    description: "Run Python, Java, or Node.js code snippets instantly in the integrated terminal drawer.",
    category: "productivity",
    enabled: true,
    icon: "▶️"
  },
  {
    id: "markdown-preview",
    name: "Markdown Live Preview",
    description: "Split-pane live rendering for Markdown files (.md) with GitHub-flavored styling.",
    category: "productivity",
    enabled: false,
    icon: "📝"
  },
  {
    id: "color-picker",
    name: "CSS Color Picker",
    description: "Inline CSS/hex color previewer and interactive palette selection overlay.",
    category: "formatting",
    enabled: true,
    icon: "🎨"
  },
  {
    id: "emmet",
    name: "Emmet Expansion",
    description: "Expand HTML and CSS abbreviations using standard Emmet completion rules.",
    category: "productivity",
    enabled: true,
    icon: "⚡"
  }
];

const [state, setState] = createStore<ExtensionsState>({
  extensions: defaultExtensions
});

export const extensionsStore = {
  extensions: () => state.extensions,
  
  isEnabled(id: string): boolean {
    return state.extensions.find(ext => ext.id === id)?.enabled ?? false;
  },

  toggleExtension(id: string) {
    setState("extensions", ext => ext.id === id, "enabled", val => !val);
    
    // Save to localStorage
    try {
      localStorage.setItem("hyperdrive_extensions", JSON.stringify(state.extensions));
    } catch {}
  },

  load() {
    try {
      const raw = localStorage.getItem("hyperdrive_extensions");
      if (raw) {
        const parsed = JSON.parse(raw) as EditorExtension[];
        setState("extensions", parsed);
      }
    } catch {}
  }
};
