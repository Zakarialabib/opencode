import { getDatabase } from "../store/index.js";
import { getEmbeddings } from "./dense.js";
import { isVectorActive } from "../store/vec.js";
import { rerankChunks } from "./reranker.js";
import { reciprocalRankFusion, SearchResultItem } from "./fusion.js";
import { RerankingTrigger, getRerankingTrigger } from "./reranking-trigger.js";

// Re-exported from fusion.ts; kept as alias for backward compatibility
// with brain.ts and index.ts imports. Fields: id, filepath, language, type,
// name, start_line, end_line, parent_id?, content, score?
export type { SearchResultItem as SearchResult } from "./fusion.js";
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
  intent: string = "unknown",
  confidence: number = 0.7
): Promise<SearchResult[]> {
  const db = getDatabase(projectRoot);
  const rerankingTrigger = getRerankingTrigger();

  const cacheKey = rerankingTrigger.getCacheKey(query, intent);
  const cachedResults = rerankingTrigger.getCachedReranked(cacheKey);
  if (cachedResults) {
    return cachedResults.slice(0, topK);
  }

  const [ftsResults, denseResults] = await Promise.all([
    ftsSearch(db, query, topK * 3),
    denseSearch(db, projectRoot, query, topK * 3),
  ]);

  const fused = reciprocalRankFusion(denseResults, ftsResults);

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

  if (rerankingTrigger.shouldRerank(intent, topFused.length, confidence)) {
    const rerankLimit = rerankingTrigger.getRerankLimit(intent, topFused.length, confidence);
    const itemsToRerank = topFused.slice(0, rerankLimit);
    const remainingChunks = topFused.slice(rerankLimit);

    const reranked = await rerankChunks(projectRoot, query, itemsToRerank, intent);
    const finalResults = [...reranked, ...remainingChunks].slice(0, topK);

    rerankingTrigger.cacheReranked(cacheKey, finalResults);
    return finalResults;
  }

  return topFused.slice(0, topK);
}

export async function searchProjectContextDebug(
  projectRoot: string,
  query: string,
  topK: number,
  intent: string,
  confidence: number
): Promise<{
  results: any[];
  debug: {
    timings: {
      ftsMs: number;
      denseMs: number;
      fusionMs: number;
      rerankMs: number;
      totalMs: number;
    };
    stage1_fts: any[];
    stage2_dense: any[];
    stage3_fused: any[];
    rerank: {
      enabled: boolean;
      gate: number;
      threshold: number;
      intent: string;
      rerankLimit: number;
    };
  };
}> {
  const nowMs = () =>
    typeof performance !== "undefined" && typeof performance.now === "function"
      ? performance.now()
      : Date.now();

  const startedAt = nowMs();

  const db = getDatabase(projectRoot);
  const rerankingTrigger = getRerankingTrigger();

  const cacheKey = rerankingTrigger.getCacheKey(query, intent);
  const cachedResults = rerankingTrigger.getCachedReranked(cacheKey);

  const threshold = rerankingTrigger.getConfig().confidenceThreshold;

  const toStageItem = (item: SearchResult) => ({
    id: item.id,
    filepath: item.filepath,
    name: item.name,
    start_line: item.start_line,
    score: item.score ?? 0,
  });

  if (cachedResults) {
    const endedAt = nowMs();
    return {
      results: cachedResults.slice(0, topK),
      debug: {
        timings: { ftsMs: 0, denseMs: 0, fusionMs: 0, rerankMs: 0, totalMs: endedAt - startedAt },
        stage1_fts: [],
        stage2_dense: [],
        stage3_fused: [],
        rerank: { enabled: false, gate: confidence, threshold, intent, rerankLimit: 0 },
      },
    };
  }

  const ftsStart = nowMs();
  const ftsResults = ftsSearch(db, query, topK * 3);
  const ftsMs = nowMs() - ftsStart;

  const denseStart = nowMs();
  const denseResults = await denseSearch(db, projectRoot, query, topK * 3);
  const denseMs = nowMs() - denseStart;

  const fusionStart = nowMs();
  const fused = reciprocalRankFusion(denseResults, ftsResults);

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
  } catch {}

  const topFused = fused.slice(0, topK * 2);
  const fusionMs = nowMs() - fusionStart;

  const shouldRerank = rerankingTrigger.shouldRerank(intent, topFused.length, confidence);
  const rerankLimit = shouldRerank
    ? rerankingTrigger.getRerankLimit(intent, topFused.length, confidence)
    : 0;

  let rerankMs = 0;
  let results: SearchResult[] = topFused.slice(0, topK);

  if (shouldRerank) {
    const rerankStart = nowMs();
    const itemsToRerank = topFused.slice(0, rerankLimit);
    const remainingChunks = topFused.slice(rerankLimit);

    const reranked = await rerankChunks(projectRoot, query, itemsToRerank, intent);
    results = [...reranked, ...remainingChunks].slice(0, topK);
    rerankMs = nowMs() - rerankStart;

    rerankingTrigger.cacheReranked(cacheKey, results);
  }

  const endedAt = nowMs();

  return {
    results,
    debug: {
      timings: { ftsMs, denseMs, fusionMs, rerankMs, totalMs: endedAt - startedAt },
      stage1_fts: ftsResults.map(toStageItem),
      stage2_dense: denseResults.map(toStageItem),
      stage3_fused: topFused.map(toStageItem),
      rerank: {
        enabled: shouldRerank,
        gate: confidence,
        threshold,
        intent,
        rerankLimit,
      },
    },
  };
}
