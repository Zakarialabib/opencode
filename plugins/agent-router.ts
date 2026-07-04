import { parseJsonc } from "./jsonc-utils";
import { type Plugin, tool } from "@opencode-ai/plugin";
import { readFileSync, accessSync } from "node:fs";
import { join, dirname, parse } from "node:path";

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

  const cwdCandidate = join(process.cwd(), "opencode.json");
  try {
    accessSync(cwdCandidate);
    return cwdCandidate;
  } catch {
    // Fall back to directory search.
  }

  return findConfigPath(startDir);
}

// Type definitions
interface AgentRule {
  agent: string;
  keywords: string[];
  skills: string[];
  description: string;
}

// ─── Model selection by task complexity ─────────────────────────
// Single-model environment: all tasks use the free OpenCode model.
// The model name here is a label; routing is handled by OpenCode's provider config.
// Complexity classification is still useful for agent routing + tool selection.
const MODEL_MAP = {
  trivial: "opencode/deepseek-v4-flash-free",
  simple: "opencode/deepseek-v4-flash-free",
  medium: "opencode/deepseek-v4-flash-free",
  complex: "opencode/deepseek-v4-flash-free",
  research: "opencode/deepseek-v4-flash-free",
};

const COMPLEXITY_KEYWORDS = {
  complex: [
    "architecture",
    "redesign",
    "migrate",
    "scalab",
    "performance",
    "security audit",
    "new feature",
    "system design",
    "data model",
    "cross-stack",
    "multi-agent",
    "orchestrat",
    "workflow",
    "refactor",
    "restructure",
    "design pattern",
  ],
  medium: [
    "implement",
    "add",
    "create",
    "build",
    "feature",
    "module",
    "component",
    "api",
    "endpoint",
    "service",
    "integration",
    "database",
    "migration",
    "schema",
    "model",
  ],
  trivial: [
    "typo",
    "rename",
    "fix typo",
    "format",
    "whitespace",
    "comment",
    "readme",
    "spelling",
    "cosmetic",
  ],
};

function classifyComplexity(task: string): keyof typeof MODEL_MAP {
  const q = task.toLowerCase();

  // Check trivial first (fast path)
  for (const kw of COMPLEXITY_KEYWORDS.trivial) {
    if (q.includes(kw)) return "trivial";
  }

  // Check complex
  for (const kw of COMPLEXITY_KEYWORDS.complex) {
    if (q.includes(kw)) return "complex";
  }

  // Check medium
  for (const kw of COMPLEXITY_KEYWORDS.medium) {
    if (q.includes(kw)) return "medium";
  }

  return "simple";
}

function selectModel(_task: string, _agentName: string): string {
  // Single-model environment: all agents use the same free model.
  // Complexity is still tracked for agent-routing purposes (not model selection).
  return MODEL_MAP.medium;
}

// Default agent routing rules - UPDATED to match opencode.json agents
const DEFAULT_AGENT_RULES: AgentRule[] = [
  {
    agent: "android-kotlin",
    keywords: ["android", "kotlin", "compose", "gradle", "apk", "mobile native", "adb"],
    skills: [],
    description: "Android/Kotlin native development with Jetpack Compose and Gradle",
  },
  {
    agent: "backend-laravel",
    keywords: [
      "laravel",
      "php",
      "livewire",
      "eloquent",
      "artisan",
      "blade",
      "pest",
      "phpunit",
      "laravel 13",
    ],
    skills: ["laravel-feature-scaffold", "pest-testing"],
    description:
      "Laravel 13, Livewire 4, PHP 8.3 development - NOT for generic API (use software-architect)",
  },
  {
    agent: "backend-tauri",
    keywords: ["rust", "tauri", "desktop", "cargo", ".rs", "tauri app"],
    skills: ["stack-context"],
    description: "Rust and Tauri desktop application development",
  },
  {
    agent: "code-reviewer",
    keywords: ["review", "audit", "quality", "standards", "naming", "lint"],
    skills: [],
    description: "Code quality review: naming, redundancy, standards, and pattern violations",
  },
  {
    agent: "core-factory",
    keywords: [
      "implement",
      "code",
      "edit",
      "modify",
      "build",
      "create file",
      "change",
      "fix",
      "agent",
      "pattern",
    ],
    skills: ["self-improver", "stack-context", "coding-agent"],
    description: "Core implementation and direct file editing (merged builder/planner/opencoder)",
  },
  {
    agent: "devops-engineer",
    keywords: [
      "ops",
      "terminal",
      "deploy",
      "build",
      "process",
      "operational",
      "git",
      "release",
      "mcp",
      "server",
      "integration",
      "tool integration",
      "mcp server",
    ],
    skills: ["git-release"],
    description: "Operational tasks, MCP integration, and infrastructure",
  },
  {
    agent: "docs-curator",
    keywords: [
      "docs",
      "documentation",
      "guide",
      "write",
      "content",
      "readme",
      "report",
      "excel",
      "word",
      "pdf",
      "powerpoint",
      "presentation",
      "spreadsheet",
      "governance",
      "audit docs",
      "standards",
      "documentation audit",
      "drift",
      "improve",
      "evolve",
      "self-improve",
      "research",
      "learn",
      "adapt",
      "marketing",
      "content",
      "strategy",
      "campaign",
      "seo",
      "social",
      "brand",
      "market",
    ],
    skills: [
      "xlsx",
      "docx",
      "pdf",
      "ppt",
      "content-strategy",
      "market-research-reports",
      "docs-governance-audit",
      "writing-plans",
      "seo-content-writer",
    ],
    description: "Documentation, self-improvement, and system evolution",
  },
  {
    agent: "docs-evolver",
    keywords: ["docs", "documentation", "changelog", "adr", "readme"],
    skills: [],
    description: "Documentation evolution: sync docs with code, manage changelogs and ADRs",
  },
  {
    agent: "explore",
    keywords: ["find", "search", "locate", "where is", "grep", "glob", "pattern"],
    skills: [],
    description: "Fast codebase search: file location, pattern finding, and structural queries",
  },
  {
    agent: "frontend-ui-ux",
    keywords: [
      "react",
      "typescript",
      "ui",
      "ux",
      "css",
      "tailwind",
      "component",
      "design",
      "html",
      "chart",
      "visual",
      "image",
      "icon",
      "animation",
      "gradient",
      "dashboard",
      "widget",
      "next.js",
      "shadcn",
    ],
    skills: ["ui-ux-pro-max", "react-reuse-audit", "charts", "visual-design-foundations"],
    description: "Premium UI/UX design and frontend development (Next.js, TypeScript, Tailwind)",
  },
  {
    agent: "integration-test",
    keywords: ["test", "coverage", "integration", "e2e", "vitest", "pest"],
    skills: [],
    description: "Integration test generation, execution, and coverage analysis",
  },
  {
    agent: "lead-strategist",
    keywords: [
      "orchestrate",
      "multi-agent",
      "delegate",
      "workflow",
      "coordinate",
      "complex",
      "strategy",
    ],
    skills: ["workflow-manager", "project-orchestration", "task"],
    description: "Strategic orchestrator managing complex multi-agent workflows and coordination",
  },
  {
    agent: "mobile-qa",
    keywords: ["mobile test", "android test", "ui test", "emulator", "device test"],
    skills: [],
    description:
      "Android UI testing, device compatibility, screenshot comparison, and regression verification",
  },
  {
    agent: "plan",
    keywords: [
      "plan",
      "analyze",
      "review",
      "architecture",
      "design",
      "gapanalysis",
      "risk",
      "assessment",
    ],
    skills: [],
    description: "Read-only analyst for architecture review, gap analysis, and risk assessment",
  },
  {
    agent: "qa-guardian",
    keywords: [
      "test",
      "testing",
      "pest",
      "phpunit",
      "vitest",
      "cargo test",
      "coverage",
      "test suite",
      "security",
      "vulnerability",
      "secret",
      "leak",
      "audit",
      "csrf",
      "xss",
      "injection",
      "review",
      "code review",
      "standards",
      "performance",
      "refactor",
      "quality",
      "bug",
      "debug",
      "error",
      "crash",
      "troubleshoot",
      "browser",
      "reproduce",
    ],
    skills: ["testing-strategy", "security-review", "react-reuse-audit"],
    description: "Unified QA: code review, testing, security scanning, and debugging",
  },
  {
    agent: "refactor-architect",
    keywords: ["refactor", "restructure", "migrate", "technical debt", "reorganize"],
    skills: [],
    description:
      "System architect for codebase refactoring, structural analysis, and migration planning",
  },
  {
    agent: "research-analyst",
    keywords: ["best practice", "benchmark", "comparison", "standard", "research"],
    skills: [],
    description: "Research and gap analysis: best practices, benchmarks, external standards",
  },
  {
    agent: "scout",
    keywords: ["research", "docs", "upstream", "dependency", "library", "version", "api docs"],
    skills: [],
    description:
      "External research: dependency inspection, upstream documentation, and version tracking",
  },
  {
    agent: "software-architect",
    keywords: [
      "api",
      "rest",
      "graphql",
      "prisma",
      "endpoint",
      "backend",
      "json:api",
      "node",
      "express",
    ],
    skills: ["fullstack-dev"],
    description:
      "Generic API design (Node/Express, REST/GraphQL) - NOT for Laravel (use backend-laravel)",
  },
  {
    agent: "software-architect",
    keywords: ["architecture", "design", "system", "structure", "decision", "database", "schema"],
    skills: ["database-design", "self-reflection", "context7", "memory", "sequential-thinking"],
    description: "Technical vision and long-term structural integrity",
  },
];

const AgentRouterPlugin: Plugin = async ({ directory }) => {
  // Load agent routing rules from config, fallback to defaults
  let AGENT_RULES: AgentRule[] = DEFAULT_AGENT_RULES;

  const configPath = resolveConfigPath(directory);
  if (configPath) {
    try {
      const config = parseJsonc(readFileSync(configPath, "utf8"));
      // Check both "agent" (singular, current) and "agents" (plural, legacy)
      const agentConfig = config.agent || config.agents;
      if (agentConfig && Array.isArray(agentConfig)) {
        AGENT_RULES = agentConfig as AgentRule[];
      }
    } catch {
      console.log("Using default agent routing rules");
    }
  } else {
    console.log("Using default agent routing rules");
  }

  // Helper function to route a task
  function routeTask(task: string) {
    const taskLower = task.toLowerCase();
    const matches: Array<{
      agent: string;
      score: number;
      description: string;
      matchedKeywords: string[];
      matchedSkills: string[];
    }> = [];

    // Match agents based on keywords and skills
    for (const rule of AGENT_RULES) {
      let score = 0;
      const matchedKeywords: string[] = [];
      const matchedSkills: string[] = [];

      // Check keywords
      for (const keyword of rule.keywords) {
        if (taskLower.includes(keyword.toLowerCase())) {
          score += 2;
          matchedKeywords.push(keyword);
        }
      }

      // Check skills
      for (const skill of rule.skills) {
        if (taskLower.includes(skill.toLowerCase())) {
          score += 3;
          matchedSkills.push(skill);
        }
      }

      if (score > 0) {
        matches.push({
          agent: rule.agent,
          score,
          description: rule.description,
          matchedKeywords,
          matchedSkills,
        });
      }
    }

    // Sort by score descending
    matches.sort((a, b) => b.score - a.score);
    return matches;
  }

  return {
    // Custom tools
    tool: {
      route_agent: tool({
        description: "Analyze a task and recommend the best agent(s) to handle it",
        args: {
          task: tool.schema.string().describe("Description of the task to route"),
          verbose: tool.schema
            .boolean()
            .default(false)
            .describe("Include detailed reasoning and skill matches"),
        },
        async execute({ task, verbose }) {
          const matches = routeTask(task);

          if (matches.length === 0) {
            return `No specific agent matched for task: "${task}". Defaulting to lead-strategist for analysis.`;
          }

          const bestMatch = matches[0];
          let result = `🎯 Recommended Agent: **${bestMatch.agent}**\n`;
          result += `   Role: ${bestMatch.description}\n`;

          if (verbose) {
            result += `\n📊 Matching Details:\n`;
            result += `   Score: ${bestMatch.score}\n`;
            if (bestMatch.matchedKeywords.length > 0) {
              result += `   Matched Keywords: ${bestMatch.matchedKeywords.join(", ")}\n`;
            }
            if (bestMatch.matchedSkills.length > 0) {
              result += `   Matched Skills: ${bestMatch.matchedSkills.join(", ")}\n`;
            }

            if (matches.length > 1) {
              result += `\n🔄 Other Possible Agents:\n`;
              for (let i = 1; i < Math.min(matches.length, 3); i++) {
                const m = matches[i];
                result += `   ${i}. ${m.agent} (score: ${m.score})\n`;
              }
            }
          }

          result += `\n💡 To switch to this agent, use: \`/agent ${bestMatch.agent}\`\n`;
          return result;
        },
      }),

      auto_route: tool({
        description: "Automatically switch to the best agent for the given task",
        args: {
          task: tool.schema.string().describe("Description of the task to route"),
          confirm: tool.schema
            .boolean()
            .default(true)
            .describe("Ask for confirmation before switching"),
        },
        async execute({ task }) {
          const matches = routeTask(task);
          if (matches.length === 0) {
            return `No specific agent matched. Staying with current agent.`;
          }
          const bestMatch = matches[0];
          return `Recommended agent: ${bestMatch.agent}\n\nNote: Automatic agent switching requires session integration. Use \`/agent ${bestMatch.agent}\` to switch manually.`;
        },
      }),

      // ── Model selector: picks best model by task complexity ──
      recommend_model: tool({
        description:
          "Classify task complexity for agent-routing purposes (model is fixed — single-model environment)",
        args: {
          task: tool.schema.string().describe("The task to analyze"),
          agentName: tool.schema
            .string()
            .default("core-factory")
            .describe("The agent that will execute the task"),
        },
        async execute({ task, agentName }) {
          const complexity = classifyComplexity(task);
          const model = selectModel(task, agentName);

          let result = `## Task Complexity Analysis\n\n`;
          result += `**Task**: ${task}\n`;
          result += `**Agent**: ${agentName}\n`;
          result += `**Complexity**: ${complexity}\n`;
          result += `**Model**: \`${model}\` (free model — same for all complexities)\n\n`;

          result += `### Complexity Guidelines\n`;
          result += `- Trivial (typo, rename, format) — quick single-edit tasks\n`;
          result += `- Simple (single file, known pattern) — straightforward changes\n`;
          result += `- Medium (multi-file feature) — new components, API endpoints\n`;
          result += `- Complex (architecture, new system) — cross-stack, orchestration\n`;
          result += `- Research (external) — library evaluation, benchmarks\n\n`;

          result += `All complexities use the same free model (${model}). Complexity primarily affects agent routing and tool selection.`;
          return result;
        },
      }),
    },

    // Hook: Analyze incoming messages and suggest agent switching
    "chat.message": async ({
      agent,
      message,
    }: {
      agent?: string;
      message?: string;
      sessionID?: string;
      messageID?: string;
      variant?: string;
    }) => {
      // Skip if message is empty or starts with @ (agent mention)
      if (!message || message.startsWith("@") || message.startsWith("/")) return;

      // Only analyze substantial messages (more than 5 words)
      if (message.split(" ").length < 5) return;

      const matches = routeTask(message);
      if (matches.length > 0 && matches[0].agent !== agent) {
        console.log(`Suggested agent switch: ${agent} → ${matches[0].agent}`);
      }
    },
  };
};

export default AgentRouterPlugin;
