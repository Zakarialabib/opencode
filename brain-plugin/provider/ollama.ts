/**
 * Ollama Provider for Brain Plugin
 * 
 * Provides an alternative to LM Studio for running local LLMs.
 * Uses Ollama's REST API for chat completions and embeddings.
 * 
 * Ollama API endpoints:
 * - GET  /api/tags         - List models
 * - POST /api/generate     - Generate text
 * - POST /api/chat         - Chat completions
 * - POST /api/embeddings   - Get embeddings
 * - POST /api/pull         - Pull/download a model
 * - DELETE /api/delete     - Delete a model
 * - POST /api/show         - Show model info
 */

export const OLLAMA_DEFAULT_BASE_URL = "http://localhost:11434";
export const OLLAMA_DEFAULT_CHAT_MODEL = "qwen3:4b";
export const OLLAMA_DEFAULT_EMBED_MODEL = "nomic-embed-text";

export interface OllamaModelInfo {
  name: string;
  model: string;
  modified_at: string;
  size: number;
  digest: string;
  details: {
    parent_model: string;
    format: string;
    family: string;
    families: string[];
    parameter_size: string;
    quantization_level: string;
  };
}

export interface OllamaEmbeddingResponse {
  model: string;
  embeddings: number[][];
}

export interface OllamaChatResponse {
  model: string;
  created_at: string;
  message: {
    role: string;
    content: string;
  };
  done: boolean;
}

export class OllamaProvider {
  name = "ollama";
  baseURL: string;
  defaultChatModel = OLLAMA_DEFAULT_CHAT_MODEL;
  defaultEmbedModel = OLLAMA_DEFAULT_EMBED_MODEL;

  constructor(baseURL?: string) {
    this.baseURL = baseURL ?? OLLAMA_DEFAULT_BASE_URL;
  }

  setBaseURL(url: string): void {
    this.baseURL = url.replace(/\/+$/, "");
    console.log(`[Ollama] Client configured for: ${this.baseURL}`);
  }

  /**
   * Check if Ollama server is reachable
   */
  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseURL}/api/tags`, {
        method: "GET",
        signal: AbortSignal.timeout(5000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * List all downloaded models
   */
  async listModels(): Promise<OllamaModelInfo[]> {
    try {
      const response = await fetch(`${this.baseURL}/api/tags`, {
        method: "GET",
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) return [];
      const json = (await response.json()) as any;
      return Array.isArray(json?.models) ? json.models : [];
    } catch {
      return [];
    }
  }

  /**
   * Get model names only
   */
  async listModelNames(): Promise<string[]> {
    const models = await this.listModels();
    return models.map((m) => m.name);
  }

  /**
   * Check if a specific model is available locally
   */
  async isModelAvailable(modelId: string): Promise<boolean> {
    const models = await this.listModelNames();
    return models.some(
      (name) => name === modelId || name.startsWith(modelId.split(":")[0])
    );
  }

  /**
   * Show model details
   */
  async showModel(modelId: string): Promise<any> {
    try {
      const response = await fetch(`${this.baseURL}/api/show`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: modelId }),
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) return null;
      return await response.json();
    } catch {
      return null;
    }
  }

  /**
   * Pull/download a model from Ollama registry
   */
  async pullModel(modelId: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseURL}/api/pull`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: modelId, stream: false }),
        signal: AbortSignal.timeout(600000), // 10 min timeout for large models
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Delete a model from local storage
   */
  async deleteModel(modelId: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseURL}/api/delete`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: modelId }),
        signal: AbortSignal.timeout(30000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Generate embeddings using Ollama
   */
  async embed(modelId: string, texts: string[]): Promise<number[][]> {
    const effectiveModelId = modelId || this.defaultEmbedModel;
    
    try {
      // Ollama embeddings API - one at a time for reliability
      const embeddings: number[][] = [];
      for (const text of texts) {
        const response = await fetch(`${this.baseURL}/api/embeddings`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: effectiveModelId,
            prompt: text,
          }),
          signal: AbortSignal.timeout(30000),
        });
        
        if (!response.ok) {
          throw new Error(`Ollama embedding failed: ${response.statusText}`);
        }
        
        const json = (await response.json()) as any;
        if (json?.embedding && Array.isArray(json.embedding)) {
          embeddings.push(json.embedding);
        } else {
          throw new Error("Invalid embedding response from Ollama");
        }
      }
      
      return embeddings;
    } catch (error: any) {
      console.error(`[Ollama] Embedding failed:`, error.message);
      throw error;
    }
  }

  /**
   * Chat completion using Ollama
   */
  async chat(
    modelId: string,
    messages: Array<{ role: string; content: string }>,
    options?: {
      temperature?: number;
      topP?: number;
      maxTokens?: number;
    }
  ): Promise<string> {
    const effectiveModelId = modelId || this.defaultChatModel;

    try {
      const response = await fetch(`${this.baseURL}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: effectiveModelId,
          messages,
          stream: false,
          options: {
            temperature: options?.temperature ?? 0.7,
            top_p: options?.topP ?? 0.9,
            num_predict: options?.maxTokens ?? 4096,
          },
        }),
        signal: AbortSignal.timeout(120000),
      });

      if (!response.ok) {
        throw new Error(`Ollama chat failed: ${response.statusText}`);
      }

      const json = (await response.json()) as OllamaChatResponse;
      return json.message?.content ?? "";
    } catch (error: any) {
      console.error(`[Ollama] Chat failed:`, error.message);
      throw error;
    }
  }

  /**
   * Classify models by type (chat, embedding, etc.)
   */
  classifyModels(
    models: OllamaModelInfo[]
  ): { chat: OllamaModelInfo[]; embed: OllamaModelInfo[] } {
    const embed: OllamaModelInfo[] = [];
    const chat: OllamaModelInfo[] = [];

    for (const model of models) {
      const name = model.name.toLowerCase();
      const family = model.details?.family?.toLowerCase() ?? "";
      
      if (
        name.includes("embed") ||
        name.includes("nomic-embed") ||
        name.includes("mxbai-embed") ||
        family.includes("nomic-embed") ||
        family.includes("bert")
      ) {
        embed.push(model);
      } else {
        chat.push(model);
      }
    }

    return { chat, embed };
  }
}

export const defaultOllamaProvider = new OllamaProvider();
