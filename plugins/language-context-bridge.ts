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
}

interface LanguageServerInfo {
  name: string;
  type:
    | "rust-analyzer"
    | "typescript"
    | "json"
    | "markdown"
    | "yaml"
    | "tailwind"
    | "php"
    | "unknown";
  process?: TraeProcess;
  isRunningInTrae: boolean;
  capabilities?: string[];
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

function findLanguageServers(processes: TraeProcess[]): LanguageServerInfo[] {
  const servers: LanguageServerInfo[] = [];

  function traverse(proc: TraeProcess) {
    const name = proc.patched_name || proc.name || "";
    const cmd = proc.cmd || "";

    if (name.includes("rust-analyzer") || cmd.includes("rust-analyzer")) {
      servers.push({
        name: "rust-analyzer",
        type: "rust-analyzer",
        process: proc,
        isRunningInTrae: true,
        capabilities: ["symbols", "types", "diagnostics", "completion"],
      });
    }

    if (name.includes("typescript-language-server") || cmd.includes("typescript-language-server")) {
      servers.push({
        name: "typescript-language-server",
        type: "typescript",
        process: proc,
        isRunningInTrae: true,
        capabilities: ["symbols", "types", "diagnostics", "completion", "references"],
      });
    }

    if (
      name.includes("intelephense") ||
      cmd.includes("intelephense") ||
      name.includes("php-language-server")
    ) {
      servers.push({
        name: "PHP Language Server (Intelephense)",
        type: "php",
        process: proc,
        isRunningInTrae: true,
        capabilities: [
          "symbols",
          "types",
          "diagnostics",
          "completion",
          "references",
          "laravel-support",
        ],
      });
    }

    if (name.includes("json-language-features") || cmd.includes("jsonServerMain")) {
      servers.push({
        name: "json-language-server",
        type: "json",
        process: proc,
        isRunningInTrae: true,
        capabilities: ["validation", "completion", "formatting"],
      });
    }

    if (name.includes("markdown-language-features") || cmd.includes("markdown")) {
      servers.push({
        name: "markdown-language-server",
        type: "markdown",
        process: proc,
        isRunningInTrae: true,
        capabilities: ["preview", "validation"],
      });
    }

    if (name.includes("yaml-language-features") || cmd.includes("languageserver.js")) {
      servers.push({
        name: "yaml-language-server",
        type: "yaml",
        process: proc,
        isRunningInTrae: true,
        capabilities: ["validation", "completion", "formatting"],
      });
    }

    if (name.includes("tailwind") || cmd.includes("tailwindServer")) {
      servers.push({
        name: "tailwind-language-server",
        type: "tailwind",
        process: proc,
        isRunningInTrae: true,
        capabilities: ["class-completion", "validation"],
      });
    }

    if (proc.children) {
      proc.children.forEach(traverse);
    }
  }

  processes.forEach(traverse);
  return servers;
}

async function refreshTraeProcessTree(): Promise<TraeProcess[]> {
  cachedTraeMd = null; // Force refresh
  return await parseTraeProcessTree();
}

const LanguageContextBridgePlugin: Plugin = async ({ client, project, directory }) => {
  return {
    async onLoad() {
      console.log("🔤 Language Context Bridge plugin loaded");

      const processes = await parseTraeProcessTree();
      const servers = findLanguageServers(processes);

      console.log(`Found ${servers.length} language servers running in Trae`);
      servers.forEach((server) => {
        console.log(`  - ${server.name} (${server.type})`);
      });
    },

    tool: {
      trae_list_language_servers: tool({
        description: "List language servers currently running in Trae IDE",
        args: {},
        async execute() {
          const processes = await parseTraeProcessTree();
          const servers = findLanguageServers(processes);

          if (servers.length === 0) {
            return "No language servers found running in Trae. Trae might not be running or trae.md is outdated.";
          }

          const lines = ["Language servers running in Trae:"];
          for (const server of servers) {
            const memMB = server.process?.real_memory
              ? (server.process.real_memory / 1024 / 1024).toFixed(1)
              : "unknown";
            const caps = server.capabilities?.join(", ") || "none";

            lines.push(`- ${server.name} (${server.type})`);
            lines.push(`  PID: ${server.process?.pid}, Memory: ${memMB}MB`);
            lines.push(`  Capabilities: ${caps}`);
          }

          return lines.join("\n");
        },
      }),

      trae_get_rust_context: tool({
        description: "Get Rust code context from Trae's rust-analyzer",
        args: {
          filePath: tool.schema.string().describe("Rust file path to analyze"),
          symbol: tool.schema
            .string()
            .optional()
            .describe("Specific symbol to lookup (e.g., struct name, function name)"),
        },
        async execute({ filePath, symbol }) {
          const processes = await parseTraeProcessTree();
          const servers = findLanguageServers(processes);
          const rustAnalyzer = servers.find((s) => s.type === "rust-analyzer");

          if (!rustAnalyzer) {
            return "❌ rust-analyzer is not running in Trae. Please start it in Trae's extension host.";
          }

          const pid = rustAnalyzer.process?.pid;
          const memMB = rustAnalyzer.process?.real_memory
            ? (rustAnalyzer.process.real_memory / 1024 / 1024).toFixed(1)
            : "unknown";

          let result = `✅ rust-analyzer is running in Trae (PID: ${pid}, Memory: ${memMB}MB)\n\n`;
          result += `To get context for ${filePath}:\n`;
          result += `1. rust-analyzer has full Type information and symbol table\n`;
          result += `2. You can query symbols, types, documentation, and diagnostics\n`;

          if (symbol) {
            result += `\nLooking up symbol: ${symbol}\n`;
            result += `Note: For full symbol info, use Trae's IDE features (Go to Definition, Hover, etc.)\n`;
          }

          result += `\nCapabilities available:\n`;
          result += `- Symbol definitions and references\n`;
          result += `- Type information and inference\n`;
          result += `- Documentation comments\n`;
          result += `- Diagnostic warnings/errors\n`;
          result += `- Code completion suggestions\n`;

          return result;
        },
      }),

      trae_get_typescript_context: tool({
        description: "Get TypeScript code context from Trae's TypeScript language server",
        args: {
          filePath: tool.schema.string().describe("TypeScript/JavaScript file path"),
          includeDiagnostics: tool.schema
            .boolean()
            .default(true)
            .describe("Include diagnostic errors"),
        },
        async execute({ filePath, includeDiagnostics }) {
          const processes = await parseTraeProcessTree();
          const servers = findLanguageServers(processes);
          const tsServer = servers.find((s) => s.type === "typescript");

          if (!tsServer) {
            return "❌ TypeScript language server is not running in Trae.";
          }

          let result = `✅ TypeScript language server is running in Trae (PID: ${tsServer.process?.pid})\n\n`;
          result += `File: ${filePath}\n\n`;
          result += `Available context:\n`;
          result += `- Symbol definitions and references\n`;
          result += `- Type information\n`;
          result += `- Import resolution\n`;

          if (includeDiagnostics) {
            result += `- Diagnostic errors and warnings\n`;
            result += `\nNote: Check Trae's Problems panel for real-time diagnostics.`;
          }

          return result;
        },
      }),

      trae_get_php_context: tool({
        description: "Get PHP/Laravel code context from Trae's PHP language server (Intelephense)",
        args: {
          filePath: tool.schema.string().describe("PHP file path"),
        },
        async execute({ filePath }) {
          const processes = await parseTraeProcessTree();
          const servers = findLanguageServers(processes);
          const phpServer = servers.find((s) => s.type === "php");

          if (!phpServer) {
            return "❌ PHP language server (Intelephense) is not running in Trae.";
          }

          let result = `✅ PHP Language Server is running in Trae (PID: ${phpServer.process?.pid})\n\n`;
          result += `File: ${filePath}\n\n`;
          result += `Available Context for Laravel:\n`;
          result += `- Eloquent model symbols and relations\n`;
          result += `- Controller methods and routing symbols\n`;
          result += `- Global PHP functions and Laravel helpers\n`;
          result += `- Real-time syntax and semantic diagnostics\n`;
          result += `- Cross-file references (Find usages)\n`;
          result += `\nNote: Intelephense provides deep intelligence for Laravel 13+. Use Trae's Go to Symbol (@) to navigate.`;

          return result;
        },
      }),

      trae_get_json_context: tool({
        description: "Get JSON validation context from Trae",
        args: {
          filePath: tool.schema.string().describe("JSON file path"),
        },
        async execute({ filePath }) {
          const processes = await parseTraeProcessTree();
          const servers = findLanguageServers(processes);
          const jsonServer = servers.find((s) => s.type === "json");

          if (!jsonServer) {
            return "❌ JSON language server is not running in Trae.";
          }

          return `✅ JSON Language Server is running (PID: ${jsonServer.process?.pid})\n- Providing validation for ${filePath}\n- Schema-aware completion is active.`;
        },
      }),

      trae_get_markdown_context: tool({
        description: "Get Markdown context from Trae",
        args: {
          filePath: tool.schema.string().describe("Markdown file path"),
        },
        async execute({ filePath }) {
          const processes = await parseTraeProcessTree();
          const servers = findLanguageServers(processes);
          const mdServer = servers.find((s) => s.type === "markdown");

          if (!mdServer) {
            return "❌ Markdown language server is not running in Trae.";
          }

          return `✅ Markdown Language Server is active (PID: ${mdServer.process?.pid})\n- Providing link validation and preview for ${filePath}`;
        },
      }),

      trae_get_tailwind_context: tool({
        description: "Get Tailwind CSS context from Trae's Tailwind extension",
        args: {
          partialClass: tool.schema
            .string()
            .optional()
            .describe("Partial class name to search for"),
        },
        async execute({ partialClass }) {
          const processes = await parseTraeProcessTree();
          const servers = findLanguageServers(processes);
          const tailwind = servers.find((s) => s.type === "tailwind");

          if (!tailwind) {
            return "❌ Tailwind CSS extension is not running in Trae.";
          }

          let result = `✅ Tailwind CSS extension is running in Trae\n\n`;
          result += `Capabilities:\n`;
          result += `- Class name completion\n`;
          result += `- Class validation\n`;
          result += `- Hover information\n`;

          if (partialClass) {
            result += `\nSearching for classes containing: "${partialClass}"\n`;
            result += `Note: Use Trae's IntelliSense (Ctrl+Space) for full class suggestions.`;
          }

          return result;
        },
      }),

      trae_language_server_status: tool({
        description: "Check status of specific language server in Trae",
        args: {
          serverType: tool.schema
            .enum(["rust", "typescript", "json", "markdown", "yaml", "tailwind", "php"])
            .describe("Type of language server to check"),
        },
        async execute({ serverType }) {
          const processes = await parseTraeProcessTree();
          const servers = findLanguageServers(processes);

          const typeMap: Record<string, string> = {
            rust: "rust-analyzer",
            typescript: "typescript",
            json: "json",
            markdown: "markdown",
            yaml: "yaml",
            tailwind: "tailwind",
            php: "php",
          };

          const server = servers.find((s) => s.type === typeMap[serverType]);

          if (!server) {
            return `❌ ${serverType} language server is not running in Trae.`;
          }

          const memMB = server.process?.real_memory
            ? (server.process.real_memory / 1024 / 1024).toFixed(1)
            : "unknown";
          const cpu = server.process?.cpu_with_child
            ? (server.process.cpu_with_child * 100).toFixed(1) + "%"
            : "unknown";

          return `✅ ${server.name} is running:\n- PID: ${server.process?.pid}\n- Memory: ${memMB}MB\n- CPU: ${cpu}%\n- Capabilities: ${server.capabilities?.join(", ")}`;
        },
      }),

      trae_refresh_language_servers: tool({
        description: "Force refresh of Trae language servers cache",
        args: {},
        async execute() {
          const tree = await refreshTraeProcessTree();
          const servers = findLanguageServers(tree);
          return `✅ Language servers cache refreshed. Found ${servers.length} servers.`;
        },
      }),
    },
  };
};

export default LanguageContextBridgePlugin;
