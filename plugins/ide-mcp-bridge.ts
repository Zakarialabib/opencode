import { Plugin, tool } from "@opencode-ai/plugin";
import { readFile } from "fs/promises";
import { join } from "path";

interface IdeProcess {
  name: string;
  cmd: string;
  pid: number;
  ppid: number;
  isRenderer: boolean;
  children?: IdeProcess[];
  real_memory?: number;
  memory_with_child?: number;
  cpu_with_child?: number;
  type?: string;
  extensionType?: string;
  patched_name?: string;
}

interface McpServerInfo {
  name: string;
  ideProcess?: IdeProcess;
  ipcPath?: string;
  tcpPort?: number;
  isRunningInIde: boolean;
  fallbackCommand?: string[];
}

// Cache for ide.md content
let cachedIdeMd: string | null = null;
let cacheTimestamp: number = 0;
const CACHE_TTL = 5000; // 5 seconds

async function getIdeMdContent(): Promise<string> {
  const now = Date.now();
  if (cachedIdeMd && now - cacheTimestamp < CACHE_TTL) {
    return cachedIdeMd;
  }

  try {
    const ideMdPath = join(process.cwd(), "ide.md");
    cachedIdeMd = await readFile(ideMdPath, "utf-8");
    cacheTimestamp = now;
    return cachedIdeMd;
  } catch (e) {
    console.error("Failed to read ide.md:", e);
    return "";
  }
}

async function parseIdeProcessTree(): Promise<IdeProcess[]> {
  try {
    const content = await getIdeMdContent();
    if (!content) return [];

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return [];

    const tree = JSON.parse(jsonMatch[0]);
    return tree.children || [];
  } catch (e) {
    console.error("Failed to parse ide.md:", e);
    return [];
  }
}

function findMcpServers(processes: IdeProcess[]): IdeProcess[] {
  const mcpServers: IdeProcess[] = [];

  function traverse(proc: IdeProcess) {
    if (
      proc.name?.includes("mcp") ||
      proc.name?.includes("knowledge-graph") ||
      proc.name?.includes("context7") ||
      proc.name?.includes("fs-mcp") ||
      proc.name?.includes("sequential-thinking") ||
      proc.patched_name?.includes("mcp")
    ) {
      mcpServers.push(proc);
    }

    if (proc.children) {
      proc.children.forEach(traverse);
    }
  }

  processes.forEach(traverse);
  return mcpServers;
}

function extractIpcPath(proc: IdeProcess): string | undefined {
  const cmd = proc.cmd || proc.name || "";

  if (cmd.includes("knowledge-graph")) return "\\\\?\\pipe\\ide-mcp-knowledge-graph";
  if (cmd.includes("context7")) return "\\\\?\\pipe\\ide-mcp-context7";
  if (cmd.includes("fs-mcp")) return "\\\\?\\pipe\\ide-mcp-fs";
  if (cmd.includes("sequential-thinking")) return "\\\\?\\pipe\\ide-mcp-sequential";

  return undefined;
}

async function refreshIdeProcessTree(): Promise<IdeProcess[]> {
  cachedIdeMd = null; // Force refresh
  return await parseIdeProcessTree();
}

const IdeMcpBridgePlugin: Plugin = async ({ client, project, directory }) => {
  return {
    async onLoad() {
      console.log("🔗 IDE MCP Bridge plugin loaded");

      const processes = await parseIdeProcessTree();
      const mcpServers = findMcpServers(processes);

      console.log(`Found ${mcpServers.length} MCP servers running in IDE`);
      mcpServers.forEach((server) => {
        console.log(`  - ${server.patched_name || server.name} (PID: ${server.pid})`);
      });
    },

    tool: {
      ide_list_mcp_servers: tool({
        description: "List MCP servers currently running in IDE",
        args: {},
        async execute() {
          const processes = await parseIdeProcessTree();
          const mcpServers = findMcpServers(processes);

          if (mcpServers.length === 0) {
            return "No MCP servers found running in IDE. IDE might not be running or ide.md is outdated.";
          }

          const lines = ["MCP servers running in IDE:"];
          for (const server of mcpServers) {
            const name = server.patched_name || server.name;
            const memMB = server.real_memory
              ? (server.real_memory / 1024 / 1024).toFixed(1)
              : "unknown";
            const ipc = extractIpcPath(server) || "N/A";

            lines.push(`- ${name} (PID: ${server.pid}, Memory: ${memMB}MB)`);
            lines.push(`  IPC: ${ipc}`);
          }

          return lines.join("\n");
        },
      }),

      ide_check_mcp: tool({
        description: "Check if a specific MCP server is running in IDE",
        args: {
          serverName: tool.schema
            .string()
            .describe("MCP server name to check (e.g., knowledge-graph, context7, fs-mcp)"),
        },
        async execute({ serverName }) {
          const processes = await parseIdeProcessTree();
          const mcpServers = findMcpServers(processes);

          const found = mcpServers.find(
            (s) =>
              s.name?.includes(serverName) ||
              s.patched_name?.includes(serverName) ||
              s.cmd?.includes(serverName)
          );

          if (!found) {
            return `❌ MCP server "${serverName}" is not running in IDE. You may need to start it in IDE's extension host.`;
          }

          const memMB = found.real_memory
            ? (found.real_memory / 1024 / 1024).toFixed(1)
            : "unknown";
          const ipc = extractIpcPath(found) || "N/A";

          return `✅ Found "${serverName}" in IDE:\n- PID: ${found.pid}\n- Memory: ${memMB}MB\n- IPC Path: ${ipc}\n\nYou can connect to this server instead of spawning a new one.`;
        },
      }),

      ide_get_process_tree: tool({
        description: "Get IDE process tree for monitoring",
        args: {
          filter: tool.schema
            .string()
            .optional()
            .describe('Filter processes by name (e.g., "mcp", "rust", "extension")'),
        },
        async execute({ filter }) {
          const processes = await parseIdeProcessTree();

          function formatProcess(proc: IdeProcess, indent: string = ""): string {
            const memMB = proc.real_memory ? (proc.real_memory / 1024 / 1024).toFixed(1) : "?";
            const type = proc.type || proc.patched_name || "unknown";

            if (filter && !proc.name?.includes(filter) && !proc.patched_name?.includes(filter)) {
              return "";
            }

            let result = `${indent}${type} (PID: ${proc.pid}, Mem: ${memMB}MB)`;

            if (proc.children) {
              const children = proc.children
                .map((child) => formatProcess(child, indent + "  "))
                .filter((line) => line.length > 0)
                .join("\n");
              if (children) result += "\n" + children;
            }

            return result;
          }

          const output = processes.map((p) => formatProcess(p)).filter((line) => line.length > 0);

          if (output.length === 0) {
            return filter
              ? `No processes found matching "${filter}" in IDE.`
              : "No processes found. Is IDE running?";
          }

          return output.join("\n");
        },
      }),

      ide_bridge_status: tool({
        description: "Check which OpenCode MCP servers can be bridged to IDE",
        args: {},
        async execute() {
          const processes = await parseIdeProcessTree();
          const mcpServers = findMcpServers(processes);

          const opencodeMcps = [
            { name: "knowledge-graph", package: "@itseasy21/mcp-knowledge-graph" },
            { name: "context7", package: "@upstash/context7-mcp" },
            { name: "fs-mcp", package: "@bunas/fs-mcp" },
            {
              name: "sequential-thinking",
              package: "@modelcontextprotocol/server-sequential-thinking",
            },
            { name: "git", package: "mcp-server-git" },
            { name: "fetch", package: "mcp-server-fetch" },
            { name: "sqlite", package: "mcp-server-sqlite" },
          ];

          const lines = ["OpenCode MCP ↔ IDE Bridge Status:", ""];

          for (const ocMcp of opencodeMcps) {
            const ideServer = mcpServers.find(
              (s) => s.name?.includes(ocMcp.name) || s.cmd?.includes(ocMcp.package)
            );

            if (ideServer) {
              lines.push(`✅ ${ocMcp.name}: Bridged to IDE (PID: ${ideServer.pid})`);
            } else {
              lines.push(`⚠️  ${ocMcp.name}: Will spawn locally (${ocMcp.package})`);
            }
          }

          lines.push("");
          lines.push("To bridge, ensure IDE has these MCP servers running in its extension host.");

          return lines.join("\n");
        },
      }),

      ide_refresh_process_tree: tool({
        description: "Force refresh of IDE process tree cache",
        args: {},
        async execute() {
          const tree = await refreshIdeProcessTree();
          return `✅ Process tree refreshed. Found ${tree.length} top-level processes.`;
        },
      }),
    },
  };
};

export default IdeMcpBridgePlugin;
