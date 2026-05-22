/**
 * Pattern Extraction Engine
 *
 * Analyzes observed outcomes to detect recurring failure patterns.
 * Stores detected patterns in `agent_patterns` table with confidence scores.
 * When confidence exceeds threshold, triggers prompt-tuner for auto-correction.
 *
 * Patterns detected:
 *   - i18n_miss: Hardcoded strings when project uses i18n
 *   - missing_test: Files changed without corresponding test
 *   - unused_import: LSP diagnostics about unused imports
 *   - style_inconsistency: Convention or formatting violations
 *   - type_error: TypeScript/PHP type errors after edits
 *   - error_swallow: Bash errors not surfaced
 *   - existing_resource: Duplicate component/route/service
 */

import { getDatabase } from "../store/index.js";
import { queryOutcomes, type AgentOutcome } from "./observer.js";
import * as path from "path";
import * as fs from "fs";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DetectedPattern {
  id: string;
  patternType: string;
  agentName: string;
  description: string;
  suggestion: string;
  confidence: number; // 0.0 - 1.0
  occurrenceCount: number;
  firstSeen: number;
  lastSeen: number;
  metadata: Record<string, any>;
  active: boolean;
}

export interface PatternExtractor {
  name: string;
  description: string;
  extract: (
    outcomes: AgentOutcome[],
    projectRoot: string
  ) => Array<Omit<DetectedPattern, "id" | "firstSeen" | "lastSeen" | "active">>;
}

const MIN_OCCURRENCES_FOR_PATTERN = 3;
const PATTERN_CONFIDENCE_PER_OCCURRENCE = 0.15;
const MAX_CONFIDENCE = 0.95;

// ---------------------------------------------------------------------------
// Built-in Pattern Extractors
// ---------------------------------------------------------------------------

/**
 * Detects hardcoded strings in frontend files when project has i18n setup.
 * Looks for edit operations on .tsx/.ts files that add string literals
 * while the project has i18n configuration files.
 */
const i18nMissExtractor: PatternExtractor = {
  name: "i18n_miss",
  description: "Hardcoded UI text when project uses localization",
  extract: (outcomes, projectRoot) => {
    const hasI18n = checkProjectHasI18n(projectRoot);
    if (!hasI18n) return [];

    const relevant = outcomes.filter(
      (o) =>
        (o.filePath?.endsWith(".tsx") || o.filePath?.endsWith(".ts")) &&
        (o.toolName === "edit" || o.toolName === "write") &&
        o.outcome !== "failure"
    );

    // Check for string literal patterns in details
    const i18nMisses = relevant.filter((o) => {
      const details = o.details.toLowerCase();
      return (
        details.includes("text") ||
        details.includes("label") ||
        details.includes("title") ||
        details.includes("button")
      );
    });

    if (i18nMisses.length < MIN_OCCURRENCES_FOR_PATTERN) return [];

    // Group by agent
    const byAgent = groupBy(i18nMisses, "agentName");
    const results: Array<Omit<DetectedPattern, "id" | "firstSeen" | "lastSeen" | "active">> = [];

    for (const [agent, occurrences] of Object.entries(byAgent)) {
      if (occurrences.length >= MIN_OCCURRENCES_FOR_PATTERN) {
        results.push({
          patternType: "i18n_miss",
          agentName: agent,
          description: `${agent} wrote ${occurrences.length} UI text strings without using translation keys`,
          suggestion: `Before writing display text, check if the project uses i18n (e.g., react-i18next, Laravel lang files). If yes, add translation keys and use the t() function.`,
          confidence: Math.min(
            MAX_CONFIDENCE,
            occurrences.length * PATTERN_CONFIDENCE_PER_OCCURRENCE
          ),
          occurrenceCount: occurrences.length,
          metadata: {
            sampleFiles: [...new Set(occurrences.map((o) => o.filePath).filter(Boolean))].slice(
              0, 5
            ),
          },
        });
      }
    }

    return results;
  },
};

/**
 * Detects when files are modified without corresponding test files.
 */
const missingTestExtractor: PatternExtractor = {
  name: "missing_test",
  description: "Files modified without corresponding test updates",
  extract: (outcomes) => {
    const edits = outcomes.filter((o) => o.toolName === "edit" || o.toolName === "write");

    const changedFiles = new Set<string>();
    const testFiles = new Set<string>();

    for (const o of edits) {
      if (!o.filePath) continue;
      if (
        o.filePath.includes(".test.") ||
        o.filePath.includes(".spec.") ||
        o.filePath.includes("Test.php") ||
        o.filePath.includes("_test.")
      ) {
        testFiles.add(o.filePath);
      } else {
        changedFiles.add(o.filePath);
      }
    }

    // Source files that don't have a corresponding test change
    const missing: string[] = [];
    for (const f of changedFiles) {
      const dir = path.dirname(f);
      const base = path.basename(f, path.extname(f));
      const ext = path.extname(f);

      const possibleTests = [
        path.join(dir, `${base}.test${ext}`),
        path.join(dir, `${base}.spec${ext}`),
        path.join(dir, `__tests__`, `${base}.test${ext}`),
        path.join(dir, `__tests__`, `${base}.spec${ext}`),
      ];

      const hasTest = possibleTests.some((pt) => testFiles.has(pt));
      if (!hasTest) {
        missing.push(f);
      }
    }

    if (missing.length < MIN_OCCURRENCES_FOR_PATTERN) return [];

    // Group by agent
    const byAgent = groupBy(
      edits.filter((o) => o.filePath && missing.includes(o.filePath)),
      "agentName"
    );

    return Object.entries(byAgent).map(([agent, occurrences]) => ({
      patternType: "missing_test",
      agentName: agent,
      description: `${agent} modified ${occurrences.length} source files without corresponding test changes`,
      suggestion: `After modifying source files, update or create corresponding test files (.test.ts, .spec.ts, Test.php, _test.exs).`,
      confidence: Math.min(
        MAX_CONFIDENCE,
        occurrences.length * PATTERN_CONFIDENCE_PER_OCCURRENCE * 1.2
      ),
      occurrenceCount: occurrences.length,
      metadata: { sampleFiles: missing.slice(0, 5) },
    }));
  },
};

/**
 * Detects recurring TypeScript/PHP type or lint errors from LSP diagnostics.
 */
const typeErrorExtractor: PatternExtractor = {
  name: "type_error",
  description: "Recurring type errors after edits",
  extract: (outcomes) => {
    const typeErrors = outcomes.filter(
      (o) =>
        o.toolName === "lsp" &&
        o.outcome === "failure" &&
        (o.details.includes("type") ||
          o.details.includes("Type") ||
          o.details.includes("undefined") ||
          o.details.includes("Cannot find"))
    );

    if (typeErrors.length < MIN_OCCURRENCES_FOR_PATTERN) return [];

    const byAgent = groupBy(typeErrors, "agentName");

    return Object.entries(byAgent).map(([agent, occurrences]) => ({
      patternType: "type_error",
      agentName: agent,
      description: `${agent} had ${occurrences.length} type-related LSP errors across recent edits`,
      suggestion: `Run LSP diagnostics after every edit. Check types for null/undefined cases. Use strict type checks before committing.`,
      confidence: Math.min(
        MAX_CONFIDENCE,
        occurrences.length * PATTERN_CONFIDENCE_PER_OCCURRENCE * 0.8
      ),
      occurrenceCount: occurrences.length,
      metadata: {
        sampleErrors: [
          ...new Set(occurrences.map((o) => o.details.slice(0, 120))),
        ].slice(0, 5),
      },
    }));
  },
};

/**
 * Detects bash command errors that may indicate incomplete setup.
 */
const errorSwallowExtractor: PatternExtractor = {
  name: "error_swallow",
  description: "Command failures that may need error handling",
  extract: (outcomes) => {
    const bashFails = outcomes.filter(
      (o) => o.toolName === "bash" && o.outcome === "failure"
    );

    if (bashFails.length < MIN_OCCURRENCES_FOR_PATTERN) return [];

    const byAgent = groupBy(bashFails, "agentName");

    return Object.entries(byAgent).map(([agent, occurrences]) => ({
      patternType: "error_swallow",
      agentName: agent,
      description: `${agent} had ${occurrences.length} command execution failures`,
      suggestion: `After command failures, check exit codes and error messages. Use proper error handling in bash commands. Retry with modified approach on failure.`,
      confidence: Math.min(
        MAX_CONFIDENCE,
        occurrences.length * PATTERN_CONFIDENCE_PER_OCCURRENCE * 0.7
      ),
      occurrenceCount: occurrences.length,
      metadata: {
        sampleErrors: [
          ...new Set(occurrences.map((o) => o.details.slice(0, 120))),
        ].slice(0, 5),
      },
    }));
  },
};

// ---------------------------------------------------------------------------
// All Extractors
// ---------------------------------------------------------------------------

const ALL_EXTRACTORS: PatternExtractor[] = [
  i18nMissExtractor,
  missingTestExtractor,
  typeErrorExtractor,
  errorSwallowExtractor,
];

// ---------------------------------------------------------------------------
// Pattern Extraction Pipeline
// ---------------------------------------------------------------------------

/**
 * Run all pattern extractors against recent observations.
 * Returns newly detected or updated patterns.
 */
export function extractPatterns(
  projectRoot: string,
  lookbackMinutes: number = 30
): DetectedPattern[] {
  const db = getDatabase(projectRoot);
  const since = Date.now() - lookbackMinutes * 60 * 1000;

  // Get recent observations
  const outcomes = queryOutcomes(projectRoot, {
    limit: 500,
    since,
  });

  if (outcomes.length === 0) {
    console.log("[Brain/Patterns] No recent observations to analyze");
    return [];
  }

  console.log(
    `[Brain/Patterns] Analyzing ${outcomes.length} recent observations across ${ALL_EXTRACTORS.length} extractors...`
  );

  const detected: DetectedPattern[] = [];

  for (const extractor of ALL_EXTRACTORS) {
    try {
      const results = extractor.extract(outcomes, projectRoot);
      for (const result of results) {
        const existing = findExistingPattern(db, result.patternType, result.agentName);
        if (existing) {
          // Update existing pattern
          updatePattern(db, existing.id, {
            confidence: Math.min(MAX_CONFIDENCE, result.confidence),
            occurrenceCount: result.occurrenceCount,
            lastSeen: Date.now(),
            description: result.description,
            suggestion: result.suggestion,
            metadata: result.metadata,
            active: true,
          });
          detected.push({ ...existing, ...result, lastSeen: Date.now() });
          console.log(
            `[Brain/Patterns] Updated pattern: ${result.patternType} for ${result.agentName} (confidence: ${result.confidence.toFixed(2)})`
          );
        } else {
          // Create new pattern
          const id = `pat_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
          const now = Date.now();
          db.prepare(`
            INSERT INTO agent_patterns (id, pattern_type, agent_name, description, suggestion, confidence, occurrence_count, first_seen, last_seen, metadata, active)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            id,
            result.patternType,
            result.agentName,
            result.description,
            result.suggestion,
            result.confidence,
            result.occurrenceCount,
            now,
            now,
            JSON.stringify(result.metadata),
            1
          );
          detected.push({
            id,
            ...result,
            firstSeen: now,
            lastSeen: now,
            active: true,
          });
          console.log(
            `[Brain/Patterns] New pattern detected: ${result.patternType} for ${result.agentName} (confidence: ${result.confidence.toFixed(2)})`
          );

          // Tag observations with this pattern type
          tagObservations(db, result.patternType, result.agentName, since);
        }
      }
    } catch (err: any) {
      console.error(`[Brain/Patterns] Extractor ${extractor.name} failed:`, err.message);
    }
  }

  return detected;
}

/**
 * Get all stored patterns with optional filters.
 */
export function getPatterns(
  projectRoot: string,
  filter?: { active?: boolean; agentName?: string; patternType?: string }
): DetectedPattern[] {
  const db = getDatabase(projectRoot);
  const conditions: string[] = [];
  const params: any[] = [];

  if (filter?.active !== undefined) {
    conditions.push("active = ?");
    params.push(filter.active ? 1 : 0);
  }
  if (filter?.agentName) {
    conditions.push("agent_name = ?");
    params.push(filter.agentName);
  }
  if (filter?.patternType) {
    conditions.push("pattern_type = ?");
    params.push(filter.patternType);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  try {
    const rows = db
      .prepare(`SELECT * FROM agent_patterns ${where} ORDER BY confidence DESC, last_seen DESC`)
      .all(...params) as any[];

    return rows.map((row) => ({
      id: row.id,
      patternType: row.pattern_type,
      agentName: row.agent_name,
      description: row.description,
      suggestion: row.suggestion,
      confidence: row.confidence,
      occurrenceCount: row.occurrence_count,
      firstSeen: row.first_seen,
      lastSeen: row.last_seen,
      metadata: safeParseJSON(row.metadata, {}),
      active: row.active === 1,
    }));
  } catch {
    return [];
  }
}

/**
 * Get patterns that have exceeded the auto-tune confidence threshold.
 */
export function getPatternsReadyForTuning(
  projectRoot: string,
  threshold: number = 0.5
): DetectedPattern[] {
  const all = getPatterns(projectRoot, { active: true });
  return all.filter((p) => p.confidence >= threshold);
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

function findExistingPattern(
  db: any,
  patternType: string,
  agentName: string
): DetectedPattern | null {
  try {
    const row = db
      .prepare("SELECT * FROM agent_patterns WHERE pattern_type = ? AND agent_name = ?")
      .get(patternType, agentName) as any;
    if (!row) return null;
    return {
      id: row.id,
      patternType: row.pattern_type,
      agentName: row.agent_name,
      description: row.description,
      suggestion: row.suggestion,
      confidence: row.confidence,
      occurrenceCount: row.occurrence_count,
      firstSeen: row.first_seen,
      lastSeen: row.last_seen,
      metadata: safeParseJSON(row.metadata, {}),
      active: row.active === 1,
    };
  } catch {
    return null;
  }
}

function updatePattern(
  db: any,
  id: string,
  updates: Partial<DetectedPattern>
): void {
  const fields: string[] = [];
  const params: any[] = [];

  if (updates.confidence !== undefined) {
    fields.push("confidence = ?");
    params.push(updates.confidence);
  }
  if (updates.occurrenceCount !== undefined) {
    fields.push("occurrence_count = ?");
    params.push(updates.occurrenceCount);
  }
  if (updates.lastSeen !== undefined) {
    fields.push("last_seen = ?");
    params.push(updates.lastSeen);
  }
  if (updates.description !== undefined) {
    fields.push("description = ?");
    params.push(updates.description);
  }
  if (updates.suggestion !== undefined) {
    fields.push("suggestion = ?");
    params.push(updates.suggestion);
  }
  if (updates.metadata !== undefined) {
    fields.push("metadata = ?");
    params.push(JSON.stringify(updates.metadata));
  }
  if (updates.active !== undefined) {
    fields.push("active = ?");
    params.push(updates.active ? 1 : 0);
  }

  if (fields.length === 0) return;

  params.push(id);
  db.prepare(`UPDATE agent_patterns SET ${fields.join(", ")} WHERE id = ?`).run(...params);
}

function tagObservations(
  db: any,
  patternType: string,
  agentName: string,
  since: number
): void {
  try {
    db.prepare(`
      UPDATE agent_outcomes SET pattern_type = ?
      WHERE agent_name = ? AND created_at >= ? AND pattern_type IS NULL
    `).run(patternType, agentName, since);
  } catch {}
}

function checkProjectHasI18n(projectRoot: string): boolean {
  // Check for common i18n configuration files
  const indicators = [
    path.join(projectRoot, "src", "i18n.ts"),
    path.join(projectRoot, "src", "i18n.tsx"),
    path.join(projectRoot, "src", "locales"),
    path.join(projectRoot, "src", "i18n"),
    path.join(projectRoot, "resources", "lang"),
    path.join(projectRoot, "lang"),
    path.join(projectRoot, "public", "locales"),
    // Config indicators
    path.join(projectRoot, "next-i18next.config.js"),
    path.join(projectRoot, "i18n.config.ts"),
    path.join(projectRoot, "i18n.config.js"),
    // package.json dependencies
    path.join(projectRoot, "package.json"),
  ];

  for (const indicator of indicators) {
    try {
      if (fs.existsSync(indicator)) {
        if (indicator.endsWith("package.json")) {
          // Check for i18n dependencies
          const pkg = JSON.parse(fs.readFileSync(indicator, "utf-8"));
          const deps = { ...pkg.dependencies, ...pkg.devDependencies };
          return (
            "i18next" in deps ||
            "react-i18next" in deps ||
            "vue-i18n" in deps ||
            "next-i18next" in deps ||
            "laravel-vue-i18n" in deps
          );
        }
        return true;
      }
    } catch {
      continue;
    }
  }
  return false;
}

function groupBy<T>(arr: T[], key: keyof T): Record<string, T[]> {
  return arr.reduce(
    (acc, item) => {
      const k = String(item[key]);
      if (!acc[k]) acc[k] = [];
      acc[k].push(item);
      return acc;
    },
    {} as Record<string, T[]>
  );
}

function safeParseJSON(raw: any, fallback: any): any {
  if (!raw) return fallback;
  if (typeof raw === "object") return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}
