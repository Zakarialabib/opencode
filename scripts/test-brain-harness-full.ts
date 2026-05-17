#!/usr/bin/env npx tsx
/**
 * Meta-Harness Model Loader & Tester
 *
 * This script:
 * 1. Programmatically loads models into LM Studio (embed first, reranker, chat last)
 * 2. Tests brain plugin components
 * 3. Runs meta-harness benchmarks
 * 4. Generates comprehensive report
 *
 * Usage:
 *   npx tsx scripts/test-brain-harness.ts --load-models [--live] [--full]
 *
 * Options:
 *   --load-models  Load models into LM Studio before testing
 *   --live         Use live brain retrieval (requires indexed project)
 *   --smoke        Run smoke suite only (default)
 *   --full         Run full benchmark suite
 */

import { existsSync, mkdirSync, writeFileSync, appendFileSync } from "fs";
import { join } from "path";
import { fileLog, clearLog } from "../meta-harness/utils/logger";
import { DEFAULT_HARNESS_CONFIG, validateConfig } from "../meta-harness/harness-space";
import { loadTasks } from "../meta-harness/benchmark/tasks";
import { evaluateHarness } from "../meta-harness/evaluator";
import { proposeHarness } from "../meta-harness/proposer";

// Import brain plugin components
import {
  defaultProvider,
  LMStudioProvider,
  META_HARNESS_MODELS,
} from "../brain-plugin/provider/lmstudio";
import { searchProjectContext } from "../brain-plugin/retrieval/searcher";
import { contextInjector } from "../brain-plugin/context/injector";
import * as fusion from "../brain-plugin/retrieval/fusion";
import * as reranker from "../brain-plugin/retrieval/reranker";
import * as tree from "../brain-plugin/tree/engine";

interface TestReport {
  timestamp: number;
  modelLoading: {
    requested: string[];
    loaded: string[];
    missing: string[];
    errors: string[];
  };
  lmStudioStatus: {
    available: boolean;
    baseUrl: string;
    loadedModels: string[];
  };
  brainPluginComponents: {
    fusion: { configured: boolean; weights: any };
    reranker: { configured: boolean; config: any };
    tree: { configured: boolean; config: any };
  };
  benchmarkResults: {
    smoke: any | null;
    full: any | null;
  };
  metaHarnessOptimization: {
    iterations: number;
    bestScore: number;
    bestConfig: any;
    history: any[];
  };
  errors: string[];
}

const OUTPUT_DIR = join(process.cwd(), ".opencode", "meta-harness-logs");
const REPORT_FILE = join(OUTPUT_DIR, "test-report-full.json");

// CLI args
const args = process.argv.slice(2);
const LOAD_MODELS = args.includes("--load-models");
const LIVE_MODE = args.includes("--live");
const SMOKE_ONLY = args.includes("--smoke") || !args.includes("--full");

async function loadModelsIntoLMStudio(provider: LMStudioProvider): Promise<{
  loaded: string[];
  errors: string[];
}> {
  console.log("\n📦 Loading models into LM Studio...");
  console.log("   Order: embeddings → reranker → chat (qwen last)");

  const loaded: string[] = [];
  const errors: string[] = [];

  // Step 1: Load embedding model FIRST
  console.log(`\n[1/3] Loading embedding model: ${META_HARNESS_MODELS.embedModel}`);
  try {
    await provider.loadEmbeddingModel();
    const success = await provider.waitForModel(META_HARNESS_MODELS.embedModel, 120000);
    if (success) {
      loaded.push(META_HARNESS_MODELS.embedModel);
      console.log(`   ✓ Embedding model loaded`);
    } else {
      errors.push(`Embedding model ${META_HARNESS_MODELS.embedModel} failed to load`);
    }
  } catch (err: any) {
    errors.push(`Embedding model error: ${err.message}`);
    console.log(`   ✗ Failed: ${err.message}`);
  }

  // Step 2: Load reranker model
  console.log(`\n[2/3] Loading reranker model: ${META_HARNESS_MODELS.rerankerModel}`);
  try {
    await provider.loadRerankerModel();
    const success = await provider.waitForModel(META_HARNESS_MODELS.rerankerModel, 120000);
    if (success) {
      loaded.push(META_HARNESS_MODELS.rerankerModel);
      console.log(`   ✓ Reranker model loaded`);
    } else {
      errors.push(`Reranker model ${META_HARNESS_MODELS.rerankerModel} failed to load`);
    }
  } catch (err: any) {
    errors.push(`Reranker model error: ${err.message}`);
    console.log(`   ✗ Failed: ${err.message}`);
  }

  // Step 3: Load chat model LAST
  console.log(`\n[3/3] Loading chat model (qwen last): ${META_HARNESS_MODELS.chatModel}`);
  try {
    await provider.loadChatModel();
    const success = await provider.waitForModel(META_HARNESS_MODELS.chatModel, 180000);
    if (success) {
      loaded.push(META_HARNESS_MODELS.chatModel);
      console.log(`   ✓ Chat model loaded`);
    } else {
      errors.push(`Chat model ${META_HARNESS_MODELS.chatModel} failed to load`);
    }
  } catch (err: any) {
    errors.push(`Chat model error: ${err.message}`);
    console.log(`   ✗ Failed: ${err.message}`);
  }

  return { loaded, errors };
}

async function checkLMStudioStatus(provider: LMStudioProvider) {
  console.log("\n📡 Checking LM Studio status...");

  try {
    const models = await provider.getLoadedModels();
    console.log(`   Loaded models: ${models.length}`);
    for (const m of models) console.log(`   - ${m}`);

    return {
      available: true,
      baseUrl: provider.baseURL || "http://127.0.0.1:1234",
      loadedModels: models,
    };
  } catch (err: any) {
    console.log(`   ✗ LM Studio unavailable: ${err.message}`);
    return {
      available: false,
      baseUrl: provider.baseURL || "http://127.0.0.1:1234",
      loadedModels: [],
    };
  }
}

function testBrainPluginComponents() {
  console.log("\n🧠 Testing Brain Plugin components...");

  // Apply default harness config
  applyConfigToBrain(DEFAULT_HARNESS_CONFIG);

  const fusionWeights = fusion.getFusionWeights();
  const rerankerConfig = reranker.getRerankerConfig();
  const treeConfig = tree.getTreeConfig();

  console.log(
    `   Fusion: α=${fusionWeights.alpha.toFixed(2)}, β=${fusionWeights.beta.toFixed(2)}, γ=${fusionWeights.gamma.toFixed(2)}`
  );
  console.log(
    `   Reranker: gate=${rerankerConfig.confidenceGate}, minResults=${rerankerConfig.rerankMinResults}`
  );
  console.log(`   Tree: ${Object.keys(treeConfig.intentThresholds).length} intents configured`);

  return {
    fusion: { configured: true, weights: fusionWeights },
    reranker: { configured: true, config: rerankerConfig },
    tree: { configured: true, config: treeConfig },
  };
}

function applyConfigToBrain(config: any): void {
  fusion.setFusionWeights(config.fusionAlpha, config.fusionBeta, config.fusionGamma);
  fusion.setMemoryBoost(config.memoryBoost);
  reranker.setRerankerConfidenceGate(config.confidenceGate);
  reranker.setRerankMinResults(config.rerankMinResults);
  reranker.setRerankerMaxChunks(config.rerankerMaxChunks);
  tree.setIntentThresholds(config.intentThresholds);
  tree.setChunkCounts(config.chunkCounts);
}

async function runBenchmark(
  suite: "smoke" | "full",
  provider: LMStudioProvider,
  logger: any
): Promise<any> {
  console.log(`\n📊 Running ${suite} benchmark...`);

  const tasks = loadTasks(suite);
  console.log(`   Tasks: ${tasks.length}`);

  try {
    const config = { ...DEFAULT_HARNESS_CONFIG };

    // Create a simple LM Studio client wrapper for evaluator
    const lmStudioClient = {
      config: {
        baseUrl: provider.baseURL || "http://127.0.0.1:1234",
        chatModel: META_HARNESS_MODELS.chatModel,
        embedModel: META_HARNESS_MODELS.embedModel,
        rerankerModel: META_HARNESS_MODELS.rerankerModel,
      },
      async chatCompletion(messages: any[], options: any) {
        try {
          const result = await provider.chat(META_HARNESS_MODELS.chatModel, messages, options);
          return { choices: [{ message: { content: result } }] };
        } catch (err: any) {
          throw new Error(`Chat failed: ${err.message}`);
        }
      },
      async getEmbeddings(texts: string[]) {
        try {
          return await provider.embed(META_HARNESS_MODELS.embedModel, texts);
        } catch (err: any) {
          throw new Error(`Embedding failed: ${err.message}`);
        }
      },
      async listModels() {
        return provider.getLoadedModels().then((loaded) => loaded.map((m) => ({ key: m })));
      },
    };

    const result = await evaluateHarness(config, tasks, lmStudioClient as any, logger);

    console.log(`   Score: ${result.score.toFixed(4)}`);
    console.log(`   Retrieval: ${result.metrics.retrievalAccuracy.toFixed(2)}`);
    console.log(`   Efficiency: ${result.metrics.contextEfficiency.toFixed(2)}`);

    return {
      timestamp: Date.now(),
      mode: LIVE_MODE ? "live" : "simulated",
      config,
      tasks: result.raw,
      aggregate: result.metrics,
    };
  } catch (err: any) {
    console.log(`   ✗ Benchmark failed: ${err.message}`);
    return null;
  }
}

async function runOptimization(
  iterations: number,
  provider: LMStudioProvider,
  logger: any
): Promise<any> {
  console.log(`\n🔄 Running Meta-Harness optimization (${iterations} iterations)...`);

  const history: any[] = [];
  let bestScore = 0;
  let bestConfig: any = null;

  // Create LM Studio client wrapper
  const lmStudioClient = {
    config: {
      baseUrl: provider.baseURL || "http://127.0.0.1:1234",
      chatModel: META_HARNESS_MODELS.chatModel,
      embedModel: META_HARNESS_MODELS.embedModel,
      rerankerModel: META_HARNESS_MODELS.rerankerModel,
    },
    async chatCompletion(messages: any[], options: any) {
      try {
        const result = await provider.chat(META_HARNESS_MODELS.chatModel, messages, options);
        return { choices: [{ message: { content: result } }] };
      } catch (err: any) {
        throw new Error(`Chat failed: ${err.message}`);
      }
    },
    async listModels() {
      return provider.getLoadedModels().then((loaded) => loaded.map((m) => ({ key: m })));
    },
  };

  const tasks = loadTasks("smoke");
  let currentConfig = { ...DEFAULT_HARNESS_CONFIG };

  for (let iter = 0; iter < iterations; iter++) {
    console.log(`   Iteration ${iter + 1}/${iterations}...`);

    try {
      const result = await evaluateHarness(currentConfig, tasks, lmStudioClient as any, logger);

      if (result.score > bestScore) {
        bestScore = result.score;
        bestConfig = { ...currentConfig };
      }

      history.push({
        iteration: iter + 1,
        score: result.score,
        config: {
          fusionAlpha: currentConfig.fusionAlpha,
          fusionBeta: currentConfig.fusionBeta,
          fusionGamma: currentConfig.fusionGamma,
          memoryBoost: currentConfig.memoryBoost,
          confidenceGate: currentConfig.confidenceGate,
        },
      });

      // Propose next config
      if (iter < iterations - 1) {
        const { proposedConfig } = await proposeHarness(
          currentConfig,
          history,
          lmStudioClient as any,
          logger
        );
        currentConfig = proposedConfig;
      }
    } catch (err: any) {
      console.log(`   ✗ Iteration failed: ${err.message}`);
    }
  }

  console.log(`   ✓ Best score: ${bestScore.toFixed(4)}`);

  return { iterations, bestScore, bestConfig, history };
}

async function main() {
  console.log("╔════════════════════════════════════════════════════════════╗");
  console.log("║  Meta-Harness Full Test (with Model Loading)              ║");
  console.log("╚════════════════════════════════════════════════════════════╝");

  const errors: string[] = [];

  // Ensure output directory exists
  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  clearLog();
  fileLog("=== Meta-Harness Full Test Started ===");

  // Initialize report
  const report: TestReport = {
    timestamp: Date.now(),
    modelLoading: { requested: [], loaded: [], missing: [], errors: [] },
    lmStudioStatus: { available: false, baseUrl: "", loadedModels: [] },
    brainPluginComponents: {
      fusion: { configured: false, weights: null },
      reranker: { configured: false, config: null },
      tree: { configured: false, config: null },
    },
    benchmarkResults: { smoke: null, full: null },
    metaHarnessOptimization: { iterations: 0, bestScore: 0, bestConfig: null, history: [] },
    errors: [],
  };

  // Track what we're going to load
  report.modelLoading.requested = [
    META_HARNESS_MODELS.embedModel,
    META_HARNESS_MODELS.rerankerModel,
    META_HARNESS_MODELS.chatModel,
  ];

  // Check and set LM Studio URL from environment or default
  const lmStudioUrl = process.env.LM_STUDIO_URL || "http://127.0.0.1:1234";
  defaultProvider.setBaseURL(lmStudioUrl);

  const logger = (msg: string, level: "info" | "warn" | "error" = "info") => {
    fileLog(`[Test] ${msg}`, level);
    if (level === "error") errors.push(msg);
  };

  // Step 1: Load models if requested
  if (LOAD_MODELS) {
    const result = await loadModelsIntoLMStudio(defaultProvider);
    report.modelLoading.loaded = result.loaded;
    report.modelLoading.errors = result.errors;
    report.modelLoading.missing = report.modelLoading.requested.filter(
      (m) => !result.loaded.includes(m)
    );
  }

  // Step 2: Check LM Studio status
  report.lmStudioStatus = await checkLMStudioStatus(defaultProvider);

  // Step 3: Test Brain Plugin components
  report.brainPluginComponents = testBrainPluginComponents();

  // Step 4: Run benchmarks
  if (SMOKE_ONLY || args.includes("--full")) {
    report.benchmarkResults.smoke = await runBenchmark("smoke", defaultProvider, logger);

    if (!SMOKE_ONLY && report.lmStudioStatus.available) {
      report.benchmarkResults.full = await runBenchmark("full", defaultProvider, logger);
    }
  }

  // Step 5: Run optimization if models are loaded
  const allModelsLoaded = report.modelLoading.loaded.length === 3;
  if (allModelsLoaded && report.lmStudioStatus.available) {
    report.metaHarnessOptimization = await runOptimization(3, defaultProvider, logger);
  } else {
    console.log("\n⏭️  Skipping optimization (not all models loaded)");
  }

  // Finalize
  report.errors = errors;

  // Save report
  writeFileSync(REPORT_FILE, JSON.stringify(report, null, 2));
  console.log(`\n📄 Report saved to: ${REPORT_FILE}`);

  // Print summary
  console.log("\n╔════════════════════════════════════════════════════════════╗");
  console.log("║                    TEST SUMMARY                            ║");
  console.log("╚════════════════════════════════════════════════════════════╝");
  console.log(`LM Studio: ${report.lmStudioStatus.available ? "✅" : "❌"}`);
  console.log(
    `Models loaded: ${report.modelLoading.loaded.length}/${report.modelLoading.requested.length}`
  );
  for (const m of report.modelLoading.loaded) console.log(`   ✓ ${m}`);
  for (const m of report.modelLoading.missing) console.log(`   ✗ ${m}`);

  if (report.benchmarkResults.smoke) {
    console.log(
      `Smoke Score: ${report.benchmarkResults.smoke.aggregate?.score?.toFixed(4) || "N/A"}`
    );
  }
  if (report.benchmarkResults.full) {
    console.log(
      `Full Score: ${report.benchmarkResults.full.aggregate?.score?.toFixed(4) || "N/A"}`
    );
  }

  console.log(`Optimization Best: ${report.metaHarnessOptimization.bestScore.toFixed(4)}`);
  console.log(`Errors: ${errors.length}`);

  fileLog("=== Meta-Harness Full Test Completed ===");
}

main().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
