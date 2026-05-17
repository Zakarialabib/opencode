/**
 * Meta-Harness for OpenCode Brain Plugin
 *
 * Automated search over task-specific model harnesses.
 * Optimizes retrieval, fusion, reranking, and context injection
 * parameters using LM Studio as the proposer and evaluator backend.
 *
 * @module meta-harness
 */

export { MetaHarnessPlugin } from "./meta-harness";
export { DEFAULT_HARNESS_CONFIG, applyHarnessConfig, validateConfig } from "./harness-space";
export { evaluateHarness } from "./evaluator";
export { proposeHarness } from "./proposer";
export { MetaHarnessLoop } from "./loop";
export { LMStudioClient } from "./lmstudio-client";
export { loadTasks } from "./benchmark/tasks";
export { runBenchmark, applyConfigToBrain, smokeTest } from "./runner";
export type {
  MetaHarnessOptions,
  EvalResult,
  TaskResult,
  BenchmarkTask,
  ProposerResult,
  BrainHarnessConfig,
  LMStudioModel,
  HarnessPopulationMember,
  PluginState,
} from "./types";
export type { BenchmarkMode, BenchmarkConfig, BenchmarkResult } from "./runner";
