/**
 * Meta-Harness Evaluator
 *
 * Runs benchmark tasks against a given harness config and computes
 * aggregate scores across retrieval, generation, efficiency, and token economy.
 */

import { fileLog } from "./utils/logger.js";
import type {
  BrainHarnessConfig,
  BenchmarkTask,
  EvalResult,
  LMStudioClient,
  TaskResult,
} from "./types";
import { DEFAULT_HARNESS_CONFIG } from "./harness-space";

export interface EvaluateOptions {
  config: BrainHarnessConfig;
  tasks: BenchmarkTask[];
  lmStudio: LMStudioClient;
  logger?: (msg: string, level?: "info" | "warn" | "error") => void;
}

/**
 * Evaluate a harness config against benchmark tasks.
 * Returns aggregate score and per-task metrics.
 */
export async function evaluateHarness(
  config: BrainHarnessConfig,
  tasks: BenchmarkTask[],
  lmStudio: LMStudioClient,
  logger?: (msg: string, level?: "info" | "warn" | "error") => void
): Promise<EvalResult> {
  const log = logger || ((msg: string) => fileLog(`[Evaluator] ${msg}`));

  const taskResults: TaskResult[] = [];

  // Track aggregate metrics
  let totalRetrievalScore = 0;
  let totalGenerationScore = 0;
  let totalEfficiencyScore = 0;
  let totalEconomyScore = 0;
  let totalLatencyMs = 0;
  let successfulTasks = 0;

  for (const task of tasks) {
    try {
      const startTime = Date.now();

      // Run the task with current config
      const result = await task.run(config);

      const latency = Date.now() - startTime;

      // Calculate per-task scores
      // 1. Retrieval score: how many gold chunks were retrieved
      const goldMatchCount = result.retrievedChunks.filter((chunk) =>
        task.goldChunks.some((gold) => chunk.includes(gold))
      ).length;
      const retrievalScore =
        task.goldChunks.length > 0
          ? goldMatchCount / task.goldChunks.length
          : result.chunksRetrieved > 0
            ? 0.8
            : 0.2; // Binary for quick_chat

      // 2. Generation score: did output match expected pattern
      const outputMatch =
        typeof task.expectedOutput === "string"
          ? result.llmOutput.includes(task.expectedOutput)
          : task.expectedOutput.test(result.llmOutput);
      const generationScore = outputMatch ? 1.0 : Math.max(0, 1 - result.llmOutput.length / 5000);

      // 3. Efficiency score: ratio of useful chunks to total retrieved
      const efficiencyScore =
        result.chunksRetrieved > 0 ? result.chunksInjected / result.chunksRetrieved : 0;

      // 4. Token economy: how much of the context was actually used
      const wasteRatio = result.tokensWasted / (result.tokensUsed + result.tokensWasted + 1);
      const economyScore = Math.max(0, 1 - wasteRatio);

      const taskScore =
        0.3 * retrievalScore + 0.35 * generationScore + 0.2 * efficiencyScore + 0.15 * economyScore;

      const taskResult: TaskResult = {
        taskName: task.name,
        taskScore,
        latency,
        intent: result.intent,
        retrieval: retrievalScore,
        generation: generationScore,
        efficiency: efficiencyScore,
        economy: economyScore,
        chunksRetrieved: result.chunksRetrieved,
        chunksInjected: result.chunksInjected,
        tokensUsed: result.tokensUsed,
        tokensWasted: result.tokensWasted,
        llmOutput: result.llmOutput.slice(0, 500), // Truncate for logs
        expectedMatch: outputMatch,
      };

      taskResults.push(taskResult);

      // Aggregate
      totalRetrievalScore += retrievalScore;
      totalGenerationScore += generationScore;
      totalEfficiencyScore += efficiencyScore;
      totalEconomyScore += economyScore;
      totalLatencyMs += latency;
      if (outputMatch) successfulTasks++;
    } catch (err) {
      log(`Task ${task.name} failed: ${err}`, "error");
      taskResults.push({
        taskName: task.name,
        taskScore: 0,
        latency: 0,
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
      });
    }
  }

  const numTasks = tasks.length || 1;

  // Compute aggregate metrics
  const metrics = {
    retrievalAccuracy: totalRetrievalScore / numTasks,
    contextEfficiency: totalEfficiencyScore / numTasks,
    tokenEconomy: totalEconomyScore / numTasks,
    taskSuccessRate: successfulTasks / numTasks,
    latencyMs: totalLatencyMs,
    intentPrecision: computeIntentPrecision(taskResults),
  };

  // Compute weighted aggregate score (matches README: 30% retrieval + 35% generation + 20% efficiency + 15% token economy)
  const aggregateScore =
    0.3 * metrics.retrievalAccuracy +
    0.35 * metrics.taskSuccessRate + // Using task success as proxy for generation quality
    0.2 * metrics.contextEfficiency +
    0.15 * metrics.tokenEconomy;

  return {
    score: aggregateScore,
    metrics,
    raw: taskResults,
  };
}

/**
 * Compute per-intent precision scores for detailed analysis.
 */
function computeIntentPrecision(taskResults: TaskResult[]): Record<string, number> {
  const intentMap: Record<string, { total: number; scores: number[] }> = {};

  for (const result of taskResults) {
    if (!intentMap[result.intent]) {
      intentMap[result.intent] = { total: 0, scores: [] };
    }
    intentMap[result.intent].total++;
    intentMap[result.intent].scores.push(result.taskScore);
  }

  const precision: Record<string, number> = {};
  for (const [intent, data] of Object.entries(intentMap)) {
    precision[intent] = data.scores.reduce((a, b) => a + b, 0) / data.scores.length;
  }

  return precision;
}

/**
 * Quick smoke test to verify the evaluator works.
 */
export async function smokeTest(): Promise<boolean> {
  const { loadTasks } = await import("./benchmark/tasks");

  try {
    const tasks = loadTasks("smoke");
    const lmStudio = new (await import("./lmstudio-client")).LMStudioClient({
      baseUrl: "http://127.0.0.1:1234",
      chatModel: "qwen3.5-4b-claude-4.6-opus-reasoning-distilled-v2",
      embedModel: "text-embedding-qwen3-embedding-0.6b",
      rerankerModel: "qwen3-reranker-0.6b",
    });

    const result = await evaluateHarness(DEFAULT_HARNESS_CONFIG, tasks, lmStudio);

    console.log(`Smoke test passed. Score: ${result.score.toFixed(4)}`);
    return true;
  } catch (err) {
    console.error("Smoke test failed:", err);
    return false;
  }
}

export async function runQuickBenchmark(
  projectRoot: string,
  suite: "smoke" | "full" = "smoke"
): Promise<{ score: number; tasksRun: number; avgLatencyMs: number; metrics: Record<string, number> }> {
  const { loadTasks } = await import("./benchmark/tasks");
  const tasks = loadTasks(suite);
  
  const results: any[] = [];
  let totalLatency = 0;
  
  for (const task of tasks) {
    const startTime = Date.now();
    try {
      const result = await task.run(DEFAULT_HARNESS_CONFIG);
      const latency = Date.now() - startTime;
      totalLatency += latency;
      results.push({ name: task.name, intent: task.intent, score: result.llmOutput.length > 0 ? 0.7 : 0.3, latency });
    } catch {
      results.push({ name: task.name, score: 0, latency: 0 });
    }
  }
  
  const avgLatency = totalLatency / results.length;
  const avgScore = results.reduce((s, r) => s + r.score, 0) / results.length;
  
  const metrics: Record<string, number> = {};
  const byIntent: Record<string, number[]> = {};
  for (const r of results) {
    if (!byIntent[r.intent]) byIntent[r.intent] = [];
    byIntent[r.intent].push(r.score);
  }
  for (const [intent, scores] of Object.entries(byIntent)) {
    metrics[intent] = scores.reduce((s, v) => s + v, 0) / scores.length;
  }
  
  return { score: avgScore, tasksRun: results.length, avgLatencyMs: avgLatency, metrics };
}
