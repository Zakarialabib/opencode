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
  const k = options?.k ?? 60;
  const wDense = options?.denseWeight ?? 0.5;
  const wKeyword = options?.keywordWeight ?? 0.2;

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
      score: rrfScore
    }))
    .sort((a, b) => b.score! - a.score!); // Higher RRF score is better!

  return fused;
}
