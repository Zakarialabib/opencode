import type { DecisionRecord, DevIntent } from "../tree/engine";
import { sessionMemory } from "../state/session";
import { docsStore } from "../docs-store";

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
