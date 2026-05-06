import { parseJsonc, stringifyJson } from "./jsonc-utils";
import { Plugin, tool } from "@opencode-ai/plugin";
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

const ContextManagerPlugin: Plugin = async ({ client, project, directory }) => {
  const configPath = join(directory, "opencode.json");

  const readConfig = (): Record<string, any> | null => {
    try {
      const content = readFileSync(configPath, "utf8");
      return parseJsonc(content);
    } catch (e) {
      return null;
    }
  };

  const writeConfig = (config: Record<string, any>) => {
    writeFileSync(configPath, stringifyJson(config));
  };

  return {
    tool: {
      context_view: tool({
        description: "View current context configuration (include/exclude patterns)",
        args: {},
        async execute() {
          const config = readConfig();
          if (!config) return "❌ Failed to read config.";

          const context = config.context || {};
          let result = "## Current Context Configuration\n\n";
          result += `### Include Patterns\n`;
          result +=
            context.include?.length > 0
              ? context.include.map((p: string) => `- \`${p}\``).join("\n")
              : "None configured.\n";
          result += `\n### Exclude Patterns\n`;
          result +=
            context.exclude?.length > 0
              ? context.exclude.map((p: string) => `- \`${p}\``).join("\n")
              : "None configured.\n";
          return result;
        },
      }),

      context_add_include: tool({
        description: "Add a pattern to the context include list (requires restart)",
        args: {
          pattern: tool.schema.string().describe("Glob pattern to add (e.g., **/*.vue)"),
        },
        async execute({ pattern }) {
          const config = readConfig();
          if (!config) return "❌ Failed to read config.";

          if (!config.context) config.context = {};
          if (!config.context.include) config.context.include = [];

          if (config.context.include.includes(pattern)) {
            return `Pattern \`${pattern}\` already in include list.`;
          }

          config.context.include.push(pattern);
          writeConfig(config);
          return `✅ Added \`${pattern}\` to context include list.\n⚠️ Restart OpenCode to apply changes.`;
        },
      }),

      context_add_exclude: tool({
        description: "Add a pattern to the context exclude list (requires restart)",
        args: {
          pattern: tool.schema.string().describe("Glob pattern to add (e.g., **/temp/**)"),
        },
        async execute({ pattern }) {
          const config = readConfig();
          if (!config) return "❌ Failed to read config.";

          if (!config.context) config.context = {};
          if (!config.context.exclude) config.context.exclude = [];

          if (config.context.exclude.includes(pattern)) {
            return `Pattern \`${pattern}\` already in exclude list.`;
          }

          config.context.exclude.push(pattern);
          writeConfig(config);
          return `✅ Added \`${pattern}\` to context exclude list.\n⚠️ Restart OpenCode to apply changes.`;
        },
      }),

      context_reset: tool({
        description: "Reset context configuration to default",
        args: {},
        async execute() {
          const config = readConfig();
          if (!config) return "❌ Failed to read config.";

          config.context = {
            include: [
              "**/*.ts",
              "**/*.tsx",
              "**/*.php",
              "**/*.rs",
              "**/*.md",
              "**/*.yaml",
              "**/*.yml",
            ],
            exclude: [
              "node_modules/**",
              ".git/**",
              "dist/**",
              "build/**",
              "*.env",
              "*.log",
              "**/__pycache__/**",
            ],
          };
          writeConfig(config);
          return "✅ Context configuration reset to default.\n⚠️ Restart OpenCode to apply changes.";
        },
      }),
    },
  };
};

export default ContextManagerPlugin;
