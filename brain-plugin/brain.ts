import { tool, type Plugin } from "@opencode-ai/plugin";
import { DecisionTree } from "./tree/engine";
import { LMStudioProvider } from "./provider/lmstudio";
import { indexer } from "./retrieval/indexer";
import { searcher } from "./retrieval/searcher";
import { contextInjector } from "./context/injector";
import { sessionMemory } from "./state/session";
import type { SignalBundle } from "./tree/engine";

const LM_STUDIO_URL = "http://192.168.1.12:1234/v1";

const BrainPlugin: Plugin = async ({ directory }) => {
  let tree: DecisionTree;
  let provider: LMStudioProvider;

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

      try {
        const context = await searcher.search(
          msg.content,
          {
            strategy: strategy.name,
            depth: strategy.depth,
            maxChunks: strategy.maxChunks,
            rerank: strategy.rerank,
          },
          directory,
          signals.lspSymbols
        );

        if (context.chunks.length > 0) {
          sessionMemory.markContextUsed(context.chunks);

          const augmentedMessage = contextInjector.inject(msg.content, context);
          output.message.content = augmentedMessage;

          console.log(`[Brain] Injected ${context.chunks.length} chunks for intent: ${scenario.intent}`);
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
    },

    "session.compacting": async (input: any, output: any) => {
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
          force: tool.schema.boolean().optional().describe("Force re-index"),
        },
        async execute(args: any) {
          const root = args.path ?? directory;
          const result = await indexer.run(root, { force: args.force });
          return `Brain indexing ${result.status}: ${result.chunks} chunks indexed`;
        },
      }),

      brain_search: tool({
        description: "Search the codebase for relevant context",
        args: {
          query: tool.schema.string().describe("Search query"),
          top_k: tool.schema.number().optional().describe("Number of results (default: 5)"),
        },
        async execute(args: any) {
          const context = await searcher.search(
            args.query,
            { strategy: "manual", depth: "broad", maxChunks: args.top_k ?? 5, rerank: true },
            directory
          );
          return contextInjector.formatResults(context);
        },
      }),

      brain_status: tool({
        description: "Get the brain's current decision tree state",
        args: {},
        async execute() {
          const stats = tree.getStats();
          const memory = sessionMemory.getMemory();

          return `## Brain Status

### Decision Tree
- Total nodes: ${stats.totalNodes}
- Pending mutations: ${stats.pendingMutations}

### Intents
${Object.entries(stats.intents)
  .map(([intent, data]) => `- ${intent}: weight=${data.weight.toFixed(2)}, visits=${data.visits}`)
  .join("\n")}

### Session Memory
- Decisions: ${memory.decisions.length}
- Successes: ${memory.successCount}
- Failures: ${memory.failures.length}
- Recent files: ${memory.recentFiles.length}`;
        },
      }),

      brain_reset: tool({
        description: "Reset the brain's session memory and decision tree",
        args: {},
        async execute() {
          sessionMemory.reset();
          tree = new DecisionTree();
          await tree.save();
          return "Brain reset successfully";
        },
      }),
    },

    "server.start": async () => {
      console.log("[Brain] Plugin loaded - Cognitive layer for OpenCode");
      console.log(`[Brain] LM Studio: ${LM_STUDIO_URL}`);
      console.log(`[Brain] Decision tree: ${tree.getStats().totalNodes} nodes`);
    },
  };
};

export default BrainPlugin;
