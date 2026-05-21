/**
 * GPU-Aware Model Loading Configuration
 *
 * Optimized for systems with limited VRAM:
 * - NVIDIA M4400 (4GB GDDR5 VRAM)
 * - 16GB System RAM
 * - Target: Don't exceed 6GB VRAM total
 */

export const GPU_CONFIG = {
  // VRAM budget (leave headroom for system)
  maxVRAMUsageGB: 5.5,
  offloadWhenIdle: true,

  // Per-model VRAM estimates (approximate, Q8_0 quantization)
  modelVRAMEstimates: {
    // Embedding models (small, keep loaded)
    "text-embedding-qwen3-embedding-0.6b": { vramGB: 0.8, minRAM: 1, keepLoaded: true },
    "text-embedding-nomic-embed-text-v1.5": { vramGB: 1.2, minRAM: 2, keepLoaded: true },
    "nomic-embed-text-v1.5": { vramGB: 1.2, minRAM: 2, keepLoaded: true },

    // Reranker models (medium, load on-demand)
    "qwen3-reranker-0.6b": { vramGB: 1.5, minRAM: 2, keepLoaded: false },

    // Chat models (large, load only when needed)
    "qwen3.5-4b-claude-4.6-opus-reasoning-distilled-v2": {
      vramGB: 2.6,
      minRAM: 4,
      keepLoaded: false,
    },
    "qwen3-4b-2507": { vramGB: 2.4, minRAM: 4, keepLoaded: false },
    "qwen3.5-0.8b-claude-4.6-opus-reasoning-distilled": {
      vramGB: 1.0,
      minRAM: 2,
      keepLoaded: false,
    },
    "gemma-4-e2b-it": { vramGB: 2.4, minRAM: 4, keepLoaded: false },
    "gemma-4-e4b-it": { vramGB: 4.8, minRAM: 8, keepLoaded: false }, // May be too large
  },

  // Loading order (embed first, then reranker, chat last)
  loadingOrder: [
    "text-embedding-qwen3-embedding-0.6b", // Load first, keep loaded
    "qwen3-reranker-0.6b", // Load second, can evict
    "qwen3.5-4b-claude-4.6-opus-reasoning-distilled-v2", // Load last, evict others if needed
  ],

  // Model presets for different use cases
  presets: {
    // Minimal RAG (embedding only for search)
    ragMinimal: {
      models: ["text-embedding-qwen3-embedding-0.6b"],
      maxVRAM: 1.5,
      description: "Search only - no reranking or chat",
    },

    // Full RAG with reranking
    ragFull: {
      models: ["text-embedding-qwen3-embedding-0.6b", "qwen3-reranker-0.6b"],
      maxVRAM: 3.0,
      description: "Search + reranking, no chat",
    },

    // RAG + Light chat (small model)
    ragWithLightChat: {
      models: [
        "text-embedding-qwen3-embedding-0.6b",
        "qwen3.5-0.8b-claude-4.6-opus-reasoning-distilled",
      ],
      maxVRAM: 3.5,
      description: "Search + light chat model",
    },

    // Full pipeline (all models, conservative)
    fullPipeline: {
      models: [
        "text-embedding-qwen3-embedding-0.6b",
        "qwen3-reranker-0.6b",
        "qwen3.5-4b-claude-4.6-opus-reasoning-distilled-v2",
      ],
      maxVRAM: 5.5,
      description: "Full pipeline with reasoning model",
    },
  },
} as const;

export interface ModelLoadRequest {
  modelId: string;
  priority: "critical" | "high" | "normal" | "low";
  canEvict: boolean;
  maxVRAMGB: number;
}

/**
 * Calculate current VRAM usage estimate
 */
export function estimateCurrentVRAM(loadedModels: string[]): number {
  let total = 0;
  for (const modelId of loadedModels) {
    const estimate =
      GPU_CONFIG.modelVRAMEstimates[modelId as keyof typeof GPU_CONFIG.modelVRAMEstimates];
    if (estimate) {
      total += estimate.vramGB;
    }
  }
  return total;
}

/**
 * Check if a model can be loaded given VRAM constraints
 */
export function canLoadModel(modelId: string, currentlyLoaded: string[]): boolean {
  const estimate =
    GPU_CONFIG.modelVRAMEstimates[modelId as keyof typeof GPU_CONFIG.modelVRAMEstimates];
  if (!estimate) return true; // Unknown model, assume OK

  const currentUsage = estimateCurrentVRAM(currentlyLoaded);
  return currentUsage + estimate.vramGB <= GPU_CONFIG.maxVRAMUsageGB;
}

/**
 * Get models to evict to make room for a new model
 */
export function getModelsToEvict(newModelId: string, currentlyLoaded: string[]): string[] {
  const estimate =
    GPU_CONFIG.modelVRAMEstimates[newModelId as keyof typeof GPU_CONFIG.modelVRAMEstimates];
  if (!estimate) return [];

  const currentUsage = estimateCurrentVRAM(currentlyLoaded);
  const needed = estimate.vramGB - (GPU_CONFIG.maxVRAMUsageGB - currentUsage);

  if (needed <= 0) return [];

  // Find models that can be evicted (not marked as keepLoaded)
  const toEvict: string[] = [];
  let freedSpace = 0;

  for (const modelId of currentlyLoaded) {
    const modelEstimate =
      GPU_CONFIG.modelVRAMEstimates[modelId as keyof typeof GPU_CONFIG.modelVRAMEstimates];
    if (modelEstimate && !modelEstimate.keepLoaded) {
      toEvict.push(modelId);
      freedSpace += modelEstimate.vramGB;
      if (freedSpace >= needed) break;
    }
  }

  return toEvict;
}
