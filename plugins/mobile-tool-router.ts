import { type Plugin, tool } from "@opencode-ai/plugin";
import { accessSync, readFileSync } from "node:fs";
import { join, dirname, parse } from "node:path";

// Find project root by looking for opencode.json
function findProjectRoot(startDir: string): string | null {
  let current = startDir;
  const root = parse(current).root;

  while (current !== root) {
    try {
      const configPath = join(current, "opencode.json");
      accessSync(configPath);
      return current;
    } catch {
      current = dirname(current);
    }
  }
  return null;
}

// Detect Android project indicators
function detectAndroidProject(root: string): {
  isAndroid: boolean;
  hasGradle: boolean;
  hasManifest: boolean;
  isTauriMobile: boolean;
} {
  const result = { isAndroid: false, hasGradle: false, hasManifest: false, isTauriMobile: false };

  try {
    accessSync(join(root, "build.gradle.kts"));
    result.hasGradle = true;
  } catch {
    try {
      accessSync(join(root, "build.gradle"));
      result.hasGradle = true;
    } catch {}
  }

  try {
    accessSync(join(root, "app", "src", "main", "AndroidManifest.xml"));
    result.hasManifest = true;
  } catch {}

  // Check for Tauri Android structure
  try {
    accessSync(join(root, "src-tauri", "gen", "android"));
    result.isTauriMobile = true;
  } catch {}

  result.isAndroid = result.hasGradle || result.hasManifest || result.isTauriMobile;
  return result;
}

// Check which MCP servers are configured
function checkMcpServers(config: any): { available: string[]; missing: string[] } {
  const required = ["gradle", "mobile", "android-emulator"];
  const configured = config.mcp ? Object.keys(config.mcp).filter((k) => config.mcp[k]?.enabled !== false) : [];
  const available = required.filter((s) => configured.includes(s));
  const missing = required.filter((s) => !configured.includes(s));
  return { available, missing };
}

const MobileToolRouterPlugin: Plugin = async () => {
  return {
    tool: {
      android_detect: tool({
        description: "Detect Android project structure and report available MCP tooling",
        args: {
          path: tool.schema
            .string()
            .optional()
            .describe("Optional project path to scan (defaults to current directory)"),
        },
        async execute(args: { path?: string }) {
          const root = args.path || findProjectRoot(process.cwd()) || ".";
          const android = detectAndroidProject(root);

          let config: any = {};
          try {
            const configRaw = readFileSync(join(root, "opencode.json"), "utf-8");
            config = JSON.parse(configRaw);
          } catch {}

          const { available, missing } = config.mcp
            ? checkMcpServers(config)
            : { available: [], missing: ["gradle", "mobile", "android-emulator"] };

          return JSON.stringify(
            {
              projectRoot: root,
              isAndroid: android.isAndroid,
              indicators: {
                gradle: android.hasGradle,
                androidManifest: android.hasManifest,
                tauriMobile: android.isTauriMobile,
              },
              mcpServers: {
                available,
                missing,
              },
              suggestedAgent: android.isAndroid ? "android-kotlin" : null,
            },
            null,
            2
          );
        },
      }),
    },
  };
};

export default MobileToolRouterPlugin;
