import type { Plugin } from "@opencode-ai/plugin"
import { fileLog } from "./utils/logger.js"
import { MetaHarnessLoop } from "./loop.js"
import { DEFAULT_HARNESS_CONFIG } from "./harness-space.js"
import { LMStudioClient } from "./lmstudio-client.js"
import type { MetaHarnessOptions } from "./types.js"

/**
 * Meta-Harness Plugin for OpenCode
 * 
 * Automated search over task-specific model harnesses for the Brain Plugin.
 * Optimizes retrieval, fusion, reranking, and context injection parameters
 * using LM Studio as the proposer and evaluator backend.
 * 
 * Installation: Add to opencode.json plugins array:
 * { "plugins": [".opencode/plugins/meta-harness.ts"] }
 */
export const MetaHarnessPlugin: Plugin = async (ctx) => {
  const logger = (msg: string, level: "info" | "warn" | "error" = "info") => {
    fileLog(`[Meta-Harness] ${msg}`, level)
  }

  logger("Initializing Meta-Harness optimization engine...")

  // Initialize LM Studio client with fallback discovery
  const lmStudio = new LMStudioClient({
    baseUrl: process.env.LM_STUDIO_URL || "http://127.0.0.1:1234",
    chatModel: process.env.LM_STUDIO_CHAT_MODEL || "qwen3.5-4b-claude-4.6-opus-reasoning-distilled-v2",
    embedModel: process.env.LM_STUDIO_EMBED_MODEL || "text-embedding-qwen3-embedding-0.6b",
    rerankerModel: process.env.LM_STUDIO_RERANKER_MODEL || "qwen3-reranker-0.6b",
  })

  // Verify LM Studio connectivity and model availability
  try {
    const models = await lmStudio.listModels()
    const requiredModels = [
      lmStudio.config.chatModel,
      lmStudio.config.embedModel,
      lmStudio.config.rerankerModel,
    ]

    const availableKeys = models.map(m => m.key)
    const missing = requiredModels.filter(m => !availableKeys.includes(m))

    if (missing.length > 0) {
      logger(`WARNING: Missing models in LM Studio: ${missing.join(", ")}`, "warn")
      logger("Please load these models in LM Studio before running optimization.", "warn")
    } else {
      logger(`All required models available: ${requiredModels.join(", ")}`)
    }
  } catch (err) {
    logger(`Failed to connect to LM Studio: ${err}`, "error")
    logger("Meta-Harness will operate in degraded mode.", "warn")
  }

  // Store optimization state in plugin context
  const state = {
    isOptimizing: false,
    currentIteration: 0,
    bestConfig: DEFAULT_HARNESS_CONFIG,
    history: [] as Array<{ config: any; score: number; metrics: any }>,
    lmStudio,
    logger,
  }

  return {
    // Custom tool: Trigger harness optimization
    tool: {
      "brain_optimize_harness": {
        description: "Run Meta-Harness to optimize Brain Plugin retrieval and injection parameters",
        args: {
          iterations: { type: "number", description: "Number of optimization iterations", default: 10 },
          suite: { type: "string", description: "Benchmark suite: smoke or full", default: "smoke" },
          top_k: { type: "number", description: "Keep top-K configs per iteration", default: 5 },
          intent: { type: "string", description: "Optimize for specific intent (debug|refactor|feature|test|learn|quick_chat)", optional: true },
        },
        async execute(args: any, context: any) {
          if (state.isOptimizing) {
            return "⚠️ Optimization already in progress. Check logs for status."
          }

          const options: MetaHarnessOptions = {
            iterations: args.iterations || 10,
            suite: args.suite || "smoke",
            topK: args.top_k || 5,
            intent: args.intent,
            lmStudio,
            logger,
            outputDir: `${ctx.directory}/.opencode/meta-harness-logs`,
          }

          // Run optimization in background (non-blocking)
          state.isOptimizing = true
          MetaHarnessLoop(options, state).then((result) => {
            state.isOptimizing = false
            state.bestConfig = result.config
            logger(`Optimization complete. Best score: ${result.score.toFixed(4)}`)
          }).catch((err) => {
            state.isOptimizing = false
            logger(`Optimization failed: ${err}`, "error")
          })

          return `🚀 Meta-Harness optimization started.\nIterations: ${options.iterations}\nSuite: ${options.suite}\nTop-K: ${options.topK}\nIntent: ${options.intent || "all"}\n\nCheck logs at: ${options.outputDir}/harness_history.jsonl`
        },
      },

      "brain_harness_status": {
        description: "Check Meta-Harness optimization status and current best config",
        args: {},
        async execute(_args: any, _context: any) {
          const status = state.isOptimizing ? "RUNNING" : "IDLE"
          const historyLen = state.history.length
          const bestScore = state.history.length > 0 
            ? Math.max(...state.history.map(h => h.score)).toFixed(4)
            : "N/A"

          return `Meta-Harness Status: ${status}\nIterations completed: ${state.currentIteration}\nHistory entries: ${historyLen}\nBest score: ${bestScore}\n\nCurrent best config keys: ${Object.keys(state.bestConfig).join(", ")}`
        },
      },

      "brain_apply_harness": {
        description: "Apply a specific harness configuration to the Brain Plugin",
        args: {
          config_path: { type: "string", description: "Path to harness config JSON file" },
        },
        async execute(args: any, _context: any) {
          try {
            const fs = await import("fs")
            const configRaw = fs.readFileSync(args.config_path, "utf-8")
            const config = JSON.parse(configRaw)
            state.bestConfig = config
            return `✅ Harness config applied from ${args.config_path}`
          } catch (err) {
            return `❌ Failed to apply config: ${err}`
          }
        },
      },
    },

    // Event handler: Monitor tool execution for feedback signals
    "tool.execute.after": async ({ tool }, { output, duration }) => {
      // Collect feedback signals for Meta-Harness learning
      if (tool === "brain_search" || tool === "brain_embed_test") {
        const signal = {
          tool,
          duration,
          success: !output?.error,
          timestamp: Date.now(),
        }
        logger(`Retrieval feedback: ${JSON.stringify(signal)}`)

        // Store for RRF weight tuning
        // This feeds into feedback.ts equivalent within the harness
      }
    },

    // Chat parameters hook: Apply optimized params when available
    "chat.params": async ({ model, provider, message }, { temperature, topP, options }) => {
      // If we have an optimized config and this is LM Studio, apply subtle adjustments
      if (provider === "lmstudio" && state.bestConfig.maxContextTokens) {
        options.maxTokens = Math.min(
          options.maxTokens || 4096,
          state.bestConfig.maxContextTokens
        )
      }
    },

    "experimental.session.compacting": async (input: any, output: any) => {
      logger("Session compacting - persisting harness state")
      try {
        const fs = await import("fs")
        const path = await import("path")
        const statePath = path.join(ctx.directory, ".opencode", "meta-harness-state.json")

        fs.mkdirSync(path.dirname(statePath), { recursive: true })
        fs.writeFileSync(statePath, JSON.stringify({
          bestConfig: state.bestConfig,
          history: state.history.slice(-50),
          lastUpdated: Date.now(),
        }, null, 2))
      } catch (err) {
        logger(`Failed to persist state: ${err}`, "error")
      }
    },

    "session.archived": async () => {
      logger("Session archived - cleanup complete")
    },
  }
}

export default MetaHarnessPlugin
