import { getDatabase } from "../store";
import { getEmbeddings } from "./dense";
import { isVectorActive } from "../store/vec";

export interface SearchResult {
  id: string;
  filepath: string;
  language: string;
  type: string;
  name: string;
  start_line: number;
  end_line: number;
  parent_id: string | null;
  content: string;
  score: number;
}

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

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, topK);
  } catch (e: any) {
    console.warn(`[Brain/Searcher] Dense search failed: ${e.message}`);
    return [];
  }
}

export async function searchProjectContext(
  projectRoot: string,
  query: string,
  topK: number = 5
): Promise<SearchResult[]> {
  const db = getDatabase(projectRoot);

  const ftsResults = ftsSearch(db, query, topK);

  const denseResults = await denseSearch(db, projectRoot, query, topK);

  const seen = new Set<string>();
  const merged: SearchResult[] = [];

  for (const r of denseResults) {
    if (!seen.has(r.id)) {
      seen.add(r.id);
      merged.push(r);
    }
  }

  for (const r of ftsResults) {
    if (!seen.has(r.id)) {
      seen.add(r.id);
      merged.push({ ...r, score: r.score * 0.3 });
    }
  }

  merged.sort((a, b) => b.score - a.score);
  return merged.slice(0, topK);
}
