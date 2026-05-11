export const LM_STUDIO_API = "http://192.168.1.12:1234/api/v1";
export const LM_STUDIO_V1 = "http://192.168.1.12:1234/v1";
export const DEFAULT_EMBED_MODEL = "text-embedding-qwen3-embedding-0.6b";
export const DEFAULT_CHAT_MODEL = "qwen3.5-4b-claude-4.6-opus-reasoning-distilled-v2";
export const DEFAULT_DRAFT_MODEL = "qwen3.5-0.8b-claude-4.6-opus-reasoning-distilled-v2";

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
  chatWithSpeculative(modelId: string, draftModelId: string, messages: any[], opts?: ChatOptions): Promise<{ content: string; usage?: any }>;
}

export class LMStudioProvider implements CustomProvider {
  name = "lmstudio";
  baseURL = LM_STUDIO_V1;
  apiURL = LM_STUDIO_API;

  async load(modelId: string, opts?: LoadOptions): Promise<ModelHandle> {
    const isEmbedding = modelId.includes("embedding") || modelId.includes("embed");

    const body: any = {
      model: modelId,
      context_length: opts?.contextLength ?? 2048,
      echo_load_config: true,
    };

    if (!isEmbedding) {
      body.flash_attention = opts?.flashAttention ?? true;
      body.offload_kv_cache_to_gpu = opts?.offloadKVCache ?? true;
      if (opts?.contextLength) body.context_length = opts.contextLength;
    }

    try {
      const res = await fetch(`${this.apiURL}/models/load`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        throw new Error(`Failed to load model: ${res.statusText}`);
      }

      const data = await res.json();
      return {
        id: crypto.randomUUID(),
        instanceId: data.instance_id,
        modelId,
        loadedAt: Date.now(),
        config: data.load_config,
      };
    } catch (error) {
      console.error(`[LMStudioProvider] Failed to load ${modelId}:`, error);
      return {
        id: crypto.randomUUID(),
        modelId,
        loadedAt: Date.now(),
      };
    }
  }

  async unload(handle: ModelHandle): Promise<void> {
    if (!handle.instanceId) return;

    try {
      await fetch(`${this.apiURL}/models/unload`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instance_id: handle.instanceId }),
      });
    } catch (error) {
      console.error(`[LMStudioProvider] Failed to unload ${handle.modelId}:`, error);
    }
  }

  async embed(modelId: string, texts: string[]): Promise<number[][]> {
    const res = await fetch(`${this.baseURL}/embeddings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: modelId || DEFAULT_EMBED_MODEL,
        input: texts.map((t) => t.replace(/\n/g, " ")),
      }),
    });

    if (!res.ok) {
      throw new Error(`Embedding failed: ${res.statusText}`);
    }

    const data = await res.json();
    return data.data.map((d: any) => d.embedding);
  }

  async chat(modelId: string, messages: any[], opts?: ChatOptions): Promise<string> {
    const chatOptions: any = {
      model: modelId,
      messages,
      max_tokens: opts?.maxTokens ?? 4096,
      temperature: opts?.temperature ?? 0.7,
    };

    if (opts?.topP !== undefined) chatOptions.top_p = opts.topP;
    if (opts?.topK !== undefined) chatOptions.top_k = opts.topK;
    if (opts?.repeatPenalty !== undefined) chatOptions.repeat_penalty = opts.repeatPenalty;
    if (opts?.seed !== undefined) chatOptions.seed = opts.seed;

    const res = await fetch(`${this.baseURL}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(chatOptions),
    });

    if (!res.ok) {
      throw new Error(`Chat failed: ${res.statusText}`);
    }

    const data = await res.json();
    return data.choices?.[0]?.message?.content || "";
  }

  async chatWithSpeculative(
    modelId: string,
    draftModelId: string,
    messages: any[],
    opts?: ChatOptions
  ): Promise<{ content: string; usage?: any }> {
    const chatOptions: any = {
      model: modelId,
      messages,
      max_tokens: opts?.maxTokens ?? 4096,
      temperature: opts?.temperature ?? 0.7,
      draft_model: draftModelId,
    };

    const res = await fetch(`${this.baseURL}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(chatOptions),
    });

    if (!res.ok) {
      throw new Error(`Speculative chat failed: ${res.statusText}`);
    }

    const data = await res.json();
    return {
      content: data.choices?.[0]?.message?.content || "",
      usage: data.usage,
    };
  }
}

export const defaultProvider = new LMStudioProvider();
