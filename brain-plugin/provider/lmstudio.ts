import { LMStudioClient } from "@lmstudio/sdk";

export const DEFAULT_EMBED_MODEL = "nomic-embed-text-v1.5";
export const DEFAULT_CHAT_MODEL = "qwen/qwen3-4b-2507";
export const DEFAULT_DRAFT_MODEL = "qwen/qwen3-0.8b-2507";

export interface LoadOptions {
  contextLength?: number;
  flashAttention?: boolean;
  gpuLayers?: number;
  offloadKVCache?: boolean;
  draftModel?: string;
}

export interface ChatOptions {
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  topK?: number;
  repeatPenalty?: number;
  seed?: number;
}

export interface ModelHandle {
  id: string;
  instanceId?: string;
  modelId: string;
  loadedAt: number;
  config?: any;
}

export interface CustomProvider {
  name: string;
  baseURL: string;
  load(modelId: string, opts?: LoadOptions): Promise<ModelHandle>;
  unload(handle: ModelHandle): Promise<void>;
  embed(modelId: string, texts: string[]): Promise<number[][]>;
  chat(modelId: string, messages: any[], opts?: ChatOptions): Promise<string>;
  chatWithSpeculative(
    modelId: string,
    draftModelId: string,
    messages: any[],
    opts?: ChatOptions
  ): Promise<{ content: string; usage?: any }>;
}

export class LMStudioProvider implements CustomProvider {
  name = "lmstudio";
  baseURL = "";
  defaultEmbedModel = DEFAULT_EMBED_MODEL;
  defaultChatModel = DEFAULT_CHAT_MODEL;
  defaultDraftModel = DEFAULT_DRAFT_MODEL;
  private client: LMStudioClient;
  private embedModelHandle: any = null;
  private llmHandle: any = null;

  constructor() {
    this.client = new LMStudioClient();
  }

  setBaseURL(url: string): void {
    this.baseURL = url.replace(/\/v1\/?$/, "");
    console.log(`[LMStudio] Dynamically configuring client SDK target baseURL: "${this.baseURL}"`);
    this.client = new LMStudioClient({ baseUrl: this.baseURL });
  }

  async load(modelId: string, opts?: LoadOptions): Promise<ModelHandle> {
    const isEmbedding = modelId.includes("embedding") || modelId.includes("embed");
    try {
      if (isEmbedding) {
        this.embedModelHandle = await this.client.embedding.model(modelId);
      } else {
        this.llmHandle = await this.client.llm.model(modelId);
      }
      return { id: crypto.randomUUID(), modelId, loadedAt: Date.now() };
    } catch (error) {
      console.error(`[LMStudio] Failed to load ${modelId}:`, error);
      return { id: crypto.randomUUID(), modelId, loadedAt: Date.now() };
    }
  }

  async unload(handle: ModelHandle): Promise<void> {
    try {
      if (this.embedModelHandle && handle.modelId.includes("embed")) {
        await this.embedModelHandle.unload();
        this.embedModelHandle = null;
      } else if (this.llmHandle) {
        await this.llmHandle.unload();
        this.llmHandle = null;
      }
    } catch (error) {
      console.error(`[LMStudio] Failed to unload ${handle.modelId}:`, error);
    }
  }

  async embed(modelId: string, texts: string[]): Promise<number[][]> {
    try {
      if (!this.embedModelHandle) {
        this.embedModelHandle = await this.client.embedding.model(modelId || DEFAULT_EMBED_MODEL);
      }
      const results =
        texts.length === 1
          ? [await this.embedModelHandle.embed(texts[0])]
          : await this.embedModelHandle.embed(texts);
      return results.map((r: any) => r.embedding);
    } catch (error) {
      console.error(`[LMStudio] Embedding failed:`, error);
      throw error;
    }
  }

  async chat(modelId: string, messages: any[], opts?: ChatOptions): Promise<string> {
    try {
      if (!this.llmHandle) {
        this.llmHandle = await this.client.llm.model(modelId || DEFAULT_CHAT_MODEL);
      }
      const result = await this.llmHandle.respond(messages, {
        maxTokens: opts?.maxTokens ?? 4096,
        temperature: opts?.temperature ?? 0.7,
      });
      return result.content;
    } catch (error) {
      console.error(`[LMStudio] Chat failed:`, error);
      throw error;
    }
  }

  async chatWithSpeculative(
    modelId: string,
    draftModelId: string,
    messages: any[],
    opts?: ChatOptions
  ): Promise<{ content: string; usage?: any }> {
    try {
      if (!this.llmHandle) {
        this.llmHandle = await this.client.llm.model(modelId || DEFAULT_CHAT_MODEL);
      }
      const result = await this.llmHandle.respond(messages, {
        maxTokens: opts?.maxTokens ?? 4096,
        temperature: opts?.temperature ?? 0.7,
        draftModel: draftModelId || DEFAULT_DRAFT_MODEL,
      });
      return { content: result.content, usage: result.stats };
    } catch (error) {
      console.error(`[LMStudio] Speculative chat failed:`, error);
      return { content: "" };
    }
  }

  async getLoadedModels(): Promise<string[]> {
    try {
      const models = await this.client.llm.listLoaded();
      return models.map((m: any) => m.modelKey);
    } catch {
      try {
        const downloaded = await this.client.system.listDownloadedModels("llm");
        return downloaded.map((m: any) => m.modelKey || m.path);
      } catch {
        return [];
      }
    }
  }

  async getContextLength(): Promise<number> {
    try {
      if (!this.llmHandle) return 4096;
      return typeof this.llmHandle.getContextLength === "function"
        ? await this.llmHandle.getContextLength()
        : 4096;
    } catch {
      return 4096;
    }
  }

  async getEmbeddingModelInfo(): Promise<{ maxContextLength: number; evalBatchSize: number }> {
    try {
      if (!this.embedModelHandle) return { maxContextLength: 4096, evalBatchSize: 64 };
      const [ctxLen, batchSize] = await Promise.all([
        this.embedModelHandle.getContextLength(),
        this.embedModelHandle.getEvalBatchSize(),
      ]);
      return { maxContextLength: ctxLen, evalBatchSize: batchSize };
    } catch {
      return { maxContextLength: 4096, evalBatchSize: 64 };
    }
  }
}

export const defaultProvider = new LMStudioProvider();
