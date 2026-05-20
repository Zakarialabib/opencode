#!/usr/bin/env tsx
import { indexProject } from "../retrieval/indexer.js";

const projectRoot = process.cwd();
console.log("\n🔄 Brain Harness Indexer\n");
console.log("─".repeat(40));
console.log(`Project: ${projectRoot}\n`);

const startTime = Date.now();
try {
  const chunks = await indexProject(projectRoot);
  const duration = Date.now() - startTime;
  console.log(`\n✅ Indexed ${chunks.length} chunks in ${duration}ms`);
} catch (err: any) {
  console.error(`\n❌ Indexing failed: ${err.message}`);
}
