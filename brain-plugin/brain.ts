import { tool, type Plugin } from "@opencode-ai/plugin";
import { DecisionTree } from "./tree/engine";
import { LMStudioProvider, DEFAULT_EMBED_MODEL } from "./provider/lmstudio";
import { searchContext, searchContextLMStudio } from "./retrieval/searcher";
import { indexProject, IndexProgress } from "./retrieval/indexer";
import { contextInjector } from "./context/injector";
import { sessionMemory } from "./state/session";
import type { SignalBundle } from "./tree/engine";

const LM_STUDIO_URL = process.env.BRAIN_LMSTUDIO_URL || "http://192.168.1.12:1234/v1";
const BRAIN_EMBED_URL = process.env.BRAIN_EMBED_URL || "http://127.0.0.1:7878";

interface SidecarState {
  process: any | null;
  healthy: boolean;
  startedAt: number | null;
  lastHealthCheck: number;
}

const sidecar: SidecarState = {
  process: null,
  healthy: false,
  startedAt: null,
  lastHealthCheck: 0,
};

function toWslPath(windowsPath: string): string {
  return windowsPath
    .replace(/^([A-Z]):\\/i, (_: string, d: string) => `/mnt/${d.toLowerCase()}/`)
    .replace(/\\/g, "/");
}

async function checkSidecarHealth(): Promise<boolean> {
  const now = Date.now();
  if (now - sidecar.lastHealthCheck < 5000) return sidecar.healthy;
  sidecar.lastHealthCheck = now;
  try {
    const res = await fetch(`${BRAIN_EMBED_URL}/health`, { signal: AbortSignal.timeout(2000) });
    sidecar.healthy = res.ok;
    if (res.ok) {
      const data = await res.json();
      console.log(
        `[Brain] Sidecar healthy | uptime: ${data.uptime_seconds}s | models: ${data.loaded_models?.length || 0}`
      );
    }
    return sidecar.healthy;
  } catch {
    sidecar.healthy = false;
    return false;
  }
}

async function startSidecar(): Promise<boolean> {
  if (await checkSidecarHealth()) {
    console.log("[Brain] Rust sidecar already running");
    return true;
  }
  console.log("[Brain] Starting Rust sidecar...");
  try {
    const { spawn } = await import("child_process");
    const isWindows = typeof process !== "undefined" && process.platform === "win32";
    const nativeBinary = isWindows
      ? `${directory}\\rust-brain-sidecar\\target\\release\\brain-embed.exe`
      : `${directory}/rust-brain-sidecar/target/release/brain-embed`;
    const nativeArgs: string[] = [];
    const wslArgs = [
      "-d",
      "Ubuntu",
      "--",
      "bash",
      "-c",
      `RUST_LOG=info ${toWslPath(directory)}/rust-brain-sidecar/target/release/brain-embed`,
    ];
    const proc = isWindows
      ? spawn(nativeBinary, nativeArgs, {
          detached: true,
          stdio: "pipe",
          cwd: `${directory}\\rust-brain-sidecar`,
        })
      : spawn(nativeBinary, nativeArgs, {
          detached: true,
          stdio: "pipe",
          cwd: `${directory}/rust-brain-sidecar`,
        });
    proc.stdout?.on("data", (d: Buffer) => {
      const msg = d.toString().trim();
      if (msg) console.log(`[brain-embed] ${msg}`);
    });
    proc.stderr?.on("data", (d: Buffer) => {
      const msg = d.toString().trim();
      if (msg) console.log(`[brain-embed:err] ${msg}`);
    });
    proc.on("exit", (code: number) => {
      console.log(`[Brain] Sidecar exited (code ${code})`);
      sidecar.process = null;
      sidecar.healthy = false;
    });
    sidecar.process = proc;
    proc.unref();
    for (let i = 0; i < 30; i++) {
      await new Promise((r) => setTimeout(r, 1000));
      if (await checkSidecarHealth()) {
        console.log(`[Brain] Sidecar ready after ${i + 1}s`);
        return true;
      }
    }
    if (isWindows) {
      console.warn("[Brain] Native sidecar did not become healthy; trying WSL fallback...");
      try {
        const wslProc = spawn("wsl.exe", wslArgs, { detached: true, stdio: "pipe" });
        sidecar.process = wslProc;
        wslProc.unref();
        for (let i = 0; i < 30; i++) {
          await new Promise((r) => setTimeout(r, 1000));
          if (await checkSidecarHealth()) {
            console.log(`[Brain] WSL sidecar ready after ${i + 1}s`);
            return true;
          }
        }
      } catch (fallbackErr) {
        console.error("[Brain] WSL sidecar fallback failed:", fallbackErr);
      }
    }
    console.error("[Brain] Sidecar failed to start within 30s");
    return false;
  } catch (err) {
    console.error("[Brain] Sidecar start error:", err);
    return false;
  }
}

function stopSidecar(): void {
  if (sidecar.process) {
    try {
      sidecar.process.kill("SIGTERM");
    } catch {}
    sidecar.process = null;
  }
  sidecar.healthy = false;
}

async function syncConfigToSidecar(provider: LMStudioProvider): Promise<void> {
  try {
    const res = await fetch(`${BRAIN_EMBED_URL}/config`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        embed_model: provider.defaultEmbedModel,
        chat_model: provider.defaultChatModel,
        draft_model: provider.defaultDraftModel,
        speculative_enabled: true,
        context_length: 4096,
        temperature: 0.7,
        max_tokens: 4096,
      }),
    });
    if (res.ok) console.log("[Brain] Config synced to sidecar");
  } catch (err) {
    console.error("[Brain] Config sync failed:", err);
  }
}

async function sidecarPrewarm(modelType: string): Promise<void> {
  try {
    await fetch(`${BRAIN_EMBED_URL}/prewarm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model_type: modelType }),
    });
    console.log(`[Brain] Prewarmed ${modelType} model`);
  } catch {}
}

const BrainPlugin: Plugin = async ({ directory }) => {
  let tree: DecisionTree;
  let provider: LMStudioProvider;
  let indexingInProgress = false;
  const dirtyFiles = new Set<string>();
  let reindexTimer: any = null;

  try {
    tree = await DecisionTree.load();
    provider = new LMStudioProvider(LM_STUDIO_URL);
    console.log("[Brain] Decision tree loaded successfully");
  } catch (error) {
    console.error("[Brain] Failed to initialize:", error);
    tree = new DecisionTree();
    provider = new LMStudioProvider(LM_STUDIO_URL);
  }

  return {
    "server.start": async () => {
      console.log("[Brain] Plugin loaded - Cognitive layer for OpenCode");
      console.log(`[Brain] LM Studio: ${LM_STUDIO_URL}`);
      console.log(`[Brain] Decision tree: ${tree.getStats().totalNodes} nodes`);

      const started = await startSidecar();
      if (started) {
        await syncConfigToSidecar(provider);
        console.log(`[Brain] Auto-indexing project: ${directory}`);
        indexingInProgress = true;
        try {
          const result = await indexProject(directory);
          console.log(
            `[Brain] Indexed ${result.chunks} chunks from ${result.files_indexed} files (${result.duration_ms}ms)`
          );
        } catch (err) {
          console.error("[Brain] Auto-index failed:", err);
        }
        indexingInProgress = false;
      } else {
        console.warn("[Brain] Sidecar not available - RAG disabled");
      }
    },

    "session.archived": async () => {
      stopSidecar();
      console.log("[Brain] Sidecar stopped");
    },

    "message.updated": async (input: any, output: any) => {
      const msg = input.message;
      if (msg.role !== "user") return;

      const signals: SignalBundle = {
        message: msg.content,
        recentFiles: sessionMemory.getMemory().recentFiles,
        diagnostics: sessionMemory.getMemory().diagnostics,
        todo: sessionMemory.getMemory().currentTodo,
        lspSymbols: sessionMemory.getMemory().lspSymbols,
      };

      const { node: scenario, score } = tree.classify(msg.content, signals);

      if (scenario.intent === "quick_chat" || score < 0.1) {
        return;
      }

      const strategy = tree.selectStrategy(scenario);

      if (strategy.depth === "none" || strategy.maxChunks === 0) {
        return;
      }

      if (["debug", "refactor", "feature", "learn"].includes(scenario.intent)) {
        sidecarPrewarm("embed");
      }

      try {
        let context;
        if (sidecar.healthy) {
          context = await searchContext(
            msg.content,
            {
              strategy: strategy.name,
              depth: strategy.depth,
              maxChunks: strategy.maxChunks,
              rerank: strategy.rerank,
            },
            directory
          );
        } else {
          console.log("[Brain] Sidecar unavailable, falling back to LM Studio embedding");
          context = await searchContextLMStudio(
            msg.content,
            {
              strategy: strategy.name,
              depth: strategy.depth,
              maxChunks: strategy.maxChunks,
              rerank: strategy.rerank,
            },
            directory,
            provider
          );
        }

        if (context.chunks.length > 0) {
          sessionMemory.markContextUsed(context.chunks);
          const augmentedMessage = contextInjector.inject(msg.content, context, {
            intent: scenario.intent,
            sessionSummary: sessionMemory.getSummary(),
            recentFiles: signals.recentFiles,
            diagnostics: signals.diagnostics.map((d) => `${d.file}:${d.message}`),
          });
          output.message.content = augmentedMessage;
          console.log(`[Brain] +${context.chunks.length} chunks | backend: ${sidecar.healthy ? "sidecar" : "lmstudio"} | intent: ${scenario.intent}`);
        }
        sessionMemory.recordDecision({
          timestamp: Date.now(),
          intent: scenario.intent,
          strategy: strategy.name,
          contextCount: context.chunks.length,
          query: msg.content,
        });
      } catch (error) {
        console.error("[Brain] Retrieval error:", error);
      }
    },

    "tool.execute.after": async (input: any, output: any) => {
      if (input.tool === "edit" || input.tool === "write") {
        sessionMemory.markSuccess();
      }
      if (input.tool === "bash" && output.result?.includes("error")) {
        sessionMemory.markFailure("bash_error");
      }
    },

    "lsp.client.diagnostics": async (input: any) => {
      const diagnostics = input.diagnostics || [];
      sessionMemory.setDiagnostics(diagnostics);
      if (diagnostics.some((d: any) => d.severity === "error")) {
        tree.prewarmIntent("debug");
      }
    },

    "file.watcher.updated": async (input: any) => {
      sessionMemory.markFileDirty(input.path);
      dirtyFiles.add(input.path);
      if (!indexingInProgress && sidecar.healthy && dirtyFiles.size >= 5) {
        clearTimeout(reindexTimer);
        reindexTimer = setTimeout(async () => {
          if (dirtyFiles.size === 0) return;
          indexingInProgress = true;
          const files = Array.from(dirtyFiles);
          dirtyFiles.clear();
          try {
            const result = await indexProject(directory, { force: true });
            console.log(`[Brain] Re-indexed ${result.chunks} chunks (${files.length} dirty files)`);
          } catch (err) {
            console.error("[Brain] Re-index failed:", err);
          }
          indexingInProgress = false;
        }, 5000);
      }
    },

    "session.compacting": async (input: any, output: any) => {
      const summary = sessionMemory.getSummary();
      if (output.context) {
        output.context.push(summary);
      }
      await tree.save();
    },

    "chat.params": async (params: any) => {
      if (!sidecar.healthy) return params;
      const cfg = await (await fetch(`${BRAIN_EMBED_URL}/config`)).json().catch(() => null);
      if (cfg?.speculative_enabled && cfg?.draft_model) {
        params.draft_model = cfg.draft_model;
        console.log(`[Brain] Speculative: ${cfg.chat_model} + ${cfg.draft_model}`);
      }
      return params;
    },

    tool: {
      brain_index_project: tool({
        description: "Index the current project for semantic code search",
        args: {
          path: tool.schema.string().optional().describe("Directory path to index"),
          force: tool.schema.boolean().optional().describe("Force re-index"),
        },
        async execute(args: any) {
          if (!sidecar.healthy) return "Sidecar not running. Use brain_sidecar_status to check.";
          const root = args.path ?? directory;
          indexingInProgress = true;
          try {
            const result = await indexProject(root, { force: args.force });
            return `Indexed ${result.chunks} chunks from ${result.files_indexed} files (${result.duration_ms}ms)`;
          } catch (err: any) {
            return `Index failed: ${err.message}`;
          } finally {
            indexingInProgress = false;
          }
        },
      }),

      brain_search: tool({
        description: "Search the codebase for relevant context",
        args: {
          query: tool.schema.string().describe("Search query"),
          top_k: tool.schema.number().optional().describe("Number of results (default: 5)"),
        },
        async execute(args: any) {
          if (!sidecar.healthy) return "Sidecar not running.";
          const context = await searchContext(
            args.query,
            { strategy: "manual", depth: "broad", maxChunks: args.top_k ?? 5, rerank: true },
            directory
          );
          return contextInjector.formatResults(context);
        },
      }),

      brain_status: tool({
        description: "Get the brain's current state: sidecar health, indexed projects, cache stats",
        args: {},
        async execute() {
          const stats = tree.getStats();
          const memory = sessionMemory.getMemory();
          let sidecarInfo = "Sidecar: not running";
          let metricsInfo = "";
          if (sidecar.healthy) {
            try {
              const h = await (await fetch(`${BRAIN_EMBED_URL}/health`)).json();
              const m = await (await fetch(`${BRAIN_EMBED_URL}/metrics`)).json();
              sidecarInfo = [
                `Sidecar: ✅ running (uptime ${h.uptime_seconds}s)`,
                `GPU: ${h.gpu ? `${h.gpu.usage_percent.toFixed(1)}% used (${h.gpu.free_gb.toFixed(1)}G free / ${h.gpu.total_gb.toFixed(1)}G total)` : "N/A"}`,
                `Models: embed=${h.config.embed_model} | chat=${h.config.chat_model} | draft=${h.config.draft_model || "none"}`,
              ].join("\n");
              metricsInfo = [
                `Cache: ${m.cache_hit_rate > 0 ? (m.cache_hit_rate * 100).toFixed(0) : 0}% hit rate (${m.cache_hits} hits, ${m.cache_misses} misses)`,
                `Searches: ${m.searches_total} | Index chunks: ${m.index_chunks} | Prewarms: ${m.orchestrator_prewarm_count}`,
              ].join("\n");
            } catch {}
          }
          return [
            `## Brain Status`,
            ``,
            sidecarInfo,
            ``,
            metricsInfo,
            ``,
            `### Decision Tree`,
            `- Total nodes: ${stats.totalNodes}`,
            `- Pending mutations: ${stats.pendingMutations}`,
            ``,
            `### Intents`,
            ...Object.entries(stats.intents).map(
              ([intent, data]) =>
                `- ${intent}: weight=${data.weight.toFixed(2)}, visits=${data.visits}`
            ),
            ``,
            `### Session Memory`,
            `- Decisions: ${memory.decisions.length}`,
            `- Successes: ${memory.successCount}`,
            `- Failures: ${memory.failures.length}`,
            `- Recent files: ${memory.recentFiles.length}`,
            `- Context used: ${memory.contextUsed.length} chunks`,
          ].join("\n");
        },
      }),

      brain_metrics: tool({
        description: "Get Prometheus-style metrics from the Rust sidecar",
        args: {},
        async execute() {
          if (!sidecar.healthy) return "Sidecar not running.";
          try {
            const m = await (await fetch(`${BRAIN_EMBED_URL}/metrics`)).json();
            return [
              `## Brain Metrics`,
              ``,
              `| Metric | Value |`,
              `|--------|-------|`,
              `| Decisions total | ${m.decisions_total} |`,
              `| Searches total | ${m.searches_total} |`,
              `| Index chunks | ${m.index_chunks} |`,
              `| Cache hits | ${m.cache_hits} |`,
              `| Cache misses | ${m.cache_misses} |`,
              `| Cache hit rate | ${(m.cache_hit_rate * 100).toFixed(1)}% |`,
              `| Prewarm count | ${m.orchestrator_prewarm_count} |`,
            ].join("\n");
          } catch {
            return "Failed to fetch metrics.";
          }
        },
      }),

      brain_embed_test: tool({
        description: "Test embedding search - show what context would be retrieved for a query",
        args: {
          query: tool.schema.string().describe("Test query"),
          top_k: tool.schema.number().optional().describe("Number of results (default: 5)"),
        },
        async execute(args: any) {
          if (!sidecar.healthy) return "Sidecar not running.";
          const context = await searchContext(
            args.query,
            { strategy: "test", depth: "broad", maxChunks: args.top_k ?? 5, rerank: true },
            directory
          );
          if (context.chunks.length === 0)
            return "No relevant context found. Try indexing first with brain_index_project.";
          return contextInjector.formatResults(context);
        },
      }),

      brain_sidecar_status: tool({
        description: "Check if the Rust sidecar is running and healthy",
        args: {},
        async execute() {
          const healthy = await checkSidecarHealth();
          if (!healthy)
            return "❌ Sidecar not running. It will start automatically on next session.";
          try {
            const h = await (await fetch(`${BRAIN_EMBED_URL}/health`)).json();
            return [
              `✅ Sidecar running`,
              `- Version: ${h.version}`,
              `- Uptime: ${h.uptime_seconds}s`,
              `- GPU: ${h.gpu ? `${h.gpu.usage_percent.toFixed(1)}% used (${h.gpu.free_gb.toFixed(1)}G free)` : "N/A"}`,
              `- Embed model: ${h.config.embed_model}`,
              `- Chat model: ${h.config.chat_model}`,
              `- Draft model: ${h.config.draft_model || "none"}`,
              `- Speculative: ${h.config.speculative ? "enabled" : "disabled"}`,
            ].join("\n");
          } catch {
            return "✅ Sidecar responding but failed to parse health data.";
          }
        },
      }),

      brain_sidecar_restart: tool({
        description: "Restart the Rust sidecar",
        args: {},
        async execute() {
          stopSidecar();
          await new Promise((r) => setTimeout(r, 1000));
          const started = await startSidecar();
          if (started) {
            await syncConfigToSidecar(provider);
            return "Sidecar restarted successfully.";
          }
          return "Failed to restart sidecar.";
        },
      }),

      brain_reset: tool({
        description: "Reset the brain's session memory and decision tree",
        args: {},
        async execute() {
          sessionMemory.reset();
          tree = new DecisionTree();
          await tree.save();
          return "Brain reset successfully.";
        },
      }),

      brain_model_load: tool({
        description: "Load a model into LM Studio (chat, embed, or draft)",
        args: {
          model_type: tool.schema.string().describe("Model type: chat, embed, draft"),
        },
        async execute(args: any) {
          try {
            const cfg = await (await fetch(`${BRAIN_EMBED_URL}/config`)).json();
            const model =
              args.model_type === "embed"
                ? cfg.embed_model
                : args.model_type === "draft"
                  ? cfg.draft_model
                  : cfg.chat_model;
            if (!model) return `No ${args.model_type} model configured.`;
            const res = await fetch(`${BRAIN_EMBED_URL}/prewarm`, { method: "POST" });
            return `Loading ${args.model_type} model: ${model}`;
          } catch {
            return "Failed to load model.";
          }
        },
      }),

      brain_model_unload: tool({
        description: "Unload models from LM Studio GPU memory to free VRAM",
        args: {
          all: tool.schema.boolean().optional().describe("Unload all non-essential models"),
        },
        async execute(args: any) {
          try {
            const before = await (await fetch(`${BRAIN_EMBED_URL}/gpu`)).json();
            const res = await fetch(`${BRAIN_EMBED_URL}/cache/invalidate`, { method: "POST" });
            const after = await (await fetch(`${BRAIN_EMBED_URL}/gpu`)).json();
            return `Models unloaded. GPU before: ${before.used_gb?.toFixed(1) || "?"}G used → after: ${after.used_gb?.toFixed(1) || "?"}G used`;
          } catch {
            return "Failed to unload models.";
          }
        },
      }),

      brain_diagnostic: tool({
        description:
          "Run full pipeline diagnostic: sidecar health, index status, search, config sync",
        args: {},
        async execute() {
          const results: string[] = ["## Brain Diagnostic\n"];

          // 1. Sidecar health
          try {
            const h = await (await fetch(`${BRAIN_EMBED_URL}/health`)).json();
            results.push(`✅ Sidecar: v${h.version} (uptime ${h.uptime_seconds}s)`);
            results.push(`   Chat: ${h.config.chat_model}`);
            results.push(`   Embed: ${h.config.embed_model}`);
            results.push(`   Draft: ${h.config.draft_model || "none"}`);
            results.push(`   Speculative: ${h.config.speculative ? "enabled" : "disabled"}`);
            if (h.gpu)
              results.push(
                `   GPU: ${h.gpu.usage_percent.toFixed(1)}% used (${h.gpu.free_gb.toFixed(1)}G free)`
              );
            else results.push(`   GPU: N/A (WSL may not expose nvidia-smi)`);
            results.push(`   Loaded models: ${h.loaded_models?.join(", ") || "none"}`);
          } catch {
            results.push("❌ Sidecar: NOT RUNNING — RAG disabled");
            return results.join("\n");
          }

          // 2. Metrics / cache
          try {
            const m = await (await fetch(`${BRAIN_EMBED_URL}/metrics`)).json();
            results.push(
              `\n📊 Cache: ${m.cache_hits} hits / ${m.cache_misses} misses (${(m.cache_hit_rate * 100).toFixed(0)}%)`
            );
            results.push(`   Indexed chunks: ${m.index_chunks}`);
            results.push(`   Searches performed: ${m.searches_total}`);
          } catch {}

          // 3. Config sync
          try {
            const cfg = await (await fetch(`${BRAIN_EMBED_URL}/config`)).json();
            results.push(
              `\n⚙️ Config: context=${cfg.context_length} | concurrency=${cfg.max_concurrency} | batch=${cfg.batch_size}`
            );
          } catch {}

          // 4. Quick search test (uses directory-derived project_id)
          try {
            const ctx = await searchContext(
              "diagnostic test query",
              { strategy: "diagnostic", depth: "shallow", maxChunks: 1, rerank: false },
              directory
            );
            if (ctx.chunks.length > 0) {
              results.push(`\n🔍 Search: ✅ working (${ctx.chunks.length} results)`);
            } else {
              results.push(`\n🔍 Search: ⚠️ 0 results — try brain_index_project first`);
            }
          } catch (e: any) {
            results.push(`\n🔍 Search: ❌ ${e.message}`);
          }

          // 5. LM Studio embedding fallback check
          try {
            const testEmbed = await provider.embed(provider.defaultEmbedModel, ["test"]);
            results.push(`\n🧠 LM Studio Embedding: ✅ working (${testEmbed[0].length}-dim)`);
          } catch {
            results.push(`\n🧠 LM Studio Embedding: ❌ not available`);
          }

          results.push(`\n📁 Project: ${directory}`);
          return results.join("\n");
        },
      }),

      brain_embed_lmstudio: tool({
        description: "Use LM Studio HTTP endpoint directly for embedding search (bypasses sidecar)",
        args: {
          query: tool.schema.string().describe("Search query"),
          top_k: tool.schema.number().optional().describe("Number of results (default: 5)"),
        },
        async execute(args: any) {
          try {
            const context = await searchContextLMStudio(
              args.query,
              { strategy: "manual", depth: "broad", maxChunks: args.top_k ?? 5, rerank: true },
              directory,
              provider
            );
            if (context.chunks.length === 0) return "No relevant context found.";
            return contextInjector.formatResults(context);
          } catch (err: any) {
            return `LM Studio embedding failed: ${err.message}`;
          }
        },
      }),

      brain_speculative_status: tool({
        description: "Show speculative decoding status",
        args: {},
        async execute() {
          if (!sidecar.healthy) return "Sidecar not running.";
          try {
            const cfg = await (await fetch(`${BRAIN_EMBED_URL}/config`)).json();
            return [
              `## Speculative Decoding`,
              `- Enabled: ${cfg.speculative_enabled}`,
              `- Draft model: ${cfg.draft_model || "none"}`,
              `- Chat model: ${cfg.chat_model}`,
              `- Context length: ${cfg.context_length}`,
            ].join("\n");
          } catch {
            return "Failed to fetch config.";
          }
        },
      }),
    },
  };
};

export default BrainPlugin;
