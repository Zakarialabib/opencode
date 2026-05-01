import { Plugin, tool } from "@opencode-ai/plugin";
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

interface ExtensionInfo {
  name: string;
  id: string;
  type: "tailwind" | "yaml" | "other";
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

function findExtensions(processes: TraeProcess[]): ExtensionInfo[] {
  const extensions: ExtensionInfo[] = [];

  function traverse(proc: TraeProcess) {
    const name = proc.patched_name || proc.name || "";
    const cmd = proc.cmd || "";
    const extType = proc.extensionType || "";

    if (name.includes("tailwind") || cmd.includes("tailwindServer")) {
      extensions.push({
        name: "Tailwind CSS",
        id: "bradlc.vscode-tailwindcss",
        type: "tailwind",
        process: proc,
        isRunningInTrae: true,
        capabilities: ["class-completion", "validation", "hover-info"],
      });
    }

    if (name.includes("yaml") || cmd.includes("languageserver.js")) {
      extensions.push({
        name: "YAML",
        id: "redhat.vscode-yaml",
        type: "yaml",
        process: proc,
        isRunningInTrae: true,
        capabilities: ["validation", "completion", "formatting"],
      });
    }

    if (proc.children) {
      proc.children.forEach(traverse);
    }
  }

  processes.forEach(traverse);
  return extensions;
}

async function refreshTraeProcessTree(): Promise<TraeProcess[]> {
  cachedTraeMd = null; // Force refresh
  return await parseTraeProcessTree();
}

const ExtensionContextBridgePlugin: Plugin = async ({ client, project, directory }) => {
  return {
    async onLoad() {
      console.log("🎨 Extension Context Bridge plugin loaded");

      const processes = await parseTraeProcessTree();
      const extensions = findExtensions(processes);

      console.log(`Found ${extensions.length} extensions running in Trae`);
      extensions.forEach((ext) => {
        console.log(`  - ${ext.name} (${ext.type})`);
      });
    },

    tool: {
      trae_list_extensions: tool({
        description: "List extensions currently running in Trae IDE",
        args: {},
        async execute() {
          const processes = await parseTraeProcessTree();
          const extensions = findExtensions(processes);

          if (extensions.length === 0) {
            return "No extensions found running in Trae. Trae might not be running or trae.md is outdated.";
          }

          const lines = ["Extensions running in Trae:"];
          for (const ext of extensions) {
            const memMB = ext.process?.real_memory
              ? (ext.process.real_memory / 1024 / 1024).toFixed(1)
              : "unknown";
            const caps = ext.capabilities?.join(", ") || "none";

            lines.push(`- ${ext.name} (${ext.id})`);
            lines.push(`  PID: ${ext.process?.pid}, Memory: ${memMB}MB`);
            lines.push(`  Capabilities: ${caps}`);
          }

          return lines.join("\n");
        },
      }),

      trae_get_extension_context: tool({
        description: "Get context from a specific Trae extension",
        args: {
          extensionType: tool.schema
            .enum(["tailwind", "yaml"])
            .describe("Type of extension to get context from"),
          query: tool.schema
            .string()
            .optional()
            .describe("Optional query (e.g., class name for Tailwind)"),
        },
        async execute({ extensionType, query }) {
          const processes = await parseTraeProcessTree();
          const extensions = findExtensions(processes);

          const ext = extensions.find((e) => e.type === extensionType);

          if (!ext) {
            return `❌ ${extensionType} extension is not running in Trae.`;
          }

          let result = `✅ ${ext.name} extension is running in Trae (PID: ${ext.process?.pid})\n\n`;

          if (extensionType === "tailwind") {
            result += `Capabilities:\n`;
            result += `- Class name completion\n`;
            result += `- Class validation\n`;
            result += `- Hover information\n`;

            if (query) {
              result += `\nSearching for classes containing: "${query}"\n`;
              result += `Note: Use Trae's IntelliSense (Ctrl+Space) for full class suggestions.`;
            }
          } else if (extensionType === "yaml") {
            result += `Capabilities:\n`;
            result += `- YAML validation\n`;
            result += `- Schema validation\n`;
            result += `- Completion suggestions\n`;
            result += `- Hover information\n`;
          }

          return result;
        },
      }),

      trae_extension_status: tool({
        description: "Check status of all Trae extensions",
        args: {},
        async execute() {
          const processes = await parseTraeProcessTree();
          const extensions = findExtensions(processes);

          if (extensions.length === 0) {
            return "❌ No extensions found running in Trae.";
          }

          const lines = ["Trae Extensions Status:", ""];

          const tailwind = extensions.find((e) => e.type === "tailwind");
          const yaml = extensions.find((e) => e.type === "yaml");

          lines.push(
            `Tailwind CSS: ${tailwind ? "✅ Running (PID: " + tailwind.process?.pid + ")" : "❌ Not running"}`
          );
          lines.push(
            `YAML: ${yaml ? "✅ Running (PID: " + yaml.process?.pid + ")" : "❌ Not running"}`
          );

          lines.push("");
          lines.push("💡 Tip: Extensions provide context to OpenCode agents.");
          lines.push("   Use trae_get_extension_context to query specific extension.");

          return lines.join("\n");
        },
      }),

      trae_suggest_tailwind_classes: tool({
        description: "Get Tailwind CSS class suggestions from Trae extension",
        args: {
          partialClass: tool.schema.string().describe("Partial class name to search for"),
        },
        async execute({ partialClass }) {
          const processes = await parseTraeProcessTree();
          const extensions = findExtensions(processes);
          const tailwind = extensions.find((e) => e.type === "tailwind");

          if (!tailwind) {
            return "❌ Tailwind CSS extension is not running in Trae. Please start it in Trae's extension host.";
          }

          let result = `✅ Tailwind CSS extension is running in Trae\n\n`;
          result += `Searching for classes containing: "${partialClass}"\n`;
          result += `Capabilities available:\n`;
          result += `- Class name completion\n`;
          result += `- Class validation\n`;
          result += `- Hover information\n\n`;
          result += `Note: Use Trae's IntelliSense (Ctrl+Space) for full class suggestions.`;

          return result;
        },
      }),

      trae_refresh_extensions: tool({
        description: "Force refresh of Trae extensions cache",
        args: {},
        async execute() {
          const tree = await refreshTraeProcessTree();
          const extensions = findExtensions(tree);
          return `✅ Extensions cache refreshed. Found ${extensions.length} extensions.`;
        },
      }),
    },
  };
};

export default ExtensionContextBridgePlugin;
