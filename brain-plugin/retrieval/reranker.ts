import { SearchResultItem } from "./fusion.js";

let localReranker: any = null;
let rerankerImportFailed = false;
let rerankerEnabled = true;
let rerankerModelId = "Xenova/bge-reranker-base";
let lastRerankerError: string | undefined = undefined;
let rerankerDownloadOnly = false;

// --- Harness-configurable state ---
let _confidenceGate = 0.85; // skip rerank if top-3 scores > this
let _rerankMinResults = 10; // only rerank if >= N results
let _rerankIntents = ["learn", "refactor", "feature"]; // intents that trigger reranking
let _rerankerMaxChunks = 20; // max chunks to rerank (CPU latency control)

/**
 * Set reranker confidence gate for Meta-Harness optimization.
 * Reranking is skipped if top-3 scores already exceed this threshold.
 */
export function setRerankerConfidenceGate(gate: number): void {
  _confidenceGate = Math.max(0.5, Math.min(0.99, gate));
  console.log(`[Reranker] Confidence gate set: ${_confidenceGate.toFixed(2)}`);
}

/**
 * Set minimum results required before triggering reranking.
 */
export function setRerankMinResults(minResults: number): void {
  _rerankMinResults = Math.max(3, Math.min(100, minResults));
  console.log(`[Reranker] Min results set: ${_rerankMinResults}`);
}

/**
 * Set which intents trigger reranking.
 */
export function setRerankIntents(intents: string[]): void {
  _rerankIntents = intents.filter((i) => typeof i === "string");
  console.log(`[Reranker] Intents set: ${_rerankIntents.join(", ")}`);
}

/**
 * Set maximum chunks to rerank (CPU latency control).
 */
export function setRerankerMaxChunks(maxChunks: number): void {
  _rerankerMaxChunks = Math.max(5, Math.min(100, maxChunks));
  console.log(`[Reranker] Max chunks set: ${_rerankerMaxChunks}`);
}

/**
 * Get current reranker configuration.
 */
export function getRerankerConfig(): {
  confidenceGate: number;
  rerankMinResults: number;
  rerankIntents: string[];
  maxChunks: number;
} {
  return {
    confidenceGate: _confidenceGate,
    rerankMinResults: _rerankMinResults,
    rerankIntents: [..._rerankIntents],
    maxChunks: _rerankerMaxChunks,
  };
}

export function setRerankerEnabled(enabled: boolean): void {
  rerankerEnabled = !!enabled;
  if (!rerankerEnabled) {
    localReranker = null;
  }
}

export function setRerankerModelId(modelId: string): void {
  if (typeof modelId !== "string" || !modelId.trim()) return;
  rerankerModelId = modelId.trim();
  localReranker = null;
  rerankerImportFailed = false;
  lastRerankerError = undefined;
}

export function getRerankerLoadStatus(): {
  enabled: boolean;
  modelId: string;
  loaded: boolean;
  importFailed: boolean;
  lastError?: string;
} {
  return {
    enabled: rerankerEnabled,
    modelId: rerankerModelId,
    loaded: !!localReranker,
    importFailed: rerankerImportFailed,
    lastError: lastRerankerError,
  };
}

export async function prewarmReranker(projectRoot: string): Promise<{
  enabled: boolean;
  modelId: string;
  loaded: boolean;
  importFailed: boolean;
  lastError?: string;
}> {
  await getLocalReranker(projectRoot);
  return getRerankerLoadStatus();
}

/**
 * Initializes the local reranker pipeline on CPU.
 */
async function getLocalReranker(projectRoot: string): Promise<any> {
  if (!rerankerEnabled) return null;
  if (localReranker) return localReranker;
  if (rerankerImportFailed) return null;

  try {
    const { pipeline, env } = await import("@xenova/transformers");

    // Set explicit cache path inside the project
    const cacheDir = `${projectRoot}/.opencode/models`.replace(/\\/g, "/");
    env.cacheDir = cacheDir;

    console.log(
      `[Brain/Reranker] Loading reranker model from Hugging Face on CPU: ${rerankerModelId}`
    );
    // Note: device option was removed from PretrainedOptions in transformers.js v2 - CPU is default
    localReranker = await pipeline("text-classification", rerankerModelId);
    console.log("[Brain/Reranker] Local ONNX reranker loaded successfully");
    return localReranker;
  } catch (error: any) {
    console.warn(`[Brain/Reranker] Local reranker initialization failed: ${error.message}`);
    console.warn(
      "[Brain/Reranker] Skipping cross-encoder reranker (falling back to pure RRF fusion scores)"
    );
    rerankerImportFailed = true;
    lastRerankerError = error?.message ?? String(error);
    return null;
  }
}

/**
 * Reranks fusion search results using a local Qwen3 Reranker cross-encoder (ONNX CPU).
 * Capped strictly to the top-20 inputs to prevent CPU latency spikes.
 * Only activates for 'learn' intent with sufficient results to avoid unnecessary latency.
 */
export async function rerankChunks(
  projectRoot: string,
  query: string,
  fusedChunks: SearchResultItem[],
  intent: string = "unknown"
): Promise<SearchResultItem[]> {
  if (fusedChunks.length === 0) return [];
  if (!rerankerEnabled) return fusedChunks;

  // Only rerank for configured intents with enough candidates to benefit from cross-encoding
  if (!_rerankIntents.includes(intent) || fusedChunks.length < _rerankMinResults) {
    return fusedChunks;
  }

  // Skip reranker if top-3 scores already indicate high confidence (confidence gate)
  const topScores = fusedChunks
    .slice(0, 3)
    .map((c) => c.score)
    .filter((s) => s !== undefined);
  if (topScores.length >= 3 && topScores.every((s) => (s as number) > _confidenceGate)) {
    return fusedChunks;
  }

  // Cap to harness-configured max chunks to ensure CPU latency remains sub-second
  const topK = _rerankerMaxChunks;
  const itemsToRerank = fusedChunks.slice(0, topK);
  const remainingChunks = fusedChunks.slice(topK);

  const reranker = await getLocalReranker(projectRoot);

  if (!reranker) {
    // Graceful fallback: return RRF results completely intact
    return fusedChunks;
  }

  try {
    console.log(`[Brain/Reranker] Cross-encoding ${itemsToRerank.length} top RRF chunks...`);
    const startTime = Date.now();

    // Run cross-encoder scoring for each query-chunk pair
    const scoredItems = await Promise.all(
      itemsToRerank.map(async (item) => {
        // Query + Chunk text combined pair
        const output = await reranker({ text: query, text_pair: item.content });
        // The classification pipeline returns label scores
        // We look for relevance probability/score (usually output[0].score)
        const rerankScore = output[0]?.score ?? 0.0;
        return {
          ...item,
          score: rerankScore, // replace with high-fidelity cross-encoder score
        };
      })
    );

    const duration = Date.now() - startTime;
    console.log(`[Brain/Reranker] Reranking complete in ${duration}ms.`);

    // Sort by new cross-encoder score DESC
    const reranked = scoredItems.sort((a, b) => b.score! - a.score!);

    // Append remaining chunks that were not reranked (maintaining search coverage)
    return [...reranked, ...remainingChunks];
  } catch (e: any) {
    console.error("[Brain/Reranker] Reranking execution failed, returning raw fusion:", e.message);
    return fusedChunks;
  }
}

// ─── Reranker Status & Unload ───────────────────────────────────────────────────
export interface RerankerStatus {
  pipelineLoaded: boolean;
  importFailed: boolean;
  confidenceGate: number;
  rerankMinResults: number;
  rerankIntents: string[];
  maxChunks: number;
  downloadOnly: boolean;
}

/**
 * Get current status of the reranker pipeline for dashboard/observability.
 */
export function getRerankerStatus(): RerankerStatus {
  return {
    pipelineLoaded: localReranker !== null,
    importFailed: rerankerImportFailed,
    confidenceGate: _confidenceGate,
    rerankMinResults: _rerankMinResults,
    rerankIntents: [..._rerankIntents],
    maxChunks: _rerankerMaxChunks,
    downloadOnly: rerankerDownloadOnly,
  };
}

/**
 * Unload the reranker pipeline (download-only mode, no loaded model in memory).
 * Resets to allow fresh loading on next use.
 */
export function unloadReranker(): void {
  localReranker = null;
  rerankerImportFailed = false;
  rerankerDownloadOnly = true;
  console.log("[Brain/Reranker] Reranker pipeline unloaded. Will re-init on next rerank request.");
}

/**
 * Force-skip reranker (download-only mode, always fall back to RRF fusion).
 */
export function forceRerankerOff(): void {
  if (!rerankerImportFailed) {
    rerankerImportFailed = true;
    localReranker = null;
    console.log("[Brain/Reranker] Forced reranker off. Fusion-only mode.");
  }
}
