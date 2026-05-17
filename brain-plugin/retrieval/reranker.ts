import { SearchResultItem } from "./fusion";

let localReranker: any = null;
let rerankerImportFailed = false;

/**
 * Initializes the Qwen3 Reranker pipeline on CPU.
 */
async function getLocalReranker(projectRoot: string): Promise<any> {
  if (localReranker) return localReranker;
  if (rerankerImportFailed) return null;

  try {
    const { pipeline, env } = await import("@xenova/transformers");

    // Set explicit cache path inside the project
    const cacheDir = `${projectRoot}/.opencode/models`.replace(/\\/g, "/");
    env.cacheDir = cacheDir;

    console.log(`[Brain/Reranker] Loading Qwen3-Reranker-0.6B from Hugging Face on CPU...`);
    localReranker = await pipeline("text-classification", "Qwen/Qwen3-Reranker-0.6B", {
      device: "cpu", // Save VRAM
    });
    console.log("[Brain/Reranker] Qwen3 ONNX Reranker loaded successfully");
    return localReranker;
  } catch (error: any) {
    console.warn(`[Brain/Reranker] Local reranker initialization failed: ${error.message}`);
    console.warn(
      "[Brain/Reranker] Skipping cross-encoder reranker (falling back to pure RRF fusion scores)"
    );
    rerankerImportFailed = true;
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

  // Only rerank for 'learn' intent with enough candidates to benefit from cross-encoding
  if (intent !== "learn" || fusedChunks.length < 10) {
    return fusedChunks;
  }

  // Cap to top-20 fusion chunks strictly to ensure CPU latency remains sub-second
  const topK = 20;
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
