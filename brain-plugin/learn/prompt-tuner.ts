/**
 * Prompt Tuner
 *
 * Generates prompt-level instructions from detected patterns and applies
 * them to agent configurations in opencode.json.
 *
 * Flow:
 *   1. Read high-confidence patterns from agent_patterns table
 *   2. Generate instruction text from pattern suggestion
 *   3. Check if instruction already applied (prompt_overrides table)
 *   4. If not applied, prepend instruction to the target agent's prompt
 *   5. Record the override in prompt_overrides table
 */

import { getDatabase } from "../store/index.js";
import type { DetectedPattern } from "./patterns.js";
import * as fs from "fs";
import * as path from "path";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PromptOverride {
  id: string;
  agentName: string;
  instruction: string;
  sourcePatternId: string;
  sourcePatternType: string;
  enabled: boolean;
  createdAt: number;
  appliedAt: number | null;
  lastVerifiedAt: number | null;
}

const TUNING_CONFIDENCE_THRESHOLD = 0.5;

// ---------------------------------------------------------------------------
// Instruction Generation
// ---------------------------------------------------------------------------

const PATTERN_INSTRUCTIONS: Record<
  string,
  (pattern: DetectedPattern) => string
> = {
  i18n_miss: (p) =>
    `LOCALIZATION: Before writing any UI text (labels, buttons, titles, messages), check if the project uses i18n. Look for translation files (locales/, lang/, i18n.ts). If i18n is configured, add translation keys and use the project's translation function (t(), __(), trans()) instead of hardcoded strings.`,

  missing_test: (p) =>
    `TEST COVERAGE: After creating or modifying source files, update corresponding test files. Check for existing test patterns (.test.ts, .spec.ts, Test.php) and follow them. Do not leave source changes without test coverage.`,

  type_error: (p) =>
    `TYPE SAFETY: After every edit, verify LSP diagnostics before considering the task done. Check for type errors, undefined references, and null safety. Fix all type errors before moving to the next task.`,

  error_swallow: (p) =>
    `ERROR HANDLING: When bash commands fail, read the error output carefully. Do not proceed silently — retry with a corrected approach or report the failure. Check exit codes and error messages before continuing.`,
};

function generateInstruction(pattern: DetectedPattern): string {
  const generator = PATTERN_INSTRUCTIONS[pattern.patternType];
  if (generator) return generator(pattern);
  // Fallback: use the pattern suggestion directly
  return pattern.suggestion;
}

// ---------------------------------------------------------------------------
// Prompt Application
// ---------------------------------------------------------------------------

/**
 * Check if a pattern-based instruction is already applied to an agent.
 */
function isInstructionApplied(
  db: any,
  agentName: string,
  sourcePatternId: string
): boolean {
  try {
    const row = db
      .prepare(
        "SELECT id FROM prompt_overrides WHERE agent_name = ? AND source_pattern_id = ? AND enabled = 1"
      )
      .get(agentName, sourcePatternId) as any;
    return !!row;
  } catch {
    return false;
  }
}

/**
 * Apply a single pattern as a prompt instruction to the target agent.
 * Returns the instruction text if applied, null if already exists.
 */
export function applyPatternInstruction(
  projectRoot: string,
  pattern: DetectedPattern
): string | null {
  const db = getDatabase(projectRoot);

  // Check if already applied
  if (isInstructionApplied(db, pattern.agentName, pattern.id)) {
    return null;
  }

  const instruction = generateInstruction(pattern);

  // Apply to opencode.json
  const configPath = path.join(projectRoot, "opencode.json");
  try {
    const configRaw = fs.readFileSync(configPath, "utf-8");
    const config = JSON.parse(configRaw);

    // Find the agent config
    const agentConfig = config.agent?.[pattern.agentName];
    if (!agentConfig) {
      console.log(
        `[Brain/PromptTuner] Agent "${pattern.agentName}" not found in opencode.json, skipping`
      );
      return null;
    }

    // Check if a similar instruction already exists in the prompt
    const existingPrompt: string = agentConfig.prompt || "";
    if (existingPrompt.includes(instruction.slice(0, 60))) {
      // Similar instruction already present
      return null;
    }

    // Prepend the instruction to the agent's prompt
    const updatedPrompt = `${instruction}\n\n${existingPrompt}`;
    agentConfig.prompt = updatedPrompt;

    // Write back
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), "utf-8");

    // Record the override
    const overrideId = `po_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const now = Date.now();
    db.prepare(`
      INSERT INTO prompt_overrides (id, agent_name, instruction, source_pattern_id, source_pattern_type, enabled, created_at, applied_at, last_verified_at)
      VALUES (?, ?, ?, ?, ?, 1, ?, ?, NULL)
    `).run(
      overrideId,
      pattern.agentName,
      instruction,
      pattern.id,
      pattern.patternType,
      now,
      now
    );

    console.log(
      `[Brain/PromptTuner] Applied instruction to ${pattern.agentName}: ${instruction.slice(0, 80)}...`
    );

    return instruction;
  } catch (err: any) {
    console.error("[Brain/PromptTuner] Failed to apply instruction:", err.message);
    return null;
  }
}

/**
 * Run auto-tuning: apply all patterns that exceed the confidence threshold.
 * Returns array of applied instructions.
 */
export function autoTunePrompts(
  projectRoot: string,
  patterns: DetectedPattern[]
): string[] {
  const applicable = patterns.filter(
    (p) => p.confidence >= TUNING_CONFIDENCE_THRESHOLD
  );

  if (applicable.length === 0) {
    console.log("[Brain/PromptTuner] No patterns ready for tuning");
    return [];
  }

  console.log(
    `[Brain/PromptTuner] Attempting to apply ${applicable.length} pattern instructions...`
  );

  const applied: string[] = [];
  for (const pattern of applicable) {
    try {
      const result = applyPatternInstruction(projectRoot, pattern);
      if (result) {
        applied.push(result);
      }
    } catch (err: any) {
      console.error(
        `[Brain/PromptTuner] Failed to apply pattern ${pattern.id}:`,
        err.message
      );
    }
  }

  console.log(`[Brain/PromptTuner] Applied ${applied.length}/${applicable.length} instructions`);
  return applied;
}

// ---------------------------------------------------------------------------
// Override Management
// ---------------------------------------------------------------------------

/**
 * Get all prompt overrides, optionally filtered by agent.
 */
export function getPromptOverrides(
  projectRoot: string,
  agentName?: string
): PromptOverride[] {
  const db = getDatabase(projectRoot);

  try {
    const rows = agentName
      ? db
          .prepare(
            "SELECT * FROM prompt_overrides WHERE agent_name = ? ORDER BY created_at DESC"
          )
          .all(agentName)
      : db
          .prepare("SELECT * FROM prompt_overrides ORDER BY created_at DESC")
          .all();

    return (rows as any[]).map((row) => ({
      id: row.id,
      agentName: row.agent_name,
      instruction: row.instruction,
      sourcePatternId: row.source_pattern_id,
      sourcePatternType: row.source_pattern_type,
      enabled: row.enabled === 1,
      createdAt: row.created_at,
      appliedAt: row.applied_at,
      lastVerifiedAt: row.last_verified_at,
    }));
  } catch {
    return [];
  }
}

/**
 * Disable a prompt override (removes instruction from agent prompt).
 */
export function disablePromptOverride(
  projectRoot: string,
  overrideId: string
): boolean {
  const db = getDatabase(projectRoot);

  try {
    const override = db
      .prepare("SELECT * FROM prompt_overrides WHERE id = ?")
      .get(overrideId) as any;
    if (!override) return false;

    // Remove from opencode.json
    const configPath = path.join(projectRoot, "opencode.json");
    const configRaw = fs.readFileSync(configPath, "utf-8");
    const config = JSON.parse(configRaw);
    const agentConfig = config.agent?.[override.agent_name];

    if (agentConfig?.prompt) {
      const existingPrompt: string = agentConfig.prompt;
      const updatedPrompt = existingPrompt.replace(
        `${override.instruction}\n\n`,
        ""
      );
      if (updatedPrompt !== existingPrompt) {
        agentConfig.prompt = updatedPrompt;
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2), "utf-8");
      }
    }

    // Mark as disabled
    db.prepare("UPDATE prompt_overrides SET enabled = 0 WHERE id = ?").run(overrideId);

    console.log(`[Brain/PromptTuner] Disabled override ${overrideId} for ${override.agent_name}`);
    return true;
  } catch (err: any) {
    console.error("[Brain/PromptTuner] Failed to disable override:", err.message);
    return false;
  }
}
