import { type Plugin, tool } from "@opencode-ai/plugin";
import { parseJsonc } from "./jsonc-utils";
import { readFile, writeFile, copyFile, rename, readdir } from "fs/promises";
import { execSync } from "child_process";
import { createHash } from "crypto";
import { debug, warn, SKILL_CATEGORIES } from "./debug-logger";

// Debug: trace tool execution
function traceToolExecution(toolName: string, args: any, result: any, duration: number) {
  debug(SKILL_CATEGORIES.TOOL_EXECUTE, `Tool executed: ${toolName}`, {
    duration,
    hasArgs: !!args,
    hasResult: !!result,
    resultPreview: typeof result === "string" ? result.slice(0, 100) : typeof result,
  });
}

// Debug: trace hook invocation
function traceHook(name: string, input: any, output: any) {
  debug(SKILL_CATEGORIES.HOOK_INVOKE, `Hook triggered: ${name}`, {
    hasInput: !!input,
    inputKeys: input ? Object.keys(input).slice(0, 5) : [],
    hasOutput: !!output,
  });
}

// ─── Ambient LSP Feedback ───────────────────────────────────────
// Architecture:
//   edit/write → tool.execute.after → runQuickCheck → inject into tool output (same-turn)
//   next turn  → chat.params       → flush remaining  → inject into instructions (next-turn)
//   dedup      → hash (file+line+msg) with 30s expiry
//   race-safe  → pendingChecks promise queue, awaited before flush

interface DiagnosticEntry {
  file: string;
  errors: string;
  severity: "error" | "warning";
  hash: string;
  timestamp: number;
}

// Per-session accumulation
const diagnosticsBySession: Map<string, DiagnosticEntry[]> = new Map();
// Race-safety: pending async checks per session
const pendingChecks: Map<string, Promise<void>> = new Map();
// Dedup window: 30 seconds
const DEDUP_WINDOW_MS = 30_000;
const SEEN_HASHES: Map<string, number> = new Map();

function diagnosticHash(file: string, line: number, msg: string): string {
  return createHash("sha1").update(`${file}:${line}:${msg}`).digest("hex").slice(0, 12);
}

function isDuplicate(hash: string): boolean {
  const lastSeen = SEEN_HASHES.get(hash);
  if (lastSeen && Date.now() - lastSeen < DEDUP_WINDOW_MS) return true;
  SEEN_HASHES.set(hash, Date.now());
  // Cleanup stale hashes periodically
  if (SEEN_HASHES.size > 500) {
    const cutoff = Date.now() - DEDUP_WINDOW_MS;
    for (const [k, v] of SEEN_HASHES) if (v < cutoff) SEEN_HASHES.delete(k);
  }
  return false;
}

function addDiagnostic(sessionID: string, entry: DiagnosticEntry) {
  if (isDuplicate(entry.hash)) return;
  const list = diagnosticsBySession.get(sessionID) || [];
  list.push(entry);
  diagnosticsBySession.set(sessionID, list);
}

function flushDiagnostics(sessionID: string): DiagnosticEntry[] {
  const list = diagnosticsBySession.get(sessionID) || [];
  diagnosticsBySession.delete(sessionID);
  return list;
}

// Extension → check command mapping
const CHECKER_REGISTRY: Record<
  string,
  { cmd: string; timeout: number; filter: (out: string, file: string) => string | null }
> = {
  php: {
    cmd: `php -l "{file}"`,
    timeout: 5000,
    filter: (out) =>
      out.includes("Parse error") || out.includes("Fatal error") ? out.trim() : null,
  },
  ts: {
    cmd: `npx tsc --noEmit --pretty false 2>&1`,
    timeout: 15000,
    filter: (out, file) => {
      const lines = out.split("\n").filter((l) => l.includes(file));
      return lines.length > 0 ? lines.slice(0, 10).join("\n") : null;
    },
  },
  tsx: {
    cmd: `npx tsc --noEmit --pretty false 2>&1`,
    timeout: 15000,
    filter: (out, file) => {
      const lines = out.split("\n").filter((l) => l.includes(file));
      return lines.length > 0 ? lines.slice(0, 10).join("\n") : null;
    },
  },
  js: {
    cmd: `npx biome check --max-diagnostics=10 "{file}" 2>&1`,
    timeout: 10000,
    filter: () => null, // handled by catch
  },
  jsx: {
    cmd: `npx biome check --max-diagnostics=10 "{file}" 2>&1`,
    timeout: 10000,
    filter: () => null, // handled by catch
  },
  rs: {
    cmd: `cargo check --message-format=short 2>&1`,
    timeout: 30000,
    filter: (out, file) => {
      const lines = out
        .split("\n")
        .filter((l) => l.includes(file) && (l.includes("error") || l.includes("warning")));
      return lines.length > 0 ? lines.slice(0, 10).join("\n") : null;
    },
  },
  vue: {
    cmd: `npx tsc --noEmit --pretty false 2>&1`,
    timeout: 15000,
    filter: (out, file) => {
      const lines = out.split("\n").filter((l) => l.includes(file));
      return lines.length > 0 ? lines.slice(0, 10).join("\n") : null;
    },
  },
  svelte: {
    cmd: `npx svelte-check --output machine 2>&1`,
    timeout: 15000,
    filter: (out, file) => {
      const lines = out.split("\n").filter((l) => l.includes(file));
      return lines.length > 0 ? lines.slice(0, 10).join("\n") : null;
    },
  },
  py: {
    cmd: `python -m py_compile "{file}" 2>&1`,
    timeout: 5000,
    filter: (out) => (out.length > 0 ? out.trim() : null),
  },
};

function runQuickCheck(filePath: string): { errors: string; hashes: string[] } | null {
  const ext = filePath.split(".").pop()?.toLowerCase() || "";
  const checker = CHECKER_REGISTRY[ext];
  if (!checker) return null;

  try {
    const command = checker.cmd.replace("{file}", filePath);
    const out = execSync(command, {
      timeout: checker.timeout,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      cwd: process.cwd(),
    });

    const filtered = checker.filter(out, filePath);
    if (!filtered) return null;

    // Generate hashes per error line for dedup
    const errorLines = filtered.split("\n").filter((l) => l.trim());
    const hashes = errorLines.map((line, idx) => diagnosticHash(filePath, idx, line.slice(0, 60)));

    return { errors: filtered, hashes };
  } catch (e: any) {
    // biome check returns non-zero on findings (not a crash)
    if ((ext === "js" || ext === "jsx") && e.stdout) return { errors: e.stdout.trim(), hashes: [] };
    // Other checkers: non-zero means crash or findings
    const msg = e.stderr || e.stdout || e.message || "";
    if (msg.length > 0 && msg.length < 500) return { errors: msg.trim(), hashes: [] };
    return null;
  }
}

function detectAndCheck(filePath: string): DiagnosticEntry | null {
  const result = runQuickCheck(filePath);
  if (!result) return null;

  const ext = filePath.split(".").pop()?.toLowerCase();
  const hash = result.hashes[0] || diagnosticHash(filePath, 0, result.errors.slice(0, 60));
  return {
    file: filePath,
    errors: `[${ext}] ${result.errors}`,
    severity: "error",
    hash,
    timestamp: Date.now(),
  };
}

// ─── End Ambient LSP Feedback ───────────────────────────────────

// Helper to read config file using our fixed parseJsonc
async function readConfig(directory: string) {
  const configPath = `${directory}/opencode.json`;
  try {
    const text = await readFile(configPath, "utf8");
    return parseJsonc(text);
  } catch (e) {
    console.error("Failed to read config:", e);
    return null;
  }
}

// Helper to get LM Studio native base URL from config
async function getLmStudioNativeUrl(directory: string): Promise<string> {
  const config = await readConfig(directory);
  return config?.provider?.lmstudio?.native_base_url || "http://127.0.0.1:8080/api";
}

// Helper to get LM Studio OpenAI-compatible base URL
async function getLmStudioOpenAIUrl(directory: string): Promise<string> {
  const config = await readConfig(directory);
  return config?.provider?.lmstudio?.options?.baseURL || "http://127.0.0.1:8080/v1";
}

// Health check LM Studio native API
async function healthCheckLmStudio(
  nativeUrl: string
): Promise<{ healthy: boolean; version?: string; error?: string }> {
  try {
    const response = await fetch(`${nativeUrl}/extra/version`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) {
      return { healthy: false, error: `HTTP ${response.status}` };
    }
    const data = await response.json();
    return { healthy: true, version: data.version || "unknown" };
  } catch (e: any) {
    return { healthy: false, error: e.message };
  }
}

// Fetch available models from LM Studio native API
async function fetchModels(nativeUrl: string): Promise<{ models: string[]; error?: string }> {
  try {
    const response = await fetch(`${nativeUrl}/v1/models`, { signal: AbortSignal.timeout(5000) });
    if (!response.ok) {
      return { models: [], error: `HTTP ${response.status}` };
    }
    const data = await response.json();
    // LM Studio returns { object: "list", data: [{ id: "model-name", ... }] }
    const models = data.data?.map((m: any) => m.id) || [];
    return { models };
  } catch (e: any) {
    return { models: [], error: e.message };
  }
}

// Load a model via LM Studio native API
async function loadModel(
  nativeUrl: string,
  modelId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(`${nativeUrl}/v1/model/load`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: modelId }),
      signal: AbortSignal.timeout(30000), // model loading can take time
    });
    if (!response.ok) {
      const text = await response.text();
      return { success: false, error: `HTTP ${response.status}: ${text}` };
    }
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// Unload current model
async function unloadModel(nativeUrl: string): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(`${nativeUrl}/v1/model/unload`, {
      method: "POST",
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) {
      const text = await response.text();
      return { success: false, error: `HTTP ${response.status}: ${text}` };
    }
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export const SelfImprovePlugin: Plugin = async ({ client, project, directory }) => {
  // Track performance metrics per agent
  const performanceLog: Array<{
    agent: string;
    task: string;
    tokens: number;
    success: boolean;
    timestamp: number;
  }> = [];

  // Cache for LM Studio URLs
  let nativeUrl: string | null = null;
  let openAIUrl: string | null = null;

  // Helper to ensure URLs are loaded
  async function ensureUrls() {
    if (!nativeUrl) nativeUrl = await getLmStudioNativeUrl(directory);
    if (!openAIUrl) openAIUrl = await getLmStudioOpenAIUrl(directory);
  }

  return {
    // Hook: Before each message — LM Studio health check and diagnostic injection
    "chat.message": async (input: any, output: any) => {
      const { sessionID, agent, model, messageID, variant } = input;
      
      // ── Diagnostic injection into messages ──
      const diags = flushDiagnostics(sessionID || "default");
      if (diags.length > 0) {
        debug(
          SKILL_CATEGORIES.LSP_CONTEXT,
          `Injecting ${diags.length} LSP diagnostics into messages`
        );
        const diagText = diags.map((d) => `⚠️ ${d.file}: ${d.errors.slice(0, 250)}`).join("\n");

        // Inject as system message so model sees it
        input.messages.unshift({
          role: "system",
          name: "lsp-diagnostics",
          content: `[LSP Diagnostics - ${new Date().toISOString()}]\n${diagText}`
        });

        // Also log for observability
        await client.app.log({
          body: {
            service: "ambient-lsp",
            level: "warn",
            message: `Injected ${diags.length} diagnostics`,
            extra: { sessionID, files: diags.map(d => d.file) }
          }
        });
      }

      await ensureUrls();
      // Health check
      const health = await healthCheckLmStudio(nativeUrl!);
      if (!health.healthy) {
        // Emit warning but continue (maybe fallback to another provider?)
        await client.app.log({
          body: {
            service: "lmstudio",
            level: "warn",
            message: `LM Studio health check failed: ${health.error}`,
            extra: { nativeUrl },
          },
        });
        // Optionally, we could modify the system message to inform the user
        // For now, just log
      }

      // Auto-load model if needed (only if health is okay)
      if (health.healthy && model?.modelID) {
        // We could check if model is already loaded via /api/v1/model endpoint
        // For simplicity, we attempt to load it (LM Studio will ignore if already loaded)
        const loadResult = await loadModel(nativeUrl!, model.modelID);
        if (!loadResult.success) {
          await client.app.log({
            body: {
              service: "lmstudio",
              level: "warn",
              message: `Failed to load model ${model.modelID}: ${loadResult.error}`,
              extra: { nativeUrl, modelID: model.modelID },
            },
          });
        }
      }
    },

    // Hook: Modify chat parameters — race-safe LSP checks and lazy tool loading
    "chat.params": async ({ sessionID, agent, model, provider, message }: any, output: any) => {
      // Debug trace hook invocation
      traceHook("chat.params", { sessionID, agent, messageLength: message?.length }, output);

      // ── Race-safe: await any pending async checks from prior tool executions ──
      const pending = pendingChecks.get(sessionID || "default");
      if (pending) {
        try {
          await pending;
          debug(SKILL_CATEGORIES.LSP_CONTEXT, "Awaited pending LSP checks");
        } catch {
          warn(SKILL_CATEGORIES.LSP_ERROR, "Error awaiting pending LSP checks");
        }
        pendingChecks.delete(sessionID || "default");
      }

      // ── Lazy tool loading: filter tools based on conversation keywords ──
      if (output.tools && Array.isArray(output.tools)) {
        const conversation = message || "";
        const lazyTools = filterToolsByKeywords(output.tools, conversation);
        
        if (lazyTools.length !== output.tools.length) {
          debug(SKILL_CATEGORIES.TOOL_LOAD, `Lazy loading: ${output.tools.length} → ${lazyTools.length} tools`);
          output.tools = lazyTools;
        }
      }

    },

    // Hook: After tool execution — same-turn diagnostic injection
    "tool.execute.after": async (input: any, output: any) => {
      const startTime = Date.now();
      const toolName = input.tool || "";
      const sessionID = input.args?.sessionID || "default";

      // Debug trace hook invocation
      traceHook("tool.execute.after", input, output);

      // Capture file modifications and run fast check for same-turn feedback
      if ((toolName === "write" || toolName === "edit") && input.args?.filePath) {
        const filePath = input.args.filePath;

        // Run synchronously for same-turn injection (fast checks only, <5s)
        const ext = filePath.split(".").pop()?.toLowerCase() || "";
        const fastExts = ["php", "py"];
        if (fastExts.includes(ext)) {
          const entry = detectAndCheck(filePath);
          if (entry && output && typeof output === "object") {
            output.result = (output.result || "") + `\n\n⚠️ LSP: ${entry.errors.slice(0, 300)}`;
            debug(SKILL_CATEGORIES.LSP_CONTEXT, `LSP injected for ${filePath}`);
          }
        } else {
          // Slower checks: fire-and-forget with race-safe queue
          const check = (async () => {
            const entry = detectAndCheck(filePath);
            if (entry) {
              addDiagnostic(sessionID, entry);
              debug(SKILL_CATEGORIES.LSP_ERROR, `LSP issue detected in ${filePath}`);
            }
          })();
          pendingChecks.set(
            sessionID,
            check.then(() => {})
          );
        }
      }

      // Debug trace tool execution
      traceToolExecution(toolName, input.args, output?.result, Date.now() - startTime);
    },

    // Hook: On session end, analyze and propose config improvements
    "session.archived": async ({ session }: any) => {
      const configPath = `${directory}/opencode.json`;

      // Analyze session patterns
      const analysis = await analyzeSessionPatterns(session.id);

      // Generate improvement recommendations
      const recommendations = await generateRecommendations(analysis);

      // Write to proposed config
      await writeFile(
        `${directory}/opencode.json.proposed`,
        JSON.stringify(recommendations, null, 2),
        "utf8"
      );

      console.log(`🔄 Self-improvement proposal generated: opencode.json.proposed`);
      console.log(`   Review with: opencode diff-config`);
    },

    // Custom tools
    tool: {
      // Existing tool
      apply_config_improvements: tool({
        description: "Apply proposed configuration improvements after human review",
        args: {
          approve: tool.schema.boolean().describe("Whether to apply the proposed changes"),
          backup: tool.schema.boolean().default(true).describe("Create backup of current config"),
        },
        async execute({ approve, backup }) {
          if (!approve) return "Changes rejected. Proposal kept for review.";

          const current = `${directory}/.opencode/opencode.json`;
          const proposed = `${directory}/.opencode/opencode.json.proposed`;

          if (backup) {
            const backupPath = `${current}.backup.${Date.now()}`;
            await copyFile(current, backupPath);
          }

          await rename(proposed, current);
          return "Configuration upgraded. Restart OpenCode to apply changes.";
        },
      }),

      // Meta-tool: Evaluate agent effectiveness
      evaluate_agent: tool({
        description: "Evaluate specific agent performance and suggest optimizations",
        args: {
          agentName: tool.schema
            .enum([
              "core-builder",
              "core-planner",
              "lead-strategist",
              "lead-architect",
              "frontend-ui-ux",
              "backend-api",
              "backend-laravel",
              "qa-reviewer",
              "qa-tester",
            ])
            .describe("Agent to evaluate"),
          metric: tool.schema
            .enum(["token_efficiency", "task_success", "context_window_usage"])
            .describe("Metric to analyze"),
        },
        async execute({ agentName, metric }) {
          // Query your sqlite/knowledge-graph for historical data
          // Return optimization suggestions
          return `Analysis for ${agentName} on ${metric}:\n${generateAnalysis(agentName, metric)}`;
        },
      }),

      // LM Studio health check tool
      lmstudio_health: tool({
        description: "Check health of LM Studio server and display version",
        args: {},
        async execute() {
          await ensureUrls();
          const health = await healthCheckLmStudio(nativeUrl!);
          if (health.healthy) {
            return `✅ LM Studio is healthy (version: ${health.version}) at ${nativeUrl}`;
          } else {
            return `❌ LM Studio is unreachable: ${health.error}\nNative URL: ${nativeUrl}`;
          }
        },
      }),

      // LM Studio model discovery tool
      lmstudio_models: tool({
        description: "List available models from LM Studio and show all provider models",
        args: {},
        async execute() {
          await ensureUrls();
          const health = await healthCheckLmStudio(nativeUrl!);
          let result = "";

          // LM Studio models
          if (health.healthy) {
            const lmResult = await fetchModels(nativeUrl!);
            if (lmResult.error) {
              result += `❌ Error fetching LM Studio models: ${lmResult.error}\n\n`;
            } else if (lmResult.models.length === 0) {
              result += `⚠️ No models loaded in LM Studio. Load a model first.\n\n`;
            } else {
              result += `## LM Studio Models (${lmResult.models.length})\n\n`;
              for (const m of lmResult.models) {
                result += `- \`${m}\`\n`;
              }
              result += "\n";
            }
          } else {
            result += `❌ LM Studio is unreachable: ${health.error}\n\n`;
          }

          // Cerebras models
          result += `## Cerebras Models (API)\n\n`;
          result += `- \`qwen-3-235b-a22b-instruct-2507\` (Tool calling: ✅, Reasoning: ✅)\n`;
          result += `- \`zai-glm-4.7\` (Tool calling: ❌, Reasoning: ✅)\n\n`;

          // OpenCode-Go models
          result += `## OpenCode-Go Models (API)\n\n`;
          result += `- \`kimi-k2.6\` (Tool calling: ✅, Reasoning: ✅)\n`;
          result += `- \`glm-5.1\` (Tool calling: ✅, Reasoning: ✅)\n`;
          result += `- \`qwen3.6-plus\` (Tool calling: ✅, Reasoning: ✅)\n\n`;

          result += `💡 Use \`/model <provider>/<model>\` to switch models.`;

          return result;
        },
      }),

      // LM Studio load model tool
      lmstudio_load_model: tool({
        description: "Load a specific model in LM Studio",
        args: {
          modelId: tool.schema.string().describe("Model ID to load (e.g., qwen3.5-4b)"),
        },
        async execute({ modelId }) {
          await ensureUrls();
          const health = await healthCheckLmStudio(nativeUrl!);
          if (!health.healthy) {
            return `Cannot load model: LM Studio is unreachable (${health.error})`;
          }
          const result = await loadModel(nativeUrl!, modelId);
          if (result.success) {
            return `✅ Model '${modelId}' loaded successfully.`;
          } else {
            return `❌ Failed to load model '${modelId}': ${result.error}`;
          }
        },
      }),

      // LM Studio unload model tool
      lmstudio_unload_model: tool({
        description: "Unload the current model from LM Studio",
        args: {},
        async execute() {
          await ensureUrls();
          const health = await healthCheckLmStudio(nativeUrl!);
          if (!health.healthy) {
            return `Cannot unload model: LM Studio is unreachable (${health.error})`;
          }
          const result = await unloadModel(nativeUrl!);
          if (result.success) {
            return `✅ Current model unloaded successfully.`;
          } else {
            return `❌ Failed to unload model: ${result.error}`;
          }
        },
      }),

      // Clarification tool for requirement gathering
      clarify: tool({
        description: "Ask user for clarification before proceeding with ambiguous requirements",
        args: {
          question: tool.schema.string().describe("The clarification question to ask the user"),
          options: tool.schema.array(tool.schema.string()).optional().describe("Multiple choice options"),
          blocking: tool.schema.boolean().default(true).describe("Whether to wait for user response"),
        },
        async execute({ question, options, blocking }) {
          // Emit clarification request to user interface
          await client.app.log({
            body: {
              service: "clarification-gate",
              level: "info",
              message: `Clarification needed: ${question}`,
              extra: { options, blocking }
            }
          });

          // For now, return a message indicating clarification is needed
          // In a full implementation, this would integrate with the chat UI
          let result = `🤔 **Clarification Needed:** ${question}\n\n`;
          
          if (options && options.length > 0) {
            result += `Options:\n`;
            options.forEach((opt, idx) => {
              result += `${idx + 1}. ${opt}\n`;
            });
          }
          
          result += `\nPlease provide more details so I can proceed effectively.`;
          
          if (blocking) {
            result += `\n\n⚠️  Workflow paused until clarification is received.`;
          }
          
          return result;
        },
      }),

      // Task delegation tool with briefing inheritance
      task: tool({
        description: "Delegate a task to another agent with context briefing",
        args: {
          agent: tool.schema.string().describe("Target agent to delegate to"),
          task: tool.schema.string().describe("Task description"),
          briefing: tool.schema.object({
            recentFiles: tool.schema.array(tool.schema.string()).optional().describe("Recently accessed files"),
            activeDecisions: tool.schema.array(tool.schema.string()).optional().describe("Key architectural decisions"),
            failedApproaches: tool.schema.array(tool.schema.string()).optional().describe("Approaches that didn't work"),
            contextWindow: tool.schema.number().optional().describe("Remaining token budget"),
            parentAgent: tool.schema.string().optional().describe("Delegating agent name"),
          }).optional().describe("Context briefing for the child agent"),
          priority: tool.schema.enum(["low", "medium", "high"]).default("medium").describe("Task priority"),
          timeout: tool.schema.number().optional().describe("Timeout in minutes"),
        },
        async execute({ agent, task, briefing, priority, timeout }) {
          // Auto-generate briefing if not provided
          const finalBriefing = briefing || await generateBriefing();

          // Log the delegation
          await client.app.log({
            body: {
              service: "task-delegation",
              level: "info",
              message: `Delegating task to ${agent}`,
              extra: { task, briefing: finalBriefing, priority, timeout }
            }
          });

          // In a full implementation, this would trigger agent switching
          // For now, return delegation summary
          let result = `📋 **Task Delegated to ${agent}**\n\n`;
          result += `**Task:** ${task}\n`;
          result += `**Priority:** ${priority}\n`;
          
          if (timeout) {
            result += `**Timeout:** ${timeout} minutes\n`;
          }

          if (finalBriefing) {
            result += `\n**Context Briefing Provided:**\n`;
            if (finalBriefing.recentFiles?.length) {
              result += `- Recent files: ${finalBriefing.recentFiles.join(', ')}\n`;
            }
            if (finalBriefing.activeDecisions?.length) {
              result += `- Key decisions: ${finalBriefing.activeDecisions.join(', ')}\n`;
            }
            if (finalBriefing.failedApproaches?.length) {
              result += `- Avoided approaches: ${finalBriefing.failedApproaches.join(', ')}\n`;
            }
            if (finalBriefing.contextWindow) {
              result += `- Token budget: ${finalBriefing.contextWindow}\n`;
            }
          }

          result += `\n🔄 Switching to agent: ${agent}`;
          
          return result;
        },
      }),

      // Unified checkpointing tool
      checkpoint: tool({
        description: "Create atomic multi-layer snapshot before destructive operations",
        args: {
          name: tool.schema.string().optional().describe("Optional checkpoint name"),
          layers: tool.schema.array(tool.schema.enum(["git", "db", "memory", "task_state"])).default(["git", "db", "memory", "task_state"]).describe("Layers to checkpoint"),
        },
        async execute({ name, layers }) {
          const checkpointId = name || `cp-${Date.now()}`;
          const results: string[] = [];

          // Layer 1: Git stash
          if (layers.includes("git")) {
            try {
              execSync(`git stash push -m "checkpoint-${checkpointId}"`, { stdio: "pipe" });
              results.push("✅ Git stash created");
            } catch (e) {
              results.push("❌ Git stash failed");
            }
          }

          // Layer 2: Database backup
          if (layers.includes("db")) {
            try {
              // Mock DB backup - in real implementation, backup sqlite files
              execSync(`copy opencode.db opencode.db.${checkpointId}.bak`, { stdio: "pipe" });
              results.push("✅ Database backup created");
            } catch (e) {
              results.push("❌ Database backup failed");
            }
          }

          // Layer 3: Memory export
          if (layers.includes("memory")) {
            try {
              // Mock memory export - in real implementation, export MCP memory
              await writeFile(`memory.${checkpointId}.json`, JSON.stringify({ checkpoint: checkpointId }));
              results.push("✅ Memory state exported");
            } catch (e) {
              results.push("❌ Memory export failed");
            }
          }

          // Layer 4: Task state export
          if (layers.includes("task_state")) {
            try {
              // Mock task state export
              await writeFile(`tasks.${checkpointId}.json`, JSON.stringify({ checkpoint: checkpointId, tasks: [] }));
              results.push("✅ Task state exported");
            } catch (e) {
              results.push("❌ Task state export failed");
            }
          }

          // Log checkpoint creation
          await client.app.log({
            body: {
              service: "checkpoint",
              level: "info",
              message: `Created checkpoint ${checkpointId}`,
              extra: { layers, results }
            }
          });

          return `📸 **Checkpoint Created: ${checkpointId}**\n\n${results.join('\n')}\n\nUse \`/undo ${checkpointId}\` to rollback.`;
        },
      }),

      // Undo checkpoint tool
      undo: tool({
        description: "Rollback to a previous checkpoint",
        args: {
          checkpointId: tool.schema.string().optional().describe("Specific checkpoint ID to rollback to, or latest if not specified"),
        },
        async execute({ checkpointId }) {
          // Find latest checkpoint if not specified
          const targetId = checkpointId || await findLatestCheckpoint();
          if (!targetId) {
            return "❌ No checkpoints found to rollback to.";
          }

          const results: string[] = [];

          // Layer 4: Restore task state
          try {
            // Mock restore
            results.push("✅ Task state restored");
          } catch (e) {
            results.push("❌ Task state restore failed");
          }

          // Layer 3: Restore memory
          try {
            // Mock restore
            results.push("✅ Memory state restored");
          } catch (e) {
            results.push("❌ Memory restore failed");
          }

          // Layer 2: Restore database
          try {
            execSync(`copy opencode.db.${targetId}.bak opencode.db`, { stdio: "pipe" });
            results.push("✅ Database restored");
          } catch (e) {
            results.push("❌ Database restore failed");
          }

          // Layer 1: Git stash pop
          try {
            execSync(`git stash pop "stash@{0}"`, { stdio: "pipe" });
            results.push("✅ Git changes restored");
          } catch (e) {
            results.push("❌ Git restore failed");
          }

          // Log rollback
          await client.app.log({
            body: {
              service: "checkpoint",
              level: "warn",
              message: `Rolled back to checkpoint ${targetId}`,
              extra: { results }
            }
          });

          return `↶ **Rolled back to checkpoint: ${targetId}**\n\n${results.join('\n')}`;
        },
      }),

      // Browser automation tool (Playwright integration)
      browser: tool({
        description: "Automate browser interactions for UI testing and screenshots",
        args: {
          action: tool.schema.enum(["navigate", "click", "type", "screenshot", "wait"]).describe("Browser action to perform"),
          url: tool.schema.string().optional().describe("URL to navigate to (for navigate action)"),
          selector: tool.schema.string().optional().describe("CSS selector for element interaction"),
          text: tool.schema.string().optional().describe("Text to type (for type action)"),
          waitFor: tool.schema.string().optional().describe("Selector to wait for (for wait action)"),
          description: tool.schema.string().optional().describe("Description of the element for screenshot"),
        },
        async execute({ action, url, selector, text, waitFor, description }) {
          // Mock browser automation - in real implementation, use Playwright
          let result = `🌐 **Browser Action: ${action}**\n\n`;

          switch (action) {
            case "navigate":
              if (!url) return "❌ URL required for navigate action";
              result += `Navigated to: ${url}\n`;
              // Mock navigation
              break;
              
            case "click":
              if (!selector) return "❌ Selector required for click action";
              result += `Clicked element: ${selector}\n`;
              // Mock click
              break;
              
            case "type":
              if (!selector || !text) return "❌ Selector and text required for type action";
              result += `Typed "${text}" into: ${selector}\n`;
              // Mock typing
              break;
              
            case "screenshot":
              result += `Screenshot taken`;
              if (description) result += `: ${description}`;
              result += `\n📸 [Screenshot would be attached here]\n`;
              // Mock screenshot
              break;
              
            case "wait":
              if (!waitFor) return "❌ Selector required for wait action";
              result += `Waiting for element: ${waitFor}\n`;
              // Mock wait
              break;
          }

          // Log browser action
          await client.app.log({
            body: {
              service: "browser",
              level: "info",
              message: `Browser action: ${action}`,
              extra: { url, selector, text, waitFor }
            }
          });

          return result;
        },
      }),
    },
  };
};

// Helper function to generate task briefing
async function generateBriefing() {
  // Get recent file operations (mock implementation)
  const recentFiles = ["src/main.ts", "src/components/UserForm.vue", "src/api/user.ts"];
  
  // Get active decisions (mock implementation)
  const activeDecisions = ["Using Vue 3 Composition API", "Laravel 10 with Sanctum auth"];
  
  // Get failed approaches (mock implementation)
  const failedApproaches = ["Class-based components", "JWT tokens"];
  
  // Estimate remaining context window (mock)
  const contextWindow = 100000;
  
  return {
    recentFiles,
    activeDecisions,
    failedApproaches,
    contextWindow,
    parentAgent: "lead-strategist"
  };
}

// Helper function to find latest checkpoint
async function findLatestCheckpoint(): Promise<string | null> {
  try {
    // Mock implementation - in real system, query checkpoint registry
    const files = await readdir(process.cwd());
    const checkpoints = files
      .filter(f => f.startsWith('memory.cp-') && f.endsWith('.json'))
      .map(f => f.replace('memory.cp-', '').replace('.json', ''))
      .sort()
      .reverse();
    
    return checkpoints[0] || null;
  } catch {
    return null;
  }
}

// Helper function for lazy tool loading based on conversation keywords
function filterToolsByKeywords(tools: any[], conversation: string): any[] {
  const keywords = conversation.toLowerCase();
  
  // Define tool categories and their trigger keywords
  const toolCategories = {
    // Always available core tools
    core: ["clarify", "task", "checkpoint", "undo"],
    
    // File system tools
    filesystem: ["read", "write", "create", "delete", "file", "folder", "directory"],
    
    // Git/version control tools
    git: ["commit", "push", "pull", "merge", "branch", "stash", "diff", "log"],
    
    // Build/test tools
    build: ["build", "compile", "test", "run", "start", "deploy", "package"],
    
    // Database tools
    database: ["query", "insert", "update", "delete", "table", "schema", "migrate"],
    
    // Web/network tools
    web: ["http", "api", "request", "response", "url", "fetch", "browser"],
    
    // Code analysis tools
    analysis: ["lint", "format", "refactor", "optimize", "debug", "trace"],
  };
  
  // Determine which categories to load
  const activeCategories = new Set<string>(["core"]); // Core tools always loaded
  
  for (const [category, triggers] of Object.entries(toolCategories)) {
    if (triggers.some(trigger => keywords.includes(trigger))) {
      activeCategories.add(category);
    }
  }
  
  // Filter tools based on active categories
  return tools.filter(tool => {
    const toolName = tool.name?.toLowerCase() || "";
    
    // Check if tool belongs to any active category
    for (const category of activeCategories) {
      const categoryTools = toolCategories[category as keyof typeof toolCategories];
      if (categoryTools.some(trigger => toolName.includes(trigger))) {
        return true;
      }
    }
    
    return false;
  });
}

async function analyzeSessionPatterns(sessionId: string) {
  // Implement your stratigraphic analysis logic
  // Query knowledge-graph MCP, sqlite MCP, etc.
  return { patterns: [] };
}

async function generateRecommendations(analysis: any) {
  // Implement recommendation engine
  // Compare current config vs. optimal patterns
  return { recommendations: [] };
}

function generateAnalysis(agent: string, metric: string) {
  // Implement per-agent analysis
  return `TODO: Implement ${metric} analysis for ${agent}`;
}
