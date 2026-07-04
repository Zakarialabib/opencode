/**
 * project-initializer.ts — Auto-harness Layer 1: Project Auto-Discovery
 *
 * Auto-detects project context on session start:
 * - Stack detection (Tauri/React/Laravel/Android)
 * - Test framework detection
 * - Package manager detection
 * - Conventions extraction
 * - MCP availability check
 *
 * Architecture:
 *   session.created (or first chat.params) → detectProject() → inject context into memory
 *   Subsequent sessions → memory MCP recall previous project context
 */

import { type Plugin, tool } from "@opencode-ai/plugin";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname, parse } from "node:path";

// ─── Types ─────────────────────────────────────────────────────

interface ProjectProfile {
  stack: ("tauri" | "react" | "laravel" | "android" | "node")[];
  testCommand: string;
  testFramework: string;
  lintCommand: string;
  buildCommand: string;
  packageManager: string;
  hasDocs: boolean;
  hasWorkflows: boolean;
  hasRules: boolean;
  hasMemory: boolean;
  hasGit: boolean;
  srcDirs: string[];
  configFiles: string[];
  detectedAt: number;
}

// ─── Detection helpers ─────────────────────────────────────────

const EXTENSION_MAP: Record<string, "tauri" | "react" | "laravel" | "android" | "node"> = {
  ".rs": "tauri",
  ".tsx": "react",
  ".ts": "react",
  ".php": "laravel",
  ".kt": "android",
};

function detectStack(directory: string): ProjectProfile["stack"] {
  const stacks = new Set<ProjectProfile["stack"][number]>();
  const patterns = [
    { file: "Cargo.toml", stack: "tauri" as const },
    { file: "tauri.conf.json", stack: "tauri" as const },
    { file: "vite.config.ts", stack: "react" as const },
    { file: "vite.config.js", stack: "react" as const },
    { file: "artisan", stack: "laravel" as const },
    { file: "composer.json", stack: "laravel" as const },
    { file: "build.gradle.kts", stack: "android" as const },
    { file: "gradlew", stack: "android" as const },
    { file: "package.json", stack: "node" as const },
  ];

  for (const { file, stack } of patterns) {
    if (existsSync(join(directory, file))) {
      stacks.add(stack);
    }
  }

  return Array.from(stacks);
}

function detectTestFramework(directory: string): { command: string; framework: string } {
  const pkgPath = join(directory, "package.json");
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
      const scripts = pkg.scripts || {};
      if (scripts.test) {
        const cmd = scripts.test;
        if (cmd.includes("vitest")) return { command: "npx vitest run", framework: "vitest" };
        if (cmd.includes("jest")) return { command: "npx jest", framework: "jest" };
        if (cmd.includes("mocha")) return { command: "npx mocha", framework: "mocha" };
        if (cmd.includes("playwright"))
          return { command: "npx playwright test", framework: "playwright" };
        return { command: "npm test", framework: "npm-scripts" };
      }
    } catch {
      /* ignore */
    }
  }

  if (existsSync(join(directory, "composer.json"))) {
    if (existsSync(join(directory, "vendor", "bin", "pest"))) {
      return { command: "./vendor/bin/pest", framework: "pest" };
    }
    if (existsSync(join(directory, "vendor", "bin", "phpunit"))) {
      return { command: "./vendor/bin/phpunit", framework: "phpunit" };
    }
  }

  if (existsSync(join(directory, "Cargo.toml"))) {
    return { command: "cargo test", framework: "cargo-test" };
  }

  if (existsSync(join(directory, "gradlew"))) {
    return { command: "./gradlew test", framework: "gradle" };
  }

  return { command: "npm test", framework: "unknown" };
}

function detectPackageManager(directory: string): string {
  if (existsSync(join(directory, "bun.lockb"))) return "bun";
  if (existsSync(join(directory, "pnpm-lock.yaml"))) return "pnpm";
  if (existsSync(join(directory, "yarn.lock"))) return "yarn";
  if (existsSync(join(directory, "package-lock.json"))) return "npm";
  if (existsSync(join(directory, "composer.lock"))) return "composer";
  if (existsSync(join(directory, "Cargo.lock"))) return "cargo";
  return "unknown";
}

function detectSrcDirs(directory: string): string[] {
  const candidates = ["src", "src-tauri", "app", "android", "lib", "resources"];
  return candidates.filter((d) => existsSync(join(directory, d)));
}

function detectConfigFiles(directory: string): string[] {
  const candidates = [
    "opencode.json",
    "package.json",
    "Cargo.toml",
    "composer.json",
    "tsconfig.json",
    "vite.config.ts",
    "tailwind.config.ts",
    "biome.json",
    ".prettierrc",
    "pint.json",
    "rustfmt.toml",
    ".env.example",
    "docker-compose.yml",
    "Makefile",
  ];
  return candidates.filter((f) => existsSync(join(directory, f)));
}

async function detectProject(directory: string): Promise<ProjectProfile> {
  const stack = detectStack(directory);
  const { command: testCommand, framework: testFramework } = detectTestFramework(directory);

  return {
    stack,
    testCommand,
    testFramework,
    lintCommand: "npm run lint",
    buildCommand: "npm run build",
    packageManager: detectPackageManager(directory),
    hasDocs: existsSync(join(directory, "docs")),
    hasWorkflows: existsSync(join(directory, "workflows")),
    hasRules: existsSync(join(directory, "rules")),
    hasMemory: existsSync(join(directory, ".opencode", "opencode-memory.db")),
    hasGit: existsSync(join(directory, ".git")),
    srcDirs: detectSrcDirs(directory),
    configFiles: detectConfigFiles(directory),
    detectedAt: Date.now(),
  };
}

function formatProjectContext(profile: ProjectProfile): string {
  const lines: string[] = [
    "## \u{1F4CB} Project Auto-Detected Context",
    "",
    `**Stack**: ${profile.stack.join(" + ") || "unknown"}`,
    `**Test**: ${profile.testFramework} (\`${profile.testCommand}\`)`,
    `**Package Manager**: ${profile.packageManager}`,
    `**Source Dirs**: ${profile.srcDirs.join(", ") || "none detected"}`,
    "",
    "**Available**:",
    `- Docs: ${profile.hasDocs ? "\u2705" : "\u274C"}`,
    `- Workflows: ${profile.hasWorkflows ? "\u2705" : "\u274C"}`,
    `- Rules: ${profile.hasRules ? "\u2705" : "\u274C"}`,
    `- Memory DB: ${profile.hasMemory ? "\u2705" : "\u274C"}`,
    `- Git: ${profile.hasGit ? "\u2705" : "\u274C"}`,
    "",
    "**Config Files**:",
    ...profile.configFiles.map((f) => `- \`${f}\``),
    "",
    "**Layer 1 Rules** (auto-harness):",
    "- Before editing: READ the file first (AGENT.md \u00a72 RULE 1)",
    "- Before asking: SEARCH first (glob \u2192 grep \u2192 read \u2192 context7)",
    "- Before architecture: RAG at PLAN stage (docs + context7 + websearch)",
    "- After editing: VERIFY at harness stage (LSP + tests + self-review)",
    "- Every step: WORKLOG entry",
  ];
  return lines.join("\n");
}

// ─── Plugin ────────────────────────────────────────────────────

const ProjectInitializerPlugin: Plugin = async ({ directory }) => {
  let cachedProfile: ProjectProfile | null = null;
  let initialized = false;

  return {
    // ── On first message, auto-detect and inject project context ──
    "chat.params": async (input: any, output: any) => {
      if (initialized) return;
      initialized = true;

      try {
        cachedProfile = await detectProject(directory);
        const contextBlock = formatProjectContext(cachedProfile);

        // Inject into system prompt / instructions
        if (output?.instructions && Array.isArray(output.instructions)) {
          output.instructions.push(contextBlock);
        } else if (output?.system) {
          output.system += "\n\n" + contextBlock;
        }
      } catch {
        // Graceful degradation — project detection is non-critical
      }
    },

    tool: {
      // ── Manual re-detect project context ──
      project_detect: tool({
        description:
          "Auto-detect project stack, frameworks, and conventions. Returns a structured ProjectProfile.",
        args: {},
        async execute() {
          cachedProfile = await detectProject(directory);
          return formatProjectContext(cachedProfile);
        },
      }),

      // ── Get cached project profile ──
      project_status: tool({
        description: "Show the current cached project profile without re-detecting",
        args: {},
        async execute() {
          if (!cachedProfile) {
            cachedProfile = await detectProject(directory);
          }
          const lines: string[] = [
            "## Project Status",
            `Stack: ${cachedProfile.stack.join(" + ") || "unknown"}`,
            `Test: ${cachedProfile.testFramework}`,
            `Package: ${cachedProfile.packageManager}`,
            `Source: ${cachedProfile.srcDirs.join(", ")}`,
            `Docs: ${cachedProfile.hasDocs ? "yes" : "no"}`,
            `Workflows: ${cachedProfile.hasWorkflows ? "yes" : "no"}`,
            `Rules: ${cachedProfile.hasRules ? "yes" : "no"}`,
            `Git: ${cachedProfile.hasGit ? "yes" : "no"}`,
            `Detected at: ${new Date(cachedProfile.detectedAt).toISOString()}`,
          ];
          return lines.join("\n");
        },
      }),
    },
  };
};

export default ProjectInitializerPlugin;
