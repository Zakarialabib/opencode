#!/usr/bin/env npx tsx
/**
 * Quick Project Indexer
 * Indexes the current project for brain plugin RAG
 */

import { existsSync, mkdirSync } from "fs";
import { join } from "path";
import { getDatabase } from "../brain-plugin/store";
import { indexProject } from "../brain-plugin/retrieval/indexer";
import { fileLog } from "../meta-harness/utils/logger";

const PROJECT_ROOT = process.cwd();
const LOG_DIR = join(PROJECT_ROOT, ".opencode", "logs");

async function main() {
  console.log("╔════════════════════════════════════════════════════════════╗");
  console.log("║              Project Indexer for Brain Plugin              ║");
  console.log("╚════════════════════════════════════════════════════════════╝");

  if (!existsSync(LOG_DIR)) {
    mkdirSync(LOG_DIR, { recursive: true });
  }

  fileLog("=== Project Indexing Started ===");

  const db = getDatabase(PROJECT_ROOT);

  // Check current state
  const beforeCount = db.prepare("SELECT COUNT(*) as count FROM chunks").get() as any;
  console.log(`\n📊 Current index: ${beforeCount?.count || 0} chunks`);

  // Run indexing
  console.log(`\n🔄 Indexing project: ${PROJECT_ROOT}`);
  const startTime = Date.now();

  try {
    const result = await indexProject(PROJECT_ROOT);
    const duration = Date.now() - startTime;

    // Check new state
    const afterCount = db.prepare("SELECT COUNT(*) as count FROM chunks").get() as any;
    const filesCount = db.prepare("SELECT COUNT(*) as count FROM files").get() as any;

    console.log(`\n✅ Indexing complete!`);
    console.log(`   Chunks added: ${result.length}`);
    console.log(`   Total chunks: ${afterCount?.count || 0}`);
    console.log(`   Files tracked: ${filesCount?.count || 0}`);
    console.log(`   Duration: ${duration}ms (${(duration / 1000).toFixed(1)}s)`);

    fileLog(`Indexed ${result.length} chunks in ${duration}ms`);
  } catch (err: any) {
    console.log(`\n❌ Indexing failed: ${err.message}`);
    fileLog(`Indexing failed: ${err.message}`, "error");
  }

  fileLog("=== Project Indexing Completed ===");
}

main().catch((err) => {
  console.error("Indexing failed:", err);
  process.exit(1);
});
