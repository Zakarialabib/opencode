/**
 * Learning Feedback Loop Orchestrator
 *
 * Ties observer → patterns → prompt-tuner → meta-harness into a closed loop.
 *
 * Flow:
 *   1. Observer captures tool outcomes + LSP diagnostics in real-time
 *   2. Pattern extractor periodically analyzes observations for recurring issues
 *   3. When patterns exceed confidence threshold, prompt-tuner applies fixes
 *   4. Meta-harness evaluates the combined effect on retrieval performance
 *   5. The loop repeats, refining prompts and retrieval params together
 *
 * Integration with Auto-Harness:
 *   - Meta-harness optimizes retrieval (fusion weights, reranking, chunk counts)
 *   - This loop optimizes agent behavior (prompts, conventions, error handling)
 *   - Together they form a complete closed loop over quality dimensions
 */

import { getDatabase } from "../store/index.js";
import { recordOutcome, getOutcomeStats, queryOutcomes } from "./observer.js";
import {
  extractPatterns,
  getPatterns,
  getPatternsReadyForTuning,
  type DetectedPattern,
} from "./patterns.js";
import { autoTunePrompts, getPromptOverrides, type PromptOverride } from "./prompt-tuner.js";
import { evaluateContextEfficiencyAndTune } from "./tuner.js";

// Minimal interface for meta-harness integration (avoids cross-plugin dep)
interface BrainHarnessConfig {
  fusionAlpha: number;
  fusionBeta: number;
  fusionGamma: number;
  confidenceGate: number;
  maxContextTokens?: number;
  [key: string]: any;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LearningLoopStatus {
  enabled: boolean;
  lastObservationCount: number;
  lastPatternRun: number | null;
  activePatterns: number;
  appliedOverrides: number;
  totalOutcomes: number;
  lastHarnessSync: number | null;
  feedbackMetrics: {
    precisionAt5: number;
    mrr: number;
    contextEfficiency: number;
  };
}

export interface LearnerConfig {
  enabled: boolean;
  patternExtractionIntervalMs: number;
  promptTuningThreshold: number;
  maxPatternsPerRun: number;
  lookbackMinutes: number;
}

const DEFAULT_CONFIG: LearnerConfig = {
  enabled: true,
  patternExtractionIntervalMs: 5 * 60 * 1000, // every 5 minutes
  promptTuningThreshold: 0.5,
  maxPatternsPerRun: 5,
  lookbackMinutes: 30,
};

// ---------------------------------------------------------------------------
// Learner State
// ---------------------------------------------------------------------------

class LearnerLoop {
  private config: LearnerConfig;
  private extractionTimer: ReturnType<typeof setInterval> | null = null;
  private lastPatternRun: number | null = null;
  private projectRoot: string = "";
  private _activePatterns: DetectedPattern[] = [];
  private _overrides: PromptOverride[] = [];

  constructor(config: Partial<LearnerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // -----------------------------------------------------------------------
  // Lifecycle
  // -----------------------------------------------------------------------

  start(projectRoot: string): void {
    this.projectRoot = projectRoot;
    console.log(
      `[Brain/Learner] Starting learning loop (interval: ${this.config.patternExtractionIntervalMs}ms)`
    );

    // Run initial extraction
    setImmediate(() => this.runCycle());

    // Schedule periodic extraction
    this.extractionTimer = setInterval(
      () => this.runCycle(),
      this.config.patternExtractionIntervalMs
    );
  }

  stop(): void {
    if (this.extractionTimer) {
      clearInterval(this.extractionTimer);
      this.extractionTimer = null;
    }
    console.log("[Brain/Learner] Learning loop stopped");
  }

  // -----------------------------------------------------------------------
  // Main Cycle
  // -----------------------------------------------------------------------

  async runCycle(): Promise<{
    patternsFound: number;
    instructionsApplied: number;
  }> {
    if (!this.config.enabled || !this.projectRoot) {
      return { patternsFound: 0, instructionsApplied: 0 };
    }

    console.log("[Brain/Learner] Running learning feedback cycle...");
    const startTime = Date.now();

    // Phase 1: Extract patterns from recent observations
    const newPatterns = extractPatterns(this.projectRoot, this.config.lookbackMinutes);
    this.lastPatternRun = Date.now();

    // Phase 2: Run context efficiency tuning (existing)
    try {
      evaluateContextEfficiencyAndTune(this.projectRoot);
    } catch {}

    // Phase 3: Auto-tune prompts for high-confidence patterns
    const readyPatterns = getPatternsReadyForTuning(
      this.projectRoot,
      this.config.promptTuningThreshold
    );

    const limitedPatterns = readyPatterns.slice(0, this.config.maxPatternsPerRun);
    const applied = autoTunePrompts(this.projectRoot, limitedPatterns);

    // Phase 4: Update agent memory
    this._activePatterns = getPatterns(this.projectRoot, { active: true });
    this._overrides = getPromptOverrides(this.projectRoot);

    const duration = Date.now() - startTime;
    console.log(
      `[Brain/Learner] Cycle complete in ${duration}ms: ` +
        `${newPatterns.length} patterns, ${applied.length} instructions applied`
    );

    return {
      patternsFound: newPatterns.length,
      instructionsApplied: applied.length,
    };
  }

  // -----------------------------------------------------------------------
  // Status
  // -----------------------------------------------------------------------

  getStatus(): LearningLoopStatus {
    const db = this.projectRoot ? getDatabase(this.projectRoot) : null;
    let metrics = { precisionAt5: 0, mrr: 0, contextEfficiency: 0 };

    if (db) {
      try {
        const row = db.prepare("SELECT value FROM config WHERE key = 'learning_metrics'").get() as
          | { value: string }
          | undefined;
        if (row) {
          metrics = JSON.parse(row.value);
        }
      } catch {}
    }

    const stats = this.projectRoot ? getOutcomeStats(this.projectRoot) : { total: 0 };

    return {
      enabled: this.config.enabled,
      lastObservationCount: this._activePatterns.reduce((sum, p) => sum + p.occurrenceCount, 0),
      lastPatternRun: this.lastPatternRun,
      activePatterns: this._activePatterns.length,
      appliedOverrides: this._overrides.filter((o) => o.enabled).length,
      totalOutcomes: stats.total,
      lastHarnessSync: null,
      feedbackMetrics: metrics,
    };
  }

  getActivePatterns(): DetectedPattern[] {
    return [...this._activePatterns];
  }

  getOverrides(): PromptOverride[] {
    return [...this._overrides];
  }

  // -----------------------------------------------------------------------
  // Integration point with Meta-Harness
  // -----------------------------------------------------------------------

  /**
   * Called by meta-harness after a config evaluation to sync feedback.
   * This allows meta-harness to learn from agent-level outcomes alongside
   * retrieval metrics.
   */
  onHarnessEvaluation(config: BrainHarnessConfig, score: number): void {
    if (!this.projectRoot) return;
    const db = getDatabase(this.projectRoot);

    try {
      // Store latest evaluation
      db.prepare(
        "INSERT OR REPLACE INTO config (key, value, updated_at) VALUES ('harness_last_score', ?, ?)"
      ).run(score.toString(), Date.now());
      db.prepare(
        "INSERT OR REPLACE INTO config (key, value, updated_at) VALUES ('harness_last_config', ?, ?)"
      ).run(JSON.stringify(config), Date.now());

      // Record as an observation
      recordOutcome(this.projectRoot, {
        agentName: "meta-harness",
        taskDesc: `Harness evaluation: score=${score.toFixed(4)}`,
        toolName: "evaluate",
        filePath: null,
        outcome: score > 0.7 ? "success" : "failure",
        details: `config: fusion=${config.fusionAlpha.toFixed(2)}/${config.fusionBeta.toFixed(2)}/${config.fusionGamma.toFixed(2)}, gate=${config.confidenceGate.toFixed(2)}`,
        patternType: null,
        metadata: { config, score },
      });
    } catch {}
  }

  // -----------------------------------------------------------------------
  // Configuration
  // -----------------------------------------------------------------------

  updateConfig(updates: Partial<LearnerConfig>): void {
    this.config = { ...this.config, ...updates };
    console.log(`[Brain/Learner] Config updated: ${JSON.stringify(updates)}`);
  }

  getConfig(): LearnerConfig {
    return { ...this.config };
  }
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

export const learnerLoop = new LearnerLoop();

/**
 * Convenience: run a single extraction + tuning cycle.
 */
export async function runLearningCycle(
  projectRoot: string
): Promise<{ patternsFound: number; instructionsApplied: number }> {
  learnerLoop.start(projectRoot);
  return learnerLoop.runCycle();
}
