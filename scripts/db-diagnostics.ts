#!/usr/bin/env npx tsx
/**
 * Database Diagnostics
 */

import { getDatabase } from "../brain-plugin/store";
import { isVectorActive } from "../brain-plugin/store/vec";

const db = getDatabase("C:/opencode");

console.log("=== Database Diagnostics ===");

// Check vec extension
console.log("vec extension active:", isVectorActive(db));

// Count chunks
const chunkCount = db.prepare("SELECT COUNT(*) as count FROM chunks").get() as any;
console.log("Total chunks:", chunkCount?.count);

// Check embeddings tables
try {
  const qwenCount = db.prepare("SELECT COUNT(*) as count FROM chunk_embeddings").get() as any;
  console.log("Qwen embeddings:", qwenCount?.count);
} catch (e: any) {
  console.log("Qwen embeddings: ERROR -", e.message);
}

try {
  const nomicCount = db
    .prepare("SELECT COUNT(*) as count FROM chunk_embeddings_nomic")
    .get() as any;
  console.log("Nomic embeddings:", nomicCount?.count);
} catch (e: any) {
  console.log("Nomic embeddings: ERROR -", e.message);
}

// Check FTS
try {
  const ftsCount = db.prepare("SELECT COUNT(*) as count FROM fts_chunks").get() as any;
  console.log("FTS records:", ftsCount?.count);
} catch (e: any) {
  console.log("FTS records: ERROR -", e.message);
}

// Sample a chunk to see structure
const sample = db.prepare("SELECT id, filepath, content FROM chunks LIMIT 1").get() as any;
if (sample) {
  console.log("\nSample chunk:");
  console.log("  ID:", sample.id);
  console.log("  File:", sample.filepath);
  console.log("  Content preview:", sample.content?.slice(0, 100));
}

// Try a simple FTS search
console.log("\n=== Testing FTS Search ===");
try {
  const ftsResults = db
    .prepare(`
    SELECT c.id, c.filepath, c.content 
    FROM fts_chunks f 
    JOIN chunks c ON c.rowid = f.rowid 
    WHERE fts_chunks MATCH 'auth' 
    LIMIT 3
  `)
    .all() as any[];

  console.log("FTS search for 'auth':", ftsResults.length, "results");
  for (const r of ftsResults) {
    console.log("  -", r.filepath, ":", r.content?.slice(0, 80));
  }
} catch (e: any) {
  console.log("FTS search failed:", e.message);
}
