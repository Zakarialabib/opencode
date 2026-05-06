import { Plugin, tool } from "@opencode-ai/plugin";

// Model capability registry
const MODEL_CAPABILITIES = {
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
  cerebras: {
    "qwen-3-235b-a22b-instruct-2507": {
      tool_call: true,
      reasoning: true,
      supportsInstructions: false,
    },
    "zai-glm-4.7": { tool_call: false, reasoning: true, supportsInstructions: false },
  },
};

// Get model capabilities
function getModelCapabilities(provider: string, model: string) {
  return (
    MODEL_CAPABILITIES[provider]?.[model] || {
      tool_call: false,
      reasoning: false,
      supportsInstructions: false,
    }
  );
}

// Check if model supports tools
function modelSupportsTools(provider: string, model: string): boolean {
  const caps = getModelCapabilities(provider, model);
  return caps.tool_call === true;
}

// Route to best available model based on requirements
function routeModel(requirements: { needsTools?: boolean; needsReasoning?: boolean }) {
  const { needsTools = false, needsReasoning = false } = requirements;

  // Priority order: opencode-go, opencode, lmstudio, cerebras
  const providers = ["opencode-go", "opencode", "lmstudio", "cerebras"];

  for (const provider of providers) {
    const models = MODEL_CAPABILITIES[provider];
    if (!models) continue;

    for (const [modelName, caps] of Object.entries(models)) {
      if (needsTools && !caps.tool_call) continue;
      if (needsReasoning && !caps.reasoning) continue;

      return { provider, model: modelName, capabilities: caps };
    }
  }

  // Fallback to default
  return {
    provider: "opencode-go",
    model: "kimi-k2.6",
    capabilities: MODEL_CAPABILITIES["opencode-go"]["kimi-k2.6"],
  };
}

const ModelRouterPlugin: Plugin = async ({ client, project, directory }) => {
  return {
    // Tool: Check model capabilities
    tool: {
      check_model: tool({
        description: "Check capabilities of a specific model",
        args: {
          provider: tool.schema.string().describe("Provider name (e.g., 'opencode', 'cerebras')"),
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

    // Hook: Intercept model calls to handle instructions properly
    "model.call": async ({ provider, model, params, next }) => {
      const caps = getModelCapabilities(provider, model);

      // If model doesn't support instructions parameter, convert to system prompt
      if (!caps.supportsInstructions && params.instructions) {
        const instructions = Array.isArray(params.instructions)
          ? params.instructions.join("\n")
          : params.instructions;

        // Prepend instructions to system prompt or messages
        if (params.system) {
          params.system = `${instructions}\n\n${params.system}`;
        } else if (params.messages && params.messages.length > 0) {
          // Add as system message at the beginning
          params.messages.unshift({ role: "system", content: instructions });
        }

        // Remove instructions param to avoid API error
        delete params.instructions;
      }

      // Check tool support
      if (!caps.tool_call && params.tools && params.tools.length > 0) {
        client.app.log({
          body: {
            service: "model-router",
            level: "warn",
            message: `Model ${provider}/${model} doesn't support tools, but tools were requested. Removing tools.`,
          },
        });
        delete params.tools;
      }

      return next({ provider, model, params });
    },
  };
};

export default ModelRouterPlugin;
