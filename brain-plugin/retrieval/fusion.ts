// Alias for backward compatibility
export type SearchResult = SearchResultItem;

export interface SearchResultItem {
  id: string;
  filepath: string;
  language: string;
  type: string;
  name: string;
  start_line: number;
  end_line: number;
  parent_id?: string | null;
  content: string;
  score?: number;
}

export interface FusionOptions {
  k?: number; // RRF smoothing factor (default: 60)
  denseWeight?: number; // default: 0.5
  keywordWeight?: number; // default: 0.2
}

// --- Harness-configurable state ---
let _fusionAlpha = 0.4; // keyword weight (FTS5)
let _fusionBeta = 0.4; // dense weight (embeddings)
let _fusionGamma = 0.2; // sparse weight (pseudo-SPLADE)
let _memoryBoost = 0.15; // 15% boost for known concepts
let _rrfK = 60; // RRF smoothing factor

/**
 * Set RRF fusion weights for Meta-Harness optimization.
 * Alpha = keyword (FTS5), Beta = dense (embeddings), Gamma = sparse.
 * Weights are normalized to sum to 1.0.
 */
export function setFusionWeights(alpha: number, beta: number, gamma: number): void {
  _fusionAlpha = alpha;
  _fusionBeta = beta;
  _fusionGamma = gamma;
  // Normalize
  const sum = alpha + beta + gamma;
  if (sum > 0) {
    _fusionAlpha = alpha / sum;
    _fusionBeta = beta / sum;
    _fusionGamma = gamma / sum;
  }
  console.log(
    `[Fusion] Weights set: alpha=${_fusionAlpha.toFixed(2)}, beta=${_fusionBeta.toFixed(2)}, gamma=${_fusionGamma.toFixed(2)}`
  );
}

/**
 * Set memory boost for known concepts (Meta-Harness).
 */
export function setMemoryBoost(boost: number): void {
  _memoryBoost = Math.max(0, Math.min(0.5, boost));
  console.log(`[Fusion] Memory boost set: ${_memoryBoost.toFixed(2)}`);
}

/**
 * Set RRF K smoothing factor.
 */
export function setRrfK(k: number): void {
  _rrfK = Math.max(1, Math.min(200, k));
  console.log(`[Fusion] RRF K set: ${_rrfK}`);
}

/**
 * Get current fusion weights for inspection.
 */
export function getFusionWeights(): {
  alpha: number;
  beta: number;
  gamma: number;
  memoryBoost: number;
  rrfK: number;
} {
  return {
    alpha: _fusionAlpha,
    beta: _fusionBeta,
    gamma: _fusionGamma,
    memoryBoost: _memoryBoost,
    rrfK: _rrfK,
  };
}

/**
 * Fuses results from multiple retrievers using Reciprocal Rank Fusion (RRF).
 *
 * Formula:
 * RRF(d) = Weight_dense * (1 / (K + r_dense(d))) + Weight_keyword * (1 / (K + r_keyword(d)))
 */
export function reciprocalRankFusion(
  denseResults: SearchResultItem[],
  keywordResults: SearchResultItem[],
  options?: FusionOptions
): SearchResultItem[] {
  // Use harness-configured weights, fall back to options or defaults
  const k = options?.k ?? _rrfK;
  const wDense = options?.denseWeight ?? _fusionBeta;
  const wKeyword = options?.keywordWeight ?? _fusionAlpha;

  const scoreMap = new Map<string, { item: SearchResultItem; rrfScore: number }>();

  // Helper to add ranked items to the RRF score accumulator
  function accumulateScores(results: SearchResultItem[], weight: number) {
    for (let index = 0; index < results.length; index++) {
      const item = results[index];
      const rank = index + 1; // 1-based rank
      const rrfContribution = weight * (1.0 / (k + rank));

      const existing = scoreMap.get(item.id);
      if (existing) {
        existing.rrfScore += rrfContribution;
      } else {
        scoreMap.set(item.id, { item, rrfScore: rrfContribution });
      }
    }
  }

  // Accumulate scores for dense vectors and lexical keyword hits
  accumulateScores(denseResults, wDense);
  accumulateScores(keywordResults, wKeyword);

  // Convert map to sorted array
  const fused = Array.from(scoreMap.values())
    .map(({ item, rrfScore }) => ({
      ...item,
      score: rrfScore,
    }))
    .sort((a, b) => b.score! - a.score!); // Higher RRF score is better!

  return fused;
}
