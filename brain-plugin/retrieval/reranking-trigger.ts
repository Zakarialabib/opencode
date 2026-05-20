import { SearchResultItem } from "./fusion";

export interface RerankingConfig {
  enabled: boolean;
  minResults: number;
  intentsRequiringRerank: string[];
  confidenceThreshold: number;
  maxChunksBeforeRerank: number;
  adaptiveLimit: boolean;
}

export interface RerankingStrategy {
  prioritize: string[];
  weights: Record<string, number>;
}

export const RERANKING_STRATEGIES: Record<string, RerankingStrategy> = {
  learn: {
    prioritize: ["documentation", "tests", "examples"],
    weights: { documentation: 1.5, code: 1.0, comments: 0.8 },
  },
  refactor: {
    prioritize: ["dependencies", "interfaces", "tests"],
    weights: { interfaces: 1.5, dependencies: 1.2, code: 1.0 },
  },
  feature: {
    prioritize: ["related_code", "tests", "schemas"],
    weights: { related_code: 1.5, tests: 1.2, schemas: 1.0 },
  },
};

let _config: RerankingConfig = {
  enabled: true,
  minResults: 10,
  intentsRequiringRerank: ["learn", "refactor", "feature"],
  confidenceThreshold: 0.7,
  maxChunksBeforeRerank: 20,
  adaptiveLimit: true,
};

const _rerankingCache = new Map<string, { results: SearchResultItem[]; timestamp: number }>();
const CACHE_TTL_MS = 30000;

export class RerankingTrigger {
  private config: RerankingConfig;

  constructor(config?: Partial<RerankingConfig>) {
    this.config = { ..._config, ...config };
  }

  shouldRerank(intent: string, resultCount: number, confidence: number): boolean {
    if (!this.config.enabled) {
      return false;
    }

    if (resultCount < this.config.minResults) {
      return false;
    }

    if (!this.config.intentsRequiringRerank.includes(intent)) {
      return false;
    }

    if (confidence < this.config.confidenceThreshold) {
      return false;
    }

    return true;
  }

  getRerankLimit(intent: string, resultCount: number, confidence: number = 0.7): number {
    const baseLimit = Math.min(resultCount, this.config.maxChunksBeforeRerank);

    if (!this.config.adaptiveLimit) {
      return baseLimit;
    }

    const confidenceMultiplier = 0.5 + confidence * 0.8;
    const intentMultiplier = this.getIntentComplexityMultiplier(intent);
    const adaptiveLimit = Math.round(baseLimit * confidenceMultiplier * intentMultiplier);

    return Math.max(5, Math.min(adaptiveLimit, this.config.maxChunksBeforeRerank));
  }

  getIntentComplexityMultiplier(intent: string): number {
    const complexityMap: Record<string, number> = {
      learn: 1.3,
      refactor: 1.4,
      feature: 1.2,
      debug: 1.0,
      test: 1.1,
      review: 1.0,
    };
    return complexityMap[intent] ?? 1.0;
  }

  getStrategy(intent: string): RerankingStrategy | null {
    return RERANKING_STRATEGIES[intent] ?? null;
  }

  getCacheKey(query: string, intent: string): string {
    const normalizedQuery = query.toLowerCase().trim().replace(/\s+/g, " ");
    return `${intent}:${normalizedQuery}`;
  }

  getCachedReranked(cacheKey: string): SearchResultItem[] | null {
    const cached = _rerankingCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return cached.results;
    }
    _rerankingCache.delete(cacheKey);
    return null;
  }

  cacheReranked(cacheKey: string, results: SearchResultItem[]): void {
    _rerankingCache.set(cacheKey, { results, timestamp: Date.now() });
    if (_rerankingCache.size > 100) {
      const oldestKey = _rerankingCache.keys().next().value;
      if (oldestKey) {
        _rerankingCache.delete(oldestKey);
      }
    }
  }

  clearCache(): void {
    _rerankingCache.clear();
  }

  getConfig(): RerankingConfig {
    return { ...this.config };
  }

  updateConfig(updates: Partial<RerankingConfig>): void {
    this.config = { ...this.config, ...updates };
    _config = { ..._config, ...updates };
  }
}

export function getRerankingTrigger(): RerankingTrigger {
  return new RerankingTrigger(_config);
}

export function setRerankingConfig(config: Partial<RerankingConfig>): void {
  _config = { ..._config, ...config };
  console.log(
    `[RerankingTrigger] Config updated: enabled=${_config.enabled}, minResults=${_config.minResults}, intents=[${_config.intentsRequiringRerank.join(", ")}], threshold=${_config.confidenceThreshold}`
  );
}

export function getRerankingConfig(): RerankingConfig {
  return { ..._config };
}
