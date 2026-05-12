/**
 * Autoresearch Experiment Runner
 * Runs Karpathy-style autonomous experiment loops for any optimization task.
 *
 * Usage:
 *   node autoresearch.js "Optimize portal.html load time by 20%" --max-iterations 5 --budget 300
 */

const fs = require("node:fs");
const { execSync } = require("node:child_process");

const EXPERIMENTS_DIR = "experiments";
const RESULTS_DIR = `${EXPERIMENTS_DIR}/results`;
const PROMPTS_DIR = `${EXPERIMENTS_DIR}/prompts`;

for (const dir of [EXPERIMENTS_DIR, RESULTS_DIR, PROMPTS_DIR]) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

// ─── Prompt Engineering Integration ────────────────────────────────────────────

/** Load the current best prompt for an agent from memory. */
function _loadCurrentPrompt(agentRole) {
  const promptFile = `${PROMPTS_DIR}/${agentRole}.json`;
  if (fs.existsSync(promptFile)) {
    const data = JSON.parse(fs.readFileSync(promptFile, "utf8"));
    return (
      data.prompts.sort((a, b) => (b.quality_score || 0) - (a.quality_score || 0))[0]?.prompt ||
      data.currentPrompt
    );
  }
  return _getDefaultPrompt(agentRole);
}

/** Get default prompt template for a given agent role. */
function _getDefaultPrompt(agentRole) {
  const defaults = {
    researcher:
      "You are an autonomous research agent tasked with optimizing a metric through iterative experimentation.\n\n" +
      "PROCESS:\n" +
      "1. Read program.md for task constraints\n" +
      "2. Propose a specific code change to improve the target metric\n" +
      "3. Execute benchmark to measure impact\n" +
      "4. If improvement >= threshold: save and commit\n" +
      "5. If regression: revert, analyze, and retry\n" +
      "6. Document every experiment with metrics\n\n" +
      "OUTPUT FORMAT:\n" +
      'After each experiment: {"iteration": N, "metric_before": X, "metric_after": Y, "improved": bool}',

    reviewer: "Quality assurance agent. Evaluate experiment results and decide keep or revert.",

    optimizer: "Prompt optimization agent. Analyze output quality and suggest prompt improvements.",
  };
  return defaults[agentRole] || defaults.researcher;
}

/** Simple heuristic evaluation of output quality. */
function _evaluatePromptQuality(
  output,
  expected,
  criteria = ["relevance", "completeness", "accuracy"]
) {
  const scores = {};

  if (criteria.includes("relevance")) {
    const outputLower = output.toLowerCase();
    const expectedKeywords = (expected || "")
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 3);
    const matched = expectedKeywords.filter((kw) => outputLower.includes(kw));
    scores.relevance = expectedKeywords.length > 0 ? matched.length / expectedKeywords.length : 0.5;
  }

  if (criteria.includes("completeness")) {
    const words = output.split(/\s+/).length;
    scores.completeness = Math.min(1, words / 50);
  }

  if (criteria.includes("accuracy")) {
    const hasNumbers = /\d+(\.\d+)?/.test(output);
    const hasJson = /\{.*\}/.test(output) || /\[.*\]/.test(output);
    scores.accuracy = (hasNumbers ? 0.5 : 0) + (hasJson ? 0.5 : 0);
  }

  const composite = Object.values(scores).reduce((a, b) => a + b, 0) / Object.keys(scores).length;
  return { scores, composite: Math.round(composite * 100) / 100 };
}

/** Map weakest dimension to best rewrite strategy. */
function _selectRewriteStrategy(weakestDimension) {
  const strategyMap = {
    relevance: "simplify",
    completeness: "expand-context",
    accuracy: "more-examples",
    formatCompliance: "tighter-constraints",
    actionability: "split-task",
    efficiency: "simplify",
  };
  return strategyMap[weakestDimension] || "more-examples";
}

// ─── Autoresearch Loop Class ───────────────────────────────────────────────────

class AutoresearchLoop {
  constructor(taskDescription, options = {}) {
    this.task = taskDescription;
    this.maxIterations = options.maxIterations || 5;
    this.timeBudget = options.budget || 300;
    this.qualityThreshold = options.qualityThreshold || 0.75;
    this.metricKey = options.metricKey || "load_time_ms";
    this.benchmarkScript = options.benchmarkScript || "benchmark.js";
    this.results = [];
    this.iteration = 0;
    this.baseline = null;
    this.currentBest = null;
    this.branchCreated = false;
  }

  log(msg, level = "info") {
    const prefixes = {
      info: "\u2139",
      warn: "\u26A0",
      error: "\u274C",
      success: "\u2705",
      step: "\uD83E\uDDEA",
    };
    console.log(`${prefixes[level] || "\u2139"} ${msg}`);
  }

  /** Run the benchmark script and extract metric. */
  async runBenchmark() {
    this.log(`Running benchmark: ${this.benchmarkScript}`);
    try {
      const output = execSync(`node ${this.benchmarkScript}`, {
        cwd: process.cwd(),
        encoding: "utf8",
        timeout: (this.timeBudget * 1000) / this.maxIterations,
      });

      const match = output.match(/\{[\s\S]*\}/);
      if (match) {
        const result = JSON.parse(match[0]);
        return result[this.metricKey] || result;
      }

      const numMatch = output.match(/[\d.]+(?=\s*ms|s|seconds|$)/);
      return numMatch ? parseFloat(numMatch[0]) : null;
    } catch (error) {
      this.log(`Benchmark failed: ${error.message}`, "error");
      return null;
    }
  }

  /** Create or switch to experiment branch. */
  gitSave(branchName) {
    try {
      if (!this.branchCreated) {
        execSync(`git checkout -b ${branchName}`, { encoding: "utf8" });
        this.branchCreated = true;
      } else {
        execSync(`git checkout ${branchName}`, { encoding: "utf8" });
      }
    } catch (e) {
      this.log(`Git branch error: ${e.message}`, "warn");
    }
  }

  gitCommit(description) {
    try {
      execSync(`git add -A && git commit -m "${description}"`, { encoding: "utf8" });
    } catch {
      // Nothing to commit
    }
  }

  gitRevert() {
    try {
      execSync(`git reset --hard HEAD~1`, { encoding: "utf8" });
    } catch (e) {
      this.log(`Git revert error: ${e.message}`, "warn");
    }
  }

  calculateImprovement() {
    if (!this.baseline || !this.currentBest) return 0;
    return ((this.baseline - this.currentBest) / this.baseline) * 100;
  }

  /** Run single experiment iteration. */
  async runExperiment() {
    this.iteration++;
    this.log(`=== Experiment ${this.iteration}/${this.maxIterations} ===`);
    this.log(`Task: ${this.task}`);

    const proposedChange = `Experiment ${this.iteration} modification`;
    const metricAfter = await this.runBenchmark();

    if (metricAfter === null) {
      this.log("No metric returned, skipping", "warn");
      return { success: false, reason: "no_metric" };
    }

    if (this.baseline === null) {
      this.baseline = metricAfter;
      this.currentBest = metricAfter;
      this._gitRemoveInitialState();
    }

    const improved = metricAfter < this.currentBest;
    const improvementPct = this.calculateImprovement();

    const result = {
      iteration: this.iteration,
      metric_before: this.currentBest,
      metric_after: metricAfter,
      improved,
      improvement_pct: Math.abs(improvementPct).toFixed(2),
      description: proposedChange,
      reverted: false,
    };

    const quality = _evaluatePromptQuality(
      JSON.stringify(result),
      `{"${this.metricKey}": ${this.currentBest * (improved ? 0.8 : 1.2)}}`
    );

    if (improved) {
      this.currentBest = metricAfter;
      const metricUnit = this.metricKey === "load_time_ms" ? "ms" : "";
      this.gitCommit(`exp ${this.iteration}: ${proposedChange} - ${metricAfter}${metricUnit}`);
      this.log(
        `Improvement: ${this.currentBest} \u2192 ${metricAfter} (${improvementPct.toFixed(1)}%)`,
        "success"
      );
    } else {
      this.gitRevert();
      result.reverted = true;
      this.log(`No improvement (${metricAfter}), reverted`, "warn");
    }

    this.results.push(result);

    fs.writeFileSync(
      `${RESULTS_DIR}/exp-${this.iteration}.json`,
      JSON.stringify({ result, quality }, null, 2)
    );

    if (quality.composite < this.qualityThreshold) {
      this.log(
        `Quality ${quality.composite} < ${this.qualityThreshold}, triggering prompt rewrite`,
        "warn"
      );
      this.rewritePrompt("researcher", quality);
    }

    return result;
  }

  /** Commit initial state as baseline. */
  _gitRemoveInitialState() {
    try {
      execSync(`git add -A && git commit -m "baseline: initial state - ${this.baseline}"`, {
        encoding: "utf8",
      });
    } catch {
      // Already committed
    }
  }

  /** Self-improve the prompt based on quality feedback. */
  rewritePrompt(agentRole, quality) {
    const promptFile = `${PROMPTS_DIR}/${agentRole}.json`;
    let data = { prompts: [], currentPrompt: _getDefaultPrompt(agentRole) };

    if (fs.existsSync(promptFile)) {
      data = JSON.parse(fs.readFileSync(promptFile, "utf8"));
    }

    const weakest = Object.entries(quality.scores).sort((a, b) => a[1] - b[1])[0];
    const strategy = _selectRewriteStrategy(weakest[0]);
    const rewritten = this._applyRewrite(data.currentPrompt, strategy, weakest);

    data.prompts.push({
      prompt: data.currentPrompt,
      quality_score: quality.composite,
      strategy,
      rewritten_at: new Date().toISOString(),
      weakness: weakest[0],
    });

    data.currentPrompt = rewritten;
    data.prompts.push({
      prompt: rewritten,
      quality_score: null,
      strategy: "initial",
      rewritten_at: new Date().toISOString(),
    });

    fs.writeFileSync(promptFile, JSON.stringify(data, null, 2));
    this.log(`Prompt rewritten: ${strategy} (weakest: ${weakest[0]})`, "info");
  }

  /** Apply a prompt rewrite based on the selected strategy. */
  _applyRewrite(currentPrompt, strategy, _weakness) {
    const additions = {
      "more-examples":
        "\n\nADDITIONAL EXAMPLE (auto-added):\n" +
        "When measuring timing, always use performance.now() and account for warmup runs.",
      "tighter-constraints":
        "\n\nSTRICT CONSTRAINT (auto-added):\n" +
        "Do NOT suggest changes that increase complexity without clear metric improvement.",
      simplify:
        "\n\nSIMPLIFIED FOCUS:\n" +
        "Focus ONLY on the single most impactful change. Avoid multi-area changes.",
      "expand-context":
        "\n\nEXPANDED CONTEXT (auto-added):\n" +
        `Consider recent results: ${JSON.stringify(this.results.slice(-3))}\n` +
        "Use this context to avoid repeating failures.",
      "different-role":
        "\n\nROLE REFRAINED (auto-added):\n" +
        "You are now a skeptic. Challenge assumptions and propose counter-examples.",
      "split-task":
        "\n\nTASK DECOMPOSITION (auto-added):\n" +
        "(1) Identify bottleneck, (2) Propose targeted fix, (3) Validate no regressions.",
    };
    return currentPrompt + (additions[strategy] || additions["more-examples"]);
  }

  /** Execute the full autoresearch loop. */
  async run() {
    console.log(`\n${"=".repeat(60)}`);
    console.log("AUTORESEARCH LOOP STARTED");
    console.log(`   Task: ${this.task}`);
    console.log(`   Max iterations: ${this.maxIterations}`);
    console.log(`${"=".repeat(60)}\n`);

    const branchName =
      "autoresearch/" +
      this.task
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .slice(0, 30) +
      "-" +
      Date.now();
    this.gitSave(branchName);

    for (let i = 0; i < this.maxIterations; i++) {
      const _result = await this.runExperiment();
      const targetPercent = parseFloat(this.task.match(/(\d+)%/)?.[1] || 0);
      if (this.calculateImprovement() >= targetPercent) {
        this.log(
          `Target achieved! ${this.calculateImprovement().toFixed(1)}% improvement`,
          "success"
        );
        break;
      }
      if (i >= this.maxIterations - 1) {
        this.log("Iteration budget exhausted", "warn");
      }
    }

    console.log(`\n${"=".repeat(60)}`);
    console.log("AUTORESEARCH SUMMARY");
    console.log("=".repeat(60));
    console.log(`   Baseline: ${this.baseline}`);
    console.log(`   Best:     ${this.currentBest}`);
    console.log(`   Improvement: ${this.calculateImprovement().toFixed(1)}%`);
    console.log(`   Experiments: ${this.iteration}`);
    console.log("=".repeat(60));

    const summary = {
      task: this.task,
      baseline: this.baseline,
      best: this.currentBest,
      improvement_pct: this.calculateImprovement().toFixed(1),
      iterations: this.iteration,
      results: this.results,
      date: new Date().toISOString(),
    };

    fs.writeFileSync(`${RESULTS_DIR}/summary-${Date.now()}.json`, JSON.stringify(summary, null, 2));

    this.log(`Results saved to ${RESULTS_DIR}/summary-*.json`, "info");
    return summary;
  }
}

// ─── CLI Entry Point ───────────────────────────────────────────────────────────

if (require.main === module) {
  const args = process.argv.slice(2);
  const task = args[0] || "Refactor auth to use JWT";

  const findArg = (prefix) => {
    const found = args.find((a) => a.startsWith(prefix));
    return found ? found.split("=")[1] : null;
  };

  const options = {
    maxIterations: findArg("--max-iterations") ? parseInt(findArg("--max-iterations"), 10) : 5,
    budget: findArg("--budget") ? parseInt(findArg("--budget"), 10) : 300,
    metricKey: findArg("--metric") || "load_time_ms",
    qualityThreshold: 0.75,
  };

  const loop = new AutoresearchLoop(task, options);
  loop
    .run()
    .then((summary) => {
      console.log(JSON.stringify(summary, null, 2));
    })
    .catch((err) => {
      console.error("Autoresearch failed:", err);
      process.exit(1);
    });
}

module.exports = { AutoresearchLoop };
