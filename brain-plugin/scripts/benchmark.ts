#!/usr/bin/env tsx
import { runQuickBenchmark } from "../../meta-harness/evaluator.js";

const projectRoot = process.cwd();
const suite = process.argv.includes("--full") ? "full" : "smoke";

console.log("\n🏃 Brain Harness Benchmark\n");
console.log("─".repeat(40));
console.log(`Suite: ${suite}\n`);

const startTime = Date.now();
try {
  const result = await runQuickBenchmark(projectRoot, suite);
  const duration = Date.now() - startTime;

  console.log(`\n📊 Results (${duration}ms total)`);
  console.log(`  Overall Score:  ${(result.score * 100).toFixed(1)}%`);
  console.log(`  Tasks Run:      ${result.tasksRun}`);
  console.log(`  Avg Latency:    ${result.avgLatencyMs.toFixed(0)}ms`);

  console.log("\n  Per-Intent Scores:");
  for (const [intent, score] of Object.entries(result.metrics)) {
    const bar = "█".repeat(Math.round(score * 10)) + "░".repeat(10 - Math.round(score * 10));
    console.log(`    ${intent.padEnd(15)} [${bar}] ${(score * 100).toFixed(0)}%`);
  }
} catch (err: any) {
  console.error(`\n❌ Benchmark failed: ${err.message}`);
}
