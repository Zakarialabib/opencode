export type DevIntent =
  | "debug"
  | "refactor"
  | "feature"
  | "review"
  | "learn"
  | "test"
  | "quick_chat";

export type ContextDepth = "shallow" | "targeted" | "broad" | "diagnostic" | "precise" | "none";

export interface ContextStrategy {
  name: string;
  provider: string;
  embedModel: string;
  rerank: boolean;
  depth: ContextDepth;
  maxChunks: number;
}

export interface SignalBundle {
  message: string;
  recentFiles: string[];
  diagnostics: Diagnostic[];
  todo?: string;
  lspSymbols?: Symbol[];
}

export interface Diagnostic {
  severity: "error" | "warning" | "info";
  message: string;
  file?: string;
  line?: number;
}

// --- Harness-configurable state for DecisionTree ---
let _intentThresholds: Record<string, number> = {
  debug: 0.7,
  "debug+stacktrace": 0.75,
  refactor: 0.6,
  "refactor+single": 0.65,
  feature: 0.6,
  test: 0.65,
  learn: 0.5,
  quick_chat: 0.3,
};

let _chunkCounts: Record<string, number> = {
  debug: 10,
  "debug+stacktrace": 5,
  refactor: 20,
  "refactor+single": 8,
  feature: 15,
  test: 12,
  learn: 25,
  quick_chat: 0,
};

/**
 * Set intent thresholds for Meta-Harness optimization.
 */
export function setIntentThresholds(thresholds: Record<string, number>): void {
  _intentThresholds = { ...thresholds };
  console.log(
    `[Tree/Engine] Intent thresholds updated: ${Object.entries(_intentThresholds)
      .map(([k, v]) => `${k}=${v.toFixed(2)}`)
      .join(", ")}`
  );
}

/**
 * Set chunk counts per intent for Meta-Harness optimization.
 */
export function setChunkCounts(counts: Record<string, number>): void {
  _chunkCounts = { ...counts };
  console.log(
    `[Tree/Engine] Chunk counts updated: ${Object.entries(_chunkCounts)
      .map(([k, v]) => `${k}=${v}`)
      .join(", ")}`
  );
}

/**
 * Get current thresholds and chunk counts.
 */
export function getTreeConfig(): {
  intentThresholds: Record<string, number>;
  chunkCounts: Record<string, number>;
} {
  return { intentThresholds: { ..._intentThresholds }, chunkCounts: { ..._chunkCounts } };
}

export interface Symbol {
  name: string;
  kind: string;
  file: string;
}

export interface ScenarioNode {
  id: string;
  intent: DevIntent;
  condition: (signals: SignalBundle) => boolean;
  weight: number;
  visits: number;
  children: ScenarioNode[];
  strategy: ContextStrategy;
  parent?: ScenarioNode;
}

export interface DecisionRecord {
  timestamp: number;
  intent: DevIntent;
  strategy: string;
  contextCount: number;
  query: string;
  success?: boolean;
}

const LM_STUDIO_URL = "http://192.168.1.12:1234/v1";

function buildCondition(pattern: RegExp): (signals: SignalBundle) => boolean {
  return (signals: SignalBundle) => pattern.test(signals.message);
}

function buildStackTraceCondition(): (signals: SignalBundle) => boolean {
  return (signals: SignalBundle) =>
    /at\s+\S+\.\w+:\d+|stack trace|^\s*File "/m.test(signals.message);
}

function buildSingleFileCondition(): (signals: SignalBundle) => boolean {
  return (signals: SignalBundle) =>
    /this function|this method|this class/i.test(signals.message) &&
    signals.recentFiles.length === 1;
}

export class DecisionTree {
  private root: ScenarioNode;
  private pendingMutations = 0;
  private statePath: string;

  constructor(statePath = "~/.config/opencode/brain-tree.json") {
    this.statePath = statePath;
    this.root = this.buildInitialTree();
  }

  classify(msg: string, signals: SignalBundle): { node: ScenarioNode; score: number } {
    const scores = this.scoreNodes(this.root, { ...signals, message: msg });
    return scores.sort((a, b) => b.score - a.score)[0];
  }

  private scoreNodes(
    node: ScenarioNode,
    signals: SignalBundle
  ): Array<{ node: ScenarioNode; score: number }> {
    const matches: Array<{ node: ScenarioNode; score: number }> = [];

    const baseScore = node.condition(signals) ? 1.0 : 0.0;
    const weighted = baseScore * node.weight * Math.log(node.visits + 2);

    matches.push({ node, score: weighted });

    for (const child of node.children) {
      matches.push(...this.scoreNodes(child, signals));
    }

    return matches;
  }

  selectStrategy(node: ScenarioNode): ContextStrategy {
    const base = node.weight < 0.4 && node.parent ? node.parent.strategy : node.strategy;

    // Override maxChunks from harness config if available (meta-harness optimization)
    const effectiveMaxChunks = _chunkCounts[node.intent] ?? base.maxChunks;

    return {
      ...base,
      maxChunks: effectiveMaxChunks,
    };
  }

  grow(decision: DecisionRecord, success: boolean): void {
    const node = this.findNode(decision.intent);
    if (!node) return;

    node.visits++;

    if (success) {
      node.weight = (node.weight * (node.visits - 1) + 1) / node.visits;
    } else {
      node.weight = (node.weight * (node.visits - 1)) / node.visits;
      const refinedCondition = this.inferRefinedCondition(decision);
      if (!node.children.find((c) => c.id === refinedCondition.id)) {
        this.spawnChild(node, decision);
        this.pendingMutations++;
      }
    }
  }

  private findNode(intent: DevIntent): ScenarioNode | null {
    return this.findNodeRecursive(this.root, intent);
  }

  private findNodeRecursive(node: ScenarioNode, intent: DevIntent): ScenarioNode | null {
    if (node.intent === intent) return node;
    for (const child of node.children) {
      const found = this.findNodeRecursive(child, intent);
      if (found) return found;
    }
    return null;
  }

  private inferRefinedCondition(decision: DecisionRecord): ScenarioNode {
    return {
      id: `${decision.intent}-refined-${decision.timestamp}`,
      intent: decision.intent,
      condition: () => true,
      weight: 0.5,
      visits: 0,
      children: [],
      strategy: {
        name: `${decision.strategy}-refined`,
        provider: "lmstudio",
        embedModel: "text-embedding-nomic-embed-text-v1.5",
        rerank: true,
        depth: "targeted",
        maxChunks: decision.contextCount + 5,
      },
    };
  }

  private spawnChild(parent: ScenarioNode, decision: DecisionRecord): void {
    const child = this.inferRefinedCondition(decision);
    child.parent = parent;
    parent.children.push(child);
  }

  prewarmIntent(intent: DevIntent): void {
    const node = this.findNode(intent);
    if (node) {
      node.weight = Math.min(node.weight + 0.1, 1.0);
    }
  }

  async save(): Promise<void> {
    try {
      const fs = await import("fs");
      const path = await import("path");
      const expandPath = this.statePath.replace(
        /^~/,
        process.env.HOME || process.env.USERPROFILE || ""
      );
      const dir = path.dirname(expandPath);

      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      const state = {
        root: this.serializeNode(this.root),
        pendingMutations: this.pendingMutations,
        savedAt: Date.now(),
      };

      fs.writeFileSync(expandPath, JSON.stringify(state, null, 2));
    } catch (error) {
      console.error("[Brain] Failed to save tree:", error);
    }
  }

  static async load(statePath = "~/.config/opencode/brain-tree.json"): Promise<DecisionTree> {
    try {
      const fs = await import("fs");
      const path = await import("path");
      const expandPath = statePath.replace(/^~/, process.env.HOME || process.env.USERPROFILE || "");
      if (!fs.existsSync(expandPath)) {
        return new DecisionTree(statePath);
      }
      const data = JSON.parse(fs.readFileSync(expandPath, "utf-8"));
      const tree = new DecisionTree(statePath);
      tree.root = tree.deserializeNode(data.root);
      tree.pendingMutations = data.pendingMutations || 0;
      return tree;
    } catch {
      return new DecisionTree(statePath);
    }
  }

  private serializeNode(node: ScenarioNode): any {
    return {
      ...node,
      parent: undefined,
      children: node.children.map((c) => this.serializeNode(c)),
    };
  }

  private deserializeNode(data: any): ScenarioNode {
    const node: ScenarioNode = {
      ...data,
      children: (data.children || []).map((c: any) => this.deserializeNode(c)),
    };
    for (const child of node.children) {
      child.parent = node;
    }
    return node;
  }

  getStats(): {
    totalNodes: number;
    pendingMutations: number;
    intents: Record<DevIntent, { weight: number; visits: number }>;
  } {
    const intents: Record<DevIntent, { weight: number; visits: number }> = {
      debug: { weight: 0, visits: 0 },
      refactor: { weight: 0, visits: 0 },
      feature: { weight: 0, visits: 0 },
      review: { weight: 0, visits: 0 },
      learn: { weight: 0, visits: 0 },
      test: { weight: 0, visits: 0 },
      quick_chat: { weight: 0, visits: 0 },
    };

    this.countNodes(this.root, intents);

    return {
      totalNodes: this.countTotalNodes(this.root),
      pendingMutations: this.pendingMutations,
      intents,
    };
  }

  private countNodes(
    node: ScenarioNode,
    intents: Record<DevIntent, { weight: number; visits: number }>
  ): void {
    intents[node.intent].weight = node.weight;
    intents[node.intent].visits += node.visits;
    for (const child of node.children) {
      this.countNodes(child, intents);
    }
  }

  private countTotalNodes(node: ScenarioNode): number {
    return 1 + node.children.reduce((sum, c) => sum + this.countTotalNodes(c), 0);
  }

  private buildInitialTree(): ScenarioNode {
    return {
      id: "root",
      intent: "quick_chat",
      weight: 0.5,
      visits: 1,
      condition: () => true,
      children: [
        this.createDebugBranch(),
        this.createRefactorBranch(),
        this.createFeatureBranch(),
        this.createTestBranch(),
        this.createLearnBranch(),
      ],
      strategy: {
        name: "direct",
        provider: "lmstudio",
        embedModel: "text-embedding-nomic-embed-text-v1.5",
        rerank: false,
        depth: "none",
        maxChunks: 0,
      },
    };
  }

  private createDebugBranch(): ScenarioNode {
    const debugNode: ScenarioNode = {
      id: "debug-error-msg",
      intent: "debug",
      weight: 0.8,
      visits: 1,
      condition: buildCondition(/error|exception|fail|panic|traceback|bug/i),
      children: [],
      strategy: {
        name: "diagnostic_targeted",
        provider: "lmstudio",
        embedModel: "text-embedding-nomic-embed-text-v1.5",
        rerank: false,
        depth: "diagnostic",
        maxChunks: 10,
      },
    };

    debugNode.children.push({
      id: "debug-stack-trace",
      intent: "debug",
      weight: 0.9,
      visits: 1,
      condition: buildStackTraceCondition(),
      children: [],
      strategy: {
        name: "stack_trace_precise",
        provider: "lmstudio",
        embedModel: "text-embedding-nomic-embed-text-v1.5",
        rerank: true,
        depth: "precise",
        maxChunks: 5,
      },
    });

    return debugNode;
  }

  private createRefactorBranch(): ScenarioNode {
    const refactorNode: ScenarioNode = {
      id: "refactor-large-file",
      intent: "refactor",
      weight: 0.7,
      visits: 1,
      condition: buildCondition(/refactor|restructure|extract|rename|move to/i),
      children: [],
      strategy: {
        name: "refactor_multi_file",
        provider: "lmstudio",
        embedModel: "text-embedding-nomic-embed-text-v1.5",
        rerank: true,
        depth: "broad",
        maxChunks: 20,
      },
    };

    refactorNode.children.push({
      id: "refactor-single-function",
      intent: "refactor",
      weight: 0.85,
      visits: 1,
      condition: buildSingleFileCondition(),
      children: [],
      strategy: {
        name: "refactor_local",
        provider: "lmstudio",
        embedModel: "text-embedding-nomic-embed-text-v1.5",
        rerank: false,
        depth: "shallow",
        maxChunks: 8,
      },
    });

    return refactorNode;
  }

  private createFeatureBranch(): ScenarioNode {
    return {
      id: "feature-new",
      intent: "feature",
      weight: 0.6,
      visits: 1,
      condition: buildCondition(/add|implement|create|support|enable/i),
      children: [],
      strategy: {
        name: "feature_architecture",
        provider: "lmstudio",
        embedModel: "text-embedding-nomic-embed-text-v1.5",
        rerank: true,
        depth: "broad",
        maxChunks: 15,
      },
    };
  }

  private createTestBranch(): ScenarioNode {
    return {
      id: "test-generation",
      intent: "test",
      weight: 0.75,
      visits: 1,
      condition: buildCondition(/test|spec|jest|pytest|unit test/i),
      children: [],
      strategy: {
        name: "test_context",
        provider: "lmstudio",
        embedModel: "text-embedding-nomic-embed-text-v1.5",
        rerank: false,
        depth: "targeted",
        maxChunks: 12,
      },
    };
  }

  private createLearnBranch(): ScenarioNode {
    return {
      id: "learn-codebase",
      intent: "learn",
      weight: 0.7,
      visits: 1,
      condition: buildCondition(/how does|explain|what is|understand|architecture/i),
      children: [],
      strategy: {
        name: "learn_summarize",
        provider: "lmstudio",
        embedModel: "text-embedding-nomic-embed-text-v1.5",
        rerank: true,
        depth: "broad",
        maxChunks: 25,
      },
    };
  }
}
