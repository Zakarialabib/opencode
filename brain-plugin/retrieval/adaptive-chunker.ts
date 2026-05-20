import type { DevIntent } from "../tree/engine.js";

export type TaskComplexity = "low" | "medium" | "high";

export interface ChunkingStrategy {
  intent: string;
  baseChunks: number;
  confidenceWeights: Record<number, number>;
  minChunks: number;
  maxChunks: number;
}

export class AdaptiveChunker {
  private strategies: Record<string, ChunkingStrategy>;

  constructor() {
    this.strategies = this.initializeStrategies();
  }

  calculateChunkLimit(
    intent: string,
    confidence: number,
    taskComplexity: TaskComplexity
  ): number {
    const strategy = this.strategies[intent] || this.strategies["default"];

    const weight = this.findWeight(confidence, strategy.confidenceWeights);

    let chunks = strategy.baseChunks * weight;

    if (taskComplexity === "high") chunks *= 1.5;
    if (taskComplexity === "low") chunks *= 0.7;

    return Math.max(
      strategy.minChunks,
      Math.min(strategy.maxChunks, Math.round(chunks))
    );
  }

  estimateComplexity(query: string): TaskComplexity {
    const queryLower = query.toLowerCase();

    const complexityIndicators = [
      "architecture",
      "design",
      "system",
      "refactor",
      "migration",
      "implement",
      "optimize",
      "performance",
      "scalable",
      "distributed",
      "concurrent",
      "async",
      "framework",
      "library",
      "api",
      "protocol",
    ];

    const simpleIndicators = [
      "fix",
      "typo",
      "format",
      "style",
      "simple",
      "quick",
      "small",
      "minor",
      "lint",
      "rename",
      "rename variable",
      "add comment",
    ];

    let complexityScore = 0;

    for (const indicator of complexityIndicators) {
      if (queryLower.includes(indicator)) {
        complexityScore += 1;
      }
    }

    for (const indicator of simpleIndicators) {
      if (queryLower.includes(indicator)) {
        complexityScore -= 0.5;
      }
    }

    if (queryLower.split(/\s+/).length > 15) {
      complexityScore += 1;
    }

    if (complexityScore >= 2) return "high";
    if (complexityScore <= -1) return "low";
    return "medium";
  }

  private initializeStrategies(): Record<string, ChunkingStrategy> {
    return {
      learn: {
        intent: "learn",
        baseChunks: 10,
        confidenceWeights: {
          0.9: 0.6,
          0.7: 0.8,
          0.5: 1.0,
          0.3: 1.3,
          0.1: 1.5,
        },
        minChunks: 5,
        maxChunks: 20,
      },
      refactor: {
        intent: "refactor",
        baseChunks: 15,
        confidenceWeights: {
          0.9: 0.5,
          0.7: 0.7,
          0.5: 1.0,
          0.3: 1.4,
          0.1: 1.6,
        },
        minChunks: 8,
        maxChunks: 25,
      },
      feature: {
        intent: "feature",
        baseChunks: 12,
        confidenceWeights: {
          0.9: 0.6,
          0.7: 0.8,
          0.5: 1.0,
          0.3: 1.3,
          0.1: 1.5,
        },
        minChunks: 6,
        maxChunks: 22,
      },
      debug: {
        intent: "debug",
        baseChunks: 8,
        confidenceWeights: {
          0.9: 0.7,
          0.7: 0.9,
          0.5: 1.0,
          0.3: 1.2,
          0.1: 1.4,
        },
        minChunks: 4,
        maxChunks: 15,
      },
      test: {
        intent: "test",
        baseChunks: 10,
        confidenceWeights: {
          0.9: 0.6,
          0.7: 0.8,
          0.5: 1.0,
          0.3: 1.3,
          0.1: 1.5,
        },
        minChunks: 5,
        maxChunks: 18,
      },
      review: {
        intent: "review",
        baseChunks: 12,
        confidenceWeights: {
          0.9: 0.6,
          0.7: 0.8,
          0.5: 1.0,
          0.3: 1.3,
          0.1: 1.5,
        },
        minChunks: 6,
        maxChunks: 20,
      },
      quick_chat: {
        intent: "quick_chat",
        baseChunks: 3,
        confidenceWeights: {
          0.9: 0.8,
          0.7: 0.9,
          0.5: 1.0,
          0.3: 1.2,
          0.1: 1.3,
        },
        minChunks: 1,
        maxChunks: 8,
      },
      default: {
        intent: "default",
        baseChunks: 10,
        confidenceWeights: {
          0.9: 0.6,
          0.7: 0.8,
          0.5: 1.0,
          0.3: 1.3,
          0.1: 1.5,
        },
        minChunks: 3,
        maxChunks: 15,
      },
    };
  }

  private findWeight(
    confidence: number,
    weights: Record<number, number>
  ): number {
    const levels = Object.keys(weights)
      .map(Number)
      .sort((a, b) => b - a);

    if (confidence >= levels[0]) {
      return weights[levels[0]];
    }
    if (confidence <= levels[levels.length - 1]) {
      return weights[levels[levels.length - 1]];
    }

    let lowerLevel = levels[0];
    let upperLevel = levels[levels.length - 1];

    for (let i = 0; i < levels.length - 1; i++) {
      if (confidence <= levels[i] && confidence >= levels[i + 1]) {
        lowerLevel = levels[i];
        upperLevel = levels[i + 1];
        break;
      }
    }

    const lowerWeight = weights[lowerLevel];
    const upperWeight = weights[upperLevel];

    if (lowerLevel === upperLevel) {
      return lowerWeight;
    }

    const ratio = (confidence - upperLevel) / (lowerLevel - upperLevel);
    return lowerWeight + (upperWeight - lowerWeight) * ratio;
  }

  getStrategy(intent: string): ChunkingStrategy {
    return this.strategies[intent] || this.strategies["default"];
  }

  getAllStrategies(): Record<string, ChunkingStrategy> {
    return { ...this.strategies };
  }
}

export const adaptiveChunker = new AdaptiveChunker();
