import Database from "better-sqlite3";

/**
 * Initializes the FTS5 full-text search virtual table.
 * Storing chunk_id and filepath as UNINDEXED columns optimizes performance.
 */
export function initializeFTSTables(db: Database.Database): void {
  try {
    // We use exact unicode61 tokenization for precise code search (preserves identifiers)
    db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS fts_chunks USING fts5(
        chunk_id UNINDEXED,
        filepath UNINDEXED,
        content,
        tokenize="unicode61"
      )
    `);
    console.log("[Brain/StoreFTS] FTS5 virtual table initialized successfully");
  } catch (error: any) {
    console.error("[Brain/StoreFTS] Failed to initialize FTS5 table:", error.message);
  }
}

/**
 * Inserts or replaces a chunk index inside the FTS5 table.
 */
export function upsertChunkFTS(
  db: Database.Database,
  chunkId: string,
  filepath: string,
  content: string
): void {
  db.prepare("INSERT INTO fts_chunks(chunk_id, filepath, content) VALUES(?, ?, ?)")
    .run(chunkId, filepath, content);
}

/**
 * Batch inserts FTS data. Runs inside a single SQLite transaction for maximum performance.
 */
export function upsertChunkFTSBatch(
  db: Database.Database,
  items: Array<{ chunkId: string; filepath: string; content: string }>
): void {
  const insert = db.prepare("INSERT INTO fts_chunks(chunk_id, filepath, content) VALUES(?, ?, ?)");
  
  db.transaction(() => {
    for (const item of items) {
      insert.run(item.chunkId, item.filepath, item.content);
    }
  })();
}

/**
 * Performs full-text search using SQLite's built-in BM25 relevance ranker.
 * Matches terms or prefix searches (e.g. term*).
 * Returns matching chunks ordered by lexical relevance score.
 */
export function searchKeywordFTS(
  db: Database.Database,
  keywordQuery: string,
  limit: number
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
  // SQLite FTS5 MATCH syntax: sanitize query and format for prefix/phrase search.
  // For code, we split terms and use prefix matches: "query term*"
  const sanitized = keywordQuery
    .replace(/[^\w\s\-\.\_]/g, " ") // remove symbols
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map(t => `${t}*`)
    .join(" AND ");

  if (!sanitized) return [];

  // FTS5 BM25 function returns a negative float (more negative = more relevant).
  // We sort by score ASC to get the most relevant first.
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
      bm25(fts_chunks) AS score
    FROM fts_chunks f
    JOIN chunks c ON c.id = f.chunk_id
    WHERE fts_chunks MATCH ?
    ORDER BY score ASC
    LIMIT ?
  `);

  try {
    const results = query.all(sanitized, limit) as any[];
    
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
      // Convert negative BM25 score to a positive rank metric.
      // -bm25 gives positive numbers, higher is better.
      score: -r.score
    }));
  } catch (error: any) {
    console.error("[Brain/StoreFTS] FTS query failed:", error.message);
    return [];
  }
}

/**
 * Deletes a chunk from FTS5 index.
 */
export function deleteChunkFTS(db: Database.Database, chunkId: string): void {
  db.prepare("DELETE FROM fts_chunks WHERE chunk_id = ?").run(chunkId);
}

/**
 * Cleanly wipes FTS entries for an entire file. Useful during file reindexes.
 */
export function deleteFileFTS(db: Database.Database, filepath: string): void {
  db.prepare("DELETE FROM fts_chunks WHERE filepath = ?").run(filepath);
}
