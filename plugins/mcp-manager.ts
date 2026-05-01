import { Plugin, tool } from "@opencode-ai/plugin";
import { readFileSync } from "fs";
import { join } from "path";

const MCPManagerPlugin: Plugin = async ({ client, project, directory }) => {
  // Read MCP config from opencode.json
  const configPath = join(directory, "opencode.json");
  let mcpConfig: Record<string, any> = {};

  try {
    const config = JSON.parse(readFileSync(configPath, "utf8"));
    mcpConfig = config.mcp || {};
  } catch (e) {
    console.error("Failed to read MCP config:", e);
  }

  return {
    tool: {
      mcp_list: tool({
        description: "List all configured MCP servers and their status",
        args: {},
        async execute() {
          const servers = Object.entries(mcpConfig);
          if (servers.length === 0) return "No MCP servers configured.";

          let result = `## Configured MCP Servers (${servers.length})\n\n`;
          for (const [name, config] of servers) {
            const cfg = config as any;
            result += `### ${name}\n`;
            result += `- Status: ${cfg.enabled ? "✅ Enabled" : "❌ Disabled"}\n`;
            result += `- Type: ${cfg.type}\n`;
            result += `- Command: \`${cfg.command?.join(" ") || "N/A"}\`\n`;
            result += `- Timeout: ${cfg.timeout || "default"}ms\n\n`;
          }
          return result;
        },
      }),

      mcp_check: tool({
        description: "Check health of a specific MCP server",
        args: {
          serverName: tool.schema.string().describe("Name of the MCP server to check"),
        },
        async execute({ serverName }) {
          const server = (mcpConfig as any)[serverName];
          if (!server) return `❌ MCP server "${serverName}" not found.`;

          const cfg = server as any;
          let result = `## MCP Server: ${serverName}\n\n`;
          result += `- Status: ${cfg.enabled ? "✅ Enabled" : "❌ Disabled"}\n`;
          result += `- Type: ${cfg.type}\n`;
          result += `- Command: \`${cfg.command?.join(" ") || "N/A"}\`\n`;
          result += `- Timeout: ${cfg.timeout || "default"}ms\n`;

          if (cfg.enabled) {
            result += `\n💡 To test this server, try using its tools in your prompts.`;
          } else {
            result += `\n⚠️ Server is disabled. Enable it in opencode.json or use /mcp_toggle.`;
          }
          return result;
        },
      }),

      mcp_toggle: tool({
        description: "Enable or disable an MCP server (requires restart)",
        args: {
          serverName: tool.schema.string().describe("Name of the MCP server"),
          enable: tool.schema.boolean().describe("True to enable, false to disable"),
        },
        async execute({ serverName, enable }) {
          const server = (mcpConfig as any)[serverName];
          if (!server) return `❌ MCP server "${serverName}" not found.`;

          server.enabled = enable;
          return `MCP server "${serverName}" ${enable ? "✅ enabled" : "❌ disabled"}.\n⚠️ Restart OpenCode to apply changes.`;
        },
      }),
    },
  };
};

export default MCPManagerPlugin;
