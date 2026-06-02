import { parseJsonc } from "./jsonc-utils";
import { type Plugin, tool } from "@opencode-ai/plugin";
import { readFileSync, accessSync } from "node:fs";
import { join, dirname, parse } from "node:path";

// Find project root by looking for opencode.json
function findConfigPath(startDir: string): string | null {
  let current = startDir;
  const root = parse(current).root;

  while (current !== root) {
    try {
      const configPath = join(current, "opencode.json");
      accessSync(configPath);
      return configPath;
    } catch {
      current = dirname(current);
    }
  }

  // Check root
  try {
    const configPath = join(root, "opencode.json");
    accessSync(configPath);
    return configPath;
  } catch {
    return null;
  }
}

function resolveConfigPath(startDir: string): string | null {
  const explicitConfig = process.env.OPENCODE_CONFIG;
  if (explicitConfig) {
    try {
      accessSync(explicitConfig);
      return explicitConfig;
    } catch {
      // Fall back to directory search.
    }
  }

  const explicitDir = process.env.OPENCODE_CONFIG_DIR;
  if (explicitDir) {
    const candidate = join(explicitDir, "opencode.json");
    try {
      accessSync(candidate);
      return candidate;
    } catch {
      // Fall back to directory search.
    }
  }

  return findConfigPath(startDir);
}

// Type definitions
interface ModelCapabilities {
  tool_call: boolean;
  reasoning: boolean;
  supportsInstructions: boolean;
}

interface ModelRegistry {
  [provider: string]: {
    [model: string]: ModelCapabilities;
  };
}

// Default model capability registry
const DEFAULT_MODEL_CAPABILITIES: ModelRegistry = {
  opencode: {
    "hy3-preview-free": { tool_call: true, reasoning: false, supportsInstructions: true },
  },
  "opencode-go": {
    "kimi-k2.6": { tool_call: true, reasoning: true, supportsInstructions: true },
    "glm-5.1": { tool_call: true, reasoning: true, supportsInstructions: true },
    "qwen3.6-plus": { tool_call: true, reasoning: true, supportsInstructions: true },
  },
  lmstudio: {
    "qwen3.5-4b-claude-4.6-opus-reasoning-distilled-v2": {
      tool_call: true,
      reasoning: true,
      supportsInstructions: false,
    },
    "gemma-4-e4b-it": { tool_call: true, reasoning: true, supportsInstructions: false },
    "qwen3.5-4b": { tool_call: true, reasoning: false, supportsInstructions: false },
    "google/gemma-3n-e4b": { tool_call: true, reasoning: true, supportsInstructions: false },
  },
};

const ModelRouterPlugin: Plugin = async ({ directory }) => {
  let MODEL_CAPABILITIES: ModelRegistry = DEFAULT_MODEL_CAPABILITIES;

  const configPath = resolveConfigPath(directory);
  if (configPath) {
    try {
      const config = parseJsonc(readFileSync(configPath, "utf8"));
      if (config.models && typeof config.models === "object") {
        MODEL_CAPABILITIES = config.models as ModelRegistry;
      }
    } catch {
      console.log("Using default model capabilities registry");
    }
  } else {
    console.log("Using default model capabilities registry");
  }

  function getModelCapabilities(provider: string, model: string): ModelCapabilities {
    return (
      MODEL_CAPABILITIES[provider]?.[model] || {
        tool_call: false,
        reasoning: false,
        supportsInstructions: false,
      }
    );
  }

  function routeModel(requirements: { needsTools?: boolean; needsReasoning?: boolean }) {
    const { needsTools = false, needsReasoning = false } = requirements;

    const providers = ["opencode-go", "opencode", "lmstudio"];

    for (const provider of providers) {
      const models = MODEL_CAPABILITIES[provider];
      if (!models) continue;

      for (const [modelName, caps] of Object.entries(models)) {
        if (needsTools && !caps.tool_call) continue;
        if (needsReasoning && !caps.reasoning) continue;

        return { provider, model: modelName, capabilities: caps };
      }
    }

    return {
      provider: "opencode-go",
      model: "kimi-k2.6",
      capabilities: DEFAULT_MODEL_CAPABILITIES["opencode-go"]["kimi-k2.6"],
    };
  }

  return {
    tool: {
      check_model: tool({
        description: "Check capabilities of a specific model",
        args: {
          provider: tool.schema.string().describe("Provider name (e.g., 'opencode', 'lmstudio')"),
          model: tool.schema.string().describe("Model name/ID"),
        },
        async execute({ provider, model }) {
          const caps = getModelCapabilities(provider, model);
          return `Model: ${provider}/${model}
- Tool calling: ${caps.tool_call ? "✓ Supported" : "✗ Not supported"}
- Reasoning: ${caps.reasoning ? "✓ Supported" : "✗ Not supported"}
- Supports instructions param: ${caps.supportsInstructions ? "✓ Yes" : "✗ No"}
- Instructions should be: ${caps.supportsInstructions ? "passed as parameter" : "converted to system prompt"}`;
        },
      }),

      recommend_model: tool({
        description: "Recommend best model based on requirements",
        args: {
          needsTools: tool.schema
            .boolean()
            .default(false)
            .describe("Whether tool calling is needed"),
          needsReasoning: tool.schema
            .boolean()
            .default(false)
            .describe("Whether reasoning capability is needed"),
          agent: tool.schema.string().optional().describe("Agent name for context"),
        },
        async execute({ needsTools, needsReasoning, agent }) {
          const recommendation = routeModel({ needsTools, needsReasoning });

          let result = `🎯 Recommended Model: **${recommendation.provider}/${recommendation.model}**\n`;
          result += `- Tool calling: ${recommendation.capabilities.tool_call ? "✓" : "✗"}\n`;
          result += `- Reasoning: ${recommendation.capabilities.reasoning ? "✓" : "✗"}\n`;
          result += `- Instructions handling: ${recommendation.capabilities.supportsInstructions ? "API parameter" : "System prompt"}\n`;

          if (agent) {
            result += `\n💡 For agent '${agent}', use:\n`;
            result += `   /model ${recommendation.provider}/${recommendation.model}\n`;
          }

          return result;
        },
      }),
    },

    "model.call": async ({ provider, model, params, next }: any) => {
      const caps = getModelCapabilities(provider, model);

      if (!caps.supportsInstructions && params.instructions) {
        const instructions = Array.isArray(params.instructions)
          ? params.instructions.join("\n")
          : params.instructions;

        if (params.system) {
          params.system = `${instructions}\n\n${params.system}`;
        } else if (params.messages && params.messages.length > 0) {
          params.messages.unshift({ role: "system", content: instructions });
        }

        delete params.instructions;
      }

      if (!caps.tool_call && params.tools && params.tools.length > 0) {
        console.log(`Model ${provider}/${model} doesn't support tools, removing tools.`);
        delete params.tools;
      }

      return await next({ provider, model, params });
    },
  };
};

export default ModelRouterPlugin;
