#!/usr/bin/env tsx
import { getDatabase } from "../store/index.js";
import { isVectorActive } from "../store/vec.js";
import { defaultProvider } from "../provider/lmstudio.js";

const projectRoot = process.cwd();
const db = getDatabase(projectRoot);

console.log("\n🧠 Brain Harness Status\n");
console.log("─".repeat(40));

try {
  const chunkCount = (db.prepare("SELECT COUNT(*) as c FROM chunks").get() as any)?.c ?? 0;
  const vectorCount = (db.prepare("SELECT COUNT(*) as c FROM chunk_embeddings").get() as any)?.c ?? 0;
  const conceptCount = (db.prepare("SELECT COUNT(*) as c FROM concepts").get() as any)?.c ?? 0;
  const sessionCount = (db.prepare("SELECT COUNT(*) as c FROM sessions").get() as any)?.c ?? 0;
  const ftsCount = (db.prepare("SELECT COUNT(*) as c FROM fts_chunks").get() as any)?.c ?? 0;

  console.log("\n📦 Storage");
  console.log(`  Chunks:     ${chunkCount.toLocaleString()}`);
  console.log(`  Vectors:    ${vectorCount.toLocaleString()}`);
  console.log(`  Concepts:   ${conceptCount.toLocaleString()}`);
  console.log(`  Sessions:   ${sessionCount.toLocaleString()}`);
  console.log(`  FTS Records: ${ftsCount.toLocaleString()}`);

  const vecActive = isVectorActive(db);
  console.log(`\n🔢 Vector Store: ${vecActive ? "✅ sqlite-vec active" : "❌ inactive (degraded mode)"}`);

  console.log("\n🤖 LM Studio");
  try {
    const models = await defaultProvider.getLoadedModels();
    console.log(`  Status:  ✅ Connected`);
    console.log(`  Models:  ${models.length > 0 ? models.join(", ") : "none loaded"}`);
  } catch {
    console.log("  Status:  ❌ Not connected");
    console.log("  Note:   Start LM Studio with embedding model");
  }

  console.log("\n" + "─".repeat(40));
  console.log(`Project: ${projectRoot}\n`);
} catch (err: any) {
  console.error("❌ Error:", err.message);
}
