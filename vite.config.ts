import { defineConfig } from "vite";
import solid from "vite-plugin-solid";
import { resolve } from "path";

const host = process.env.TAURI_DEV_HOST;

export default defineConfig({
  plugins: [solid()],

  // Vite options tailored for Tauri development
  clearScreen: false,

  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // tell vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },

  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
      "@components": resolve(__dirname, "src/components"),
      "@lib": resolve(__dirname, "src/lib"),
      "@store": resolve(__dirname, "src/store"),
      "@workers": resolve(__dirname, "src/workers"),
      "@styles": resolve(__dirname, "src/styles"),
    },
  },

  // Web Worker support
  worker: {
    format: "es",
    plugins: () => [solid()],
  },

  // Build optimizations
  build: {
    target: ["es2022", "chrome105", "safari15"],
    minify: "esbuild",
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
      },
      output: {
        manualChunks: {
          codemirror: [
            "@codemirror/state",
            "@codemirror/view",
            "@codemirror/commands",
            "@codemirror/language",
          ],
          xterm: ["xterm", "xterm-addon-fit", "xterm-addon-webgl"],
        },
      },
    },
  },

  // Optimizations for dependencies
  optimizeDeps: {
    include: [
      "solid-js",
      "@codemirror/state",
      "@codemirror/view",
      "@codemirror/commands",
      "@codemirror/language",
      "@codemirror/autocomplete",
    ],
    exclude: ["@tauri-apps/api", "@tauri-apps/plugin-fs"],
  },

  // Env prefix for Tauri
  envPrefix: ["VITE_", "TAURI_"],
});
