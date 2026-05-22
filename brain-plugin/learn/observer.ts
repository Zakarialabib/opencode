/**
 * Agent Outcome Observer
 *
 * Captures agent-level execution outcomes from tool events and LSP diagnostics.
 * Stores observations in the `agent_outcomes` table for pattern extraction.
 *
 * Observes:
 *   - Tool execution (edit/write/bash) with file paths and results
 *   - LSP diagnostics after edits
 *   - Agent type from context (when available)
 *   - Task descriptions from delegated tasks
 */

import { getDatabase } from "../store/index.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AgentOutcome {
  id: string;
  agentName: string;
  taskDesc: string;
  toolName: string;
  filePath: string | null;
  outcome: "success" | "failure" | "warning";
  details: string;
  patternType: string | null;
  metadata: Record<string, any>;
  createdAt: number;
}

export interface ObservationFilter {
  agentName?: string;
  patternType?: string;
  outcome?: "success" | "failure" | "warning";
  limit?: number;
  since?: number;
}

// ---------------------------------------------------------------------------
// Outcome Recording
// ---------------------------------------------------------------------------

let recentObservations: AgentOutcome[] = [];
const MAX_RECENT = 200;

/**
 * Record a single agent-level outcome observation into SQLite + memory buffer.
 */
export function recordOutcome(
  projectRoot: string,
  outcome: Omit<AgentOutcome, "id" | "createdAt">
): void {
  const db = getDatabase(projectRoot);
  const id = `obs_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const createdAt = Date.now();

  const entry: AgentOutcome = {
    id,
    ...outcome,
    createdAt,
  };

  // Persist to SQLite
  try {
    db.prepare(`
      INSERT INTO agent_outcomes (id, agent_name, task_desc, tool_name, file_path, outcome, details, pattern_type, metadata, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      entry.id,
      entry.agentName,
      entry.taskDesc,
      entry.toolName,
      entry.filePath,
      entry.outcome,
      entry.details,
      entry.patternType,
      JSON.stringify(entry.metadata),
      entry.createdAt
    );
  } catch (err: any) {
    console.error("[Brain/Observer] Failed to persist outcome:", err.message);
    return;
  }

  // Keep in-memory buffer for fast pattern scanning
  recentObservations.push(entry);
  if (recentObservations.length > MAX_RECENT) {
    recentObservations = recentObservations.slice(-MAX_RECENT);
  }
}

/**
 * Record an outcome inferred from tool execution + LSP signals.
 * This is the primary entry point from brain.ts hooks.
 */
export function observeToolExecution(
  projectRoot: string,
  toolName: string,
  input: any,
  output: any,
  agentName?: string,
  taskDesc?: string
): void {
  const filePath = input?.args?.filePath || null;
  let outcome: AgentOutcome["outcome"] = "success";
  let details = "";
  let patternType: string | null = null;
  const metadata: Record<string, any> = {};

  if (output?.error) {
    outcome = "failure";
    details = output.error.slice(0, 500);
  } else if (output?.result && typeof output.result === "string") {
    // Check for LSP warnings embedded in output (from plugins/index.ts ambient LSP)
    if (output.result.includes("LSP:") || output.result.includes("⚠️")) {
      outcome = "warning";
      details = output.result.slice(0, 500);
      metadata.hasLspWarning = true;
    }
  }

  // For edit/write tools, record the file path and outcome
  if (toolName === "edit" || toolName === "write") {
    metadata.fileExtension = filePath ? filePath.split(".").pop() : null;
    recordOutcome(projectRoot, {
      agentName: agentName || "unknown",
      taskDesc: taskDesc || "",
      toolName,
      filePath,
      outcome,
      details,
      patternType,
      metadata,
    });
  }

  // For bash tools, capture command failures
  if (toolName === "bash" && outcome === "failure") {
    metadata.command = (input?.args?.command || "").slice(0, 200);
    recordOutcome(projectRoot, {
      agentName: agentName || "unknown",
      taskDesc: taskDesc || "",
      toolName,
      filePath: null,
      outcome,
      details,
      patternType,
      metadata,
    });
  }
}

/**
 * Record an LSP diagnostic observation.
 */
export function observeDiagnostics(
  projectRoot: string,
  diagnostics: Array<{ file?: string; message: string; severity: string }>,
  agentName?: string,
  taskDesc?: string
): void {
  for (const diag of diagnostics) {
    if (!diag.file) continue;
    recordOutcome(projectRoot, {
      agentName: agentName || "unknown",
      taskDesc: taskDesc || "",
      toolName: "lsp",
      filePath: diag.file,
      outcome: diag.severity === "error" ? "failure" : "warning",
      details: diag.message.slice(0, 500),
      patternType: null,
      metadata: { severity: diag.severity },
    });
  }
}

// ---------------------------------------------------------------------------
// Querying
// ---------------------------------------------------------------------------

/**
 * Query stored observations with optional filters.
 */
export function queryOutcomes(
  projectRoot: string,
  filter: ObservationFilter = {}
): AgentOutcome[] {
  const db = getDatabase(projectRoot);
  const conditions: string[] = [];
  const params: any[] = [];
  const limit = filter.limit ?? 50;

  if (filter.agentName) {
    conditions.push("agent_name = ?");
    params.push(filter.agentName);
  }
  if (filter.patternType) {
    conditions.push("pattern_type = ?");
    params.push(filter.patternType);
  }
  if (filter.outcome) {
    conditions.push("outcome = ?");
    params.push(filter.outcome);
  }
  if (filter.since) {
    conditions.push("created_at >= ?");
    params.push(filter.since);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  try {
    const rows = db
      .prepare(`SELECT * FROM agent_outcomes ${where} ORDER BY created_at DESC LIMIT ?`)
      .all(...params, limit) as any[];

    return rows.map(mapOutcome);
  } catch (err: any) {
    console.error("[Brain/Observer] Query failed:", err.message);
    return [];
  }
}

/**
 * Get aggregate statistics about outcomes.
 */
export function getOutcomeStats(
  projectRoot: string
): {
  total: number;
  success: number;
  failure: number;
  warning: number;
  byAgent: Record<string, { total: number; failure: number }>;
  byPattern: Record<string, number>;
} {
  const db = getDatabase(projectRoot);
  const stats = {
    total: 0,
    success: 0,
    failure: 0,
    warning: 0,
    byAgent: {} as Record<string, { total: number; failure: number }>,
    byPattern: {} as Record<string, number>,
  };

  try {
    const count = db.prepare(`
      SELECT outcome, COUNT(*) as c FROM agent_outcomes GROUP BY outcome
    `).all() as { outcome: string; c: number }[];

    for (const row of count) {
      if (row.outcome === "success") stats.success = row.c;
      else if (row.outcome === "failure") stats.failure = row.c;
      else if (row.outcome === "warning") stats.warning = row.c;
    }
    stats.total = stats.success + stats.failure + stats.warning;

    const byAgent = db.prepare(`
      SELECT agent_name, outcome, COUNT(*) as c FROM agent_outcomes GROUP BY agent_name, outcome
    `).all() as { agent_name: string; outcome: string; c: number }[];

    for (const row of byAgent) {
      if (!stats.byAgent[row.agent_name]) {
        stats.byAgent[row.agent_name] = { total: 0, failure: 0 };
      }
      stats.byAgent[row.agent_name].total += row.c;
      if (row.outcome === "failure") {
        stats.byAgent[row.agent_name].failure += row.c;
      }
    }

    const byPattern = db.prepare(`
      SELECT pattern_type, COUNT(*) as c FROM agent_outcomes WHERE pattern_type IS NOT NULL GROUP BY pattern_type
    `).all() as { pattern_type: string; c: number }[];

    for (const row of byPattern) {
      stats.byPattern[row.pattern_type] = row.c;
    }
  } catch {}

  return stats;
}

/**
 * Get recent observations from the in-memory buffer.
 */
export function getRecentObservations(): AgentOutcome[] {
  return [...recentObservations];
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

function mapOutcome(row: any): AgentOutcome {
  return {
    id: row.id,
    agentName: row.agent_name,
    taskDesc: row.task_desc,
    toolName: row.tool_name,
    filePath: row.file_path,
    outcome: row.outcome,
    details: row.details,
    patternType: row.pattern_type,
    metadata: safeParseJSON(row.metadata, {}),
    createdAt: row.created_at,
  };
}

function safeParseJSON(raw: string | null, fallback: any): any {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}
