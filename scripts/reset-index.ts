#!/usr/bin/env npx tsx
/**
 * Reset and Re-index the Search Database
 */

import { existsSync, mkdirSync } from "fs";
import { join } from "path";
import { getDatabase } from "../brain-plugin/store";
import { initializeVectorTables } from "../brain-plugin/store/vec";
import { initializeFTSTables } from "../brain-plugin/store/fts";
import { indexProject } from "../brain-plugin/retrieval/indexer";
import { fileLog } from "../meta-harness/utils/logger";

const PROJECT_ROOT = process.cwd();

async function main() {
  console.log("╔════════════════════════════════════════════════════════════╗");
  console.log("║           Reset and Re-Index Search Database               ║");
  console.log("╚════════════════════════════════════════════════════════════╝");

  const logDir = join(PROJECT_ROOT, ".opencode", "logs");
  if (!existsSync(logDir)) mkdirSync(logDir, { recursive: true });

  fileLog("=== Database Reset Started ===");

  const db = getDatabase(PROJECT_ROOT);

  console.log("\n🗑️  Clearing existing indexes...");
  try {
    db.exec("DELETE FROM fts_chunks");
    db.exec("DELETE FROM chunk_embeddings");
    db.exec("DELETE FROM chunk_embeddings_nomic");
    console.log("   ✓ Cleared existing indexes");
  } catch (e: any) {
    console.log("   ✗ Error clearing:", e.message);
  }

  console.log("\n🔄 Reinitializing tables...");
  initializeVectorTables(db);
  initializeFTSTables(db);
  console.log("   ✓ Tables reinitialized");

  console.log("\n📊 Current state:");
  const chunkCount = db.prepare("SELECT COUNT(*) as count FROM chunks").get() as any;
  console.log("   Chunks in database:", chunkCount?.count || 0);

  if (chunkCount?.count > 0) {
    console.log("\n🚀 Re-indexing project for embeddings...");
    const startTime = Date.now();

    try {
      const result = await indexProject(PROJECT_ROOT);
      const duration = Date.now() - startTime;

      // Check new counts
      const ftsCount = db.prepare("SELECT COUNT(*) as count FROM fts_chunks").get() as any;
      const nomicCount = db
        .prepare("SELECT COUNT(*) as count FROM chunk_embeddings_nomic")
        .get() as any;

      console.log("\n✅ Re-indexing complete!");
      console.log("   Chunks processed:", result.length);
      console.log("   FTS records:", ftsCount?.count || 0);
      console.log("   Embeddings:", nomicCount?.count || 0);
      console.log("   Duration:", duration, "ms");

      fileLog(
        `Re-indexed ${result.length} chunks, ${ftsCount?.count || 0} FTS, ${nomicCount?.count || 0} embeddings`
      );
    } catch (e: any) {
      console.log("\n❌ Re-indexing failed:", e.message);
      fileLog(`Re-indexing failed: ${e.message}`, "error");
    }
  } else {
    console.log("\n⚠️  No chunks found. Run full index first.");
  }

  fileLog("=== Database Reset Completed ===");
}

main().catch((err) => {
  console.error("Reset failed:", err);
  process.exit(1);
});
