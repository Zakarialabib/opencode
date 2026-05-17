/**
 * Meta-Harness Benchmark Runner
 *
 * Standalone benchmark execution for testing brain plugin retrieval pipeline.
 * Can run in two modes:
 * - LIVE: Uses actual brain plugin retrieval (requires indexed project)
 * - SIMULATED: Uses simulated retrieval (for testing without LM Studio)
 *
 * Results are saved to .opencode/meta-harness-logs/
 */

import { appendFileSync, existsSync, mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { fileLog } from "./utils/logger";
import { DEFAULT_HARNESS_CONFIG, applyHarnessConfig, validateConfig } from "./harness-space";
import { LMStudioClient } from "./lmstudio-client";
import type { BrainHarnessConfig, BenchmarkTask, TaskResult } from "./types";

// Import brain plugin modules for live testing
import { searchProjectContext } from "../brain-plugin/retrieval/searcher";
import { contextInjector } from "../brain-plugin/context/injector";
import { setFusionWeights, setMemoryBoost } from "../brain-plugin/retrieval/fusion";
import {
  setRerankerConfidenceGate,
  setRerankMinResults,
  setRerankerMaxChunks,
} from "../brain-plugin/retrieval/reranker";
import { setIntentThresholds, setChunkCounts } from "../brain-plugin/tree/engine";

export type BenchmarkMode = "live" | "simulated";

export interface BenchmarkConfig {
  mode: BenchmarkMode;
  projectRoot: string;
  outputDir: string;
  config: BrainHarnessConfig;
  tasks: BenchmarkTask[];
}

export interface BenchmarkResult {
  timestamp: number;
  mode: BenchmarkMode;
  config: BrainHarnessConfig;
  tasks: TaskResult[];
  aggregate: {
    score: number;
    retrievalAccuracy: number;
    contextEfficiency: number;
    tokenEconomy: number;
    taskSuccessRate: number;
    latencyMs: number;
  };
}

/**
 * Apply harness configuration to brain plugin modules.
 */
export function applyConfigToBrain(config: BrainHarnessConfig): void {
  // Apply fusion weights
  setFusionWeights(config.fusionAlpha, config.fusionBeta, config.fusionGamma);
  setMemoryBoost(config.memoryBoost);

  // Apply reranker settings
  setRerankerConfidenceGate(config.confidenceGate);
  setRerankMinResults(config.rerankMinResults);
  setRerankerMaxChunks(config.rerankerMaxChunks);

  // Apply tree settings
  setIntentThresholds(config.intentThresholds);
  setChunkCounts(config.chunkCounts);

  // Apply context settings
  // (contextInjector uses these internally when injecting)
}

/**
 * Run a single benchmark task in LIVE mode (uses actual brain retrieval).
 */
async function runLiveTask(
  task: BenchmarkTask,
  projectRoot: string,
  config: BrainHarnessConfig
): Promise<TaskResult> {
  const startTime = Date.now();

  try {
    // Run the actual brain retrieval
    const result = await task.run(config);

    const latency = Date.now() - startTime;

    // Check if output matches expected
    const outputMatch =
      typeof task.expectedOutput === "string"
        ? result.llmOutput.includes(task.expectedOutput)
        : task.expectedOutput.test(result.llmOutput);

    return {
      taskName: task.name,
      taskScore: result.llmOutput.length > 0 ? (outputMatch ? 0.8 : 0.4) : 0,
      latency,
      intent: result.intent,
      retrieval: result.chunksRetrieved > 0 ? 0.7 : 0,
      generation: outputMatch ? 1.0 : 0.5,
      efficiency: result.chunksInjected / Math.max(1, result.chunksRetrieved),
      economy: 1 - result.tokensWasted / Math.max(1, result.tokensUsed + result.tokensWasted),
      chunksRetrieved: result.chunksRetrieved,
      chunksInjected: result.chunksInjected,
      tokensUsed: result.tokensUsed,
      tokensWasted: result.tokensWasted,
      llmOutput: result.llmOutput.slice(0, 500),
      expectedMatch: outputMatch,
    };
  } catch (err: any) {
    return {
      taskName: task.name,
      taskScore: 0,
      latency: Date.now() - startTime,
      intent: task.intent,
      retrieval: 0,
      generation: 0,
      efficiency: 0,
      economy: 0,
      chunksRetrieved: 0,
      chunksInjected: 0,
      tokensUsed: 0,
      tokensWasted: 0,
      llmOutput: "",
      expectedMatch: false,
    };
  }
}

/**
 * Run benchmark suite and return aggregated results.
 */
export async function runBenchmark(config: BenchmarkConfig): Promise<BenchmarkResult> {
  const { mode, projectRoot, outputDir, config: harnessConfig, tasks } = config;

  fileLog(`Starting benchmark in ${mode} mode with ${tasks.length} tasks`);

  // Ensure output directory exists
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  // Apply harness config to brain plugin
  applyConfigToBrain(harnessConfig);

  const taskResults: TaskResult[] = [];
  let totalLatency = 0;
  let totalRetrieval = 0;
  let totalEfficiency = 0;
  let totalEconomy = 0;
  let successfulTasks = 0;

  for (const task of tasks) {
    fileLog(`Running task: ${task.name}`);

    let result: TaskResult;

    if (mode === "live") {
      result = await runLiveTask(task, projectRoot, harnessConfig);
    } else {
      // Simulated mode - run with mock data
      const startTime = Date.now();
      const mockResult = await task.run(harnessConfig);
      const latency = Date.now() - startTime;

      const outputMatch =
        typeof task.expectedOutput === "string"
          ? mockResult.llmOutput.includes(task.expectedOutput)
          : task.expectedOutput.test(mockResult.llmOutput);

      result = {
        taskName: task.name,
        taskScore: outputMatch ? 0.8 : 0.4,
        latency,
        intent: mockResult.intent,
        retrieval: mockResult.chunksRetrieved > 0 ? 0.7 : 0.3,
        generation: outputMatch ? 1.0 : 0.5,
        efficiency: mockResult.chunksInjected / Math.max(1, mockResult.chunksRetrieved),
        economy:
          1 -
          mockResult.tokensWasted / Math.max(1, mockResult.tokensUsed + mockResult.tokensWasted),
        chunksRetrieved: mockResult.chunksRetrieved,
        chunksInjected: mockResult.chunksInjected,
        tokensUsed: mockResult.tokensUsed,
        tokensWasted: mockResult.tokensWasted,
        llmOutput: mockResult.llmOutput.slice(0, 500),
        expectedMatch: outputMatch,
      };
    }

    taskResults.push(result);
    totalLatency += result.latency;
    totalRetrieval += result.retrieval;
    totalEfficiency += result.efficiency;
    totalEconomy += result.economy;
    if (result.expectedMatch) successfulTasks++;

    fileLog(
      `  → ${result.taskName}: score=${result.taskScore.toFixed(3)}, latency=${result.latency}ms, match=${result.expectedMatch}`
    );
  }

  const numTasks = tasks.length || 1;

  const aggregate = {
    score:
      0.3 * (totalRetrieval / numTasks) +
      0.35 * (successfulTasks / numTasks) +
      0.2 * (totalEfficiency / numTasks) +
      0.15 * (totalEconomy / numTasks),
    retrievalAccuracy: totalRetrieval / numTasks,
    contextEfficiency: totalEfficiency / numTasks,
    tokenEconomy: totalEconomy / numTasks,
    taskSuccessRate: successfulTasks / numTasks,
    latencyMs: totalLatency,
  };

  const result: BenchmarkResult = {
    timestamp: Date.now(),
    mode,
    config: harnessConfig,
    tasks: taskResults,
    aggregate,
  };

  // Save results
  const resultFile = join(outputDir, `benchmark_${Date.now()}.json`);
  writeFileSync(resultFile, JSON.stringify(result, null, 2));
  fileLog(`Benchmark results saved to: ${resultFile}`);

  // Also append to history
  const historyFile = join(outputDir, "benchmark_history.jsonl");
  appendFileSync(
    historyFile,
    JSON.stringify({
      timestamp: result.timestamp,
      mode: result.mode,
      score: result.aggregate.score,
      config: {
        fusionAlpha: harnessConfig.fusionAlpha,
        fusionBeta: harnessConfig.fusionBeta,
        fusionGamma: harnessConfig.fusionGamma,
        memoryBoost: harnessConfig.memoryBoost,
        confidenceGate: harnessConfig.confidenceGate,
        maxContextTokens: harnessConfig.maxContextTokens,
      },
      metrics: result.aggregate,
    }) + "\n"
  );

  return result;
}

/**
 * Quick smoke test to verify benchmark runner works.
 */
export async function smokeTest(): Promise<boolean> {
  const { loadTasks } = await import("./benchmark/tasks");

  const outputDir = join(process.cwd(), ".opencode", "meta-harness-logs");

  const config: BenchmarkConfig = {
    mode: "simulated",
    projectRoot: process.cwd(),
    outputDir,
    config: DEFAULT_HARNESS_CONFIG,
    tasks: loadTasks("smoke"),
  };

  try {
    const result = await runBenchmark(config);
    console.log(`Smoke test passed. Score: ${result.aggregate.score.toFixed(4)}`);
    return true;
  } catch (err) {
    console.error("Smoke test failed:", err);
    return false;
  }
}

// CLI entry point
if (require.main === module) {
  const args = process.argv.slice(2);
  const mode = args.includes("--live") ? "live" : "simulated";
  const iterations = parseInt(
    args.find((a) => a.startsWith("--iterations="))?.split("=")[1] || "1",
    10
  );

  console.log(`Running benchmark: mode=${mode}, iterations=${iterations}`);

  smokeTest().then((passed) => {
    process.exit(passed ? 0 : 1);
  });
}
