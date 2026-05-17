#!/usr/bin/env npx tsx
/**
 * GPU-Aware Model Loader & Tester
 *
 * Optimized for M4400 (4GB VRAM, 16GB RAM) - Max 5.5GB VRAM usage
 *
 * Usage:
 *   npx tsx scripts/test-gpu-aware.ts [--mode=rag|full|minimal] [--benchmark]
 */

import { existsSync, mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { fileLog, clearLog } from "../meta-harness/utils/logger";
import { DEFAULT_HARNESS_CONFIG } from "../meta-harness/harness-space";
import { loadTasks } from "../meta-harness/benchmark/tasks";
import { evaluateHarness } from "../meta-harness/evaluator";

import {
  defaultProvider,
  GPU_AWARE_MODELS,
  LMStudioProvider,
} from "../brain-plugin/provider/lmstudio";
import * as fusion from "../brain-plugin/retrieval/fusion";
import * as reranker from "../brain-plugin/retrieval/reranker";
import * as tree from "../brain-plugin/tree/engine";

const OUTPUT_DIR = join(process.cwd(), ".opencode", "meta-harness-logs");

// Parse args
const args = process.argv.slice(2);
const mode = args.find((a) => a.startsWith("--mode="))?.split("=")[1] || "rag";
const runBenchmark = args.includes("--benchmark");

interface GPUTestReport {
  timestamp: number;
  mode: string;
  hardwareProfile: {
    vramLimitGB: number;
    systemRAMGB: number;
    gpu: string;
  };
  modelLoading: {
    requested: string[];
    loaded: string[];
    vramUsedGB: number;
    errors: string[];
  };
  brainPluginComponents: {
    fusion: any;
    reranker: any;
    tree: any;
  };
  benchmark: any;
  vramStatus: {
    beforeLoad: number;
    afterLoad: number;
    peakUsage: number;
  };
}

async function loadModelsForMode(provider: LMStudioProvider, targetMode: string) {
  console.log(`\n📦 Loading models for mode: ${targetMode}`);

  const loaded: string[] = [];
  const errors: string[] = [];

  if (targetMode === "minimal") {
    // Embedding only - ~0.8GB VRAM
    console.log(`   Loading: ${GPU_AWARE_MODELS.embed} (0.8GB VRAM)`);
    try {
      await provider.loadEmbeddingModel();
      loaded.push(GPU_AWARE_MODELS.embed);
    } catch (err: any) {
      errors.push(err.message);
    }
  } else if (targetMode === "rag") {
    // Embedding + Reranker - ~2.3GB VRAM
    console.log(`   Loading: ${GPU_AWARE_MODELS.embed} (0.8GB)`);
    try {
      await provider.loadEmbeddingModel();
      loaded.push(GPU_AWARE_MODELS.embed);
    } catch (err: any) {
      errors.push(`embed: ${err.message}`);
    }

    console.log(`   Loading: ${GPU_AWARE_MODELS.reranker} (1.5GB)`);
    try {
      await provider.loadRerankerModel();
      loaded.push(GPU_AWARE_MODELS.reranker);
    } catch (err: any) {
      errors.push(`reranker: ${err.message}`);
    }
  } else if (targetMode === "full") {
    // Embedding + Reranker + Chat - ~5GB VRAM
    console.log(`   Loading: ${GPU_AWARE_MODELS.embed} (0.8GB)`);
    try {
      await provider.loadEmbeddingModel();
      loaded.push(GPU_AWARE_MODELS.embed);
    } catch (err: any) {
      errors.push(`embed: ${err.message}`);
    }

    console.log(`   Loading: ${GPU_AWARE_MODELS.reranker} (1.5GB)`);
    try {
      await provider.loadRerankerModel();
      loaded.push(GPU_AWARE_MODELS.reranker);
    } catch (err: any) {
      errors.push(`reranker: ${err.message}`);
    }

    console.log(`   Loading: ${GPU_AWARE_MODELS.chat} (2.6GB)`);
    try {
      await provider.loadChatModel();
      loaded.push(GPU_AWARE_MODELS.chat);
    } catch (err: any) {
      errors.push(`chat: ${err.message}`);
    }
  }

  return { loaded, errors };
}

function testBrainComponents() {
  console.log("\n🧠 Testing Brain Plugin components...");

  applyConfig(DEFAULT_HARNESS_CONFIG);

  return {
    fusion: fusion.getFusionWeights(),
    reranker: reranker.getRerankerConfig(),
    tree: tree.getTreeConfig(),
  };
}

function applyConfig(config: any) {
  fusion.setFusionWeights(config.fusionAlpha, config.fusionBeta, config.fusionGamma);
  fusion.setMemoryBoost(config.memoryBoost);
  reranker.setRerankerConfidenceGate(config.confidenceGate);
  reranker.setRerankMinResults(config.rerankMinResults);
  reranker.setRerankerMaxChunks(config.rerankerMaxChunks);
  tree.setIntentThresholds(config.intentThresholds);
  tree.setChunkCounts(config.chunkCounts);
}

async function runSmokeBenchmark(provider: LMStudioProvider) {
  console.log("\n📊 Running smoke benchmark...");

  const tasks = loadTasks("smoke");

  // Create LM Studio client wrapper
  const lmStudioClient = {
    config: {
      baseUrl: provider.baseURL || "http://127.0.0.1:1234",
      chatModel: GPU_AWARE_MODELS.chat,
      embedModel: GPU_AWARE_MODELS.embed,
      rerankerModel: GPU_AWARE_MODELS.reranker,
    },
    async chatCompletion(messages: any[], options: any) {
      try {
        const result = await provider.chat(GPU_AWARE_MODELS.chat, messages, options);
        return { choices: [{ message: { content: result } }] };
      } catch (err: any) {
        throw new Error(`Chat failed: ${err.message}`);
      }
    },
    async listModels() {
      return provider.getLoadedModels().then((loaded) => loaded.map((m) => ({ key: m })));
    },
  };

  const logger = (msg: string) => fileLog(`[Benchmark] ${msg}`);

  const result = await evaluateHarness(
    DEFAULT_HARNESS_CONFIG,
    tasks,
    lmStudioClient as any,
    logger
  );

  console.log(`   Score: ${result.score.toFixed(4)}`);

  return {
    score: result.score,
    metrics: result.metrics,
    tasks: result.raw.length,
  };
}

async function main() {
  console.log("╔════════════════════════════════════════════════════════════╗");
  console.log("║  GPU-Aware Model Loading Test (M4400 Optimized)            ║");
  console.log("╚════════════════════════════════════════════════════════════╝");

  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  clearLog();
  fileLog("=== GPU-Aware Test Started ===");

  const report: GPUTestReport = {
    timestamp: Date.now(),
    mode,
    hardwareProfile: {
      vramLimitGB: 5.5, // M4400 with headroom
      systemRAMGB: 16,
      gpu: "NVIDIA M4400 (4GB GDDR5)",
    },
    modelLoading: { requested: [], loaded: [], vramUsedGB: 0, errors: [] },
    brainPluginComponents: { fusion: null, reranker: null, tree: null },
    benchmark: null,
    vramStatus: { beforeLoad: 0, afterLoad: 0, peakUsage: 0 },
  };

  // Set LM Studio URL
  const lmStudioUrl = process.env.LM_STUDIO_URL || "http://127.0.0.1:1234";
  defaultProvider.setBaseURL(lmStudioUrl);

  // Record VRAM before loading
  report.vramStatus.beforeLoad = defaultProvider.getCurrentVRAMUsage();

  // Determine requested models based on mode
  if (mode === "minimal") {
    report.modelLoading.requested = [GPU_AWARE_MODELS.embed];
  } else if (mode === "rag") {
    report.modelLoading.requested = [GPU_AWARE_MODELS.embed, GPU_AWARE_MODELS.reranker];
  } else {
    report.modelLoading.requested = [
      GPU_AWARE_MODELS.embed,
      GPU_AWARE_MODELS.reranker,
      GPU_AWARE_MODELS.chat,
    ];
  }

  // Load models
  const loadResult = await loadModelsForMode(defaultProvider, mode);
  report.modelLoading.loaded = loadResult.loaded;
  report.modelLoading.errors = loadResult.errors;
  report.vramStatus.afterLoad = defaultProvider.getCurrentVRAMUsage();
  report.modelLoading.vramUsedGB = report.vramStatus.afterLoad;

  console.log(`\n📊 VRAM Usage: ${report.vramStatus.afterLoad.toFixed(1)}GB / 5.5GB max`);

  // Test brain components
  report.brainPluginComponents = testBrainComponents();

  // Run benchmark if requested
  if (runBenchmark && report.modelLoading.loaded.length > 0) {
    report.benchmark = await runSmokeBenchmark(defaultProvider);
  }

  // Save report
  const reportFile = join(OUTPUT_DIR, `gpu-test-${mode}.json`);
  writeFileSync(reportFile, JSON.stringify(report, null, 2));

  // Print summary
  console.log("\n╔════════════════════════════════════════════════════════════╗");
  console.log("║                    TEST SUMMARY                            ║");
  console.log("╚════════════════════════════════════════════════════════════╝");
  console.log(`Mode: ${mode}`);
  console.log(
    `Models loaded: ${report.modelLoading.loaded.length}/${report.modelLoading.requested.length}`
  );
  for (const m of report.modelLoading.loaded) console.log(`   ✓ ${m}`);
  console.log(`VRAM used: ${report.vramStatus.afterLoad.toFixed(1)}GB / 5.5GB`);
  if (report.benchmark) {
    console.log(`Benchmark score: ${report.benchmark.score.toFixed(4)}`);
  }
  if (report.modelLoading.errors.length > 0) {
    console.log(`Errors: ${report.modelLoading.errors.join(", ")}`);
  }
  console.log(`\n📄 Report: ${reportFile}`);

  fileLog("=== GPU-Aware Test Completed ===");
}

main().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
