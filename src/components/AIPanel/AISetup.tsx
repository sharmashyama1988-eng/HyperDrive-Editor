import { createSignal, Show } from "solid-js";
import { OllamaClient } from "@lib/ollama";
import { notificationStore } from "@store/notificationStore";

interface AISetupProps {
  isOllamaRunning: boolean;
  modelName: string;
  onSetupComplete: () => void;
  onCheckStatus: () => void;
}

export default function AISetup(props: AISetupProps) {
  const [setupState, setSetupState] = createSignal<"idle" | "pulling" | "error">("idle");
  const [progressMsg, setProgressMsg] = createSignal("");
  const [progressPercent, setProgressPercent] = createSignal(0);

  const ollama = new OllamaClient();

  const handleStartSetup = async () => {
    if (!props.isOllamaRunning) {
      notificationStore.showToast("Ollama is not running locally. Please launch Ollama Desktop first.", "warning");
      return;
    }

    setSetupState("pulling");
    setProgressMsg("Connecting to local Ollama API...");

    try {
      await ollama.pullModel(props.modelName, (p) => {
        if (p.completed && p.total) {
          const percent = Math.round((p.completed / p.total) * 100);
          setProgressPercent(percent);
          setProgressMsg(`Pulling ${props.modelName}: ${percent}% (${Math.round(p.completed/1024/1024)}MB / ${Math.round(p.total/1024/1024)}MB)`);
        } else {
          setProgressMsg(p.status || "Downloading model...");
        }
      });

      setSetupState("idle");
      props.onSetupComplete();
    } catch (err: any) {
      console.error(err);
      setSetupState("error");
      setProgressMsg(`Failed to setup local model: ${err.message || err}`);
    }
  };

  return (
    <div class="ai-setup-screen">
      <div class="ai-setup-icon">🤖</div>
      <h2 class="ai-setup-title">Local AI Setup</h2>
      <p class="ai-setup-subtitle">
        HyperDrive supports local, private AI models. No API keys or internet required.
      </p>

      <div class="ai-model-badge">
        <span>Model: {props.modelName}</span>
      </div>

      <Show when={props.isOllamaRunning} fallback={
        <div class="flex-col gap-2 items-center">
          <div class="ai-error-banner">
            <span>⚠️ Local Ollama backend was not found on port 11434.</span>
          </div>
          <p style="font-size: 11px; color: var(--text-secondary); max-width: 240px; margin-bottom: 8px;">
            Please download and run Ollama from <a href="https://ollama.com" target="_blank" style="color:var(--accent-primary);">ollama.com</a>.
          </p>
          <button class="ai-setup-btn" onClick={props.onCheckStatus}>
            🔄 Refresh Status
          </button>
        </div>
      }>
        <Show when={setupState() === "pulling"} fallback={
          <button class="ai-setup-btn" onClick={handleStartSetup}>
            ⚡ Auto Setup Local Model
          </button>
        }>
          <div class="ai-progress-wrap">
            <span class="ai-progress-label">{progressMsg()}</span>
            <div class="ai-progress-bar-track">
              <div class="ai-progress-bar-fill" style={{ width: `${progressPercent()}%` }}></div>
            </div>
            <span style="font-size:10px; color:var(--text-muted); text-align:right;">{progressPercent()}%</span>
          </div>
        </Show>
      </Show>

      <Show when={setupState() === "error"}>
        <div class="ai-error-banner" style="margin-top: 10px;">
          <span>{progressMsg()}</span>
        </div>
      </Show>
    </div>
  );
}
