import { randomUUID } from "node:crypto";
import { getDatabase } from "./index.js";

export type TelemetryRunKind = "tool" | "skill" | "harness" | "rag" | "agent" | "orchestrator";
export type TelemetryRunStatus = "success" | "error";
export type TelemetryEventLevel = "debug" | "info" | "warn" | "error";

export type TelemetryRunStart = {
  kind: TelemetryRunKind;
  name: string;
  sessionId?: string;
  traceId?: string;
  meta?: Record<string, unknown>;
};

export type TelemetryRunEnd = {
  status: TelemetryRunStatus;
  metaPatch?: Record<string, unknown>;
};

export type TelemetryEvent = {
  level: TelemetryEventLevel;
  category: string;
  message: string;
  sessionId?: string;
  traceId?: string;
  extra?: Record<string, unknown>;
};

export type PruneOptions = {
  keepMs: number;
};

const SECRET_KEY_RE = /(api[_-]?key|token|password|secret|authorization)/i;

function redactString(input: string): string {
  return input
    .replace(/(api[_-]?key\s*[:=]\s*)(["']?)[^"'\s]+(\2)/gi, "$1$2[REDACTED]$3")
    .replace(/(token\s*[:=]\s*)(["']?)[^"'\s]+(\2)/gi, "$1$2[REDACTED]$3")
    .replace(/(password\s*[:=]\s*)(["']?)[^"'\s]+(\2)/gi, "$1$2[REDACTED]$3")
    .replace(/(authorization\s*[:=]\s*)(["']?)[^"'\s]+(\2)/gi, "$1$2[REDACTED]$3");
}

function safeStringify(value: unknown): string {
  const seen = new WeakSet<object>();
  return JSON.stringify(value, (_key, v) => {
    if (typeof v === "string") return redactString(v);
    if (v && typeof v === "object") {
      if (seen.has(v as object)) return "[Circular]";
      seen.add(v as object);
    }
    return v;
  });
}

function safePreview(value: unknown, maxLen: number): string {
  try {
    const raw = typeof value === "string" ? redactString(value) : safeStringify(value);
    if (raw.length <= maxLen) return raw;
    return raw.slice(0, maxLen) + "…";
  } catch {
    try {
      const raw = redactString(String(value));
      return raw.length <= maxLen ? raw : raw.slice(0, maxLen) + "…";
    } catch {
      return "";
    }
  }
}

function sanitizeObject(meta?: Record<string, unknown>): Record<string, unknown> {
  if (!meta) return {};
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(meta)) {
    if (SECRET_KEY_RE.test(k)) {
      out[k] = "[REDACTED]";
      continue;
    }
    if (typeof v === "string") {
      out[k] = safePreview(v, 200);
      continue;
    }
    out[k] = v;
  }
  return out;
}

function mergeMeta(baseJson: string, patch?: Record<string, unknown>): string {
  const patchSanitized = sanitizeObject(patch);
  if (Object.keys(patchSanitized).length === 0) return baseJson;
  try {
    const parsed = JSON.parse(baseJson);
    if (!parsed || typeof parsed !== "object") return safeStringify(patchSanitized);
    return safeStringify({ ...(parsed as any), ...patchSanitized });
  } catch {
    return safeStringify(patchSanitized);
  }
}

export function recordRunStart(projectRoot: string, input: TelemetryRunStart): string {
  const db = getDatabase(projectRoot);
  const id = randomUUID();
  const startedAt = Date.now();
  const meta = sanitizeObject(input.meta);
  const metaJson = safeStringify(meta);

  db.prepare(
    `INSERT INTO telemetry_runs (
      id, started_at, ended_at, duration_ms, kind, name, session_id, trace_id, status, meta_json
    ) VALUES (?, ?, NULL, NULL, ?, ?, ?, ?, 'success', ?)`
  ).run(
    id,
    startedAt,
    input.kind,
    input.name,
    input.sessionId ?? null,
    input.traceId ?? null,
    metaJson
  );

  return id;
}

export function recordRunEnd(projectRoot: string, runId: string, input: TelemetryRunEnd): void {
  const db = getDatabase(projectRoot);
  const row = db.prepare("SELECT started_at, meta_json FROM telemetry_runs WHERE id = ?").get(runId) as
    | { started_at: number; meta_json: string }
    | undefined;
  if (!row) return;

  const endedAt = Date.now();
  const durationMs = Math.max(0, endedAt - Number(row.started_at));
  const metaJson = mergeMeta(row.meta_json, input.metaPatch);

  db.prepare(
    `UPDATE telemetry_runs
     SET ended_at = ?, duration_ms = ?, status = ?, meta_json = ?
     WHERE id = ?`
  ).run(endedAt, durationMs, input.status, metaJson, runId);
}

export function recordEvent(projectRoot: string, input: TelemetryEvent): string {
  const db = getDatabase(projectRoot);
  const id = randomUUID();
  const ts = Date.now();
  const extraJson =
    input.extra && Object.keys(input.extra).length > 0 ? safeStringify(sanitizeObject(input.extra)) : null;

  db.prepare(
    `INSERT INTO telemetry_events (
      id, ts, trace_id, session_id, level, category, message, extra_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    ts,
    input.traceId ?? null,
    input.sessionId ?? null,
    input.level,
    input.category,
    safePreview(input.message, 500),
    extraJson
  );

  return id;
}

export function pruneOldTelemetry(projectRoot: string, options: PruneOptions): void {
  const db = getDatabase(projectRoot);
  const cutoff = Date.now() - options.keepMs;
  db.transaction(() => {
    db.prepare("DELETE FROM telemetry_events WHERE ts < ?").run(cutoff);
    db.prepare("DELETE FROM telemetry_runs WHERE started_at < ?").run(cutoff);
  })();
}
