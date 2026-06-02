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

// Default agent routing rules - UPDATED to match consolidated agents
const DEFAULT_AGENT_RULES: AgentRule[] = [
  {
    agent: "strategist",
    keywords: [
      "orchestrate",
      "multi-agent",
      "delegate",
      "workflow",
      "coordinate",
      "complex",
      "strategy",
      "prd",
      "product",
      "scope",
      "roadmap",
      "milestone",
      "backlog",
      "user story",
      "acceptance criteria",
      "release notes",
      "plan",
      "explore",
      "scout",
      "research",
      "learn",
      "market",
      "seo"
    ],
    skills: ["workflow-manager", "project-orchestration", "task", "spec-driven-design", "portfolio-management", "self-reflection"],
    description: "Product and project strategy orchestrator — requirements scoping, plan decomposition, multi-agent coordination, and research curation"
  },
  {
    agent: "architect",
    keywords: [
      "architecture",
      "design",
      "system",
      "structure",
      "decision",
      "database",
      "schema",
      "security",
      "vulnerability",
      "secret",
      "leak",
      "audit",
      "csrf",
      "xss",
      "injection",
      "adr",
      "data model",
      "analytics",
      "retention",
      "warehouse",
      "etl",
      "reporting"
    ],
    skills: ["database-design", "self-reflection", "context7", "memory", "sequential-thinking", "security-review", "threat-modeling", "compliance-audit"],
    description: "Technical and security architect — structural pattern enforcement, schema designs, security audits, and ADR governance"
  },
  {
    agent: "developer",
    keywords: [
      "implement",
      "code",
      "edit",
      "modify",
      "build",
      "create file",
      "change",
      "fix",
      "pattern",
      "laravel",
      "php",
      "livewire",
      "eloquent",
      "artisan",
      "blade",
      "pest",
      "phpunit",
      "react",
      "typescript",
      "ui",
      "ux",
      "css",
      "tailwind",
      "component",
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
      "rust",
      "tauri",
      "desktop",
      "cargo",
      ".rs",
      "android",
      "kotlin",
      "compose",
      "gradle",
      "docs",
      "documentation",
      "guide",
      "write",
      "readme"
    ],
    skills: ["self-improver", "stack-context", "coding-agent", "laravel-feature-scaffold", "ui-ux-pro-max", "react-reuse-audit", "charts", "visual-design-foundations", "xlsx", "docx", "pdf", "ppt"],
    description: "Senior full-stack implementer — high-speed feature delivery, UI/UX premium designs, Tauri/desktop, Laravel/PHP, mobile native, and documentation"
  },
  {
    agent: "qa-devops",
    keywords: [
      "test",
      "testing",
      "coverage",
      "test suite",
      "quality",
      "bug",
      "debug",
      "error",
      "crash",
      "troubleshoot",
      "browser",
      "reproduce",
      "ops",
      "terminal",
      "deploy",
      "process",
      "operational",
      "git",
      "release",
      "mcp",
      "server",
      "integration",
      "mcp server",
      "incident",
      "outage",
      "alert",
      "p0",
      "p1",
      "hotfix",
      "mttr",
      "postmortem",
      "ci/cd",
      "pipeline",
      "cache"
    ],
    skills: ["testing-strategy", "git-release", "incident-triage", "post-mortem-authoring", "agent-browser", "pest-testing"],
    description: "Quality assurance & DevOps expert — E2E testing, CI/CD automation, environment administration, incident response, and security scanning"
  }
];
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
            return `No specific agent matched for task: "${task}". Defaulting to tpm-orchestrator for analysis.`;
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
