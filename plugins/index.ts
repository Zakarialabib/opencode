import { Plugin, tool } from "@opencode-ai/plugin";
import { $ } from "bun";

// Helper to read config file (strip JSONC comments)
async function readConfig(directory: string) {
  const configPath = `${directory}/opencode.json`;
  try {
    const file = Bun.file(configPath);
    let text = await file.text();
    // Remove single-line comments (// ...)
    text = text.replace(/^\s*\/\/.*$/gm, "");
    return JSON.parse(text);
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

const SelfImprovePlugin: Plugin = async ({ client, project, directory }) => {
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
    // Hook: Before each message, ensure LM Studio is healthy and model is loaded
    "chat.message": async ({ sessionID, agent, model, messageID, variant }, output) => {
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

    // Hook: Modify parameters sent to LLM (LM Studio specific)
    "chat.params": async ({ sessionID, agent, model, provider, message }, output) => {
      // For now, we just ensure we don't break existing parameters
      // In future, we could read preset settings and apply
      // Keep existing temperature, topP, topK, options
      return output;
    },

    // Hook: After each tool execution, evaluate performance
    "tool.execute.after": async ({ tool }: any, { output, metadata }: any) => {
      // Log tool usage patterns for optimization analysis
      const outputStr = output ? String(output) : "";
      const truncatedOutput = outputStr.length > 100 ? outputStr.slice(0, 100) : outputStr;
      await client.app.log({
        body: {
          service: "self-improve",
          level: "info",
          message: `Tool ${tool} executed`,
          extra: { output: truncatedOutput, metadata },
        },
      });
    },

    // Hook: On session end, analyze and propose config improvements
    "session.archived": async ({ session }: any) => {
      const configPath = `${directory}/opencode.json`;

      // Analyze session patterns
      const analysis = await analyzeSessionPatterns(session.id);

      // Generate improvement recommendations
      const recommendations = await generateRecommendations(analysis);

      // Write to proposed config
      await Bun.write(
        `${directory}/opencode.json.proposed`,
        JSON.stringify(recommendations, null, 2)
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
            await $`cp ${current} ${current}.backup.${Date.now()}`;
          }

          await $`mv ${proposed} ${current}`;
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
    },
  };
};

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

export default SelfImprovePlugin;
