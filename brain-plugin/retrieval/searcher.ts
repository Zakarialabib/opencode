import { getDatabase } from "../store";
import { getEmbeddings } from "./dense";
import { isVectorActive } from "../store/vec";
import { rerankChunks } from "./reranker";
import { reciprocalRankFusion, SearchResultItem } from "./fusion";

// Re-exported from fusion.ts; kept as alias for backward compatibility
// with brain.ts and index.ts imports. Fields: id, filepath, language, type,
// name, start_line, end_line, parent_id?, content, score?
export { SearchResultItem as SearchResult } from "./fusion";
type SearchResult = SearchResultItem;

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0,
    magA = 0,
    magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
}

function ftsSearch(
  db: ReturnType<typeof getDatabase>,
  query: string,
  topK: number
): SearchResult[] {
  const sanitized = query.replace(/[^\w\s]/g, " ").trim();
  if (!sanitized) return [];

  try {
    const terms = sanitized
      .split(/\s+/)
      .filter((t) => t.length > 1)
      .join(" ");
    if (!terms) return [];

    const rows = db
      .prepare(`
      SELECT c.id, c.filepath, c.language, c.type, c.name, c.start_line, c.end_line, c.parent_id, c.content
      FROM fts_chunks f
      JOIN chunks c ON c.rowid = f.rowid
      WHERE fts_chunks MATCH ?
      ORDER BY rank
      LIMIT ?
    `)
      .all(terms, topK) as any[];

    return rows.map((r) => ({ ...r, score: 0.5 }));
  } catch {
    return [];
  }
}

async function denseSearch(
  db: ReturnType<typeof getDatabase>,
  projectRoot: string,
  query: string,
  topK: number
): Promise<SearchResult[]> {
  try {
    const queryEmbedding = await getEmbeddings(projectRoot, [query]);
    if (!queryEmbedding.vectors[0]) return [];

    const queryVec = queryEmbedding.vectors[0];
    const modelType = queryEmbedding.modelType;
    const tableName = modelType === "qwen" ? "chunk_embeddings" : "chunk_embeddings_nomic";

    if (!isVectorActive(db)) return [];

    const rows = db
      .prepare(`
      SELECT c.id, c.filepath, c.language, c.type, c.name, c.start_line, c.end_line, c.parent_id, c.content, e.embedding
      FROM ${tableName} e
      JOIN chunks c ON c.rowid = e.rowid
    `)
      .all() as Array<any>;

    const scored: SearchResult[] = [];
    for (const row of rows) {
      const vec = new Float32Array(
        row.embedding.buffer,
        row.embedding.byteOffset,
        row.embedding.byteLength / 4
      );
      const vecArr = Array.from(vec);
      const score = cosineSimilarity(queryVec, vecArr);
      scored.push({
        id: row.id,
        filepath: row.filepath,
        language: row.language,
        type: row.type,
        name: row.name,
        start_line: row.start_line,
        end_line: row.end_line,
        parent_id: row.parent_id,
        content: row.content,
        score,
      });
    }

    scored.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
    return scored.slice(0, topK);
  } catch (e: any) {
    console.warn(`[Brain/Searcher] Dense search failed: ${e.message}`);
    return [];
  }
}

export async function searchProjectContext(
  projectRoot: string,
  query: string,
  topK: number = 5,
  intent: string = "unknown"
): Promise<SearchResult[]> {
  const db = getDatabase(projectRoot);

  // Merge strategy: Reciprocal Rank Fusion (RRF)
  // Takes dense + FTS results, computes weighted rank-based scores,
  // deduplicates by chunk_id, returns sorted by combined RRF score.
  // Dense weight: 0.5, Keyword weight: 0.2, Smoothing factor K: 60
  const [ftsResults, denseResults] = await Promise.all([
    ftsSearch(db, query, topK * 2),
    denseSearch(db, projectRoot, query, topK * 2),
  ]);

  const fused = reciprocalRankFusion(denseResults, ftsResults);

  // Memory-aware retrieval boost: boost chunks linked to known memory concepts
  try {
    const { getConceptRelatedChunks } = await import("../memory/graph");
    const allConcepts = db
      .prepare("SELECT id FROM concepts ORDER BY session_count DESC LIMIT 10")
      .all() as Array<{ id: string }>;
    for (const concept of allConcepts) {
      const related = getConceptRelatedChunks(projectRoot, concept.id, 5);
      const relatedIds = new Set(related.map((r) => r.id));
      for (const item of fused) {
        if (relatedIds.has(item.id)) {
          item.score = (item.score || 0) * 1.15;
        }
      }
    }
  } catch (e: any) {
    // Memory graph not available — skip boost silently
  }

  const topFused = fused.slice(0, topK * 2);

  const reranked = await rerankChunks(projectRoot, query, topFused, intent);
  return reranked.slice(0, topK);
}
