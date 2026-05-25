import { readFile } from "node:fs/promises";
import { join } from "node:path";

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
}

export interface ProcessCheckResult {
  found: boolean;
  process?: TraeProcess;
  allMatching?: TraeProcess[];
  message: string;
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

export function parseTraeProcessTree(): TraeProcess[] {
  try {
    const content = cachedTraeMd;
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

export async function refreshTraeProcessTree(): Promise<TraeProcess[]> {
  cachedTraeMd = null; // Force refresh
  const content = await getTraeMdContent();

  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return [];

    const tree = JSON.parse(jsonMatch[0]);
    return tree.children || [];
  } catch (e) {
    console.error("Failed to parse trae.md:", e);
    return [];
  }
}

export function getAllProcesses(processes: TraeProcess[]): TraeProcess[] {
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

export function findProcessByName(
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

export function formatMemory(bytes?: number): string {
  if (!bytes) return "0 MB";
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function formatCpu(percent?: number): string {
  if (percent === undefined) return "0%";
  return `${(percent * 100).toFixed(1)}%`;
}

export function checkProcessHealth(processName: string): ProcessCheckResult {
  const processes = parseTraeProcessTree();
  const found = findProcessByName(processes, processName);

  if (found.length === 0) {
    return {
      found: false,
      message: `❌ No process found matching "${processName}". Trae might not be running or the process is not started.`,
    };
  }

  if (found.length === 1) {
    const proc = found[0];
    const mem = formatMemory(proc.real_memory);
    const cpu = formatCpu(proc.cpu_with_child);

    return {
      found: true,
      process: proc,
      message: `✅ Found "${processName}":\n- PID: ${proc.pid}\n- Memory: ${mem}\n- CPU: ${cpu}\n- Type: ${proc.type || "unknown"}`,
    };
  }

  const lines = [`Found ${found.length} processes matching "${processName}":`];
  found.forEach((proc, idx) => {
    const mem = formatMemory(proc.real_memory);
    lines.push(`  ${idx + 1}. ${proc.patched_name || proc.name} (PID: ${proc.pid}, Mem: ${mem})`);
  });

  return {
    found: true,
    allMatching: found,
    message: lines.join("\n"),
  };
}

export async function getTraeHealthReport(): Promise<{
  totalProcesses: number;
  totalMemoryMB: number;
  mcpServers: number;
  extensionHosts: number;
  languageServers: number;
}> {
  const processes = parseTraeProcessTree();
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
    (p) => (p.type || "").includes("extension") || (p.patched_name || "").includes("extensionHost")
  ).length;

  const languageServers = allProcs.filter(
    (p) =>
      (p.patched_name || "").includes("rust-analyzer") ||
      (p.name || "").includes("typescript-language-server") ||
      (p.patched_name || "").includes("json-language")
  ).length;

  return {
    totalProcesses: allProcs.length,
    totalMemoryMB: totalMemory / 1024 / 1024,
    mcpServers,
    extensionHosts,
    languageServers,
  };
}

// Initialize cache on load
getTraeMdContent().catch(() => {});
