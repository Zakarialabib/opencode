import { Plugin, tool } from "@opencode-ai/plugin";

// Agent routing rules: maps keywords/patterns to agents
const AGENT_RULES = [
  {
    agent: "backend-laravel",
    keywords: ["laravel", "php", "livewire", "eloquent", "artisan", "blade", "pest", "phpunit"],
    skills: ["laravel-feature-scaffold"],
    description: "Laravel 13, Livewire 4, PHP 8.3 development",
  },
  {
    agent: "frontend-ui-ux",
    keywords: ["react", "typescript", "ui", "ux", "css", "tailwind", "component", "design", "html"],
    skills: ["ui-ux-pro-max", "react-reuse-audit"],
    description: "Premium UI/UX design and frontend development",
  },
  {
    agent: "backend-tauri",
    keywords: ["rust", "tauri", "desktop", "cargo", ".rs", "tauri app"],
    skills: ["stack-context"],
    description: "Rust and Tauri desktop application development",
  },
  {
    agent: "backend-api",
    keywords: ["api", "rest", "graphql", "prisma", "endpoint", "backend", "json:api"],
    skills: ["fullstack-dev"],
    description: "API design and implementation",
  },
  {
    agent: "qa-tester",
    keywords: [
      "test",
      "testing",
      "pest",
      "phpunit",
      "vitest",
      "cargo test",
      "coverage",
      "test suite",
    ],
    skills: ["testing-strategy"],
    description: "Test suite generation and automated verification",
  },
  {
    agent: "qa-security",
    keywords: ["security", "vulnerability", "secret", "leak", "audit", "csrf", "xss", "injection"],
    skills: ["security-review"],
    description: "Security vulnerability scanning and secret leak prevention",
  },
  {
    agent: "qa-reviewer",
    keywords: ["review", "code review", "standards", "performance", "refactor", "quality"],
    skills: ["react-reuse-audit"],
    description: "Senior code reviewer focusing on standards and performance",
  },
  {
    agent: "qa-debugger",
    keywords: ["bug", "debug", "error", "crash", "troubleshoot", "browser", "reproduce"],
    skills: ["agent-browser"],
    description: "Root cause analysis and browser-based troubleshooting",
  },
  {
    agent: "lead-architect",
    keywords: ["architecture", "design", "system", "structure", "decision", "database", "schema"],
    skills: ["database-design", "self-reflection"],
    description: "High-level system design and architectural decision making",
  },
  {
    agent: "lead-orchestrator",
    keywords: ["orchestrate", "multi-agent", "delegate", "workflow", "coordinate", "complex"],
    skills: ["workflow-manager", "project-orchestration"],
    description: "Senior project orchestrator managing complex multi-agent handoffs",
  },
  {
    agent: "core-builder",
    keywords: ["implement", "code", "edit", "modify", "build", "create file", "change", "fix"],
    skills: ["self-improver", "stack-context"],
    description: "High-speed implementation and direct file modification",
  },
  {
    agent: "core-planner",
    keywords: ["plan", "strategy", "analyze", "discover", "architecture discovery", "research"],
    skills: ["stack-context", "self-reflection"],
    description: "Read-only strategic planning and architectural discovery",
  },
  {
    agent: "docs-writer",
    keywords: ["docs", "documentation", "guide", "write", "content", "readme"],
    skills: ["deep-research"],
    description: "Technical documentation and content creation",
  },
  {
    agent: "docs-governor",
    keywords: ["governance", "audit docs", "standards", "documentation audit", "drift"],
    skills: ["docs-governance-audit"],
    description: "Documentation auditing and standard enforcement",
  },
  {
    agent: "docs-evolver",
    keywords: ["improve", "evolve", "self-improve", "research", "learn", "adapt"],
    skills: ["self-improver", "deep-research"],
    description: "System self-improvement and research-driven evolution",
  },
  {
    agent: "devops-ops",
    keywords: ["ops", "terminal", "deploy", "build", "process", "operational", "git", "release"],
    skills: ["git-release"],
    description: "Terminal execution and operational task runner",
  },
  {
    agent: "devops-mcp",
    keywords: ["mcp", "server", "integration", "tool integration", "mcp server"],
    skills: [],
    description: "MCP server research and tool integration expert",
  },
  {
    agent: "backend-systems",
    keywords: ["shell", "script", "infrastructure", "low-level", "system", "bash", "powershell"],
    skills: [],
    description: "Low-level systems, shell scripting, and infrastructure logic",
  },
];

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

const AgentRouterPlugin: Plugin = async ({ client, project, directory }) => {
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
            return `No specific agent matched for task: "${task}". Defaulting to lead-orchestrator for analysis.`;
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
    "chat.message": async ({ sessionID, agent, messageID, message }) => {
      // Skip if message is empty or starts with @ (agent mention)
      if (!message || message.startsWith("@") || message.startsWith("/")) return;

      // Only analyze substantial messages (more than 5 words)
      if (message.split(" ").length < 5) return;

      const matches = routeTask(message);
      if (matches.length > 0 && matches[0].agent !== agent) {
        await client.app.log({
          body: {
            service: "agent-router",
            level: "info",
            message: `Suggested agent switch: ${agent} → ${matches[0].agent}`,
            extra: { task: message.slice(0, 50), score: matches[0].score },
          },
        });
      }
    },
  };
};

export default AgentRouterPlugin;
