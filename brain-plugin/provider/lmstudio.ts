import { LMStudioClient } from "@lmstudio/sdk";

export const DEFAULT_EMBED_MODEL = "nomic-embed-text-v1.5";
export const DEFAULT_CHAT_MODEL = "qwen/qwen3-4b-2507";
export const DEFAULT_DRAFT_MODEL = "qwen/qwen3-0.8b-2507";

// Meta-Harness required models (loaded in order: embeddings first, reranker, chat last)
export const META_HARNESS_MODELS = {
  embedModel: "text-embedding-qwen3-embedding-0.6b",
  rerankerModel: "qwen3-reranker-0.6b",
  chatModel: "qwen3.5-4b-claude-4.6-opus-reasoning-distilled-v2",
} as const;

// GPU-aware model configurations for M4400 (4GB VRAM, 16GB RAM)
export const GPU_AWARE_MODELS = {
  // Embedding: small, keep loaded (0.8GB VRAM)
  embed: "text-embedding-qwen3-embedding-0.6b",

  // Reranker: medium, load on-demand (1.5GB VRAM)
  reranker: "qwen3-reranker-0.6b",

  // Chat: larger model, load when needed (2.6GB VRAM)
  chat: "qwen3.5-4b-claude-4.6-opus-reasoning-distilled-v2",

  // Alternative light chat for minimal VRAM usage (1GB VRAM)
  chatLight: "qwen3.5-0.8b-claude-4.6-opus-reasoning-distilled",
} as const;

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

export interface ModelLoadStatus {
  modelId: string;
  loaded: boolean;
  loading: boolean;
  error?: string;
  vramUsageGB?: number;
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

// VRAM estimates for GPU-aware loading (M4400 4GB constraint)
const VRAM_ESTIMATES: Record<string, number> = {
  "text-embedding-qwen3-embedding-0.6b": 0.8,
  "text-embedding-nomic-embed-text-v1.5": 1.2,
  "qwen3-reranker-0.6b": 1.5,
  "qwen3.5-4b-claude-4.6-opus-reasoning-distilled-v2": 2.6,
  "qwen3.5-0.8b-claude-4.6-opus-reasoning-distilled": 1.0,
  "qwen3-4b-2507": 2.4,
};

const MAX_VRAM_GB = 5.5; // Leave headroom on 4GB M4400

export class LMStudioProvider implements CustomProvider {
  name = "lmstudio";
  baseURL = "";
  defaultEmbedModel = DEFAULT_EMBED_MODEL;
  defaultChatModel = DEFAULT_CHAT_MODEL;
  defaultDraftModel = DEFAULT_DRAFT_MODEL;
  private client: LMStudioClient;
  private embedModelHandle: any = null;
  private llmHandle: any = null;
  private rerankerHandle: any = null;

  // Track loading state
  private modelLoadStatus: Map<string, ModelLoadStatus> = new Map();
  private loadedVRAMGB = 0;

  constructor() {
    this.client = new LMStudioClient();
  }

  setBaseURL(url: string): void {
    // SDK requires ws:// or wss:// protocol
    let baseUrl = url
      .replace(/\/v1\/?$/, "")
      .replace(/^http:/, "ws:")
      .replace(/^https:/, "wss:");
    this.baseURL = baseUrl;
    console.log(`[LMStudio] Client configured for: ${this.baseURL}`);
    this.client = new LMStudioClient({ baseUrl: this.baseURL });
  }

  /**
   * Get current VRAM usage estimate
   */
  getCurrentVRAMUsage(): number {
    return this.loadedVRAMGB;
  }

  /**
   * Check if we can load a model within VRAM budget
   */
  canLoadModel(modelId: string): boolean {
    const estimate = VRAM_ESTIMATES[modelId] || 2.0; // Default 2GB estimate
    return this.loadedVRAMGB + estimate <= MAX_VRAM_GB;
  }

  /**
   * Get models to evict to make room for new model
   */
  private getModelsToEvict(newModelId: string): string[] {
    const needed = (VRAM_ESTIMATES[newModelId] || 2.0) - (MAX_VRAM_GB - this.loadedVRAMGB);
    if (needed <= 0) return [];

    // Don't evict embedding model (critical for RAG)
    const loaded = this.getLoadedModelIds();
    const candidates = loaded.filter((id) => !id.includes("embedding") && !id.includes("embed"));

    // Sort by VRAM usage descending
    candidates.sort((a, b) => (VRAM_ESTIMATES[b] || 2) - (VRAM_ESTIMATES[a] || 2));

    const toEvict: string[] = [];
    let freed = 0;
    for (const id of candidates) {
      toEvict.push(id);
      freed += VRAM_ESTIMATES[id] || 2;
      if (freed >= needed) break;
    }
    return toEvict;
  }

  private getLoadedModelIds(): string[] {
    const ids: string[] = [];
    if (this.embedModelHandle) ids.push("embed");
    if (this.llmHandle) ids.push("llm");
    if (this.rerankerHandle) ids.push("reranker");
    return ids;
  }

  async load(modelId: string, opts?: LoadOptions): Promise<ModelHandle> {
    const isEmbedding = modelId.includes("embedding") || modelId.includes("embed");

    this.modelLoadStatus.set(modelId, { modelId, loaded: false, loading: true });

    try {
      // Check VRAM budget for non-embedding models
      if (!isEmbedding && !this.canLoadModel(modelId)) {
        const toEvict = this.getModelsToEvict(modelId);
        console.log(`[LMStudio] VRAM budget exceeded. Evicting: ${toEvict.join(", ")}`);
        for (const id of toEvict) {
          await this.evictModel(id);
        }
      }

      console.log(
        `[LMStudio] Loading: ${modelId} (VRAM: ${this.loadedVRAMGB.toFixed(1)}/${MAX_VRAM_GB}GB)`
      );

      if (isEmbedding) {
        // Evict existing embedding if needed
        if (this.embedModelHandle) {
          await this.embedModelHandle.unload().catch(() => {});
          this.embedModelHandle = null;
        }
        this.embedModelHandle = await this.client.embedding.model(modelId);
        this.loadedVRAMGB += VRAM_ESTIMATES[modelId] || 0.8;
      } else if (modelId.includes("reranker")) {
        // Reranker loaded as LLM
        if (this.rerankerHandle) {
          await this.rerankerHandle.unload().catch(() => {});
        }
        this.rerankerHandle = await this.client.llm.model(modelId);
        this.loadedVRAMGB += VRAM_ESTIMATES[modelId] || 1.5;
      } else {
        // Main chat model
        if (this.llmHandle) {
          await this.llmHandle.unload().catch(() => {});
          this.llmHandle = null;
        }
        this.llmHandle = await this.client.llm.model(modelId);
        this.loadedVRAMGB += VRAM_ESTIMATES[modelId] || 2.6;
      }

      this.modelLoadStatus.set(modelId, {
        modelId,
        loaded: true,
        loading: false,
        vramUsageGB: VRAM_ESTIMATES[modelId],
      });
      console.log(`[LMStudio] ✓ Loaded: ${modelId} (VRAM: ${this.loadedVRAMGB.toFixed(1)}GB)`);

      return { id: crypto.randomUUID(), modelId, loadedAt: Date.now() };
    } catch (error: any) {
      console.error(`[LMStudio] Load failed ${modelId}: ${error.message}`);
      this.modelLoadStatus.set(modelId, {
        modelId,
        loaded: false,
        loading: false,
        error: error.message,
      });
      return { id: crypto.randomUUID(), modelId, loadedAt: Date.now() };
    }
  }

  /**
   * Evict a specific model to free VRAM
   */
  async evictModel(modelId: string): Promise<void> {
    const wasLoaded = this.loadedVRAMGB;
    const estimate = VRAM_ESTIMATES[modelId] || 2.0;

    if (modelId.includes("embed") && this.embedModelHandle) {
      await this.embedModelHandle.unload().catch(() => {});
      this.embedModelHandle = null;
      this.loadedVRAMGB -= estimate;
    } else if (modelId.includes("reranker") && this.rerankerHandle) {
      await this.rerankerHandle.unload().catch(() => {});
      this.rerankerHandle = null;
      this.loadedVRAMGB -= estimate;
    } else if (this.llmHandle) {
      await this.llmHandle.unload().catch(() => {});
      this.llmHandle = null;
      this.loadedVRAMGB -= estimate;
    }

    console.log(
      `[LMStudio] Evicted ${modelId}, freed ${(wasLoaded - this.loadedVRAMGB).toFixed(1)}GB VRAM`
    );
  }

  /**
   * Load embedding model (critical for RAG, keep loaded)
   */
  async loadEmbeddingModel(modelId?: string): Promise<ModelHandle> {
    const embedModel = modelId || GPU_AWARE_MODELS.embed;
    console.log(`[LMStudio] Loading embedding model (keep loaded): ${embedModel}`);
    return this.load(embedModel);
  }

  /**
   * Load reranker model (on-demand for RAG)
   */
  async loadRerankerModel(modelId?: string): Promise<ModelHandle> {
    const rerankModel = modelId || GPU_AWARE_MODELS.reranker;
    console.log(`[LMStudio] Loading reranker (on-demand): ${rerankModel}`);
    return this.load(rerankModel);
  }

  /**
   * Load chat model (on-demand for proposals)
   */
  async loadChatModel(modelId?: string): Promise<ModelHandle> {
    const chatModel = modelId || GPU_AWARE_MODELS.chat;
    console.log(`[LMStudio] Loading chat model (on-demand): ${chatModel}`);
    return this.load(chatModel);
  }

  /**
   * Load small chat model for minimal VRAM
   */
  async loadLightChatModel(): Promise<ModelHandle> {
    console.log(`[LMStudio] Loading light chat model: ${GPU_AWARE_MODELS.chatLight}`);
    return this.load(GPU_AWARE_MODELS.chatLight);
  }

  /**
   * GPU-aware loading: Load models respecting VRAM budget
   * Order: 1. Embedding (critical, keep), 2. Reranker (evictable), 3. Chat (evictable)
   */
  async loadForRAG(): Promise<{ embed: ModelHandle; reranker?: ModelHandle }> {
    console.log("[LMStudio] Loading models for RAG (VRAM budget: 5.5GB max)...");

    const embed = await this.loadEmbeddingModel();

    // Only load reranker if we have VRAM headroom
    let reranker: ModelHandle | undefined;
    if (this.canLoadModel(GPU_AWARE_MODELS.reranker)) {
      reranker = await this.loadRerankerModel();
    } else {
      console.log("[LMStudio] Skipping reranker (VRAM budget)");
    }

    return { embed, reranker };
  }

  /**
   * Load chat model for meta-harness (evicts reranker if needed)
   */
  async loadForMetaHarness(): Promise<ModelHandle> {
    console.log("[LMStudio] Loading chat for meta-harness...");

    // Evict reranker if we need VRAM for chat
    if (!this.canLoadModel(GPU_AWARE_MODELS.chat) && this.rerankerHandle) {
      console.log("[LMStudio] Evicting reranker for chat model");
      await this.evictModel(GPU_AWARE_MODELS.reranker);
    }

    return this.loadChatModel();
  }

  /**
   * Unload all non-critical models (keep embedding)
   */
  async unloadNonCritical(): Promise<void> {
    console.log("[LMStudio] Unloading non-critical models (keeping embedding)...");

    if (this.rerankerHandle) {
      await this.evictModel(GPU_AWARE_MODELS.reranker);
    }
    if (this.llmHandle) {
      await this.evictModel(GPU_AWARE_MODELS.chat);
    }
  }

  async isModelLoaded(modelId: string): Promise<boolean> {
    try {
      const loaded = await this.getLoadedModels();
      return loaded.some((m) => m.includes(modelId) || modelId.includes(m));
    } catch {
      return false;
    }
  }

  async waitForModel(modelId: string, timeoutMs: number = 60000): Promise<boolean> {
    const startTime = Date.now();
    while (Date.now() - startTime < timeoutMs) {
      if (await this.isModelLoaded(modelId)) return true;
      const status = this.modelLoadStatus.get(modelId);
      if (status?.loaded) return true;
      if (status?.error) return false;
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    return false;
  }

  async listDownloadedModels(type: "llm" | "embedding" = "llm"): Promise<string[]> {
    try {
      // Note: listDownloadedModels is not directly available in current SDK version
      // Fall back to listing loaded models only
      const loaded = await this.getLoadedModels();
      return loaded;
    } catch (error) {
      console.error(`[LMStudio] Failed to list ${type} models:`, error);
      return [];
    }
  }

  async unload(handle: ModelHandle): Promise<void> {
    await this.evictModel(handle.modelId);
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
      console.error(`[LMStudio] Speculative failed:`, error);
      return { content: "" };
    }
  }

  async getLoadedModels(): Promise<string[]> {
    try {
      const models = await this.client.llm.listLoaded();
      return models.map((m: any) => m.modelKey);
    } catch {
      return [];
    }
  }

  async getModelLoadStatus(): Promise<Map<string, ModelLoadStatus>> {
    try {
      const loaded = await this.getLoadedModels();
      for (const modelId of loaded) {
        const existing = this.modelLoadStatus.get(modelId);
        if (!existing?.loaded) {
          this.modelLoadStatus.set(modelId, {
            modelId,
            loaded: true,
            loading: false,
            vramUsageGB: VRAM_ESTIMATES[modelId],
          });
        }
      }
    } catch {}
    return this.modelLoadStatus;
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
