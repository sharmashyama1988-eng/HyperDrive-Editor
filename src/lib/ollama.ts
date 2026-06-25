export interface OllamaMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface OllamaProgress {
  status: string;
  completed?: number;
  total?: number;
}

export class OllamaClient {
  private baseUrl: string;

  constructor(baseUrl: string = "http://127.0.0.1:11434") {
    this.baseUrl = baseUrl;
  }

  public async checkConnection(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`);
      return response.ok;
    } catch {
      return false;
    }
  }

  public async listModels(): Promise<string[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`);
      if (!response.ok) return [];
      const data = await response.json();
      return (data.models || []).map((m: any) => m.name);
    } catch {
      return [];
    }
  }

  public async pullModel(modelName: string, onProgress: (progress: OllamaProgress) => void): Promise<void> {
    const response = await fetch(`${this.baseUrl}/api/pull`, {
      method: "POST",
      body: JSON.stringify({ name: modelName, stream: true }),
      headers: { "Content-Type": "application/json" }
    });

    if (!response.ok) {
      throw new Error(`Failed to pull model: ${response.statusText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) return;

    const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split("\n");
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const parsed = JSON.parse(line);
          onProgress({
            status: parsed.status,
            completed: parsed.completed,
            total: parsed.total
          });
        } catch {}
      }
    }
  }

  public async chatStream(
    modelName: string,
    messages: OllamaMessage[],
    onToken: (token: string) => void,
    signal?: AbortSignal
  ): Promise<string> {
    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: "POST",
      body: JSON.stringify({ model: modelName, messages, stream: true }),
      headers: { "Content-Type": "application/json" },
      signal
    });

    if (!response.ok) {
      throw new Error(`Ollama Chat Error: ${response.statusText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) return "";

    const decoder = new TextDecoder();
    let fullResponse = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split("\n");
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const parsed = JSON.parse(line);
          if (parsed.message?.content) {
            const token = parsed.message.content;
            fullResponse += token;
            onToken(token);
          }
        } catch {}
      }
    }

    return fullResponse;
  }
}
