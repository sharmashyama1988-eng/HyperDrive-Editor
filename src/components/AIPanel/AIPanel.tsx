import { createSignal, onMount, For, Show, createEffect } from "solid-js";
import { editorStore } from "@store/editorStore";
import { notificationStore } from "@store/notificationStore";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
}

export default function AIPanel() {
  const store = () => editorStore.get();
  const [messages, setMessages] = createSignal<Message[]>([]);
  const [sessions, setSessions] = createSignal<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = createSignal<string>("");
  const [showHistory, setShowHistory] = createSignal(false);
  const [inputVal, setInputVal] = createSignal("");
  const [isGenerating, setIsGenerating] = createSignal(false);
  const [streamingText, setStreamingText] = createSignal("");
  const [agentStatus, setAgentStatus] = createSignal("");
  const [showConfig, setShowConfig] = createSignal(false);

  const [apiKey, setApiKey] = createSignal(localStorage.getItem("hyperdrive_gemini_api_key") || "");
  const [apiType, setApiType] = createSignal(localStorage.getItem("hyperdrive_api_type") || "gemini");
  const [apiBaseUrl, setApiBaseUrl] = createSignal(localStorage.getItem("hyperdrive_api_base_url") || "https://openrouter.ai/api/v1");
  const [modelName, setModelName] = createSignal(localStorage.getItem("hyperdrive_model_name") || "gemini-1.5-flash");

  const [tempKey, setTempKey] = createSignal(apiKey());
  const [tempType, setTempType] = createSignal(apiType());
  const [tempBase, setTempBase] = createSignal(apiBaseUrl());
  const [tempModel, setTempModel] = createSignal(modelName());

  const [isCustomModel, setIsCustomModel] = createSignal(false);
  const [customModel, setCustomModel] = createSignal("");
  const [isDownloadingModel, setIsDownloadingModel] = createSignal(false);

  createEffect(() => {
    const type = tempType();
    if (type === "ollama") {
      setTempBase("http://localhost:11434/v1");
      setTempModel("qwen2.5-coder:1.5b");
      setTempKey("local");
    } else if (type === "gemini") {
      setTempBase("");
      setTempModel("gemini-1.5-flash");
    } else if (type === "openai") {
      setTempBase("https://openrouter.ai/api/v1");
      setTempModel("google/gemini-2.5-flash");
    }
  });

  const saveSessions = (currSessions: ChatSession[]) => {
    localStorage.setItem("hyperdrive_ai_sessions", JSON.stringify(currSessions));
  };

  const createNewSession = () => {
    const newSession: ChatSession = {
      id: "session_" + Date.now() + "_" + Math.random().toString(36).substring(2, 9),
      title: "New Chat",
      messages: [],
      createdAt: Date.now(),
    };
    const updated = [newSession, ...sessions()];
    setSessions(updated);
    setCurrentSessionId(newSession.id);
    setMessages([]);
    saveSessions(updated);
  };

  const selectSession = (id: string) => {
    if (isGenerating()) return;
    const session = sessions().find((s) => s.id === id);
    if (session) {
      setCurrentSessionId(id);
      setMessages(session.messages);
      setShowHistory(false);
    }
  };

  const deleteSession = (id: string, e: Event) => {
    e.stopPropagation();
    const updated = sessions().filter((s) => s.id !== id);
    setSessions(updated);
    saveSessions(updated);
    
    if (currentSessionId() === id) {
      if (updated.length > 0) {
        selectSession(updated[0].id);
      } else {
        createNewSession();
      }
    }
  };

  createEffect(() => {
    const msgs = messages();
    const sessionId = currentSessionId();
    if (!sessionId) return;
    
    setSessions((prev) => {
      const updated = prev.map((s) => {
        if (s.id === sessionId) {
          let title = s.title;
          if (title === "New Chat" && msgs.length > 0) {
            const firstUserMsg = msgs.find((m) => m.role === "user");
            if (firstUserMsg) {
              title = firstUserMsg.content.slice(0, 30) + (firstUserMsg.content.length > 30 ? "..." : "");
            }
          }
          return { ...s, messages: msgs, title };
        }
        return s;
      });
      saveSessions(updated);
      return updated;
    });
  });

  const openConfig = () => {
    setTempKey(apiKey());
    setTempType(apiType());
    setTempBase(apiBaseUrl());
    setTempModel(modelName());

    // Detect if current model is custom
    const type = tempType();
    const model = tempModel();
    const predefinedGemini = ["gemini-1.5-flash", "gemini-1.5-pro", "gemini-2.0-flash"];
    const predefinedOpenAI = ["google/gemini-2.5-flash", "deepseek/deepseek-chat", "gpt-4o-mini", "meta-llama/llama-3.3-70b-instruct"];
    const predefinedOllama = ["qwen2.5-coder:1.5b", "qwen2.5-coder:7b", "llama3:8b", "deepseek-coder:1.5b"];

    let isPredefined = false;
    if (type === "gemini" && predefinedGemini.includes(model)) isPredefined = true;
    else if (type === "openai" && predefinedOpenAI.includes(model)) isPredefined = true;
    else if (type === "ollama" && predefinedOllama.includes(model)) isPredefined = true;

    if (!isPredefined && model) {
      setIsCustomModel(true);
      setCustomModel(model);
    } else {
      setIsCustomModel(false);
      setCustomModel("");
    }

    setShowConfig(true);
  };

  const handleDownloadOllamaModel = async () => {
    const py = (window as any).pywebview?.api;
    if (py && py.pull_ollama_model) {
      setIsDownloadingModel(true);
      try {
        await py.pull_ollama_model(tempModel());
      } catch (err) {
        console.error("Failed to start Ollama model pull:", err);
        setIsDownloadingModel(false);
      }
    } else {
      notificationStore.showToast("Python backend api not ready.", "error");
    }
  };

  const openSecretFolder = async () => {
    const py = (window as any).pywebview?.api;
    const ws = store().workspacePath;
    if (py && py.reveal_project_ai_dir && ws) {
      try {
        await py.reveal_project_ai_dir(ws);
      } catch (err) {
        console.error("Failed to open secret folder:", err);
      }
    } else {
      notificationStore.showToast("No active workspace or pywebview API not ready.", "error");
    }
  };

  onMount(() => {
    // Load sessions
    const savedSessions = localStorage.getItem("hyperdrive_ai_sessions");
    if (savedSessions) {
      try {
        const parsed = JSON.parse(savedSessions) as ChatSession[];
        setSessions(parsed);
        if (parsed.length > 0) {
          const latest = parsed[0];
          setCurrentSessionId(latest.id);
          setMessages(latest.messages);
        } else {
          createNewSession();
        }
      } catch (e) {
        console.error("Failed to parse sessions", e);
        createNewSession();
      }
    } else {
      createNewSession();
    }

    const loadFromStorage = () => {
      setApiKey(localStorage.getItem("hyperdrive_gemini_api_key") || "");
      setApiType(localStorage.getItem("hyperdrive_api_type") || "gemini");
      setApiBaseUrl(localStorage.getItem("hyperdrive_api_base_url") || "https://openrouter.ai/api/v1");
      setModelName(localStorage.getItem("hyperdrive_model_name") || "gemini-1.5-flash");
    };

    loadFromStorage();
    let checks = 0;
    const interval = setInterval(() => {
      checks++;
      loadFromStorage();
      if (apiKey() || checks > 15) clearInterval(interval);
    }, 200);

    // Register global callback for python backend agent loop
    (window as any).onAgentStatus = (data: { type: string; value: any }) => {
      const { type, value } = data;
      if (type === "token") {
        setStreamingText((prev) => prev + value);
      } else if (type === "status") {
        setAgentStatus(value);
      } else if (type === "finished") {
        const finalContent = streamingText();
        setMessages((prev) => [...prev, { role: "assistant", content: finalContent }]);
        setStreamingText("");
        setAgentStatus("");
        setIsGenerating(false);
      } else if (type === "error") {
        setMessages((prev) => [...prev, { role: "assistant", content: `Error: ${value}` }]);
        setStreamingText("");
        setAgentStatus("");
        setIsGenerating(false);
      }
    };

    (window as any).onOllamaPullComplete = (modelName: string, success: boolean, errorMsg?: string) => {
      setIsDownloadingModel(false);
      if (success) {
        notificationStore.showToast(`Successfully downloaded and verified local model: ${modelName}`, "success");
      } else {
        notificationStore.showToast(`Ollama pull error: ${errorMsg || 'Unknown error'}`, "error");
      }
    };
  });

  const handleSaveKey = async (e: Event) => {
    e.preventDefault();
    const key = tempKey().trim();
    const type = tempType();
    const base = tempBase().trim();
    const model = tempModel().trim();

    localStorage.setItem("hyperdrive_gemini_api_key", key);
    localStorage.setItem("hyperdrive_api_type", type);
    localStorage.setItem("hyperdrive_api_base_url", base);
    localStorage.setItem("hyperdrive_model_name", model);

    setApiKey(key);
    setApiType(type);
    setApiBaseUrl(base);
    setModelName(model);
    setShowConfig(false);

    const py = (window as any).pywebview?.api;
    if (py && py.save_credentials) {
      try {
        await py.save_credentials(null, null, key, type, base, model);
      } catch (err) {
        console.error("Failed to save credentials to backend:", err);
      }
    }
  };

  const handleClearKey = async () => {
    const confirmed = await notificationStore.confirm("Clear AI Configuration?");
    if (confirmed) {
      localStorage.removeItem("hyperdrive_gemini_api_key");
      localStorage.removeItem("hyperdrive_api_type");
      localStorage.removeItem("hyperdrive_api_base_url");
      localStorage.removeItem("hyperdrive_model_name");

      setApiKey("");
      setApiType("gemini");
      setApiBaseUrl("https://openrouter.ai/api/v1");
      setModelName("gemini-1.5-flash");
      setShowConfig(false);

      const py = (window as any).pywebview?.api;
      if (py && py.save_credentials) {
        try {
          await py.save_credentials(null, null, "", "gemini", "https://openrouter.ai/api/v1", "gemini-1.5-flash");
        } catch (err) {
          console.error("Failed to clear credentials on backend:", err);
        }
      }
    }
  };

  const handleSendMessage = async (e: Event) => {
    e.preventDefault();
    const query = inputVal().trim();
    if (!query || isGenerating()) return;

    const userMsg: Message = { role: "user", content: query };
    const updatedMessages = [...messages(), userMsg];
    setMessages(updatedMessages);
    setInputVal("");
    setIsGenerating(true);
    setStreamingText("");
    setAgentStatus("Initializing AI Agent...");

    const py = (window as any).pywebview?.api;
    const ws = store().workspacePath;
    
    if (py && py.run_agent_loop) {
      py.run_agent_loop(
        query, 
        apiKey(), 
        ws || "", 
        JSON.stringify(messages().slice(0, -1)),
        apiType(),
        apiBaseUrl(),
        modelName()
      );
    } else {
      setMessages([...updatedMessages, { role: "assistant", content: "Error: Python backend bridge not initialized." }]);
      setIsGenerating(false);
      setAgentStatus("");
    }
  };

  const applySuggestion = (text: string) => {
    setInputVal(text);
  };

  return (
    <div class="ai-panel" style="display: flex; flex-direction: column; height: 100%; overflow: hidden;">
      {/* ── Key Setup View ──────────────────────────────────────── */}
      <Show when={apiKey() !== "" && !showConfig()} fallback={
        <div style="padding: 20px; display: flex; flex-direction: column; gap: 14px; height: 100%; overflow-y: auto;">
          <div style="text-align: center; display: flex; flex-direction: column; align-items: center; gap: 8px;">
            <span style="font-size: 32px;">🤖</span>
            <h2 style="font-size: var(--font-size-md); font-weight: 600; color: var(--text-primary); margin: 0;">AI Agent Setup</h2>
            <p style="font-size: var(--font-size-xs); color: var(--text-muted); line-height: 1.4; margin: 0;">
              Configure your AI provider to enable autonomous coding rules, web research, and custom skills.
            </p>
          </div>
          
          <form onSubmit={handleSaveKey} style="display: flex; flex-direction: column; gap: 12px; margin-top: 8px; text-align: left;">
            <div style="display: flex; flex-direction: column; gap: 4px;">
              <label style="font-size: 10px; color: var(--text-muted); font-weight: 500;">Provider Type</label>
              <select
                value={tempType()}
                onChange={(e) => setTempType(e.currentTarget.value)}
                style="width: 100%; background: var(--bg-input); border: 1px solid var(--border-default); border-radius: var(--radius-sm); color: var(--text-primary); padding: 8px; font-size: var(--font-size-xs); outline: none;"
              >
                <option value="gemini">Google Gemini API (Direct)</option>
                <option value="openai">OpenAI Compatible (OpenRouter, DeepSeek, Groq)</option>
                <option value="ollama">Local Offline Model (Ollama)</option>
              </select>
            </div>

            <Show when={tempType() === "openai" || tempType() === "ollama"}>
              <div style="display: flex; flex-direction: column; gap: 4px;">
                <label style="font-size: 10px; color: var(--text-muted); font-weight: 500;">API Base URL</label>
                <input 
                  type="text"
                  placeholder={tempType() === "ollama" ? "http://localhost:11434/v1" : "https://openrouter.ai/api/v1"}
                  value={tempBase()}
                  onInput={(e) => setTempBase(e.currentTarget.value)}
                  required
                  style="width: 100%; background: var(--bg-input); border: 1px solid var(--border-default); border-radius: var(--radius-sm); color: var(--text-primary); padding: 8px; font-size: var(--font-size-xs);"
                />
              </div>
            </Show>

            <div style="display: flex; flex-direction: column; gap: 4px;">
              <label style="font-size: 10px; color: var(--text-muted); font-weight: 500;">Model Selection</label>
              <select
                value={isCustomModel() ? "custom" : tempModel()}
                onChange={(e) => {
                  const val = e.currentTarget.value;
                  if (val === "custom") {
                    setIsCustomModel(true);
                    setTempModel(customModel() || "");
                  } else {
                    setIsCustomModel(false);
                    setTempModel(val);
                  }
                }}
                style="width: 100%; background: var(--bg-input); border: 1px solid var(--border-default); border-radius: var(--radius-sm); color: var(--text-primary); padding: 8px; font-size: var(--font-size-xs); outline: none;"
              >
                <Show when={tempType() === "gemini"}>
                  <option value="gemini-1.5-flash">gemini-1.5-flash (Fast, Recommended)</option>
                  <option value="gemini-1.5-pro">gemini-1.5-pro (High intelligence)</option>
                  <option value="gemini-2.0-flash">gemini-2.0-flash (Newest experimental)</option>
                </Show>
                <Show when={tempType() === "openai"}>
                  <option value="google/gemini-2.5-flash">google/gemini-2.5-flash (OpenRouter Default)</option>
                  <option value="deepseek/deepseek-chat">deepseek/deepseek-chat (DeepSeek V3)</option>
                  <option value="gpt-4o-mini">gpt-4o-mini</option>
                  <option value="meta-llama/llama-3.3-70b-instruct">meta-llama/llama-3.3-70b-instruct</option>
                </Show>
                <Show when={tempType() === "ollama"}>
                  <option value="qwen2.5-coder:1.5b">qwen2.5-coder:1.5b (Lightweight 1.6GB, Recommended)</option>
                  <option value="qwen2.5-coder:7b">qwen2.5-coder:7b (Strong coding 4.7GB)</option>
                  <option value="llama3:8b">llama3:8b (General purpose 4.7GB)</option>
                  <option value="deepseek-coder:1.5b">deepseek-coder:1.5b (1.6GB)</option>
                </Show>
                <option value="custom">Custom model name...</option>
              </select>
            </div>

            <Show when={isCustomModel()}>
              <div style="display: flex; flex-direction: column; gap: 4px;">
                <label style="font-size: 10px; color: var(--text-muted); font-weight: 500;">Custom Model Name</label>
                <input 
                  type="text"
                  placeholder="e.g. qwen2.5-coder:3b"
                  value={customModel()}
                  onInput={(e) => {
                    setCustomModel(e.currentTarget.value);
                    setTempModel(e.currentTarget.value);
                  }}
                  required
                  style="width: 100%; background: var(--bg-input); border: 1px solid var(--border-default); border-radius: var(--radius-sm); color: var(--text-primary); padding: 8px; font-size: var(--font-size-xs);"
                />
              </div>
            </Show>

            <Show when={tempType() === "ollama"}>
              <div style="margin-top: 4px; display: flex; flex-direction: column; gap: 4px;">
                <button
                  type="button"
                  onClick={handleDownloadOllamaModel}
                  disabled={isDownloadingModel()}
                  style="width: 100%; background: rgba(0, 212, 170, 0.15); border: 1px solid var(--accent-primary); color: var(--accent-primary); border-radius: var(--radius-sm); padding: 8px; font-size: var(--font-size-xs); font-weight: 600; cursor: pointer; transition: opacity var(--transition-fast);"
                >
                  {isDownloadingModel() ? "📥 Pulling local model..." : `📥 Download & Verify "${tempModel()}"`}
                </button>
              </div>
            </Show>

            <Show when={tempType() !== "ollama"}>
              <div style="display: flex; flex-direction: column; gap: 4px;">
                <label style="font-size: 10px; color: var(--text-muted); font-weight: 500;">API Key</label>
                <input 
                  type="password"
                  placeholder="sk-... or AIzaSy..."
                  value={tempKey()}
                  onInput={(e) => setTempKey(e.currentTarget.value)}
                  required
                  style="width: 100%; background: var(--bg-input); border: 1px solid var(--border-default); border-radius: var(--radius-sm); color: var(--text-primary); padding: 8px; font-size: var(--font-size-xs);"
                />
              </div>
            </Show>

            <button type="submit" style="background: linear-gradient(135deg, var(--accent-primary), var(--accent-secondary)); color: var(--bg-void); border: none; border-radius: var(--radius-sm); padding: 8px; font-size: var(--font-size-xs); font-weight: 600; cursor: pointer; transition: opacity var(--transition-fast); margin-top: 6px;">
              Save Configuration
            </button>
            
            <Show when={apiKey() !== ""}>
              <div style="display: flex; gap: 8px; margin-top: 4px;">
                <button 
                  type="button"
                  onClick={handleClearKey}
                  style="flex: 1; background: transparent; border: 1px solid var(--border-default); color: var(--accent-red); border-radius: var(--radius-sm); padding: 6px; font-size: var(--font-size-xs); cursor: pointer;"
                >
                  Clear
                </button>
                <button 
                  type="button"
                  onClick={() => setShowConfig(false)}
                  style="flex: 1; background: transparent; border: 1px solid var(--border-default); color: var(--text-secondary); border-radius: var(--radius-sm); padding: 6px; font-size: var(--font-size-xs); cursor: pointer;"
                >
                  Cancel
                </button>
              </div>
            </Show>
          </form>
          
          <a 
            href={tempType() === "gemini" ? "https://aistudio.google.com/app/apikey" : "https://openrouter.ai/keys"} 
            target="_blank" 
            style="color: var(--accent-primary); font-size: 11px; text-decoration: underline; text-align: center; margin-top: 6px;"
          >
            {tempType() === "gemini" ? "Get Gemini API Key" : "Get OpenRouter API Key"}
          </a>
        </div>
      }>
        {/* ── Active Chat View ────────────────────────────────────── */}
        <div class="ai-chat-header" style="display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; border-bottom: 1px solid var(--border-subtle); flex-shrink: 0;">
          <div class="ai-chat-title" style="display: flex; align-items: center; gap: 8px;">
            <span class="ai-status-dot" style="background: var(--accent-primary);"></span>
            <span style="font-weight: 600; font-size: var(--font-size-sm); color: var(--text-primary);">HyperDrive AI</span>
          </div>
          <div style="display: flex; gap: 8px;">
            <button class="ai-icon-btn" onClick={() => setShowHistory(!showHistory())} title="Chat History" style="background: transparent; border: none; cursor: pointer;">📜</button>
            <button class="ai-icon-btn" onClick={openSecretFolder} title="Open Project Secret Folder" style="background: transparent; border: none; cursor: pointer;">🔒</button>
            <button class="ai-icon-btn" onClick={openConfig} title="Configure AI Settings" style="background: transparent; border: none; cursor: pointer;">🔑</button>
            <button class="ai-icon-btn" onClick={() => setMessages([])} title="Clear Current Chat" style="background: transparent; border: none; cursor: pointer;">🗑️</button>
          </div>
        </div>

        <div style="position: relative; flex: 1; display: flex; flex-direction: column; overflow: hidden;">
          {/* History Drawer Overlay & Drawer */}
          <Show when={showHistory()}>
            <div 
              onClick={() => setShowHistory(false)}
              style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0, 0, 0, 0.4); backdrop-filter: blur(2px); z-index: 10; transition: opacity 0.2s ease-in-out;"
            />
            <div 
              style="position: absolute; top: 0; left: 0; bottom: 0; width: 260px; max-width: 85%; background: var(--bg-panel); border-right: 1px solid var(--border-default); z-index: 11; display: flex; flex-direction: column; box-shadow: 4px 0 16px rgba(0,0,0,0.3); animation: slideIn 0.2s ease-out; height: 100%;"
            >
              <div style="padding: 12px; border-bottom: 1px solid var(--border-subtle); display: flex; align-items: center; justify-content: space-between;">
                <span style="font-weight: 600; font-size: var(--font-size-xs); color: var(--text-primary);">Chat History</span>
                <button 
                  onClick={() => setShowHistory(false)}
                  style="background: transparent; border: none; color: var(--text-muted); cursor: pointer; font-size: 14px;"
                >
                  ✕
                </button>
              </div>

              {/* New Chat Button */}
              <div style="padding: 10px;">
                <button 
                  onClick={() => { createNewSession(); setShowHistory(false); }}
                  style="width: 100%; padding: 8px; border-radius: var(--radius-sm); border: 1px dashed var(--accent-primary); background: rgba(0, 212, 170, 0.05); color: var(--accent-primary); font-size: var(--font-size-xs); font-weight: 600; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px; transition: background var(--transition-fast);"
                  class="new-chat-btn"
                >
                  <span>+</span> New Chat
                </button>
              </div>

              {/* Scrollable list of sessions */}
              <div style="flex: 1; overflow-y: auto; padding: 0 8px 8px 8px; display: flex; flex-direction: column; gap: 4px;">
                <For each={sessions()}>
                  {(session) => (
                    <div 
                      onClick={() => selectSession(session.id)}
                      style={{
                        padding: "8px 10px",
                        "border-radius": "var(--radius-sm)",
                        background: session.id === currentSessionId() ? "rgba(0, 212, 170, 0.1)" : "transparent",
                        border: session.id === currentSessionId() ? "1px solid rgba(0, 212, 170, 0.25)" : "1px solid transparent",
                        cursor: "pointer",
                        display: "flex",
                        "align-items": "center",
                        "justify-content": "space-between",
                        gap: "8px",
                        transition: "background var(--transition-fast), border var(--transition-fast)"
                      }}
                      class="history-session-item"
                    >
                      <div style="display: flex; flex-direction: column; gap: 2px; min-width: 0; flex: 1;">
                        <span style={{
                          "font-size": "var(--font-size-xs)",
                          color: session.id === currentSessionId() ? "var(--accent-primary)" : "var(--text-primary)",
                          "font-weight": session.id === currentSessionId() ? "600" : "400",
                          overflow: "hidden",
                          "text-overflow": "ellipsis",
                          "white-space": "nowrap"
                        }}>{session.title}</span>
                        <span style="font-size: 8px; color: var(--text-muted);">
                          {new Date(session.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <button 
                        onClick={(e) => deleteSession(session.id, e)}
                        style="background: transparent; border: none; color: var(--text-muted); cursor: pointer; padding: 2px 4px; font-size: var(--font-size-xs); transition: color 0.2s;"
                        class="delete-session-btn"
                        title="Delete Chat"
                      >
                        🗑️
                      </button>
                    </div>
                  )}
                </For>
              </div>
            </div>
          </Show>

          {/* Message Feed */}
          <div class="ai-messages" style="flex: 1; overflow-y: auto; padding: 14px; display: flex; flex-direction: column; gap: 14px;">
            <For each={messages()}>
              {(msg) => (
                <div class={`ai-msg ${msg.role}`} style={{
                  display: "flex",
                  "flex-direction": "column",
                  gap: "4px",
                  "align-self": msg.role === "user" ? "flex-end" : "flex-start",
                  "max-width": "85%"
                }}>
                  <span class="ai-msg-role" style={{
                    "font-size": "9px",
                    "font-weight": "600",
                    "text-transform": "uppercase",
                    color: msg.role === "user" ? "var(--accent-primary)" : "var(--accent-secondary)",
                    "align-self": msg.role === "user" ? "flex-end" : "flex-start"
                  }}>{msg.role}</span>
                  <div class="ai-msg-body" style={{
                    padding: "10px 12px",
                    "border-radius": "var(--radius-md)",
                    background: msg.role === "user" ? "var(--bg-active)" : "var(--bg-panel)",
                    border: "1px solid var(--border-subtle)",
                    color: "var(--text-primary)",
                    "font-size": "var(--font-size-xs)",
                    "line-height": "1.5",
                    "white-space": "pre-wrap"
                  }}>{msg.content}</div>
                </div>
              )}
            </For>

            {/* Streaming output */}
            <Show when={isGenerating()}>
              <div class="ai-msg assistant" style="display: flex; flex-direction: column; gap: 4px; align-self: flex-start; max-width: 85%;">
                <span class="ai-msg-role" style="font-size: 9px; font-weight: 600; text-transform: uppercase; color: var(--accent-secondary);">assistant</span>
                <div class="ai-msg-body" style="padding: 10px 12px; border-radius: var(--radius-md); background: var(--bg-panel); border: 1px solid var(--border-subtle); color: var(--text-primary); font-size: var(--font-size-xs); line-height: 1.5; white-space: pre-wrap; position: relative;">
                  {streamingText()}
                  <span class="ai-streaming-cursor" style="display: inline-block; width: 6px; height: 12px; background: var(--accent-primary); margin-left: 2px; animation: blink 1s step-end infinite;"></span>
                </div>
              </div>
            </Show>
          </div>

          {/* Real-time Agentic Log */}
          <Show when={agentStatus()}>
            <div style="background: rgba(0, 212, 170, 0.08); border-top: 1px solid rgba(0, 212, 170, 0.15); border-bottom: 1px solid rgba(0, 212, 170, 0.15); color: var(--accent-primary); font-family: var(--font-mono); font-size: 10px; padding: 6px 14px; display: flex; align-items: center; gap: 6px; flex-shrink: 0;">
              <span style="animation: spin 2s linear infinite;">⏳</span>
              <span>{agentStatus()}</span>
            </div>
          </Show>

          {/* Suggestion Chips */}
          <div class="ai-suggestions" style="display: flex; gap: 6px; padding: 6px 14px; overflow-x: auto; flex-shrink: 0; background: var(--bg-panel); border-top: 1px solid var(--border-subtle);">
            <div class="ai-suggestion-chip" onClick={() => applySuggestion("Explain this active code file")} style="white-space: nowrap; font-size: 10px; padding: 4px 8px; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle); cursor: pointer; color: var(--text-secondary);">💡 Explain</div>
            <div class="ai-suggestion-chip" onClick={() => applySuggestion("Optimize this code")} style="white-space: nowrap; font-size: 10px; padding: 4px 8px; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle); cursor: pointer; color: var(--text-secondary);">⚡ Optimize</div>
            <div class="ai-suggestion-chip" onClick={() => applySuggestion("Search the web for ")} style="white-space: nowrap; font-size: 10px; padding: 4px 8px; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle); cursor: pointer; color: var(--text-secondary);">🔍 Web Search</div>
            <div class="ai-suggestion-chip" onClick={() => applySuggestion("Write a unit test for this")} style="white-space: nowrap; font-size: 10px; padding: 4px 8px; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle); cursor: pointer; color: var(--text-secondary);">🧪 Write Tests</div>
          </div>

          {/* Input Area */}
          <form onSubmit={handleSendMessage} class="ai-input-area" style="padding: 10px 14px; border-top: 1px solid var(--border-subtle); background: var(--bg-panel); flex-shrink: 0;">
            <div class="ai-input-row" style="display: flex; gap: 8px; align-items: center;">
              <textarea
                class="ai-textarea"
                placeholder="Ask anything or run rules/workflows..."
                value={inputVal()}
                onInput={(e) => setInputVal(e.currentTarget.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage(e);
                  }
                }}
                style="flex: 1; height: 36px; background: var(--bg-input); border: 1px solid var(--border-default); border-radius: var(--radius-sm); color: var(--text-primary); padding: 8px; font-size: var(--font-size-xs); resize: none; outline: none; line-height: 1.4;"
              />
              <button 
                type="submit" 
                class="ai-send-btn" 
                disabled={isGenerating()}
                style={{
                  width: "36px",
                  height: "36px",
                  background: "linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))",
                  color: "var(--bg-void)",
                  border: "none",
                  "border-radius": "var(--radius-sm)",
                  cursor: "pointer",
                  display: "flex",
                  "align-items": "center",
                  "justify-content": "center",
                  "font-weight": "bold",
                  opacity: isGenerating() ? "0.6" : "1"
                }}
              >
                ➔
              </button>
            </div>
          </form>
        </div>
      </Show>
    </div>
  );
}
