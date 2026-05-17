import type { BrainHarnessConfig } from "./types"

/**
 * BrainHarnessConfig defines the complete parameter space for the Brain Plugin.
 * Every field here is a knob that Meta-Harness can turn.
 * 
 * Based on brain-plugin-docs.md:
 * - tree/engine.ts: intent thresholds, chunk counts, rerank flags
 * - retrieval/fusion.ts: RRF weights (alpha/beta/gamma), memory boost
 * - retrieval/reranker.ts: confidence gate, min results, intent gating
 * - context/compression.ts: token thresholds per intent, strategy
 * - context/injector.ts: prompt templates, separators, max tokens
 * - LM Studio specific: temperature, max tokens, batch sizes
 */

export const DEFAULT_HARNESS_CONFIG: BrainHarnessConfig = {
  // --- Decision Tree (tree/engine.ts) ---
  intentThresholds: {
    debug: 0.70,
    "debug+stacktrace": 0.75,
    refactor: 0.60,
    "refactor+single": 0.65,
    feature: 0.60,
    test: 0.65,
    learn: 0.50,
    quick_chat: 0.30,
  },
  chunkCounts: {
    debug: 10,
    "debug+stacktrace": 5,
    refactor: 20,
    "refactor+single": 8,
    feature: 15,
    test: 12,
    learn: 25,
    quick_chat: 0,
  },
  rerankFlags: {
    debug: false,
    "debug+stacktrace": true,
    refactor: true,
    "refactor+single": false,
    feature: true,
    test: false,
    learn: true,
    quick_chat: false,
  },

  // --- Fusion (retrieval/fusion.ts) ---
  // RRF weights: must sum to ~1.0 (will be normalized)
  fusionAlpha: 0.40,  // keyword (FTS5)
  fusionBeta: 0.40,   // dense (ONNX embeddings)
  fusionGamma: 0.20,  // sparse (pseudo-SPLADE)
  memoryBoost: 0.15, // 15% boost for known concepts

  // --- Reranker (retrieval/reranker.ts) ---
  confidenceGate: 0.85,     // skip rerank if top-3 scores > this
  rerankMinResults: 10,      // only rerank if >= N results
  rerankIntents: ["learn", "refactor", "feature"],

  // --- Context Compression (context/compression.ts) ---
  tokenThresholds: {
    debug: 500,
    refactor: 500,
    feature: 500,
    test: 500,
    learn: 150,
    quick_chat: 150,
  },
  compressionStrategy: "hybrid", // truncate | summarize | hybrid

  // --- Context Injector (context/injector.ts) ---
  contextHeader: "### Relevant codebase context\n",
  chunkSeparator: "\n---\n",
  maxContextTokens: 4096,

  // --- LM Studio Specific ---
  chatTemperature: 0.7,
  chatMaxTokens: 4096,
  embedBatchSize: 4,        // qwen3-embedding-0.6b can handle small batches
  rerankerMaxChunks: 20,    // qwen3-reranker-0.6b max chunks to rerank
}

/**
 * Parameter space bounds for mutation.
 * Used by the proposer to constrain mutations.
 */
export const PARAMETER_BOUNDS = {
  intentThresholds: { min: 0.1, max: 0.95, step: 0.05 },
  chunkCounts: { min: 0, max: 50, step: 1 },
  fusionWeights: { min: 0.05, max: 0.80, step: 0.05 },
  memoryBoost: { min: 0.0, max: 0.40, step: 0.05 },
  confidenceGate: { min: 0.5, max: 0.99, step: 0.01 },
  rerankMinResults: { min: 5, max: 50, step: 1 },
  tokenThresholds: { min: 50, max: 2000, step: 50 },
  maxContextTokens: { min: 1024, max: 32768, step: 1024 },
  chatTemperature: { min: 0.0, max: 1.5, step: 0.1 },
  embedBatchSize: { min: 1, max: 16, step: 1 },
  rerankerMaxChunks: { min: 5, max: 100, step: 5 },
}

/**
 * Apply a harness config to the live Brain Plugin modules.
 * This is called at the start of every evaluation episode.
 * 
 * NOTE: This is a simulation layer. In production, these would patch
 * the actual Brain Plugin modules via their exported setters.
 */
export function applyHarnessConfig(config: BrainHarnessConfig): void {
  // In a real implementation, these would dynamically import and patch:
  // - tree/engine.ts setters
  // - retrieval/fusion.ts setters  
  // - retrieval/reranker.ts setters
  // - context/compression.ts setters
  // - context/injector.ts setters
  // - provider/lmstudio.ts setters

  // For now, we validate the config is well-formed
  validateConfig(config)
}

export function validateConfig(config: BrainHarnessConfig): void {
  const weights = config.fusionAlpha + config.fusionBeta + config.fusionGamma
  if (Math.abs(weights - 1.0) > 0.01) {
    // Normalize
    config.fusionAlpha /= weights
    config.fusionBeta /= weights
    config.fusionGamma /= weights
  }

  // Ensure chunk counts are integers
  for (const key of Object.keys(config.chunkCounts)) {
    config.chunkCounts[key] = Math.round(config.chunkCounts[key])
  }

  // Ensure rerankIntents is subset of valid intents
  const validIntents = Object.keys(config.intentThresholds)
  config.rerankIntents = config.rerankIntents.filter(i => validIntents.includes(i))
}

/**
 * Serialize config for logging/comparison.
 */
export function configFingerprint(config: BrainHarnessConfig): string {
  const keys = Object.keys(config).sort()
  const hash = keys.map(k => `${k}=${JSON.stringify((config as any)[k])}`).join("|")
  return hash
}
