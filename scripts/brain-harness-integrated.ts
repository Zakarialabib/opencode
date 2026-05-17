#!/usr/bin/env npx tsx
/**
 * Brain Plugin + Meta-Harness Integration Test
 *
 * GPU-optimized for M4400 (4GB VRAM, 16GB RAM)
 * - Loads embedding model (keep loaded for RAG)
 * - Loads reranker on-demand (evicts when chat needed)
 * - Loads chat model for meta-harness (evicts reranker)
 *
 * Usage:
 *   npx tsx scripts/brain-harness-integrated.ts [--mode=rag|full|minimal] [--optimize]
 */

import { existsSync, mkdirSync, writeFileSync, appendFileSync } from "fs";
import { join } from "path";
import { fileLog, clearLog } from "../meta-harness/utils/logger";
import { DEFAULT_HARNESS_CONFIG, validateConfig } from "../meta-harness/harness-space";
import { loadTasks } from "../meta-harness/benchmark/tasks";
import { evaluateHarness } from "../meta-harness/evaluator";
import { proposeHarness } from "../meta-harness/proposer";

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
const runOptimization = args.includes("--optimize");

interface IntegrationReport {
  timestamp: number;
  hardwareProfile: {
    vramMaxGB: number;
    ramGB: number;
    gpu: string;
  };
  phases: {
    name: string;
    modelsLoaded: string[];
    vramGB: number;
    durationMs: number;
    status: "success" | "failed";
    error?: string;
  }[];
  finalState: {
    embeddingLoaded: boolean;
    rerankerLoaded: boolean;
    chatLoaded: boolean;
    totalVRAMGB: number;
  };
  benchmarkScore: number | null;
  optimizationResult: {
    iterations: number;
    bestScore: number;
    bestConfig: any;
  } | null;
}

async function loadEmbedding(provider: LMStudioProvider): Promise<boolean> {
  console.log("\n📦 Phase 1: Loading embedding model...");
  const start = Date.now();
  try {
    await provider.loadEmbeddingModel();
    const elapsed = Date.now() - start;
    console.log(
      `   ✓ Loaded in ${elapsed}ms (VRAM: ${provider.getCurrentVRAMUsage().toFixed(1)}GB)`
    );
    return true;
  } catch (err: any) {
    console.log(`   ✗ Failed: ${err.message}`);
    return false;
  }
}

async function loadReranker(provider: LMStudioProvider): Promise<boolean> {
  console.log("\n📦 Phase 2: Loading reranker model...");
  const start = Date.now();
  try {
    await provider.loadRerankerModel();
    const elapsed = Date.now() - start;
    console.log(
      `   ✓ Loaded in ${elapsed}ms (VRAM: ${provider.getCurrentVRAMUsage().toFixed(1)}GB)`
    );
    return true;
  } catch (err: any) {
    console.log(`   ✗ Failed: ${err.message}`);
    return false;
  }
}

async function unloadReranker(provider: LMStudioProvider): Promise<void> {
  console.log("\n🗑️ Evicting reranker to free VRAM...");
  try {
    await provider.evictModel(GPU_AWARE_MODELS.reranker);
    console.log(`   ✓ Evicted (VRAM: ${provider.getCurrentVRAMUsage().toFixed(1)}GB)`);
  } catch (err: any) {
    console.log(`   ✗ Evict failed: ${err.message}`);
  }
}

async function loadChat(provider: LMStudioProvider): Promise<boolean> {
  console.log("\n📦 Phase 3: Loading chat model...");
  const start = Date.now();
  try {
    await provider.loadChatModel();
    const elapsed = Date.now() - start;
    console.log(
      `   ✓ Loaded in ${elapsed}ms (VRAM: ${provider.getCurrentVRAMUsage().toFixed(1)}GB)`
    );
    return true;
  } catch (err: any) {
    console.log(`   ✗ Failed: ${err.message}`);
    return false;
  }
}

async function runBenchmark(provider: LMStudioProvider, config: any): Promise<number> {
  console.log("\n📊 Running benchmark...");
  const tasks = loadTasks("smoke");

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
        return {
          choices: [{ message: { content: "Fallback response due to error: " + err.message } }],
        };
      }
    },
    async listModels() {
      return provider.getLoadedModels().then((loaded) => loaded.map((m) => ({ key: m })));
    },
  };

  const logger = (msg: string) => fileLog(`[Benchmark] ${msg}`);
  const result = await evaluateHarness(config, tasks, lmStudioClient as any, logger);
  console.log(`   Score: ${result.score.toFixed(4)}`);
  return result.score;
}

async function runMetaHarnessOptimization(
  provider: LMStudioProvider,
  iterations: number
): Promise<{
  bestScore: number;
  bestConfig: any;
  history: any[];
}> {
  console.log(`\n🔄 Meta-Harness Optimization (${iterations} iterations)...`);

  const tasks = loadTasks("smoke");
  const history: any[] = [];
  let bestScore = 0;
  let bestConfig = { ...DEFAULT_HARNESS_CONFIG };
  let currentConfig = { ...DEFAULT_HARNESS_CONFIG };

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

  const logger = (msg: string) => fileLog(`[Optimize] ${msg}`);

  for (let i = 0; i < iterations; i++) {
    console.log(`   Iteration ${i + 1}/${iterations}...`);

    try {
      const result = await evaluateHarness(currentConfig, tasks, lmStudioClient as any, logger);

      if (result.score > bestScore) {
        bestScore = result.score;
        bestConfig = { ...currentConfig };
        console.log(`      ✓ New best: ${bestScore.toFixed(4)}`);
      }

      history.push({
        iteration: i + 1,
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
      if (i < iterations - 1) {
        const { proposedConfig } = await proposeHarness(
          currentConfig,
          history,
          lmStudioClient as any,
          logger
        );
        currentConfig = proposedConfig;
      }
    } catch (err: any) {
      console.log(`      ✗ Failed: ${err.message}`);
    }
  }

  return { bestScore, bestConfig, history };
}

function applyBrainConfig(config: any) {
  fusion.setFusionWeights(config.fusionAlpha, config.fusionBeta, config.fusionGamma);
  fusion.setMemoryBoost(config.memoryBoost);
  reranker.setRerankerConfidenceGate(config.confidenceGate);
  reranker.setRerankMinResults(config.rerankMinResults);
  reranker.setRerankerMaxChunks(config.rerankerMaxChunks);
  tree.setIntentThresholds(config.intentThresholds);
  tree.setChunkCounts(config.chunkCounts);
}

async function main() {
  console.log("╔════════════════════════════════════════════════════════════╗");
  console.log("║  Brain Plugin + Meta-Harness Integration Test             ║");
  console.log("║  GPU-Optimized for M4400 (4GB VRAM / 16GB RAM)            ║");
  console.log("╚════════════════════════════════════════════════════════════╝");

  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  clearLog();
  fileLog("=== Brain+Harness Integration Started ===");

  const report: IntegrationReport = {
    timestamp: Date.now(),
    hardwareProfile: {
      vramMaxGB: 5.5,
      ramGB: 16,
      gpu: "NVIDIA M4400 (4GB GDDR5)",
    },
    phases: [],
    finalState: {
      embeddingLoaded: false,
      rerankerLoaded: false,
      chatLoaded: false,
      totalVRAMGB: 0,
    },
    benchmarkScore: null,
    optimizationResult: null,
  };

  // Set LM Studio URL
  const lmStudioUrl = process.env.LM_STUDIO_URL || "http://127.0.0.1:1234";
  defaultProvider.setBaseURL(lmStudioUrl);

  // Apply default config to brain plugin
  applyBrainConfig(DEFAULT_HARNESS_CONFIG);
  console.log("\n🧠 Brain plugin configured with default harness settings");

  // === PHASE 1: Embedding (always needed for RAG) ===
  let embeddingOk = await loadEmbedding(defaultProvider);
  report.phases.push({
    name: "Load Embedding",
    modelsLoaded: embeddingOk ? [GPU_AWARE_MODELS.embed] : [],
    vramGB: defaultProvider.getCurrentVRAMUsage(),
    durationMs: 0,
    status: embeddingOk ? "success" : "failed",
    error: embeddingOk ? undefined : "Failed to load",
  });
  report.finalState.embeddingLoaded = embeddingOk;

  // === PHASE 2: Reranker (for RAG mode or full mode) ===
  let rerankerOk = false;
  if (mode === "rag" || mode === "full") {
    rerankerOk = await loadReranker(defaultProvider);
    report.phases.push({
      name: "Load Reranker",
      modelsLoaded: rerankerOk ? [GPU_AWARE_MODELS.reranker] : [],
      vramGB: defaultProvider.getCurrentVRAMUsage(),
      durationMs: 0,
      status: rerankerOk ? "success" : "failed",
      error: rerankerOk ? undefined : "Failed to load",
    });
    report.finalState.rerankerLoaded = rerankerOk;
  }

  // === PHASE 3: Chat (only for full mode or optimization) ===
  let chatOk = false;
  if (mode === "full" || runOptimization) {
    // Evict reranker if we need VRAM for chat
    if (rerankerOk && !defaultProvider.canLoadModel(GPU_AWARE_MODELS.chat)) {
      await unloadReranker(defaultProvider);
      report.finalState.rerankerLoaded = false;
    }

    chatOk = await loadChat(defaultProvider);
    report.phases.push({
      name: "Load Chat",
      modelsLoaded: chatOk ? [GPU_AWARE_MODELS.chat] : [],
      vramGB: defaultProvider.getCurrentVRAMUsage(),
      durationMs: 0,
      status: chatOk ? "success" : "failed",
      error: chatOk ? undefined : "Failed to load",
    });
    report.finalState.chatLoaded = chatOk;
  }

  report.finalState.totalVRAMGB = defaultProvider.getCurrentVRAMUsage();

  // === Run Benchmark ===
  if (embeddingOk) {
    try {
      const score = await runBenchmark(defaultProvider, DEFAULT_HARNESS_CONFIG);
      report.benchmarkScore = score;
    } catch (err: any) {
      console.log(`   Benchmark failed: ${err.message}`);
    }
  }

  // === Run Optimization (if chat loaded) ===
  if (chatOk && runOptimization) {
    const optResult = await runMetaHarnessOptimization(defaultProvider, 3);
    report.optimizationResult = { iterations: 3, ...optResult };
  }

  // Save report
  const reportFile = join(OUTPUT_DIR, "integration-test.json");
  writeFileSync(reportFile, JSON.stringify(report, null, 2));

  // Summary
  console.log("\n╔════════════════════════════════════════════════════════════╗");
  console.log("║                    INTEGRATION SUMMARY                     ║");
  console.log("╚════════════════════════════════════════════════════════════╝");
  console.log(`Mode: ${mode}`);
  console.log(`VRAM: ${report.finalState.totalVRAMGB.toFixed(1)}GB / 5.5GB`);
  console.log(`Embedding: ${report.finalState.embeddingLoaded ? "✓" : "✗"}`);
  console.log(`Reranker: ${report.finalState.rerankerLoaded ? "✓" : "✗"}`);
  console.log(`Chat: ${report.finalState.chatLoaded ? "✓" : "✗"}`);
  if (report.benchmarkScore) {
    console.log(`Benchmark: ${report.benchmarkScore.toFixed(4)}`);
  }
  if (report.optimizationResult) {
    console.log(`Optimization best: ${report.optimizationResult.bestScore.toFixed(4)}`);
  }
  console.log(`\n📄 Report: ${reportFile}`);

  fileLog("=== Brain+Harness Integration Completed ===");
}

main().catch((err) => {
  console.error("Integration test failed:", err);
  process.exit(1);
});
