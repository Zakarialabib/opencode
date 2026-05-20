import { tool, type Plugin } from "@opencode-ai/plugin";
import { DecisionTree } from "./tree/engine.js";
import { LMStudioProvider, defaultProvider } from "./provider/lmstudio.js";
import { searchProjectContext } from "./retrieval/searcher.js";
import { indexProject } from "./retrieval/indexer.js";
import { contextInjector } from "./context/injector.js";
import { sessionMemory } from "./state/session.js";
import { docsStore, DocEntry } from "./docs-store.js";
import { getDatabase, closeDatabase } from "./store/index.js";
import { isVectorActive } from "./store/vec.js";
import { resetDenseFailedFlag } from "./retrieval/dense.js";
import { formatSearchResults } from "./tools/formatter";
import { TokenBudgetMonitor, ContextPruner, initializeFromConfig } from "./context/token-budget.js";
import type { SignalBundle } from "./tree/engine.js";
import { setRerankingConfig, getRerankingConfig, RERANKING_STRATEGIES } from "./retrieval/reranking-trigger";

const FETCH_TIMEOUT = 10000;

function detectRegistry(query: string): {
  registry: "npm" | "crates.io" | "packagist" | null;
  packageName: string | null;
} {
  const npmMatch = query.match(/(?:npm install|npm i|import\s+.*\s+from\s+['"])(@?[a-z0-9_./-]+)/i);
  if (npmMatch) return { registry: "npm", packageName: npmMatch[1] };

  const cargoMatch = query.match(/(?:cargo add|cargo\.toml|use\s+)([a-zA-Z][a-zA-Z0-9_-]*)(?:::|;|\s)/i);
  if (cargoMatch) return { registry: "crates.io", packageName: cargoMatch[1] };

  const composerMatch = query.match(
    /(?:composer require|composer\.json|use\s+)([A-Z][a-zA-Z0-9_]+(?:\/[A-Z][a-zA-Z0-9_]+)?)/
  );
  if (composerMatch) return { registry: "packagist", packageName: composerMatch[1] };

  return { registry: null, packageName: null };
}

async function fetchDocFromRegistry(
  registry: "npm" | "crates.io" | "packagist",
  packageName: string
): Promise<DocEntry | null> {
  const cached = docsStore.get(registry, packageName);
  if (cached) return cached;

  try {
    let url: string;
    switch (registry) {
      case "npm":
        url = `https://registry.npmjs.org/${encodeURIComponent(packageName)}`;
        break;
      case "crates.io":
        url = `https://crates.io/api/v1/crates/${encodeURIComponent(packageName)}`;
        break;
      case "packagist":
        url = `https://repo.packagist.org/p2/${packageName.replace("/", "/")}.json`;
        break;
    }
    const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT) });
    if (!res.ok) return null;
    const data: any = await res.json();
    let description = "";
    let version = "";
    let docsUrl = "";

    switch (registry) {
      case "npm":
        description = data.description || "";
        version = data["dist-tags"]?.latest || "";
        docsUrl = data.homepage || `https://www.npmjs.com/package/${packageName}`;
        break;
      case "crates.io":
        description = data.crate?.description || "";
        version = data.crate?.max_version || "";
        docsUrl = data.crate?.documentation || `https://docs.rs/${packageName}`;
        break;
      case "packagist":
        const pkg = data.packages?.[packageName]?.[0];
        description = pkg?.description || "";
        version = pkg?.version || "";
        docsUrl = `https://packagist.org/packages/${packageName}`;
        break;
    }

    const entry: DocEntry = {
      source: registry,
      packageName,
      description,
      version,
      docsUrl,
      raw: JSON.stringify(data).slice(0, 2000),
      fetchedAt: Date.now(),
      usedCount: 1,
    };
    docsStore.add(entry);
    return entry;
  } catch (err) {
    console.error(`[Brain] Doc fetch failed for ${registry}:${packageName}:`, err);
    return null;
  }
}

async function queryContext7(query: string): Promise<string | null> {
  try {
    const res = await fetch("http://localhost:11435/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "context7",
        messages: [{ role: "user", content: `Find documentation for: ${query}` }],
        stream: false,
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.message?.content || null;
  } catch {
    console.debug("[Brain] queryContext7: context7 endpoint unavailable (http://localhost:11435)");
    return null;
  }
}

function detectSkillGap(query: string, instructions: string[]): boolean {
  const hasInstruction = instructions.some((i) => {
    const keywords: string[] = i.toLowerCase().match(/\b(\w+)\b/g) || [];
    const queryWords: string[] = query.toLowerCase().match(/\b(\w{3,})\b/g) || [];
    return queryWords.some((w) => keywords.includes(w));
  });
  return !hasInstruction;
}

function rewritePrompt(query: string, intent: string, contextSummary: string): string {
  const prefix = `[Brain: classified as "${intent}" intent. ${contextSummary}]\n\n`;
  const clarification = `I need to understand this better. Could you rephrase or provide more context?\n\nOriginal: `;
  return `${prefix}${clarification}${query}`;
}

const BrainPlugin: Plugin = async ({ directory }) => {
  let tree: DecisionTree;
  let provider: LMStudioProvider;
  let indexingInProgress = false;
  const dirtyFiles = new Set<string>();
  let reindexTimer: any = null;

  try {
    tree = await DecisionTree.load();
    provider = defaultProvider;
    console.log("[Brain] Decision tree loaded successfully");
  } catch (error) {
    console.error("[Brain] Failed to initialize:", error);
    tree = new DecisionTree();
    provider = defaultProvider;
  }

  return {
    "server.start": async () => {
      console.log("[Brain] Plugin loaded - Cognitive v2 layer for OpenCode (Node-native)");
      console.log(`[Brain] LM Studio SDK: active`);
      // No VRAM guard implemented. Reranker and dense embeddings run on CPU to preserve VRAM.
      // Speculative decoding (draft_model) is not wired. The chat.params hook handles skill gaps instead.

      let config: any = {};
      try {
        const fs = await import("fs");
        const path = await import("path");
        const configPath = path.join(directory, "opencode.json");
        if (fs.existsSync(configPath)) {
          config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
          const baseURL =
            config?.provider?.lmstudio?.options?.baseURL ||
            config?.lmstudio?.baseURL ||
            "http://localhost:1234";
          provider.setBaseURL(baseURL);
        } else {
          provider.setBaseURL("http://localhost:1234");
        }
      } catch (err: any) {
        console.warn("[Brain] Failed to parse opencode.json for LM Studio baseURL:", err.message);
        provider.setBaseURL("http://localhost:1234");
      }

      const budgetMonitor = TokenBudgetMonitor.getInstance();
      if (config.compaction) {
        budgetMonitor.setBudget(config.compaction.budget || 24000);
        budgetMonitor.setReserved(config.compaction.reserved || 8192);
        console.log(
          `[Brain] Token budget configured: ${budgetMonitor.getBudgetStatus().total} total, ` +
          `${budgetMonitor.getBudgetStatus().reserved} reserved`
        );
      }
      contextInjector.initializeFromConfig(config);

      let db: ReturnType<typeof getDatabase> | undefined = undefined;
      try {
        db = getDatabase(directory);
      } catch (err: any) {
        console.error("[Brain] Database connection failed:", err.message);
      }

      let forceReindex = false;
      if (db) {
        try {
          const row = db.prepare("SELECT value FROM config WHERE key = 'needs_reindex'").get() as
            | { value: string }
            | undefined;
          if (row?.value === "true") {
            forceReindex = true;
            db.prepare(
              "INSERT OR REPLACE INTO config (key, value, updated_at) VALUES ('needs_reindex', 'false', ?)"
            ).run(Date.now());
          }
        } catch (e: any) {
          console.warn("[Brain] Failed to check needs_reindex flag:", e.message);
        }
      }

      console.log(`[Brain] Auto-indexing project in background: ${directory}`);
      setImmediate(() => {
        indexingInProgress = true;
        try {
          const startTime = Date.now();
          if (forceReindex && db) {
            console.log("[Brain] Schema migration triggered a full clean re-indexing...");
            db.transaction(() => {
              db.prepare("DELETE FROM chunks").run();
              db.prepare("DELETE FROM files").run();
              db.prepare("DELETE FROM fts_chunks").run();
              try {
                db.prepare("DELETE FROM chunk_embeddings").run();
                db.prepare("DELETE FROM chunk_embeddings_nomic").run();
              } catch {}
            })();
          }
          const result = indexProject(directory);
          const duration = Date.now() - startTime;
          console.log(
            `[Brain] Background auto-index completed in ${duration}ms (processed ${result.length} chunks)`
          );
        } catch (err: any) {
          console.error("[Brain] Background auto-index failed:", err.message);
        } finally {
          indexingInProgress = false;
        }
      });
    },

    "session.archived": async () => {
      closeDatabase();
      console.log("[Brain] Unified SQLite connection closed");
      console.log("[Brain] Cached docs:", docsStore.getSummary());
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

      const complexity = adaptiveChunker.estimateComplexity(msg.content);
      const adaptiveLimit = adaptiveChunker.calculateChunkLimit(
        scenario.intent,
        score,
        complexity
      );

      try {
        console.log(
          `[Brain] Executing search for intent: "${scenario.intent}" (strategy: ${strategy.name}, complexity: ${complexity}, chunks: ${adaptiveLimit})...`
        );
        const results = await searchProjectContext(
          directory,
          msg.content,
          adaptiveLimit,
          scenario.intent
        );

        const mappedChunks = results.map((r) => ({
          id: r.id,
          filepath: r.filepath,
          language: r.language,
          type: r.type,
          name: r.name,
          start_line: r.start_line,
          end_line: r.end_line,
          parent_id: r.parent_id,
          content: r.content,
          lines: r.end_line - r.start_line + 1,
        }));

        const context = {
          chunks: mappedChunks,
          totalChunks: mappedChunks.length,
        };

        const budgetMonitor = TokenBudgetMonitor.getInstance();
        budgetMonitor.startOperation('brain_search');

        let docContext = "";

        if (context.chunks.length < 3) {
          console.log("[Brain] Low code context, trying context7...");
          const context7Result = await queryContext7(msg.content);
          if (context7Result) {
            docContext = `\n## Library Documentation (context7)\n${context7Result.slice(0, 1500)}\n`;
            console.log("[Brain] context7 returned docs");
          }

          const { registry, packageName } = detectRegistry(msg.content);
          if (registry && packageName) {
            console.log(`[Brain] Detected ${registry} package: ${packageName}`);
            const docEntry = await fetchDocFromRegistry(registry, packageName);
            if (docEntry) {
              docContext += `\n## Package Info (${docEntry.source}: ${docEntry.packageName})\n`;
              docContext += `Description: ${docEntry.description}\n`;
              docContext += `Version: ${docEntry.version || "unknown"}\n`;
              if (docEntry.docsUrl) docContext += `Docs: ${docEntry.docsUrl}\n`;
              console.log(`[Brain] Fetched docs for ${packageName} from ${registry}`);
            }
          }
        }

        if (context.chunks.length > 0 || docContext) {
          sessionMemory.markContextUsed(context.chunks as any);
          
          const workingContext = { ...context, docContext };
          
          if (!budgetMonitor.checkBudget(500)) {
            console.log("[Brain] Budget low, triggering aggressive pruning...");
            const pruned = ContextPruner.aggressivePrune(workingContext);
            workingContext.chunks = pruned.chunks;
            workingContext.totalChunks = pruned.chunks.length;
            console.log(
              `[Brain] Aggressive pruning: removed ${pruned.removedChunks || 0} chunks, ` +
              `reduced to ${pruned.tokens || 0} tokens`
            );
          }
          
          const augmentedMessage = contextInjector.inject(
            docContext ? `${msg.content}\n\n${docContext}` : msg.content,
            workingContext,
            {
              intent: scenario.intent,
              sessionSummary: sessionMemory.getSummary(),
              recentFiles: signals.recentFiles,
              diagnostics: signals.diagnostics.map((d: any) => `${d.file}:${d.message}`),
              enableBudgetCheck: true,
            }
          );
          
          const contextTokens = contextInjector.getBudgetStatus().used;
          budgetMonitor.endOperation('brain_search', contextTokens);
          
          output.message.content = augmentedMessage;
          const sources = [];
          if (workingContext.chunks.length > 0) sources.push(`${workingContext.chunks.length} code chunks`);
          if (docContext.includes("context7")) sources.push("context7 docs");
          if (docContext.includes("Package Info")) sources.push("registry docs");
          console.log(
            `[Brain] +${sources.join(", ")} | backend: unified-sqlite | intent: ${scenario.intent}`
          );
        } else {
          budgetMonitor.endOperation('brain_search', 0);
        }

        sessionMemory.recordDecision({
          timestamp: Date.now(),
          intent: scenario.intent,
          strategy: strategy.name,
          contextCount: context.chunks.length + (docContext ? 1 : 0),
          query: msg.content,
          success: context.chunks.length > 0 || !!docContext,
        });
      } catch (error) {
        console.error("[Brain] message.updated: context retrieval pipeline failed:", error);
      }
    },

    "chat.params": async (input: any, output: any) => {
      const msg = input.message || "";
      const instructions = output.instructions || [];

      if (detectSkillGap(msg, instructions)) {
        const signals: SignalBundle = {
          message: msg,
          recentFiles: sessionMemory.getMemory().recentFiles,
          diagnostics: [],
        };
        const { node: scenario, score } = tree.classify(msg, signals);
        const docsSummary = docsStore.getSummary();
        const rewritten = rewritePrompt(msg, scenario.intent, docsSummary);

        if (output.instructions && !instructions.includes(rewritten)) {
          output.instructions.push(rewritten);
          console.log(
            `[Brain] Prompt fallback applied (intent: ${scenario.intent}, confidence: ${score.toFixed(2)})`
          );
        }
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
      if (!indexingInProgress) {
        clearTimeout(reindexTimer);
        reindexTimer = setTimeout(async () => {
          if (dirtyFiles.size === 0) return;
          indexingInProgress = true;
          const files = Array.from(dirtyFiles);
          dirtyFiles.clear();
          try {
            console.log(`[Brain] Triggering background re-index for modified files...`);
            const result = indexProject(directory);
            console.log(
              `[Brain] Background incremental re-index complete: parsed ${result.length} new chunks`
            );
          } catch (err: any) {
            console.error("[Brain] Re-index failed:", err.message);
          }
          indexingInProgress = false;
        }, 3000);
      }
    },

    "experimental.session.compacting": async (input: any, output: any) => {
      const summary = sessionMemory.getSummary();
      if (output.context) {
        output.context.push(summary);
      }
      await tree.save();
    },

    tool: {
      brain_index_project: tool({
        description: "Index the current project for semantic code search",
        args: {
          path: tool.schema.string().optional().describe("Directory path to index"),
        },
        async execute(args: any) {
          const root = args.path ?? directory;
          indexingInProgress = true;
          try {
            const startTime = Date.now();
            const result = indexProject(root);
            const duration = Date.now() - startTime;
            return `Project indexed successfully. Parsed ${result.length} modified/new chunks in ${duration}ms.`;
          } catch (err: any) {
            return `Index failed: ${err.message}`;
          } finally {
            indexingInProgress = false;
          }
        },
      }),

      brain_search: tool({
        description: "Search the codebase for relevant context using unified hybrid dense + FTS5",
        args: {
          query: tool.schema.string().describe("Search query"),
          top_k: tool.schema.number().optional().describe("Number of results (default: 5)"),
        },
        async execute(args: any) {
          const startTime = Date.now();
          const results = await searchProjectContext(
            directory,
            args.query,
            args.top_k ?? 5,
            "learn"
          );

          const mappedChunks = results.map((r) => ({
            id: r.id,
            filepath: r.filepath,
            start_line: r.start_line,
            end_line: r.end_line,
            content: r.content,
            score: r.score ?? 0.5,
          }));

          const timing = Date.now() - startTime;
          return formatSearchResults(mappedChunks, args.query, timing);
        },
      }),

      brain_status: tool({
        description:
          "Get the brain's current state: vector store counts, decision tree, cache stats",
        args: {},
        async execute() {
          const stats = tree.getStats();
          const memory = sessionMemory.getMemory();
          const budgetStatus = contextInjector.getBudgetStatus();

          let db: ReturnType<typeof getDatabase> | undefined;
          try {
            db = getDatabase(directory);
          } catch (err: any) {
            console.warn("[Brain] brain_status: getDatabase failed:", err.message);
          }

          let dbStats;
          if (db) {
            try {
              const fileCount =
                (
                  db.prepare("SELECT COUNT(*) as count FROM files").get() as
                    | { count: number }
                    | undefined
                )?.count ?? 0;
              const chunkCount =
                (
                  db.prepare("SELECT COUNT(*) as count FROM chunks").get() as
                    | { count: number }
                    | undefined
                )?.count ?? 0;
              const ftsCount =
                (
                  db.prepare("SELECT COUNT(*) as count FROM fts_chunks").get() as
                    | { count: number }
                    | undefined
                )?.count ?? 0;
              const vectorActiveFlag = isVectorActive(db);

              dbStats = [
                `Database: \u2705 isolated SQLite active`,
                `- Files tracked: ${fileCount}`,
                `- Code chunks: ${chunkCount}`,
                `- Lexical index records: ${ftsCount}`,
                `- Vector extensions loaded: ${vectorActiveFlag ? "\u2705 active (sqlite-vec)" : "\u274c deactivated (keyword degraded mode)"}`,
              ].join("\n");
            } catch (e: any) {
              dbStats = `Database: \u274c stats query failed (${e.message})`;
            }
          } else {
            dbStats = "Database: \u274c not available (getDatabase failed)";
          }

          return [
            `## Brain Status (Node-native v2)`,
            ``,
            dbStats,
            ``,
            `### Token Budget`,
            `- Total: ${budgetStatus.total} tokens`,
            `- Used: ${budgetStatus.used} tokens (${budgetStatus.percent.toFixed(1)}%)`,
            `- Reserved: ${budgetStatus.reserved} tokens`,
            `- Available for context: ${budgetStatus.availableForContext} tokens`,
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
            ``,
            `### Docs Cache`,
            docsStore.getSummary(),
          ].join("\n");
        },
      }),

      brain_reset: tool({
        description: "Reset the brain's session memory, SQLite index, and decision tree",
        args: {},
        async execute() {
          sessionMemory.reset();
          docsStore.clear();
          contextInjector.resetBudget();
          tree = new DecisionTree();
          await tree.save();

          try {
            resetDenseFailedFlag();
          } catch {}

          try {
            const db = getDatabase(directory);
            db.transaction(() => {
              db.prepare("DELETE FROM chunks").run();
              db.prepare("DELETE FROM files").run();
              db.prepare("DELETE FROM fts_chunks").run();
              try {
                db.prepare("DELETE FROM chunk_embeddings").run();
                db.prepare("DELETE FROM chunk_embeddings_nomic").run();
              } catch {}
            })();
            return "Brain completely reset successfully (indexes, memory, docs cache, decision tree, and token budget wiped).";
          } catch (err: any) {
            return `Brain memory reset, but index database wipe failed: ${err.message}`;
          }
        },
      }),

      brain_budget: tool({
        description: "Get current token budget status and usage",
        args: {},
        async execute() {
          const status = contextInjector.getBudgetStatus();
          return {
            budget: {
              total: status.total,
              used: status.used,
              remaining: status.remaining,
              percent: status.percent.toFixed(2),
              reserved: status.reserved,
              availableForContext: status.availableForContext,
            },
            message: `Token Budget: ${status.used}/${status.total} tokens used (${status.percent.toFixed(1)}%), ` +
              `${status.availableForContext} available for new context`,
          };
        },
      }),

      brain_budget_reset: tool({
        description: "Reset the token budget counter for the current session",
        args: {},
        async execute() {
          contextInjector.resetBudget();
          const status = contextInjector.getBudgetStatus();
          return {
            success: true,
            message: "Token budget reset successfully",
            newStatus: {
              total: status.total,
              used: status.used,
              availableForContext: status.availableForContext,
            },
          };
        },
      }),

      brain_diagnostic: tool({
        description: "Run full plugin diagnostic check over the SQLite and LM Studio pipelines",
        args: {},
        async execute() {
          const results: string[] = ["## Brain Diagnostic (Node-native v2)\n"];

          let db: ReturnType<typeof getDatabase> | undefined;
          try {
            db = getDatabase(directory);
            results.push("✅ SQLite store initialized successfully");
          } catch (err: any) {
            results.push(`❌ SQLite store: initialization failed (${err.message})`);
          }

          if (db) {
            try {
              const fileCount =
                (
                  db.prepare("SELECT COUNT(*) as c FROM files").get() as
                    | { c: number }
                    | undefined
                )?.c ?? 0;
              const chunkCount =
                (
                  db.prepare("SELECT COUNT(*) as c FROM chunks").get() as
                    | { c: number }
                    | undefined
                )?.c ?? 0;
              const vectorCount =
                (
                  db.prepare("SELECT COUNT(*) as c FROM chunk_embeddings").get() as
                    | { c: number }
                    | undefined
                )?.c ?? 0;
              const conceptCount =
                (
                  db.prepare("SELECT COUNT(*) as c FROM concepts").get() as
                    | { c: number }
                    | undefined
                )?.c ?? 0;
              const sessionCount =
                (
                  db.prepare("SELECT COUNT(*) as c FROM sessions").get() as
                    | { c: number }
                    | undefined
                )?.c ?? 0;
              const ftsCount =
                (
                  db.prepare("SELECT COUNT(*) as c FROM fts_chunks").get() as
                    | { c: number }
                    | undefined
                )?.c ?? 0;

              results.push("\n### Storage");
              results.push(`- Files: ${fileCount}`);
              results.push(`- Chunks: ${chunkCount}`);
              results.push(`- Vectors: ${vectorCount}`);
              results.push(`- Concepts: ${conceptCount}`);
              results.push(`- Sessions: ${sessionCount}`);
              results.push(`- FTS Records: ${ftsCount}`);

              const vectorActiveFlag = isVectorActive(db);
              results.push(`\n### Vector Store: ${vectorActiveFlag ? "✅ Active" : "❌ Inactive"}`);

              const rrfK = (
                db.prepare("SELECT value FROM config WHERE key = 'rrf_k'").get() as
                  | { value: string }
                  | undefined
              )?.value;
              if (rrfK) {
                results.push(`   Configuration: rrf_k=${rrfK}`);
              }
            } catch (err: any) {
              results.push(`❌ SQLite store: stats query failed (${err.message})`);
            }
          }

          try {
            const loaded = await provider.getLoadedModels();
            results.push(`\n### LM Studio: ✅ Connected`);
            results.push(`Models: ${loaded.join(", ") || "none"}`);
          } catch {
            results.push(`\n### LM Studio: ❌ Not connected`);
          }

          results.push(`\n### Docs Cache: ${docsStore.getAll().length} entries`);
          const docsSummary = docsStore.getSummary();
          if (docsSummary !== "No docs cached.") {
            results.push(docsSummary);
          }

          results.push(`\n### Project: ${directory}`);
          return results.join("\n");
        },
      }),

      brain_docs_cache: tool({
        description: "View cached documentation entries",
        args: {},
        async execute() {
          const entries = docsStore.getAll();
          if (entries.length === 0) return "No docs cached.";
          return entries
            .map(
              (e, i) =>
                `${i + 1}. [${e.source}] ${e.packageName} v${e.version || "?"}\n   ${e.description.slice(0, 200)}\n   Docs: ${e.docsUrl || "N/A"}`
            )
            .join("\n\n");
        },
      }),

      brain_docs_fetch: tool({
        description: "Manually fetch package documentation from registry API",
        args: {
          registry: tool.schema
            .enum(["npm", "crates.io", "packagist"])
            .describe("Package registry"),
          package: tool.schema.string().describe("Package name"),
        },
        async execute(args: any) {
          const entry = await fetchDocFromRegistry(args.registry, args.package);
          if (!entry) return `Failed to fetch docs for ${args.registry}:${args.package}`;
          return [
            `## ${entry.packageName}`,
            `- Source: ${entry.source}`,
            `- Version: ${entry.version || "unknown"}`,
            `- Description: ${entry.description}`,
            `- Docs URL: ${entry.docsUrl || "N/A"}`,
          ].join("\n");
        },
      }),

      brain_embed_test: tool({
        description: "Test embedding retrieval - returns raw chunks with scores for debugging",
        args: {
          query: tool.schema.string().describe("Test query string"),
          topK: tool.schema.number().optional().describe("Number of chunks (default: 5)"),
        },
        async execute(args: any) {
          const results = await searchProjectContext(
            directory,
            args.query,
            args.topK ?? 5,
            "learn"
          );

          return {
            query: args.query,
            intent: "learn",
            chunks: results.map((r) => ({
              id: r.id,
              filepath: r.filepath,
              name: r.name,
              start_line: r.start_line,
              end_line: r.end_line,
              score: r.score,
              content_preview: r.content.slice(0, 200),
            })),
            totalReturned: results.length,
          };
        },
      }),

      brain_embed_lmstudio: tool({
        description: "Embed text using LM Studio's embedding model",
        args: {
          texts: tool.schema.array(tool.schema.string()).describe("Array of texts to embed"),
          model: tool.schema.string().optional().describe("Embedding model ID"),
        },
        async execute(args: any) {
          const modelId = args.model || provider.defaultEmbedModel;
          try {
            const embeddings = await provider.embed(modelId, args.texts);
            return {
              success: true,
              model: modelId,
              count: embeddings.length,
              dimensions: embeddings[0]?.length || 0,
              embeddings: embeddings.map((e) => ({
                embedding: e.slice(0, 5).concat(["..."]),
                dimensions: e.length,
              })),
            };
          } catch (err: any) {
            return { success: false, error: err.message };
          }
        },
      }),

      brain_metrics: tool({
        description: "Get detailed RAG pipeline metrics and performance data",
        args: {},
        async execute() {
          const db = getDatabase(directory);
          const stats = tree.getStats();
          const memory = sessionMemory.getMemory();

          let metrics: any = {
            decisionTree: stats,
            sessionMemory: {
              decisions: memory.decisions.length,
              successes: memory.successCount,
              failures: memory.failures.length,
              recentFiles: memory.recentFiles.length,
              contextUsed: memory.contextUsed.length,
            },
          };

          try {
            const sessionRows = db
              .prepare("SELECT COUNT(*) as count FROM sessions")
              .get() as { count: number };
            const avgLatency =
              (
                db
                  .prepare("SELECT AVG(latency_ms) as avg FROM sessions")
                  .get() as { avg: number | null }
              )?.avg || 0;

            metrics.sessions = {
              total: sessionRows.count,
              avgLatencyMs: Math.round(avgLatency),
            };
          } catch {}

          try {
            const chunkRows = db
              .prepare("SELECT COUNT(*) as count FROM chunks")
              .get() as { count: number };
            const vectorRows = db
              .prepare("SELECT COUNT(*) as count FROM chunk_embeddings")
              .get() as { count: number };
            const ftsRows = db
              .prepare("SELECT COUNT(*) as count FROM fts_chunks")
              .get() as { count: number };

            metrics.index = {
              chunks: chunkRows.count,
              vectors: vectorRows.count,
              ftsRecords: ftsRows.count,
              vectorActive: isVectorActive(db),
            };
          } catch {}

          return metrics;
        },
      }),

      brain_benchmark: tool({
        description: "Run quick benchmark suite to test retrieval quality",
        args: {
          suite: tool.schema.enum(["smoke", "full"]).optional().describe("Benchmark suite (smoke=5 tasks, full=21 tasks)"),
        },
        async execute(args: any) {
          const evaluatorModule = await (async () => {
            try {
              return await import("../meta-harness/evaluator");
            } catch (primaryErr) {
              console.debug("[Brain] brain_benchmark: primary import path failed, trying fallback...");
              const { fileURLToPath } = await import("url");
              const { dirname, join } = await import("path");
              const pluginDir = dirname(fileURLToPath(import.meta.url));
              const fallbackPath = join(pluginDir, "..", "meta-harness", "evaluator");
              try {
                return await import(fallbackPath);
              } catch {
                throw new Error(
                  `[Brain] brain_benchmark: Cannot import meta-harness/evaluator. ` +
                  `Tried relative path and absolute fallback: ${fallbackPath}. ` +
                  `Primary error: ${(primaryErr as Error).message}`
                );
              }
            }
          })();
          const { runQuickBenchmark } = evaluatorModule;
          const suite = args.suite ?? "smoke";
          
          const result = await runQuickBenchmark(directory, suite);
          
          const lines: string[] = [
            "## Brain Benchmark Results",
            "",
            `**Overall Score:** ${(result.score * 100).toFixed(1)}%`,
            `**Tasks Run:** ${result.tasksRun}`,
            `**Avg Latency:** ${result.avgLatencyMs.toFixed(0)}ms`,
            "",
            "### Per-Intent Scores",
            "",
          ];
          
          for (const [intent, score] of Object.entries(result.metrics)) {
            const bar = "█".repeat(Math.round(score * 10)) + "░".repeat(10 - Math.round(score * 10));
            lines.push(`${intent}: [${bar}] ${(score * 100).toFixed(0)}%`);
          }
          
          return lines.join("\n");
        },
      }),

      brain_config: tool({
        description: "Get or update Brain plugin configuration including reranking settings",
        args: {
          reranking: tool.schema.object({
            enabled: tool.schema.boolean().optional().describe("Enable/disable reranking"),
            minResults: tool.schema.number().optional().describe("Minimum results to trigger reranking"),
            intents: tool.schema.array(tool.schema.string()).optional().describe("Intents that trigger reranking"),
            confidenceThreshold: tool.schema.number().optional().describe("Minimum confidence to trigger reranking"),
            adaptiveLimit: tool.schema.boolean().optional().describe("Use adaptive chunk limits based on confidence"),
          }).optional().describe("Reranking configuration updates"),
        },
        async execute(args: any) {
          if (args.reranking) {
            const updates: any = {};
            if (typeof args.reranking.enabled === "boolean") updates.enabled = args.reranking.enabled;
            if (typeof args.reranking.minResults === "number") updates.minResults = args.reranking.minResults;
            if (Array.isArray(args.reranking.intents)) updates.intentsRequiringRerank = args.reranking.intents;
            if (typeof args.reranking.confidenceThreshold === "number") updates.confidenceThreshold = args.reranking.confidenceThreshold;
            if (typeof args.reranking.adaptiveLimit === "boolean") updates.adaptiveLimit = args.reranking.adaptiveLimit;
            setRerankingConfig(updates);
          }

          const config = getRerankingConfig();
          const lines: string[] = [
            "## Brain Configuration",
            "",
            "### Reranking Settings",
            `- Enabled: ${config.enabled ? "✅" : "❌"}`,
            `- Min Results: ${config.minResults}`,
            `- Confidence Threshold: ${config.confidenceThreshold}`,
            `- Max Chunks: ${config.maxChunksBeforeRerank}`,
            `- Adaptive Limit: ${config.adaptiveLimit ? "✅" : "❌"}`,
            `- Intents: [${config.intentsRequiringRerank.join(", ")}]`,
            "",
            "### Reranking Strategies",
          ];

          for (const [intent, strategy] of Object.entries(RERANKING_STRATEGIES)) {
            lines.push(`**${intent}**`);
            lines.push(`- Prioritize: [${strategy.prioritize.join(", ")}]`);
            lines.push(`- Weights: ${JSON.stringify(strategy.weights)}`);
            lines.push("");
          }

          return lines.join("\n");
        },
      }),

      brain_speculative_status: tool({
        description: "Check speculative decoding status and draft model availability",
        args: {},
        async execute() {
          const loaded = await provider.getLoadedModels();
          const contextLength = await provider.getContextLength();
          const vramUsage = provider.getCurrentVRAMUsage();

          return {
            speculativeDecoding: "not_configured",
            loadedModels: loaded,
            contextLength,
            vramUsageGB: vramUsage,
            maxVRAMGB: 5.5,
            provider: provider.baseURL || "http://localhost:1234",
          };
        },
      }),
    },
  };
};

export default BrainPlugin;
