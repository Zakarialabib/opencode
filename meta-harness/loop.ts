/**
 * Meta-Harness Optimization Loop
 *
 * The core meta-learning loop that:
 * 1. Evaluates current harness config on benchmark tasks
 * 2. Proposes mutated configs via LM Studio proposer
 * 3. Selects top-K configs for next iteration
 * 4. Persists best config and history
 */

import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { evaluateHarness } from "./evaluator";
import { proposeHarness } from "./proposer";
import { DEFAULT_HARNESS_CONFIG, validateConfig } from "./harness-space";
import type {
  BrainHarnessConfig,
  EvalResult,
  HarnessPopulationMember,
  MetaHarnessOptions,
  PluginState,
} from "./types";

/**
 * Run the Meta-Harness optimization loop.
 * Returns the best config found after all iterations.
 */
export async function MetaHarnessLoop(
  options: MetaHarnessOptions,
  state: PluginState
): Promise<{ config: BrainHarnessConfig; score: number }> {
  const { iterations, suite, topK, intent, lmStudio, logger, outputDir } = options;

  // Ensure output directory exists
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  // Initialize population with default config
  const population: HarnessPopulationMember[] = [
    {
      config: { ...DEFAULT_HARNESS_CONFIG },
      score: 0,
      result: {} as EvalResult,
    },
  ];

  // Load benchmark tasks
  const { loadTasks } = await import("./benchmark/tasks");
  const tasks = loadTasks(suite);
  logger(`Loaded ${tasks.length} benchmark tasks (suite: ${suite})`);

  // Main optimization loop
  for (let iter = 0; iter < iterations; iter++) {
    state.currentIteration = iter + 1;
    logger(`\n=== Iteration ${iter + 1}/${iterations} ===`);

    // Evaluate each config in population
    const evaluatedPopulation: HarnessPopulationMember[] = [];

    for (const member of population) {
      const validatedConfig = validateConfig(member.config) ? member.config : member.config;

      logger(
        `Evaluating config (alpha=${validatedConfig.fusionAlpha.toFixed(2)}, gate=${validatedConfig.confidenceGate.toFixed(2)})...`
      );

      const result = await evaluateHarness(validatedConfig, tasks, lmStudio, logger);

      evaluatedPopulation.push({
        config: validatedConfig,
        score: result.score,
        result,
      });

      // Log evaluation results
      const metrics = result.metrics;
      logger(
        `  → Score: ${result.score.toFixed(4)} | ` +
          `retrieval: ${metrics.retrievalAccuracy.toFixed(2)} | ` +
          `efficiency: ${metrics.contextEfficiency.toFixed(2)} | ` +
          `tokens: ${metrics.tokenEconomy.toFixed(2)} | ` +
          `latency: ${metrics.latencyMs}ms`
      );

      // Save to history
      state.history.push({
        config: validatedConfig,
        score: result.score,
        metrics,
      });
    }

    // Sort by score descending
    evaluatedPopulation.sort((a, b) => b.score - a.score);

    // Keep top-K configs
    const topConfigs = evaluatedPopulation.slice(0, topK);

    // Log top config
    const best = topConfigs[0];
    logger(`Best in iteration: ${best.score.toFixed(4)}`);

    // Persist iteration results
    persistIterationResults(outputDir, iter, topConfigs);

    // Update state best if improved
    if (best.score > (state.history.find((h) => h.config === state.bestConfig)?.score ?? 0)) {
      state.bestConfig = best.config;
      persistBestConfig(outputDir, best.config, best.score);
    }

    // Check for convergence
    if (iter > 0) {
      const prevBest = evaluatedPopulation[0].score;
      const currBest = topConfigs[0].score;
      if (Math.abs(currBest - prevBest) < 0.001) {
        logger(`Converged at iteration ${iter + 1}`);
        break;
      }
    }

    // If more iterations remaining, propose new configs
    if (iter < iterations - 1) {
      logger(`Proposing next generation configs...`);

      const newPopulation: HarnessPopulationMember[] = [...topConfigs];

      // Generate proposals based on history
      for (let i = 0; i < Math.min(3, topK); i++) {
        try {
          const { proposedConfig, reasoning } = await proposeHarness(
            topConfigs[i].config,
            state.history.slice(-10),
            lmStudio,
            logger
          );

          logger(`  Proposal ${i + 1}: ${reasoning.slice(0, 100)}...`);

          // Evaluate proposal
          const proposalResult = await evaluateHarness(proposedConfig, tasks, lmStudio, logger);

          newPopulation.push({
            config: proposedConfig,
            score: proposalResult.score,
            result: proposalResult,
          });
        } catch (err) {
          logger(`Proposal failed: ${err}`, "error");
        }
      }

      // Also add random mutations for diversity
      for (let i = 0; i < 2; i++) {
        const randomConfig = randomMutateConfig(topConfigs[0].config);
        const randomResult = await evaluateHarness(randomConfig, tasks, lmStudio, logger);
        newPopulation.push({
          config: randomConfig,
          score: randomResult.score,
          result: randomResult,
        });
      }

      population.length = 0;
      population.push(...newPopulation.slice(0, topK + 3));
    }
  }

  // Return best config found
  const bestResult = state.history.reduce(
    (best, curr) => (curr.score > best.score ? curr : best),
    state.history[0] || { config: DEFAULT_HARNESS_CONFIG, score: 0 }
  );

  logger(`\n=== Optimization Complete ===`);
  logger(`Best score: ${bestResult.score.toFixed(4)}`);
  logger(
    `Best config: fusion_alpha=${bestResult.config.fusionAlpha.toFixed(2)}, ` +
      `confidence_gate=${bestResult.config.confidenceGate.toFixed(2)}, ` +
      `max_chunks=${bestResult.config.maxContextTokens}`
  );

  return { config: bestResult.config, score: bestResult.score };
}

function randomMutateConfig(config: BrainHarnessConfig): BrainHarnessConfig {
  const mutated = JSON.parse(JSON.stringify(config));

  // Mutate a few random fields
  const mutations = [
    () => {
      mutated.fusionAlpha += (Math.random() - 0.5) * 0.15;
    },
    () => {
      mutated.fusionBeta += (Math.random() - 0.5) * 0.15;
    },
    () => {
      mutated.memoryBoost += (Math.random() - 0.5) * 0.08;
    },
    () => {
      mutated.confidenceGate += (Math.random() - 0.5) * 0.1;
    },
    () => {
      mutated.maxContextTokens += Math.round((Math.random() - 0.5) * 2048);
    },
    () => {
      mutated.rerankMinResults += Math.round((Math.random() - 0.5) * 10);
    },
  ];

  const numMutations = 2 + Math.floor(Math.random() * 3);
  const selectedMutations = mutations.sort(() => Math.random() - 0.5).slice(0, numMutations);
  for (const mutation of selectedMutations) {
    mutation();
  }

  // Clamp values
  mutated.fusionAlpha = Math.max(0.05, Math.min(0.8, mutated.fusionAlpha));
  mutated.fusionBeta = Math.max(0.05, Math.min(0.8, mutated.fusionBeta));
  mutated.fusionGamma = Math.max(0.05, Math.min(0.8, mutated.fusionGamma));
  mutated.memoryBoost = Math.max(0, Math.min(0.4, mutated.memoryBoost));
  mutated.confidenceGate = Math.max(0.5, Math.min(0.99, mutated.confidenceGate));
  mutated.maxContextTokens = Math.max(1024, Math.min(32768, mutated.maxContextTokens));
  mutated.rerankMinResults = Math.max(5, Math.min(50, mutated.rerankMinResults));

  // Normalize fusion weights
  const sum = mutated.fusionAlpha + mutated.fusionBeta + mutated.fusionGamma;
  mutated.fusionAlpha /= sum;
  mutated.fusionBeta /= sum;
  mutated.fusionGamma /= sum;

  return mutated;
}

function persistIterationResults(
  outputDir: string,
  iteration: number,
  population: HarnessPopulationMember[]
): void {
  try {
    const historyFile = join(outputDir, "harness_history.jsonl");
    const entry = {
      iteration,
      timestamp: Date.now(),
      population: population.map((p) => ({
        score: p.score,
        config: {
          fusionAlpha: p.config.fusionAlpha,
          fusionBeta: p.config.fusionBeta,
          fusionGamma: p.config.fusionGamma,
          memoryBoost: p.config.memoryBoost,
          confidenceGate: p.config.confidenceGate,
          maxContextTokens: p.config.maxContextTokens,
          rerankMinResults: p.config.rerankMinResults,
        },
        metrics: p.result.metrics,
      })),
    };
    appendFileSync(historyFile, JSON.stringify(entry) + "\n");
  } catch (err) {
    console.error("Failed to persist iteration results:", err);
  }
}

function persistBestConfig(outputDir: string, config: BrainHarnessConfig, score: number): void {
  try {
    const bestFile = join(outputDir, "best_harness.json");
    writeFileSync(
      bestFile,
      JSON.stringify(
        {
          config,
          score,
          timestamp: Date.now(),
        },
        null,
        2
      )
    );
  } catch (err) {
    console.error("Failed to persist best config:", err);
  }
}
