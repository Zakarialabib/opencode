#!/usr/bin/env npx tsx
/**
 * Meta-Harness & Brain Plugin Comprehensive Test
 *
 * This script:
 * 1. Checks LM Studio availability and model loading
 * 2. Tests brain plugin components (retrieval, fusion, reranker, tree)
 * 3. Runs meta-harness benchmarks (smoke + full)
 * 4. Generates detailed report of all results
 *
 * Usage:
 *   npx tsx scripts/test-brain-harness.ts [--live] [--smoke] [--full]
 *
 * Options:
 *   --live    Use live brain retrieval (requires indexed project)
 *   --smoke   Run smoke suite only (default)
 *   --full    Run full benchmark suite
 *   --models  Only check model status
 */

import { existsSync, mkdirSync, writeFileSync, appendFileSync, readFileSync } from "fs";
import { join } from "path";
import { fileLog, clearLog } from "../meta-harness/utils/logger";
import { DEFAULT_HARNESS_CONFIG, validateConfig } from "../meta-harness/harness-space";
import { LMStudioClient } from "../meta-harness/lmstudio-client";
import { loadTasks } from "../meta-harness/benchmark/tasks";
import { evaluateHarness } from "../meta-harness/evaluator";
import { proposeHarness } from "../meta-harness/proposer";
import { runBenchmark, applyConfigToBrain, BenchmarkResult } from "../meta-harness/runner";

// Import brain plugin components
import { searchProjectContext } from "../brain-plugin/retrieval/searcher";
import { contextInjector } from "../brain-plugin/context/injector";
import * as fusion from "../brain-plugin/retrieval/fusion";
import * as reranker from "../brain-plugin/retrieval/reranker";
import * as tree from "../brain-plugin/tree/engine";

interface TestReport {
  timestamp: number;
  lmStudioStatus: {
    available: boolean;
    baseUrl: string;
    loadedModels: string[];
    requiredModels: string[];
    missingModels: string[];
  };
  brainPluginComponents: {
    fusion: { configured: boolean; weights: any };
    reranker: { configured: boolean; config: any };
    tree: { configured: boolean; config: any };
  };
  metaHarnessConfig: {
    defaultConfig: BrainHarnessConfig;
    parameterBounds: any;
  };
  benchmarkResults: {
    smoke: BenchmarkResult | null;
    full: BenchmarkResult | null;
  };
  metaHarnessOptimization: {
    iterations: number;
    bestScore: number;
    bestConfig: any;
    history: any[];
  };
  errors: string[];
}

interface BrainHarnessConfig {
  intentThresholds: Record<string, number>;
  chunkCounts: Record<string, number>;
  rerankFlags: Record<string, boolean>;
  fusionAlpha: number;
  fusionBeta: number;
  fusionGamma: number;
  memoryBoost: number;
  confidenceGate: number;
  rerankMinResults: number;
  rerankIntents: string[];
  tokenThresholds: Record<string, number>;
  compressionStrategy: "truncate" | "summarize" | "hybrid";
  contextHeader: string;
  chunkSeparator: string;
  maxContextTokens: number;
  chatTemperature: number;
  chatMaxTokens: number;
  embedBatchSize: number;
  rerankerMaxChunks: number;
}

const OUTPUT_DIR = join(process.cwd(), ".opencode", "meta-harness-logs");
const REPORT_FILE = join(OUTPUT_DIR, "test-report.json");

// CLI args
const args = process.argv.slice(2);
const LIVE_MODE = args.includes("--live");
const SMOKE_ONLY = args.includes("--smoke") || !args.includes("--full");
const MODELS_ONLY = args.includes("--models");

async function checkLMStudioStatus(
  lmStudio: LMStudioClient
): Promise<TestReport["lmStudioStatus"]> {
  console.log("\n📡 Checking LM Studio status...");

  try {
    const models = await lmStudio.listModels();
    const loadedKeys = models.map((m) => m.key);

    const requiredModels = [
      lmStudio.config.chatModel,
      lmStudio.config.embedModel,
      lmStudio.config.rerankerModel,
    ];

    const missing = requiredModels.filter((m) => !loadedKeys.includes(m));

    const status = {
      available: true,
      baseUrl: lmStudio.config.baseUrl,
      loadedModels: loadedKeys,
      requiredModels,
      missingModels: missing,
    };

    if (missing.length > 0) {
      console.log(`⚠️  Missing models: ${missing.join(", ")}`);
    } else {
      console.log(`✅ All required models loaded`);
    }

    return status;
  } catch (err: any) {
    console.log(`❌ LM Studio unavailable: ${err.message}`);
    return {
      available: false,
      baseUrl: lmStudio.config.baseUrl,
      loadedModels: [],
      requiredModels: [
        lmStudio.config.chatModel,
        lmStudio.config.embedModel,
        lmStudio.config.rerankerModel,
      ],
      missingModels: [],
    };
  }
}

async function testBrainPluginComponents(): Promise<TestReport["brainPluginComponents"]> {
  console.log("\n🧠 Testing Brain Plugin components...");

  // Apply default harness config
  applyConfigToBrain(DEFAULT_HARNESS_CONFIG);

  const fusionWeights = fusion.getFusionWeights();
  const rerankerConfig = reranker.getRerankerConfig();
  const treeConfig = tree.getTreeConfig();

  console.log(
    `   Fusion weights: α=${fusionWeights.alpha.toFixed(2)}, β=${fusionWeights.beta.toFixed(2)}, γ=${fusionWeights.gamma.toFixed(2)}`
  );
  console.log(
    `   Reranker: gate=${rerankerConfig.confidenceGate}, minResults=${rerankerConfig.rerankMinResults}`
  );
  console.log(
    `   Tree: intents=${Object.keys(treeConfig.intentThresholds).length}, chunks configured=${Object.keys(treeConfig.chunkCounts).length}`
  );

  return {
    fusion: { configured: true, weights: fusionWeights },
    reranker: { configured: true, config: rerankerConfig },
    tree: { configured: true, config: treeConfig },
  };
}

async function runMetaHarnessBenchmark(
  suite: "smoke" | "full",
  lmStudio: LMStudioClient,
  logger: any
): Promise<BenchmarkResult | null> {
  console.log(`\n📊 Running Meta-Harness ${suite} benchmark...`);

  const tasks = loadTasks(suite);
  console.log(`   Loaded ${tasks.length} tasks`);

  try {
    const config = { ...DEFAULT_HARNESS_CONFIG };

    // Evaluate with default config
    const result = await evaluateHarness(config, tasks, lmStudio, logger);

    console.log(`   Score: ${result.score.toFixed(4)}`);
    console.log(`   Retrieval: ${result.metrics.retrievalAccuracy.toFixed(2)}`);
    console.log(`   Efficiency: ${result.metrics.contextEfficiency.toFixed(2)}`);
    console.log(`   Token Economy: ${result.metrics.tokenEconomy.toFixed(2)}`);
    console.log(`   Task Success: ${result.metrics.taskSuccessRate.toFixed(2)}`);

    return {
      timestamp: Date.now(),
      mode: LIVE_MODE ? "live" : "simulated",
      config,
      tasks: result.raw,
      aggregate: {
        score: result.score,
        retrievalAccuracy: result.metrics.retrievalAccuracy,
        contextEfficiency: result.metrics.contextEfficiency,
        tokenEconomy: result.metrics.tokenEconomy,
        taskSuccessRate: result.metrics.taskSuccessRate,
        latencyMs: result.metrics.latencyMs,
      },
    };
  } catch (err: any) {
    console.log(`   ❌ Benchmark failed: ${err.message}`);
    return null;
  }
}

async function runMetaHarnessOptimization(
  iterations: number,
  lmStudio: LMStudioClient,
  logger: any
): Promise<TestReport["metaHarnessOptimization"]> {
  console.log(`\n🔄 Running Meta-Harness optimization (${iterations} iterations)...`);

  const history: any[] = [];
  let bestScore = 0;
  let bestConfig: any = null;

  try {
    // Run a simplified optimization loop
    const population = [{ config: { ...DEFAULT_HARNESS_CONFIG }, score: 0 }];

    for (let iter = 0; iter < iterations; iter++) {
      console.log(`   Iteration ${iter + 1}/${iterations}...`);

      const tasks = loadTasks("smoke");

      for (const member of population) {
        const result = await evaluateHarness(member.config, tasks, lmStudio, logger);
        member.score = result.score;

        if (result.score > bestScore) {
          bestScore = result.score;
          bestConfig = { ...member.config };
        }

        history.push({
          iteration: iter + 1,
          score: result.score,
          config: {
            fusionAlpha: member.config.fusionAlpha,
            fusionBeta: member.config.fusionBeta,
            fusionGamma: member.config.fusionGamma,
            memoryBoost: member.config.memoryBoost,
            confidenceGate: member.config.confidenceGate,
          },
        });
      }

      // Propose new configs
      if (iter < iterations - 1) {
        const { proposedConfig } = await proposeHarness(
          population[0].config,
          history.slice(-5),
          lmStudio,
          logger
        );
        population.push({ config: proposedConfig, score: 0 });
      }
    }

    console.log(`   ✅ Best score: ${bestScore.toFixed(4)}`);

    return {
      iterations,
      bestScore,
      bestConfig,
      history,
    };
  } catch (err: any) {
    console.log(`   ❌ Optimization failed: ${err.message}`);
    return {
      iterations,
      bestScore,
      bestConfig,
      history,
    };
  }
}

async function testBrainSearchLive(query: string): Promise<any> {
  console.log(`\n🔍 Testing live brain_search: "${query.slice(0, 50)}..."`);

  try {
    const results = await searchProjectContext(process.cwd(), query, 5, "learn");

    console.log(`   Found ${results.length} results`);

    if (results.length > 0) {
      const topResult = results[0];
      console.log(`   Top result: ${topResult.filepath}:${topResult.start_line}`);
    }

    return results;
  } catch (err: any) {
    console.log(`   ❌ Search failed: ${err.message}`);
    return [];
  }
}

async function main() {
  console.log("╔════════════════════════════════════════════════════════════╗");
  console.log("║  Meta-Harness & Brain Plugin Comprehensive Test            ║");
  console.log("╚════════════════════════════════════════════════════════════╝");

  const errors: string[] = [];

  // Ensure output directory exists
  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // Clear previous log
  clearLog();
  fileLog("=== Meta-Harness Comprehensive Test Started ===");

  // Initialize LM Studio client
  const lmStudio = new LMStudioClient({
    baseUrl: process.env.LM_STUDIO_URL || "http://127.0.0.1:1234",
    chatModel:
      process.env.LM_STUDIO_CHAT_MODEL || "qwen3.5-4b-claude-4.6-opus-reasoning-distilled-v2",
    embedModel: process.env.LM_STUDIO_EMBED_MODEL || "text-embedding-qwen3-embedding-0.6b",
    rerankerModel: process.env.LM_STUDIO_RERANKER_MODEL || "qwen3-reranker-0.6b",
  });

  const logger = (msg: string, level: "info" | "warn" | "error" = "info") => {
    fileLog(`[Test] ${msg}`, level);
    if (level === "error") errors.push(msg);
  };

  // Build report
  const report: TestReport = {
    timestamp: Date.now(),
    lmStudioStatus: {
      available: false,
      baseUrl: "",
      loadedModels: [],
      requiredModels: [],
      missingModels: [],
    },
    brainPluginComponents: {
      fusion: { configured: false, weights: null },
      reranker: { configured: false, config: null },
      tree: { configured: false, config: null },
    },
    metaHarnessConfig: {
      defaultConfig: DEFAULT_HARNESS_CONFIG,
      parameterBounds: null,
    },
    benchmarkResults: {
      smoke: null,
      full: null,
    },
    metaHarnessOptimization: {
      iterations: 0,
      bestScore: 0,
      bestConfig: null,
      history: [],
    },
    errors: [],
  };

  // Step 1: Check LM Studio
  report.lmStudioStatus = await checkLMStudioStatus(lmStudio);

  if (MODELS_ONLY) {
    console.log("\n📋 Model check complete. Exiting as requested.");
    writeFileSync(REPORT_FILE, JSON.stringify(report, null, 2));
    return;
  }

  // Step 2: Test Brain Plugin Components
  report.brainPluginComponents = await testBrainPluginComponents();

  // Step 3: Run Meta-Harness Benchmarks
  if (SMOKE_ONLY || args.includes("--full")) {
    report.benchmarkResults.smoke = await runMetaHarnessBenchmark("smoke", lmStudio, logger);

    if (!SMOKE_ONLY) {
      report.benchmarkResults.full = await runMetaHarnessBenchmark("full", lmStudio, logger);
    }
  }

  // Step 4: Run Meta-Harness Optimization (if models available)
  if (report.lmStudioStatus.available && report.lmStudioStatus.missingModels.length === 0) {
    report.metaHarnessOptimization = await runMetaHarnessOptimization(3, lmStudio, logger);
  } else {
    console.log("\n⏭️  Skipping optimization (models not available)");
  }

  // Step 5: Test Live Brain Search (if in live mode)
  if (LIVE_MODE && report.lmStudioStatus.available) {
    await testBrainSearchLive("How does the authentication flow work?");
    await testBrainSearchLive("What is the decision tree logic for intent classification?");
  }

  // Finalize report
  report.errors = errors;

  // Save report
  writeFileSync(REPORT_FILE, JSON.stringify(report, null, 2));
  console.log(`\n📄 Report saved to: ${REPORT_FILE}`);

  // Print summary
  console.log("\n╔════════════════════════════════════════════════════════════╗");
  console.log("║                    TEST SUMMARY                            ║");
  console.log("╚════════════════════════════════════════════════════════════╝");
  console.log(`LM Studio: ${report.lmStudioStatus.available ? "✅ Available" : "❌ Unavailable"}`);
  console.log(
    `Models loaded: ${report.lmStudioStatus.loadedModels.length}/${report.lmStudioStatus.requiredModels.length}`
  );

  if (report.benchmarkResults.smoke) {
    console.log(`Smoke Benchmark: ${report.benchmarkResults.smoke.aggregate.score.toFixed(4)}`);
  }
  if (report.benchmarkResults.full) {
    console.log(`Full Benchmark: ${report.benchmarkResults.full.aggregate.score.toFixed(4)}`);
  }

  console.log(`Meta-Harness Best: ${report.metaHarnessOptimization.bestScore.toFixed(4)}`);
  console.log(`Errors: ${errors.length}`);

  fileLog("=== Meta-Harness Comprehensive Test Completed ===");
}

main().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
