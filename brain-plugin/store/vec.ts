import { createDatabase, BrainDatabase } from "./driver";

/**
 * Initializes the vector virtual tables for sqlite-vec.
 * Supports different models with different dimensions using separate vec0 tables.
 */
export function initializeVectorTables(db: BrainDatabase): void {
  try {
    // 1. Qwen3-Embedding-0.6B virtual table (1024 dimensions)
    db.exec("CREATE VIRTUAL TABLE IF NOT EXISTS chunk_embeddings USING vec0(embedding float[1024])");
    
    // 2. Nomic-Embed-v1.5 virtual table (768 dimensions)
    db.exec("CREATE VIRTUAL TABLE IF NOT EXISTS chunk_embeddings_nomic USING vec0(embedding float[768])");

    // 3. Concepts vector virtual table (1024 dimensions)
    db.exec("CREATE VIRTUAL TABLE IF NOT EXISTS concept_embeddings USING vec0(embedding float[1024])");
    
    console.log("[Brain/StoreVec] Vector virtual tables initialized successfully");
  } catch (error: any) {
    console.error("[Brain/StoreVec] Failed to initialize vector virtual tables:", error.message);
  }
}

/**
 * Checks if the sqlite-vec extension is active and available.
 */
export function isVectorActive(db: BrainDatabase): boolean {
  try {
    const version = db.prepare("SELECT vec_version() AS version").get() as { version: string };
    return !!version?.version;
  } catch {
    return false;
  }
}

/**
 * Inserts or replaces a vector embedding for a given chunk.
 * Maps the content-addressable chunk string ID to the internal integer ROWID of the chunk.
 */
export function upsertChunkEmbedding(
  db: BrainDatabase,
  chunkId: string,
  vector: number[],
  modelType: "qwen" | "nomic" = "qwen",
): void {
  // Get the internal rowid of the chunk in the chunks table
  const chunkRow = db.prepare("SELECT rowid FROM chunks WHERE id = ?").get(chunkId) as { rowid: number } | undefined;
  
  if (!chunkRow) {
    console.warn(`[Brain/StoreVec] Cannot save embedding: chunk ${chunkId} not found in chunks table.`);
    return;
  }

  const rowid = BigInt(chunkRow.rowid);
  const floatArray = new Float32Array(vector);

  if (modelType === "qwen") {
    db.prepare("INSERT OR REPLACE INTO chunk_embeddings(rowid, embedding) VALUES(?, ?)")
      .run(rowid, floatArray);
  } else {
    db.prepare("INSERT OR REPLACE INTO chunk_embeddings_nomic(rowid, embedding) VALUES(?, ?)")
      .run(rowid, floatArray);
  }
}

/**
 * Batch inserts vector embeddings. Uses a transaction for maximum insertion performance.
 */
export function upsertChunkEmbeddingsBatch(
  db: BrainDatabase,
  items: Array<{ chunkId: string; vector: number[] }>,
  modelType: "qwen" | "nomic" = "qwen",
): void {
  const selectRowid = db.prepare("SELECT rowid FROM chunks WHERE id = ?");
  const insertQwen = db.prepare("INSERT OR REPLACE INTO chunk_embeddings(rowid, embedding) VALUES(?, ?)");
  const insertNomic = db.prepare("INSERT OR REPLACE INTO chunk_embeddings_nomic(rowid, embedding) VALUES(?, ?)");

  db.transaction(() => {
    for (const item of items) {
      const chunkRow = selectRowid.get(item.chunkId) as { rowid: number } | undefined;
      if (!chunkRow) continue;

      const rowid = BigInt(chunkRow.rowid);
      const floatArray = new Float32Array(item.vector);

      if (modelType === "qwen") {
        insertQwen.run(rowid, floatArray);
      } else {
        insertNomic.run(rowid, floatArray);
      }
    }
  })();
}

/**
 * Performs a dense cosine similarity search over vector embeddings.
 * Returns the matching chunk models with their cosine distance scores.
 */
export function searchDenseVectors(
  db: BrainDatabase,
  queryVector: number[],
  limit: number,
  modelType: "qwen" | "nomic" = "qwen",
): Array<{
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
}> {
  const floatArray = new Float32Array(queryVector);
  const tableName = modelType === "qwen" ? "chunk_embeddings" : "chunk_embeddings_nomic";

  // Query uses sqlite-vec vec_distance_cosine inside sorting
  const query = db.prepare(`
    SELECT 
      c.id,
      c.filepath,
      c.language,
      c.type,
      c.name,
      c.start_line,
      c.end_line,
      c.parent_id,
      c.content,
      vec_distance_cosine(e.embedding, ?) AS score
    FROM ${tableName} e
    JOIN chunks c ON c.rowid = e.rowid
    ORDER BY score ASC
    LIMIT ?
  `);

  const results = query.all(floatArray, limit) as any[];
  
  return results.map((r) => ({
    id: r.id,
    filepath: r.filepath,
    language: r.language ?? "",
    type: r.type ?? "unknown",
    name: r.name ?? "",
    start_line: r.start_line,
    end_line: r.end_line,
    parent_id: r.parent_id,
    content: r.content,
    // Convert distance (0 = identical, 1 = orthogonal, 2 = opposite) to similarity score
    score: 1.0 - r.score
  }));
}

/**
 * Cleanly deletes a vector embedding by mapping chunk string ID to rowid.
 */
export function deleteChunkEmbedding(db: BrainDatabase, chunkId: string): void {
  const chunkRow = db.prepare("SELECT rowid FROM chunks WHERE id = ?").get(chunkId) as { rowid: number } | undefined;
  if (!chunkRow) return;

  const rowid = BigInt(chunkRow.rowid);
  db.prepare("DELETE FROM chunk_embeddings WHERE rowid = ?").run(rowid);
  db.prepare("DELETE FROM chunk_embeddings_nomic WHERE rowid = ?").run(rowid);
}
