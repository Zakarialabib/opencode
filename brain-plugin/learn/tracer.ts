import type { DecisionRecord, DevIntent } from "../tree/engine.js";
import { sessionMemory } from "../state/session.js";
import { docsStore } from "../docs-store.js";

/**
 * Internal tracer — lightweight session analytics for brain plugin.
 * Replaced eval/bridge.ts (was an external-facing bridge).
 * All observability is now internal: no external eval system dependency.
 */

export interface TraceDataPoint {
  intent: DevIntent;
  strategy: string;
  contextCount: number;
  query: string;
  success: boolean;
  timestamp: number;
  docsUsed: boolean;
  docsSource?: string;
  retrievedChunks?: string[];
  usedChunks?: string[];
}

export function getTraceData(): TraceDataPoint[] {
  const memory = sessionMemory.getMemory();
  return memory.decisions.map((d: DecisionRecord) => ({
    intent: d.intent,
    strategy: d.strategy,
    contextCount: d.contextCount,
    query: d.query,
    success: d.success ?? false,
    timestamp: d.timestamp,
    docsUsed: docsStore.getAll().length > 0,
    docsSource: docsStore.getAll().length > 0 ? docsStore.getAll()[0]?.source : undefined,
  }));
}

export function getTraceMetrics(): {
  totalDecisions: number;
  successful: number;
  failed: number;
  avgContextChunks: number;
  docsCached: number;
  intents: Record<string, number>;
} {
  const memory = sessionMemory.getMemory();
  const intents: Record<string, number> = {};
  for (const d of memory.decisions) {
    intents[d.intent] = (intents[d.intent] || 0) + 1;
  }
  return {
    totalDecisions: memory.decisions.length,
    successful: memory.successCount,
    failed: memory.failures.length,
    avgContextChunks:
      memory.decisions.length > 0
        ? memory.decisions.reduce((s, d) => s + d.contextCount, 0) / memory.decisions.length
        : 0,
    docsCached: docsStore.getAll().length,
    intents,
  };
}

/**
 * Computes Precision@K: how many of the top-K retrieved chunks were actually used.
 * Reads from session memory decisions which track retrieved vs used chunks.
 */
export function computePrecisionAtK(k: number = 5): {
  overall: number;
  byIntent: Record<string, number>;
} {
  const memory = sessionMemory.getMemory();
  const byIntent: Record<string, { relevant: number; total: number }> = {};
  let totalRelevant = 0;
  let totalRetrieved = 0;

  for (const d of memory.decisions) {
    if (!d.retrievedChunks || d.retrievedChunks.length === 0) continue;
    const topK = d.retrievedChunks.slice(0, k);
    const used = new Set(d.usedChunks || []);
    const relevant = topK.filter((id: string) => used.has(id)).length;

    byIntent[d.intent] = byIntent[d.intent] || { relevant: 0, total: 0 };
    byIntent[d.intent].relevant += relevant;
    byIntent[d.intent].total += Math.min(k, d.retrievedChunks.length);
    totalRelevant += relevant;
    totalRetrieved += Math.min(k, d.retrievedChunks.length);
  }

  const overall = totalRetrieved > 0 ? totalRelevant / totalRetrieved : 0;
  const byIntentFormatted: Record<string, number> = {};
  for (const [intent, val] of Object.entries(byIntent)) {
    byIntentFormatted[intent] = val.total > 0 ? val.relevant / val.total : 0;
  }

  return { overall, byIntent: byIntentFormatted };
}

/**
 * Computes Mean Reciprocal Rank (MRR): average of 1/rank of first relevant (used) chunk.
 */
export function computeMRR(): { overall: number; byIntent: Record<string, number> } {
  const memory = sessionMemory.getMemory();
  const byIntent: Record<string, number[]> = {};
  const allReciprocals: number[] = [];

  for (const d of memory.decisions) {
    if (!d.retrievedChunks || d.retrievedChunks.length === 0) continue;
    const used = new Set(d.usedChunks || []);
    let rank = 0;
    for (let i = 0; i < d.retrievedChunks.length; i++) {
      if (used.has(d.retrievedChunks[i])) {
        rank = i + 1;
        break;
      }
    }
    const reciprocal = rank > 0 ? 1 / rank : 0;
    allReciprocals.push(reciprocal);
    byIntent[d.intent] = byIntent[d.intent] || [];
    byIntent[d.intent].push(reciprocal);
  }

  const avg = (arr: number[]) => arr.reduce((s, v) => s + v, 0) / (arr.length || 1);
  const byIntentFormatted: Record<string, number> = {};
  for (const [intent, vals] of Object.entries(byIntent)) {
    byIntentFormatted[intent] = avg(vals);
  }

  return { overall: avg(allReciprocals), byIntent: byIntentFormatted };
}
