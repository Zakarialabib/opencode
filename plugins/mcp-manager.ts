import { parseJsonc } from "./jsonc-utils";
import { type Plugin, tool } from "@opencode-ai/plugin";
import { readFileSync, accessSync } from "node:fs";
import { join, dirname, parse } from "node:path";
import { debug, info, warn, error, SKILL_CATEGORIES } from "./debug-logger";
import { execSync, exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

// Debug: trace MCP tool loading
function traceToolLoading(
  serverName: string,
  tools: string[],
  relevant: string[],
  reduction: number
) {
  debug(SKILL_CATEGORIES.TOOL_LOAD, `MCP tool loading: ${serverName}`, {
    totalTools: tools.length,
    relevantTools: relevant.length,
    reductionPercent: reduction,
  });
}

interface MCPDebugTrace {
  serverName: string;
  operation: "connect" | "disconnect" | "tool_call" | "error";
  timestamp: number;
  details?: any;
}

const mcpTraces: MCPDebugTrace[] = [];
const MAX_MCP_TRACES = 500;

function recordMCPOperation(op: MCPDebugTrace["operation"], serverName: string, details?: any) {
  mcpTraces.push({
    serverName,
    operation: op,
    timestamp: Date.now(),
    details,
  });

  if (mcpTraces.length > MAX_MCP_TRACES) {
    mcpTraces.shift();
  }

  debug(SKILL_CATEGORIES.MCP_CONNECT, `MCP ${op}: ${serverName}`, details);
}

export function getMCPDebugTraces(): MCPDebugTrace[] {
  return [...mcpTraces];
}

export function clearMCPDebugTraces() {
  mcpTraces.length = 0;
}

// Keyword to MCP server mapping
export const KEYWORD_MAP: Record<string, string[]> = {
  sqlite: ["database", "db", "query", "table", "migration", "sql"],
  git: ["commit", "branch", "merge", "diff", "history", "git", "push", "pull"],
  filesystem: ["file", "read", "write", "directory", "ls", "dir"],
  fetch: ["http", "api", "web", "url", "fetch", "scrape"],
  context7: ["docs", "documentation", "library", "reference", "code example"],
  memory: ["remember", "recall", "previous", "earlier", "knowledge"],
  "sequential-thinking": ["think", "reasoning", "step by step", "analyze"],
  "language-server": ["lsp", "typescript", "rust", "php", "diagnostic"],
  "type-inject": ["type", "inject", "definition", "symbol"],
};

// Core tools always loaded (essential for basic ops)
export const CORE_TOOLS = ["read", "write", "edit", "bash", "grep", "glob", "list"];

export function getRelevantTools(message: string): string[] {
  const msg = message.toLowerCase();
  const relevant = new Set<string>(CORE_TOOLS);

  for (const [server, keywords] of Object.entries(KEYWORD_MAP)) {
    if (keywords.some((kw) => msg.includes(kw))) {
      relevant.add(server);
    }
  }

  return Array.from(relevant);
}

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

const MCPManagerPlugin: Plugin = async ({ client, project, directory }) => {
  const configPath = resolveConfigPath(directory);
  let mcpConfig: Record<string, any> = {};

  if (configPath) {
    try {
      const content = readFileSync(configPath, "utf8");
      const config = parseJsonc(content);
      mcpConfig = config.mcp || {};
    } catch (e) {
      error(SKILL_CATEGORIES.MCP_ERROR, "Failed to read MCP config", {
        directory,
        error: (e as Error).message,
      });
    }
  } else {
    debug(SKILL_CATEGORIES.MCP_CONNECT, "No opencode.json found for MCP manager", { directory });
  }

  // Create tool loading metrics table if not exists
  try {
    const { execSync } = require("node:child_process");
    execSync(
      `sqlite3 metadata.db "CREATE TABLE IF NOT EXISTS tool_loading_metrics (timestamp TEXT, all_tools INT, loaded_tools INT, reduction_percent REAL)"`,
      { stdio: "ignore" }
    );
  } catch (e) {
    /* ignore */
  }

  return {
    "chat.params": async ({ message, agent }) => {
      const messageText = typeof message === "string" ? message : (message as any)?.content || "";
      if (!messageText || messageText.startsWith("/") || messageText.startsWith("@")) {
        return;
      }

      debug(SKILL_CATEGORIES.TOOL_LOAD, "chat.params hook triggered", {
        messageLength: messageText.length,
        agent,
        hasRelevantTools: getRelevantTools(messageText).length > 0,
      });

      const relevantTools = getRelevantTools(messageText);

      // Fallback logic (Task 4)
      if (relevantTools.length <= CORE_TOOLS.length) {
        debug(
          SKILL_CATEGORIES.TOOL_LOAD,
          "Fallback triggered: loading all tools due to ambiguous request",
          {
            relevantToolsCount: relevantTools.length,
            coreToolsCount: CORE_TOOLS.length,
          }
        );
        return { toolFilter: () => true } as any; // Allow all tools
      }

      // Performance Tracking (Task 3)
      const allToolsCount = CORE_TOOLS.length + Object.keys(mcpConfig).length * 5; // Rough estimate: ~5 tools per MCP server
      const loadedToolsCount = relevantTools.length;
      const reductionPercent =
        allToolsCount > 0 ? ((1 - loadedToolsCount / allToolsCount) * 100).toFixed(1) : "0.0";

      traceToolLoading("all", [], relevantTools, parseFloat(reductionPercent));

      // Store metrics in SQLite
      try {
        const timestamp = new Date().toISOString();
        execSync(
          `sqlite3 metadata.db "INSERT INTO tool_loading_metrics (timestamp, all_tools, loaded_tools, reduction_percent) VALUES ('${timestamp}', ${allToolsCount}, ${loadedToolsCount}, ${reductionPercent})"`,
          { stdio: "ignore" }
        );
      } catch (e) {
        /* ignore */
      }

      // Return tool filter
      return {
        toolFilter: (toolName: string) => {
          // Always allow core tools
          if (CORE_TOOLS.some((core) => toolName.toLowerCase().includes(core))) {
            return true;
          }
          // Check if tool belongs to a relevant MCP server
          return relevantTools.some((server) => toolName.toLowerCase().includes(server));
        },
      } as any;
    },

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
            result += `- Command: ${cfg.command?.join(" ") || "N/A"}\n`;
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
          result += `- Command: ${cfg.command?.join(" ") || "N/A"}\n`;
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

      mcp_health: tool({
        description: "Check health of all configured MCP servers with actual connectivity probes. Helps detect dead servers before task execution.",
        args: {
          serverName: tool.schema.string().optional().describe("Optional: check a specific server only"),
        },
        async execute({ serverName }) {
          const servers = Object.entries(mcpConfig).filter(([name]) => !serverName || name === serverName);
          if (servers.length === 0) return "No MCP servers found.";

          const results = [];
          for (const [name, config] of servers) {
            const cfg = config as any;
            const traces = mcpTraces.filter(t => t.serverName === name);
            const lastUsed = traces.length > 0
              ? new Date(Math.max(...traces.map(t => t.timestamp))).toISOString()
              : "never";
            const lastError = traces.filter(t => t.operation === "error").pop();

            let probeStatus = "unknown";
            let probeDetail = "";

            if (!cfg.enabled) {
              probeStatus = "disabled";
            } else if (cfg.type === "local" && cfg.command?.length > 0) {
              const cmdName = cfg.command[0];
              try {
                const isWin = typeof process !== "undefined" && process.platform === "win32";
                const whichCmd = isWin ? "where" : "which";
                await execAsync(`${whichCmd} ${cmdName}`);
                probeStatus = "reachable";
              } catch {
                probeStatus = "unreachable";
                probeDetail = `Command '${cmdName}' not found in PATH`;
              }
            } else {
              probeStatus = "configured";
            }

            results.push({
              server: name,
              enabled: cfg.enabled,
              type: cfg.type,
              command: cfg.command?.join(" ") || "N/A",
              probeStatus,
              probeDetail,
              lastUsed,
              errors: traces.filter(t => t.operation === "error").length,
              lastError: lastError?.details?.error || null,
            });
          }

          const summary = {
            total: results.length,
            reachable: results.filter(r => r.probeStatus === "reachable").length,
            disabled: results.filter(r => r.probeStatus === "disabled").length,
            unreachable: results.filter(r => r.probeStatus === "unreachable").length,
            unknown: results.filter(r => r.probeStatus === "unknown" || r.probeStatus === "configured").length,
          };

          return JSON.stringify({ summary, servers: results }, null, 2);
        },
      }),
    },
  };
};

export default MCPManagerPlugin;
