/**
 * memory-context.ts — Persistent context & prompt engineering plugin
 *
 * Architecture:
 *   memory MCP (knowledge graph): entities, relations, observations
 *   Local SQLite DB (opencode-memory.db): context fragments, patterns, session summaries
 *
 * Flow:
 *   chat.message hook → capture decisions/conventions → store to both backends
 *   chat.params hook → inject relevant context from past sessions into instructions
 *   Custom tools → store/recall/learn/find patterns across sessions
 */

import { type Plugin, tool } from "@opencode-ai/plugin";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

// ─── Types ─────────────────────────────────────────────────────

interface ContextFragment {
  id: string;
  type:
    | "decision"
    | "convention"
    | "error-pattern"
    | "solution"
    | "session-summary"
    | "agent-preference"
    | "tool-pattern";
  content: string;
  tags: string[];
  source: string;
  timestamp: number;
  sessionId?: string;
  agent?: string;
  project?: string;
}

interface PatternEntry {
  id: string;
  trigger: string[];
  suggestion: string;
  context: string;
  successCount: number;
  lastUsed: number;
}

interface SessionSummary {
  id: string;
  startTime: number;
  endTime: number;
  agent: string;
  taskDescription: string;
  filesModified: string[];
  keyDecisions: string[];
  outcome: "success" | "failure" | "partial";
}

// ─── SQLite helpers (raw file-based persistence) ───────────────

const DB_DIR = ".opencode";
const DB_FILE = "opencode-memory.db";
const FRAGMENTS_FILE = "context-fragments.json";
const PATTERNS_FILE = "patterns.json";
const SUMMARIES_FILE = "session-summaries.json";

function getDbPath(directory: string): string {
  const dbDir = join(directory, DB_DIR);
  if (!existsSync(dbDir)) mkdirSync(dbDir, { recursive: true });
  return dbDir;
}

function loadJson<T>(directory: string, filename: string, defaultValue: T): T {
  const path = join(getDbPath(directory), filename);
  try {
    if (existsSync(path)) return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    /* corrupt or missing */
  }
  return defaultValue;
}

function saveJson<T>(directory: string, filename: string, data: T): void {
  const path = join(getDbPath(directory), filename);
  writeFileSync(path, JSON.stringify(data, null, 2), "utf8");
}

// ─── Keyword relevance scoring ─────────────────────────────────

const TAG_WEIGHTS: Record<string, string[]> = {
  rust: ["rust", "cargo", "tauri", "rust-analyzer", ".rs", "unsafe", "impl"],
  typescript: ["typescript", "ts", "tsx", "type", "interface", "react", "component"],
  php: ["php", "laravel", "eloquent", "artisan", "blade", "livewire"],
  database: ["sql", "query", "migration", "schema", "table", "db"],
  testing: ["test", "pest", "vitest", "coverage", "assert"],
  deploy: ["deploy", "build", "ci", "cd", "release", "pipeline"],
  agent: ["agent", "delegate", "task", "subagent", "orchestrat"],
  config: ["config", "opencode", "json", "settings", "plugin", "mcp"],
};

function scoreRelevance(content: string, tags: string[], query: string): number {
  const q = query.toLowerCase();
  const c = content.toLowerCase();
  let score = 0;

  // Direct content match
  const queryWords = q.split(/\s+/).filter((w) => w.length > 2);
  for (const word of queryWords) {
    if (c.includes(word)) score += 2;
  }

  // Tag match
  for (const tag of tags) {
    if (q.includes(tag.toLowerCase())) score += 3;
    // Check derived tag groups
    for (const [group, keywords] of Object.entries(TAG_WEIGHTS)) {
      if (tag.toLowerCase() === group && keywords.some((kw) => q.includes(kw))) {
        score += 2;
      }
    }
  }

  return score;
}

// ─── Plugin ────────────────────────────────────────────────────

const MemoryContextPlugin: Plugin = async ({ directory }) => {
  // Memory backends
  const mem = {
    fragments: loadJson<ContextFragment[]>(directory, FRAGMENTS_FILE, []),
    patterns: loadJson<PatternEntry[]>(directory, PATTERNS_FILE, []),
    summaries: loadJson<SessionSummary[]>(directory, SUMMARIES_FILE, []),
  };

  // Track current session
  const currentSession = {
    id: randomUUID().slice(0, 8),
    startTime: Date.now(),
    filesModified: new Set<string>(),
    decisions: [] as string[],
    currentAgent: "",
    taskDescription: "",
  };

  function persistAll() {
    saveJson(directory, FRAGMENTS_FILE, mem.fragments);
    saveJson(directory, PATTERNS_FILE, mem.patterns);
    saveJson(directory, SUMMARIES_FILE, mem.summaries);
  }

  function getRelevantFragments(query: string, limit = 5): ContextFragment[] {
    const scored = mem.fragments
      .map((f) => ({ fragment: f, score: scoreRelevance(f.content, f.tags, query) }))
      .filter((f) => f.score > 0)
      .sort((a, b) => b.score - a.score);

    return scored.slice(0, limit).map((s) => s.fragment);
  }

  function getMatchingPatterns(task: string): PatternEntry[] {
    const q = task.toLowerCase();
    return mem.patterns
      .filter((p) => p.trigger.some((t) => q.includes(t.toLowerCase())))
      .sort((a, b) => b.successCount - a.successCount)
      .slice(0, 5); // Increased from 3 to 5 for better coverage
  }

  function getProjectConventions(): ContextFragment[] {
    return mem.fragments
      .filter((f) => f.type === "convention")
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 5);
  }

  function getAutoPatterns(): string[] {
    // Auto-generate patterns from high-success fragments
    const patterns: string[] = [];

    // Extract conventions into prompt-friendly format
    const conventions = getProjectConventions();
    if (conventions.length > 0) {
      patterns.push("Project conventions from past sessions:");
      for (const c of conventions) {
        patterns.push(`- ${c.content.slice(0, 200)}`);
      }
    }

    // Add error-prevention patterns from error-pattern fragments
    const errorPatterns = mem.fragments
      .filter((f) => f.type === "error-pattern")
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 3);
    if (errorPatterns.length > 0) {
      patterns.push("Known error patterns (avoid these):");
      for (const ep of errorPatterns) {
        patterns.push(`- ${ep.content.slice(0, 200)}`);
      }
    }

    return patterns;
  }

  return {
    // ── Hook: Before each message — inject memory context ──
    "chat.params": async (input: any, output: any) => {
      try {
        const messageText =
          typeof input?.message === "string" ? input.message : input?.message?.content || "";

        if (!messageText || messageText.length < 10) return;

        // Build memory injection
        const relevant = getRelevantFragments(messageText, 4);
        const patterns = getMatchingPatterns(messageText);

        // Also fetch project conventions and auto-patterns
        const conventions = getProjectConventions();
        const autoPatterns = getAutoPatterns();

        if (relevant.length === 0 && patterns.length === 0 && conventions.length === 0) return;

        let injection = "\n\n## \uD83E\uDDE0 Session Memory Context\n";

        if (relevant.length > 0) {
          injection += `\n**Past context** (${relevant.length} relevant fragments):\n`;
          for (const frag of relevant) {
            const date = new Date(frag.timestamp).toLocaleDateString();
            const preview =
              frag.content.length > 120 ? frag.content.slice(0, 120) + "..." : frag.content;
            injection += `- [${frag.type}] ${preview} _(from ${frag.source}, ${date})_\n`;
          }
        }

        if (patterns.length > 0) {
          injection += `\n**Learned patterns** (${patterns.length} matches):\n`;
          for (const pat of patterns) {
            injection += `- When you see: "${pat.trigger.join(", ")}"\n`;
            injection += `  Consider: ${pat.suggestion.slice(0, 200)}\n`;
          }
        }

        if (autoPatterns.length > 0) {
          injection += `\n**Auto-extracted context** (from past sessions):\n`;
          for (const line of autoPatterns) {
            injection += `  ${line}\n`;
          }
        }

        // Append to instructions/system prompt
        if (output?.instructions && Array.isArray(output.instructions)) {
          output.instructions.push(injection);
        } else if (output?.system) {
          output.system += injection;
        }
      } catch {
        /* graceful degradation */
      }
    },

    // ── Hook: Before each message — auto-extract patterns from conversation ──
    "chat.message": async ({ sessionID, messages }: any) => {
      try {
        if (!messages || messages.length < 2) return;

        // Check the last assistant message for patterns to learn
        const lastMsg = messages[messages.length - 1];
        if (lastMsg?.role !== "assistant" || typeof lastMsg?.content !== "string") return;
        const content: string = lastMsg.content;

        // Auto-extract conventions from "Always X" or "Never Y" patterns
        const conventionPatterns = [
          ...content.matchAll(/(?:Always|Never|Always use|Never use)\s+([^.\n]+)/gi),
        ];
        for (const match of conventionPatterns) {
          const existing = mem.fragments.find(
            (f) => f.type === "convention" && f.content.includes(match[1].slice(0, 40))
          );
          if (!existing) {
            mem.fragments.push({
              id: randomUUID().slice(0, 12),
              type: "convention",
              content: match[0].trim(),
              tags: ["auto-extracted", "convention"],
              source: `agent:${currentSession.currentAgent}`,
              timestamp: Date.now(),
              agent: currentSession.currentAgent || undefined,
              sessionId: currentSession.id,
            });
          }
        }

        // Auto-extract decisions from "Decision:" markers
        const decisionPatterns = [
          ...content.matchAll(/(?:Decision|Chosen|Selected|Using)\s*:\s*([^.\n]+)/gi),
        ];
        for (const match of decisionPatterns) {
          const existing = mem.fragments.find(
            (f) => f.type === "decision" && f.content.includes(match[1].slice(0, 40))
          );
          if (!existing) {
            mem.fragments.push({
              id: randomUUID().slice(0, 12),
              type: "decision",
              content: match[0].trim(),
              tags: ["auto-extracted", "decision"],
              source: `agent:${currentSession.currentAgent}`,
              timestamp: Date.now(),
              agent: currentSession.currentAgent || undefined,
              sessionId: currentSession.id,
            });
          }
        }

        // Auto-extract error patterns from "Error:" or "FIX:" patterns
        const errorPatterns = [...content.matchAll(/(?:Error|Bug|Issue|FIX|Fix):\s*([^.\n]+)/gi)];
        for (const match of errorPatterns) {
          const existing = mem.fragments.find(
            (f) => f.type === "error-pattern" && f.content.includes(match[1].slice(0, 40))
          );
          if (!existing) {
            mem.fragments.push({
              id: randomUUID().slice(0, 12),
              type: "error-pattern",
              content: match[0].trim(),
              tags: ["auto-extracted", "error"],
              source: `agent:${currentSession.currentAgent}`,
              timestamp: Date.now(),
              agent: currentSession.currentAgent || undefined,
              sessionId: currentSession.id,
            });
          }
        }

        // Persist if anything was extracted
        if (
          conventionPatterns.length > 0 ||
          decisionPatterns.length > 0 ||
          errorPatterns.length > 0
        ) {
          persistAll();
        }
      } catch {
        // Graceful degradation
      }
    },

    // ── Hook: After tool execution — capture file changes ──
    "tool.execute.after": async (input: any) => {
      if (input?.tool === "edit" || input?.tool === "write") {
        if (input.args?.filePath) {
          currentSession.filesModified.add(input.args.filePath);
        }
      }
    },

    // ── Custom tools ──
    tool: {
      // Store a context fragment (decision, convention, solution, etc.)
      memory_store: tool({
        description:
          "Store a context fragment for cross-session recall (decisions, conventions, solutions, patterns)",
        args: {
          type: tool.schema
            .enum([
              "decision",
              "convention",
              "error-pattern",
              "solution",
              "session-summary",
              "agent-preference",
              "tool-pattern",
            ])
            .describe("Type of context fragment"),
          content: tool.schema
            .string()
            .describe("The content to store (decision, convention, fix, etc.)"),
          tags: tool.schema
            .array(tool.schema.string())
            .default([])
            .describe("Tags for categorization (e.g. ['rust', 'tauri', 'config'])"),
          source: tool.schema.string().default("manual").describe("Source identifier"),
        },
        async execute({ type, content, tags, source }) {
          const fragment: ContextFragment = {
            id: randomUUID().slice(0, 12),
            type,
            content,
            tags,
            source,
            timestamp: Date.now(),
            agent: currentSession.currentAgent || undefined,
            sessionId: currentSession.id,
          };

          mem.fragments.push(fragment);
          persistAll();

          return `\u2705 Stored ${type} fragment "${content.slice(0, 60)}..." (id: ${fragment.id})`;
        },
      }),

      // Recall relevant context from past sessions
      memory_recall: tool({
        description: "Recall context fragments relevant to the given query",
        args: {
          query: tool.schema.string().describe("What to search for in past context"),
          limit: tool.schema.number().default(5).describe("Max results to return"),
          type: tool.schema
            .enum([
              "decision",
              "convention",
              "error-pattern",
              "solution",
              "session-summary",
              "agent-preference",
              "tool-pattern",
            ])
            .optional()
            .describe("Filter by fragment type"),
        },
        async execute({ query, limit, type }) {
          let candidates = type ? mem.fragments.filter((f) => f.type === type) : mem.fragments;

          if (candidates.length === 0) return "No stored context found.";

          const scored = candidates
            .map((f) => ({ fragment: f, score: scoreRelevance(f.content, f.tags, query) }))
            .filter((f) => f.score > 0)
            .sort((a, b) => b.score - a.score)
            .slice(0, limit);

          if (scored.length === 0) return "No relevant context found.";

          let result = `## \uD83E\uDDE0 Memory Recall (${scored.length} results)\n\n`;
          for (const { fragment: f, score } of scored) {
            const date = new Date(f.timestamp).toLocaleString();
            result += `### ${f.type} (score: ${score})\n`;
            result += `${f.content}\n\n`;
            result += `_Tags: ${f.tags.join(", ") || "none"} | ${date} | source: ${f.source}_\n\n`;
          }
          return result;
        },
      }),

      // Learn a pattern for future suggestion
      memory_learn: tool({
        description: "Teach the system a pattern: when X happens, consider Y",
        args: {
          triggers: tool.schema
            .array(tool.schema.string())
            .describe(
              "Keywords that trigger this pattern (e.g. ['migration', 'rollback', 'down'])"
            ),
          suggestion: tool.schema.string().describe("What to suggest when triggers are detected"),
          context: tool.schema
            .string()
            .default("")
            .describe("Optional context about where this applies"),
        },
        async execute({ triggers, suggestion, context }) {
          const existing = mem.patterns.findIndex(
            (p) =>
              p.trigger.length === triggers.length && p.trigger.every((t, i) => t === triggers[i])
          );

          if (existing >= 0) {
            mem.patterns[existing].suggestion = suggestion;
            mem.patterns[existing].context = context;
            mem.patterns[existing].successCount += 1;
          } else {
            mem.patterns.push({
              id: randomUUID().slice(0, 12),
              trigger: triggers,
              suggestion,
              context,
              successCount: 1,
              lastUsed: Date.now(),
            });
          }

          persistAll();
          return `\u2705 Learned pattern: when "${triggers.join(", ")}" \u2192 "${suggestion.slice(0, 60)}..."`;
        },
      }),

      // Find learned patterns
      memory_find: tool({
        description: "Find learned patterns matching the current task",
        args: {
          task: tool.schema.string().describe("Task description to match against patterns"),
        },
        async execute({ task }) {
          const matches = getMatchingPatterns(task);
          if (matches.length === 0) return "No matching patterns found.";

          let result = `## \uD83D\uDD0D Pattern Matches (${matches.length})\n\n`;
          for (const p of matches) {
            result += `**Triggers**: ${p.trigger.join(", ")}\n`;
            result += `**Suggestion**: ${p.suggestion}\n`;
            if (p.context) result += `**Context**: ${p.context}\n`;
            result += `**Used**: ${p.successCount} time(s)\n\n`;
          }
          return result;
        },
      }),

      // Get session summary
      memory_session: tool({
        description: "Get a summary of the current session's activity",
        args: {
          outcome: tool.schema
            .enum(["success", "failure", "partial"])
            .optional()
            .describe("Set the session outcome (stores summary when provided)"),
          task: tool.schema.string().optional().describe("Describe what this session accomplished"),
        },
        async execute({ outcome, task }) {
          if (outcome && task) {
            // Save session summary
            const summary: SessionSummary = {
              id: currentSession.id,
              startTime: currentSession.startTime,
              endTime: Date.now(),
              agent: currentSession.currentAgent,
              taskDescription: task,
              filesModified: Array.from(currentSession.filesModified),
              keyDecisions: currentSession.decisions,
              outcome,
            };

            mem.summaries.push(summary);

            // Also store as a context fragment
            const content = [
              `Session: ${task}`,
              `Agent: ${currentSession.currentAgent}`,
              `Files: ${Array.from(currentSession.filesModified).join(", ")}`,
              `Outcome: ${outcome}`,
              currentSession.decisions.length > 0
                ? `Decisions: ${currentSession.decisions.join("; ")}`
                : "",
            ]
              .filter(Boolean)
              .join("\n");

            mem.fragments.push({
              id: randomUUID().slice(0, 12),
              type: "session-summary",
              content,
              tags: ["session", outcome, ...task.split(/\s+/).filter((w) => w.length > 3)],
              source: "memory_session",
              timestamp: Date.now(),
              sessionId: currentSession.id,
            });

            persistAll();

            const duration = Math.round((Date.now() - currentSession.startTime) / 1000);
            return [
              `\u2705 Session saved: ${task}`,
              `Duration: ${duration}s`,
              `Files touched: ${Array.from(currentSession.filesModified).length}`,
              `Decisions logged: ${currentSession.decisions.length}`,
              `Outcome: ${outcome}`,
            ].join("\n");
          }

          // Just report current session state
          const duration = Math.round((Date.now() - currentSession.startTime) / 1000);
          return [
            `## Current Session (${currentSession.id})`,
            `Duration: ${duration}s`,
            `Agent: ${currentSession.currentAgent || "not set"}`,
            `Files modified: ${Array.from(currentSession.filesModified).join(", ") || "none"}`,
            `Decisions: ${currentSession.decisions.join(", ") || "none"}`,
            `Total stored fragments: ${mem.fragments.length}`,
            `Total learned patterns: ${mem.patterns.length}`,
            `Past sessions: ${mem.summaries.length}`,
          ].join("\n");
        },
      }),

      // Log a decision during the session
      memory_decision: tool({
        description: "Log a key architectural or design decision during this session",
        args: {
          decision: tool.schema.string().describe("The decision made"),
          tags: tool.schema
            .array(tool.schema.string())
            .default([])
            .describe("Optional categorization tags"),
        },
        async execute({ decision, tags }) {
          currentSession.decisions.push(decision);

          // Also store as fragment
          mem.fragments.push({
            id: randomUUID().slice(0, 12),
            type: "decision",
            content: decision,
            tags: [...tags, "decision"],
            source: "memory_decision",
            timestamp: Date.now(),
            sessionId: currentSession.id,
            agent: currentSession.currentAgent || undefined,
          });

          persistAll();
          return `\u2705 Decision logged: "${decision.slice(0, 80)}..."`;
        },
      }),

      // List all stored context types with counts
      memory_stats: tool({
        description: "Show memory storage statistics",
        args: {},
        async execute() {
          const typeCounts: Record<string, number> = {};
          for (const f of mem.fragments) {
            typeCounts[f.type] = (typeCounts[f.type] || 0) + 1;
          }

          const lines = [
            "## Memory Statistics",
            "",
            `Context fragments: ${mem.fragments.length}`,
            ...Object.entries(typeCounts)
              .sort((a, b) => b[1] - a[1])
              .map(([type, count]) => `  \u2514 ${type}: ${count}`),
            "",
            `Learned patterns: ${mem.patterns.length}`,
            `Session summaries: ${mem.summaries.length}`,
            `Database: ${join(directory, DB_DIR, DB_FILE)}`,
          ];

          return lines.join("\n");
        },
      }),

      // Forget specific context (by id or type)
      memory_forget: tool({
        description: "Remove stored context by ID or type",
        args: {
          id: tool.schema.string().optional().describe("Fragment ID to remove"),
          type: tool.schema
            .enum([
              "decision",
              "convention",
              "error-pattern",
              "solution",
              "session-summary",
              "agent-preference",
              "tool-pattern",
            ])
            .optional()
            .describe("Remove all fragments of this type"),
          confirm: tool.schema.boolean().default(false).describe("Must be true to execute"),
        },
        async execute({ id, type, confirm }) {
          if (!confirm) return "Confirmation required. Set confirm=true to proceed.";

          if (id) {
            const before = mem.fragments.length;
            mem.fragments = mem.fragments.filter((f) => f.id !== id);
            if (mem.fragments.length < before) {
              persistAll();
              return `Removed fragment ${id}.`;
            }
            return `Fragment ${id} not found.`;
          }

          if (type) {
            const before = mem.fragments.length;
            mem.fragments = mem.fragments.filter((f) => f.type !== type);
            const removed = before - mem.fragments.length;
            persistAll();
            return `Removed ${removed} fragments of type "${type}".`;
          }

          return "Specify id or type to forget.";
        },
      }),
    },
  };
};

export default MemoryContextPlugin;
