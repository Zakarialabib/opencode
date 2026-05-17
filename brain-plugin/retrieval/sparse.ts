import { getDatabase } from "../store";

export interface SparseResult {
  id: string;
  filepath: string;
  content: string;
  score: number;
}

/**
 * Pseudo-SPLADE sparse retrieval using IDF-weighted term matching.
 * Produces learned-sparse-style scores without requiring a trained SPLADE model.
 * Uses SQLite FTS5 for candidate generation, then re-ranks by IDF-weighted term scores.
 */
export function sparseSearch(
  projectRoot: string,
  query: string,
  topK: number = 10
): SparseResult[] {
  const db = getDatabase(projectRoot);

  // Step 1: Get candidate documents from FTS5
  const sanitized = query.replace(/[^\w\s]/g, " ").trim();
  if (!sanitized) return [];

  const terms = sanitized.split(/\s+/).filter(t => t.length > 1);
  if (terms.length === 0) return [];

  // Step 2: Get document frequency for each term (for IDF weighting)
  const idfWeights: Map<string, number> = new Map();
  const totalDocs =
    (
      db
        .prepare("SELECT COUNT(DISTINCT filepath) as count FROM chunks")
        .get() as any
    )?.count ?? 1;

  for (const term of terms) {
    try {
      const dfResult = db
        .prepare(
          "SELECT COUNT(DISTINCT filepath) as df FROM fts_chunks WHERE fts_chunks MATCH ?"
        )
        .get(term) as any;
      const df = dfResult?.df ?? 1;
      // IDF = log(N/df) — terms in fewer documents get higher weight
      idfWeights.set(
        term.toLowerCase(),
        Math.log((totalDocs + 1) / (df + 1)) + 1
      );
    } catch {
      idfWeights.set(term.toLowerCase(), 1.0);
    }
  }

  // Step 3: Build a weighted FTS5 query using BM25 ranking
  // Use the built-in bm25() function for initial ranking, then re-weight
  try {
    const ftsQuery = terms.join(" OR ");
    const candidates = db
      .prepare(
        `
      SELECT c.id, c.filepath, c.content, f.rank as bm25_score
      FROM fts_chunks f
      JOIN chunks c ON c.rowid = f.rowid
      WHERE fts_chunks MATCH ?
      ORDER BY rank
      LIMIT ?
    `
      )
      .all(ftsQuery, topK * 3) as any[];

    // Step 4: Re-rank by sparse IDF-weighted term frequency in each chunk
    const scored = candidates.map((row: any) => {
      const contentLower = (row.content as string).toLowerCase();
      let sparseScore = 0;

      for (const term of terms) {
        const termLower = term.toLowerCase();
        const tf =
          (contentLower.match(new RegExp(`\\b${termLower}\\b`, "g")) || [])
            .length;
        const idf = idfWeights.get(termLower) ?? 1.0;
        sparseScore += tf * idf; // TF-IDF style weighting
      }

      return {
        id: row.id,
        filepath: row.filepath,
        content: row.content,
        score: sparseScore,
      };
    });

    scored.sort((a: SparseResult, b: SparseResult) => b.score - a.score);
    return scored.slice(0, topK);
  } catch {
    return [];
  }
}