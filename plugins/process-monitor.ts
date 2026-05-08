import { type Plugin, tool } from "@opencode-ai/plugin";
import { readFile } from "fs/promises";
import { join } from "path";

interface TraeProcess {
  name: string;
  cmd: string;
  pid: number;
  ppid: number;
  isRenderer: boolean;
  children?: TraeProcess[];
  real_memory?: number;
  memory_with_child?: number;
  cpu_with_child?: number;
  type?: string;
  extensionType?: string;
  patched_name?: string;
  load?: number;
}

interface ProcessInfo {
  name: string;
  pid: number;
  ppid: number;
  memoryMB: number;
  cpuPercent: number;
  type: string;
  isRunning: boolean;
}

// Cache for trae.md content
let cachedTraeMd: string | null = null;
let cacheTimestamp: number = 0;
const CACHE_TTL = 5000; // 5 seconds

async function getTraeMdContent(): Promise<string> {
  const now = Date.now();
  if (cachedTraeMd && now - cacheTimestamp < CACHE_TTL) {
    return cachedTraeMd;
  }

  try {
    const traeMdPath = join(process.cwd(), "trae.md");
    cachedTraeMd = await readFile(traeMdPath, "utf-8");
    cacheTimestamp = now;
    return cachedTraeMd;
  } catch (e) {
    console.error("Failed to read trae.md:", e);
    return "";
  }
}

async function parseTraeProcessTree(): Promise<TraeProcess[]> {
  try {
    const content = await getTraeMdContent();
    if (!content) return [];

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return [];

    const tree = JSON.parse(jsonMatch[0]);
    return tree.children || [];
  } catch (e) {
    console.error("Failed to parse trae.md:", e);
    return [];
  }
}

function getAllProcesses(processes: TraeProcess[]): TraeProcess[] {
  const all: TraeProcess[] = [];

  function traverse(proc: TraeProcess) {
    all.push(proc);
    if (proc.children) {
      proc.children.forEach(traverse);
    }
  }

  processes.forEach(traverse);
  return all;
}

function formatMemory(bytes?: number): string {
  if (!bytes) return "0 MB";
  return (bytes / 1024 / 1024).toFixed(1) + " MB";
}

function formatCpu(percent?: number): string {
  if (percent === undefined) return "0%";
  return (percent * 100).toFixed(1) + "%";
}

function findProcessByName(
  processes: TraeProcess[],
  name: string,
  exactMatch: boolean = false
): TraeProcess[] {
  const allProcs = getAllProcesses(processes);

  return allProcs.filter((p) => {
    const procName = p.name || "";
    const patchedName = p.patched_name || "";
    const cmd = p.cmd || "";

    const searchTarget = `${procName} ${patchedName} ${cmd}`.toLowerCase();
    const searchTerm = name.toLowerCase();

    if (exactMatch) {
      return procName === name || patchedName === name;
    } else {
      return searchTarget.includes(searchTerm);
    }
  });
}

async function refreshTraeProcessTree(): Promise<TraeProcess[]> {
  cachedTraeMd = null; // Force refresh
  return await parseTraeProcessTree();
}

const ProcessMonitorPlugin: Plugin = async ({ client, project, directory }) => {
  return {
    async onLoad() {
      console.log("📊 Process Monitor plugin loaded");
    },

    tool: {
      trae_process_list: tool({
        description: "List all processes running in Trae IDE",
        args: {
          sortBy: tool.schema
            .enum(["memory", "cpu", "name", "pid"])
            .default("memory")
            .describe("Sort results by field"),
        },
        async execute({ sortBy }) {
          const processes = await parseTraeProcessTree();
          const allProcs = getAllProcesses(processes);

          if (allProcs.length === 0) {
            return "No processes found. Is Trae running? Is trae.md up to date?";
          }

          const sorted = [...allProcs];
          switch (sortBy) {
            case "memory":
              sorted.sort((a, b) => (b.real_memory || 0) - (a.real_memory || 0));
              break;
            case "cpu":
              sorted.sort((a, b) => (b.cpu_with_child || 0) - (a.cpu_with_child || 0));
              break;
            case "name":
              sorted.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
              break;
            case "pid":
              sorted.sort((a, b) => a.pid - b.pid);
              break;
          }

          const lines = [`Trae processes (${allProcs.length} total):`, ""];

          for (const proc of sorted.slice(0, 20)) {
            // Top 20
            const name = proc.patched_name || proc.name || "unknown";
            const mem = formatMemory(proc.real_memory);
            const cpu = formatCpu(proc.cpu_with_child);
            const type = proc.type || "unknown";

            lines.push(`${name} (PID: ${proc.pid})`);
            lines.push(`  Memory: ${mem} | CPU: ${cpu} | Type: ${type}`);
          }

          if (sorted.length > 20) {
            lines.push(`\n... and ${sorted.length - 20} more processes`);
          }

          return lines.join("\n");
        },
      }),

      trae_find_process: tool({
        description: "Find a specific process in Trae by name",
        args: {
          processName: tool.schema.string().describe("Process name to search for"),
          exactMatch: tool.schema.boolean().default(false).describe("Require exact name match"),
        },
        async execute({ processName, exactMatch }) {
          const processes = await parseTraeProcessTree();
          const found = findProcessByName(processes, processName, exactMatch);

          if (found.length === 0) {
            return `❌ No process found matching "${processName}".`;
          }

          const lines = [`Found ${found.length} process(es) matching "${processName}":`, ""];

          for (const proc of found) {
            const name = proc.patched_name || proc.name || "unknown";
            const mem = formatMemory(proc.real_memory);
            const cpu = formatCpu(proc.cpu_with_child);

            lines.push(`✅ ${name}`);
            lines.push(`   PID: ${proc.pid} | Parent: ${proc.ppid}`);
            lines.push(`   Memory: ${mem} | CPU: ${cpu}`);
            if (proc.type) {
              lines.push(`   Type: ${proc.type}`);
            }
            if (proc.extensionType) {
              lines.push(`   Extension Type: ${proc.extensionType}`);
            }
          }

          return lines.join("\n");
        },
      }),

      trae_monitor_signsync: tool({
        description: "Monitor SignSync-related processes in Trae",
        args: {},
        async execute() {
          const processes = await parseTraeProcessTree();
          const allProcs = getAllProcesses(processes);

          const signsyncRelated = allProcs.filter((p) => {
            const cmd = p.cmd || "";
            const name = p.name || "";
            return (
              cmd.includes("Simple-Signage") ||
              name.includes("Simple-Signage") ||
              cmd.includes("tauri") ||
              name.includes("rust-analyzer") ||
              cmd.includes("typescript-language-server") ||
              name.includes("tailwind")
            );
          });

          if (signsyncRelated.length === 0) {
            return "❌ No SignSync-related processes found in Trae. Is the project open in Trae?";
          }

          const lines = ["SignSync processes in Trae:", ""];

          for (const proc of signsyncRelated) {
            const name = proc.patched_name || proc.name || "unknown";
            const mem = formatMemory(proc.real_memory);
            const cpu = formatCpu(proc.cpu_with_child);

            lines.push(`- ${name} (PID: ${proc.pid})`);
            lines.push(`  Memory: ${mem} | CPU: ${cpu}`);

            if (proc.type) {
              lines.push(`  Type: ${proc.type}`);
            }
          }

          lines.push("");
          lines.push("💡 Tip: Use trae_find_process to check specific services.");

          return lines.join("\n");
        },
      }),

      trae_process_health: tool({
        description: "Check health of Trae IDE by analyzing process tree",
        args: {},
        async execute() {
          const processes = await parseTraeProcessTree();
          const allProcs = getAllProcesses(processes);

          const totalMemory = allProcs.reduce(
            (sum, p) => sum + (p.memory_with_child || p.real_memory || 0),
            0
          );

          const mcpServers = allProcs.filter(
            (p) =>
              (p.name || "").includes("mcp") ||
              (p.cmd || "").includes("mcp") ||
              (p.patched_name || "").includes("mcp")
          ).length;

          const extensionHosts = allProcs.filter(
            (p) =>
              (p.type || "").includes("extension") ||
              (p.patched_name || "").includes("extensionHost")
          ).length;

          const languageServers = allProcs.filter(
            (p) =>
              (p.patched_name || "").includes("rust-analyzer") ||
              (p.name || "").includes("typescript-language-server") ||
              (p.patched_name || "").includes("json-language")
          ).length;

          const lines = ["Trae IDE Health Report:", ""];
          lines.push(`Total Processes: ${allProcs.length}`);
          lines.push(`Total Memory: ${(totalMemory / 1024 / 1024).toFixed(1)} MB`);
          lines.push("");
          lines.push(`MCP Servers: ${mcpServers}`);
          lines.push(`Extension Hosts: ${extensionHosts}`);
          lines.push(`Language Servers: ${languageServers}`);

          return lines.join("\n");
        },
      }),

      trae_top_processes: tool({
        description: "Get top processes by memory or CPU usage",
        args: {
          metric: tool.schema
            .enum(["memory", "cpu"])
            .default("memory")
            .describe("Metric to sort by"),
          limit: tool.schema.number().default(10).describe("Number of top processes to return"),
        },
        async execute({ metric, limit }) {
          const processes = await parseTraeProcessTree();
          const allProcs = getAllProcesses(processes);

          const sorted = [...allProcs];
          if (metric === "memory") {
            sorted.sort((a, b) => (b.real_memory || 0) - (a.real_memory || 0));
          } else {
            sorted.sort((a, b) => (b.cpu_with_child || 0) - (a.cpu_with_child || 0));
          }

          const top = sorted.slice(0, limit);
          const metricLabel = metric === "memory" ? "Memory" : "CPU";

          const lines = [`Top ${limit} processes by ${metricLabel}:`, ""];

          for (const proc of top) {
            const name = proc.patched_name || proc.name || "unknown";
            const value =
              metric === "memory" ? formatMemory(proc.real_memory) : formatCpu(proc.cpu_with_child);

            lines.push(`${name}`);
            lines.push(`  ${metricLabel}: ${value} | PID: ${proc.pid}`);
          }

          return lines.join("\n");
        },
      }),

      trae_refresh_process_tree: tool({
        description: "Force refresh of Trae process tree cache",
        args: {},
        async execute() {
          const tree = await refreshTraeProcessTree();
          return `✅ Process tree refreshed. Found ${tree.length} top-level processes.`;
        },
      }),
    },
  };
};

export default ProcessMonitorPlugin;
