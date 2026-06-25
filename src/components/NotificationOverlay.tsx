import { For, Show, createSignal, createEffect } from "solid-js";
import { notificationStore, Toast } from "../store/notificationStore";

export default function NotificationOverlay() {
  const toasts = () => notificationStore.toasts();
  const confirm = () => notificationStore.confirmState();
  const prompt = () => notificationStore.promptState();

  // Local state for the prompt input value
  const [inputValue, setInputValue] = createSignal("");
  let promptInputRef: HTMLInputElement | undefined;

  // Sync default value when prompt opens
  createEffect(() => {
    if (prompt().isOpen) {
      setInputValue(prompt().defaultValue);
      setTimeout(() => {
        promptInputRef?.focus();
        promptInputRef?.select();
      }, 50);
    }
  });

  const getIcon = (type: Toast["type"]) => {
    switch (type) {
      case "success": return "⚡";
      case "error": return "🚨";
      case "warning": return "⚠️";
      default: return "💡";
    }
  };

  const getBorderColor = (type: Toast["type"]) => {
    switch (type) {
      case "success": return "var(--accent-green, #10b981)";
      case "error": return "var(--accent-red, #ef4444)";
      case "warning": return "var(--accent-orange, #f59e0b)";
      default: return "var(--accent-primary, #3b82f6)";
    }
  };

  return (
    <>
      {/* 1. TOAST NOTIFICATIONS */}
      <div
        style={{
          position: "fixed",
          bottom: "20px",
          right: "20px",
          display: "flex",
          "flex-direction": "column",
          gap: "10px",
          "z-index": 10000,
          "max-width": "350px",
          width: "100%",
          "pointer-events": "none",
        }}
      >
        <For each={toasts()}>
          {(toast) => (
            <div
              style={{
                background: "rgba(15, 15, 18, 0.92)",
                "backdrop-filter": "blur(16px)",
                "-webkit-backdrop-filter": "blur(16px)",
                border: `1px solid ${getBorderColor(toast.type)}`,
                "border-left": `4px solid ${getBorderColor(toast.type)}`,
                padding: "12px 16px",
                "border-radius": "var(--radius-md, 6px)",
                color: "var(--text-primary, #f5f5f7)",
                "font-size": "var(--font-size-sm, 13px)",
                display: "flex",
                "align-items": "center",
                gap: "12px",
                "box-shadow": "0 8px 30px rgba(0, 0, 0, 0.45)",
                "pointer-events": "auto",
                animation: "toastSlideIn 0.24s cubic-bezier(0.16, 1, 0.3, 1) forwards",
              }}
            >
              <span style={{ "font-size": "16px", "flex-shrink": 0 }}>{getIcon(toast.type)}</span>
              <div style={{ flex: 1, "line-height": "1.4" }}>{toast.message}</div>
              <button
                onClick={() => notificationStore.removeToast(toast.id)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "var(--text-muted, #86868b)",
                  cursor: "pointer",
                  "font-size": "14px",
                  padding: "0 4px",
                  "margin-left": "4px",
                  "flex-shrink": 0,
                }}
              >
                ×
              </button>
            </div>
          )}
        </For>
      </div>

      {/* 2. CONFIRMATION DIALOG */}
      <Show when={confirm().isOpen}>
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            background: "rgba(5, 5, 8, 0.65)",
            "backdrop-filter": "blur(8px)",
            "-webkit-backdrop-filter": "blur(8px)",
            display: "flex",
            "align-items": "center",
            "justify-content": "center",
            "z-index": 10100,
            animation: "confirmFadeIn 0.2s ease-out forwards",
          }}
        >
          <div
            style={{
              background: "rgba(18, 18, 22, 0.95)",
              border: "1px solid var(--border-default, rgba(255, 255, 255, 0.08))",
              "border-radius": "var(--radius-lg, 10px)",
              width: "400px",
              padding: "24px",
              "box-shadow": "0 24px 60px rgba(0, 0, 0, 0.6)",
              display: "flex",
              "flex-direction": "column",
              gap: "20px",
              animation: "confirmScaleUp 0.25s cubic-bezier(0.34, 1.56, 0.64, 1) forwards",
            }}
          >
            <div style={{ display: "flex", "align-items": "center", gap: "10px" }}>
              <span style={{ "font-size": "24px" }}>❓</span>
              <span style={{ "font-size": "16px", "font-weight": 700, color: "var(--text-primary, #f5f5f7)" }}>
                Confirm Action
              </span>
            </div>

            <div
              style={{
                "font-size": "var(--font-size-base, 14px)",
                color: "var(--text-secondary, #d2d2d7)",
                "line-height": "1.5",
              }}
            >
              {confirm().message}
            </div>

            <div style={{ display: "flex", "justify-content": "flex-end", gap: "10px" }}>
              <button
                onClick={() => notificationStore.resolveConfirm(false)}
                style={{
                  padding: "8px 16px",
                  background: "transparent",
                  border: "1px solid var(--border-default, rgba(255, 255, 255, 0.1))",
                  "border-radius": "var(--radius-sm, 4px)",
                  color: "var(--text-secondary, #d2d2d7)",
                  cursor: "pointer",
                  "font-size": "13px",
                  "font-weight": "600",
                }}
              >
                No
              </button>
              <button
                onClick={() => notificationStore.resolveConfirm(true)}
                style={{
                  padding: "8px 16px",
                  background: "var(--accent-primary, #3b82f6)",
                  border: "none",
                  "border-radius": "var(--radius-sm, 4px)",
                  color: "#ffffff",
                  cursor: "pointer",
                  "font-size": "13px",
                  "font-weight": "700",
                  "box-shadow": "0 2px 8px rgba(59, 130, 246, 0.4)",
                }}
              >
                Yes
              </button>
            </div>
          </div>
        </div>
      </Show>

      {/* 3. PROMPT INPUT DIALOG */}
      <Show when={prompt().isOpen}>
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            background: "rgba(5, 5, 8, 0.65)",
            "backdrop-filter": "blur(8px)",
            "-webkit-backdrop-filter": "blur(8px)",
            display: "flex",
            "align-items": "center",
            "justify-content": "center",
            "z-index": 10100,
            animation: "confirmFadeIn 0.2s ease-out forwards",
          }}
        >
          <div
            style={{
              background: "rgba(18, 18, 22, 0.95)",
              border: "1px solid var(--border-default, rgba(255, 255, 255, 0.08))",
              "border-radius": "var(--radius-lg, 10px)",
              width: "400px",
              padding: "24px",
              "box-shadow": "0 24px 60px rgba(0, 0, 0, 0.6)",
              display: "flex",
              "flex-direction": "column",
              gap: "16px",
              animation: "confirmScaleUp 0.25s cubic-bezier(0.34, 1.56, 0.64, 1) forwards",
            }}
          >
            <div style={{ display: "flex", "align-items": "center", gap: "10px" }}>
              <span style={{ "font-size": "22px" }}>✍️</span>
              <span style={{ "font-size": "15px", "font-weight": 700, color: "var(--text-primary, #f5f5f7)" }}>
                {prompt().title}
              </span>
            </div>

            <input
              ref={promptInputRef}
              type="text"
              value={inputValue()}
              onInput={(e) => setInputValue(e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  notificationStore.resolvePrompt(inputValue());
                } else if (e.key === "Escape") {
                  notificationStore.resolvePrompt(null);
                }
              }}
              style={{
                width: "100%",
                background: "var(--bg-active, rgba(255, 255, 255, 0.04))",
                border: "1px solid var(--border-default, rgba(255, 255, 255, 0.1))",
                color: "var(--text-primary, #f5f5f7)",
                padding: "8px 12px",
                "border-radius": "var(--radius-sm, 4px)",
                "font-size": "13px",
                outline: "none",
                "box-sizing": "border-box",
              }}
            />

            <div style={{ display: "flex", "justify-content": "flex-end", gap: "10px", "margin-top": "8px" }}>
              <button
                onClick={() => notificationStore.resolvePrompt(null)}
                style={{
                  padding: "8px 16px",
                  background: "transparent",
                  border: "1px solid var(--border-default, rgba(255, 255, 255, 0.1))",
                  "border-radius": "var(--radius-sm, 4px)",
                  color: "var(--text-secondary, #d2d2d7)",
                  cursor: "pointer",
                  "font-size": "13px",
                  "font-weight": "600",
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => notificationStore.resolvePrompt(inputValue())}
                style={{
                  padding: "8px 16px",
                  background: "var(--accent-primary, #3b82f6)",
                  border: "none",
                  "border-radius": "var(--radius-sm, 4px)",
                  color: "#ffffff",
                  cursor: "pointer",
                  "font-size": "13px",
                  "font-weight": "700",
                  "box-shadow": "0 2px 8px rgba(59, 130, 246, 0.4)",
                }}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      </Show>

      {/* Global Toast animations inline styling */}
      <style>{`
        @keyframes toastSlideIn {
          from {
            opacity: 0;
            transform: translateY(12px) scale(0.96);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        @keyframes confirmFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes confirmScaleUp {
          from {
            opacity: 0;
            transform: scale(0.92);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
      `}</style>
    </>
  );
}
