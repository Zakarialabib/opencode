import * as crypto from "crypto";

interface CacheEntry {
  vector: number[];
  modelType: "qwen" | "nomic";
  hitCount: number;
  lastAccess: number;
}

/**
 * LRU embedding cache — persists across coalescer windows.
 * Caches by SHA256 hash of the input text.
 * Separate from EmbeddingCoalescer (which does burst dedup within 50ms).
 */
class EmbeddingCache {
  private cache = new Map<string, CacheEntry>();
  private maxSize: number;

  constructor(maxSize: number = 500) {
    this.maxSize = maxSize;
  }

  private hash(text: string): string {
    return crypto.createHash("sha256").update(text).digest("hex");
  }

  get(text: string): { vector: number[]; modelType: "qwen" | "nomic" } | null {
    const key = this.hash(text);
    const entry = this.cache.get(key);
    if (!entry) return null;
    entry.hitCount++;
    entry.lastAccess = Date.now();
    return { vector: entry.vector, modelType: entry.modelType };
  }

  set(text: string, vector: number[], modelType: "qwen" | "nomic"): void {
    const key = this.hash(text);

    // Evict LRU if at capacity
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      let oldestKey = "";
      let oldestTime = Infinity;
      for (const [k, v] of this.cache) {
        if (v.lastAccess < oldestTime) {
          oldestTime = v.lastAccess;
          oldestKey = k;
        }
      }
      if (oldestKey) this.cache.delete(oldestKey);
    }

    this.cache.set(key, {
      vector,
      modelType,
      hitCount: 1,
      lastAccess: Date.now(),
    });
  }

  getStats(): {
    size: number;
    maxSize: number;
    hitRate: number;
    totalGets: number;
    totalSets: number;
  } {
    let totalGets = 0;
    let totalHits = 0;
    for (const entry of this.cache.values()) {
      totalGets += entry.hitCount;
      totalHits += entry.hitCount - 1; // first access is a miss (set), subsequent are hits
    }
    // Actually compute across all operations
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hitRate: totalGets > 0 ? totalHits / totalGets : 0,
      totalGets,
      totalSets: this.cache.size,
    };
  }

  clear(): void {
    this.cache.clear();
  }
}

export const embeddingCache = new EmbeddingCache(500);
