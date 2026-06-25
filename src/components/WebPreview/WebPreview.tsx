import { createSignal, Show, createEffect } from "solid-js";
import { editorStore } from "@store/editorStore";
import "@styles/preview.css";

export default function WebPreview() {
  const store = () => editorStore.get();
  const [device, setDevice] = createSignal<"desktop" | "tablet" | "mobile">("desktop");
  const [inputUrl, setInputUrl] = createSignal("");
  let iframeRef: HTMLIFrameElement | undefined;

  // Format and sync display URL
  createEffect(() => {
    const rawUrl = store().previewUrl;
    try {
      const parsed = new URL(rawUrl);
      if (parsed.hostname === "127.0.0.1" || parsed.hostname === "localhost") {
        setInputUrl(parsed.pathname.substring(1) || "index.html");
        return;
      }
    } catch {}
    setInputUrl(rawUrl);
  });

  const handleNavigate = (e: Event) => {
    e.preventDefault();
    let val = inputUrl().trim();
    if (!val) return;

    // Resolve relative path inputs against the active local preview server port
    try {
      const currentRaw = store().previewUrl;
      const parsedCurrent = new URL(currentRaw);
      if ((parsedCurrent.hostname === "127.0.0.1" || parsedCurrent.hostname === "localhost") && !/^https?:\/\//i.test(val)) {
        const port = parsedCurrent.port;
        const targetUrl = `http://127.0.0.1:${port}/${val.startsWith("/") ? val.substring(1) : val}`;
        editorStore.setPreviewUrl(targetUrl);
        return;
      }
    } catch {}

    if (!/^https?:\/\//i.test(val)) {
      val = `http://${val}`;
    }
    editorStore.setPreviewUrl(val);
  };

  const handleReload = () => {
    if (iframeRef) {
      iframeRef.src = store().previewUrl;
    }
  };

  const handleOpenExternal = () => {
    window.open(store().previewUrl, "_blank");
  };

  return (
    <div class="web-preview">
      <div class="preview-toolbar">
        <button class="ai-icon-btn" onClick={handleReload} title="Reload Preview">↺</button>
        
        <form onSubmit={handleNavigate} class="preview-address-bar">
          <input
            type="text"
            class="preview-address-input"
            value={inputUrl()}
            onInput={(e) => setInputUrl(e.currentTarget.value)}
            placeholder="localhost:5173"
          />
        </form>

        <button class="ai-icon-btn" onClick={handleOpenExternal} title="Open in browser">🌐</button>
      </div>

      <div 
        class="preview-toolbar" 
        style="justify-content: space-between; border-top: 1px solid var(--border-subtle); border-bottom: 1px solid var(--border-subtle); padding: 4px 8px;"
      >
        <span style="font-size: 10px; color: var(--text-secondary); font-weight: 500;">Device Simulation</span>
        <div class="preview-device-selector">
          <button 
            class={`preview-device-btn ${device() === "desktop" ? "active" : ""}`}
            onClick={() => setDevice("desktop")}
            title="Desktop view"
          >
            💻 Desktop
          </button>
          <button 
            class={`preview-device-btn ${device() === "tablet" ? "active" : ""}`}
            onClick={() => setDevice("tablet")}
            title="Tablet view"
          >
            📱 Tablet
          </button>
          <button 
            class={`preview-device-btn ${device() === "mobile" ? "active" : ""}`}
            onClick={() => setDevice("mobile")}
            title="Mobile view"
          >
            📱 Mobile
          </button>
        </div>
      </div>

      <div class={`preview-frame-container ${device()}`}>
        <iframe
          ref={iframeRef}
          src={store().previewUrl}
          class="preview-iframe"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
        ></iframe>
      </div>
    </div>
  );
}
