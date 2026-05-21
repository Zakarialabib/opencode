# 🌌 OpenCode User Guide

Welcome to the **OpenCode** ecosystem. This guide helps you navigate the agentic framework, leverage built-in skills, plugins, and automate your development workflow.

---

## 🧭 Navigation

| Section                                                            | Description                                                             |
| ------------------------------------------------------------------ | ----------------------------------------------------------------------- |
| [**👥 Agents Guide**](Agents-Guide.md)                             | Meet your 10 configured AI agents with intelligent routing              |
| [**⚡ Workflows Guide**](Workflows-Guide.md)                       | Automate complex tasks with multi-agent workflows                       |
| [**🔌 Plugins Guide**](Plugins-Guide.md)                           | Extend OpenCode with 11 plugins including agent-router and MCP managers |
| [**🛠️ Skills Guide**](Skills-Guide.md)                             | Deep dive into specialized capabilities with MCP integration            |
| [**💬 Prompting Guide**](Prompting-Guide.md)                       | Master the art of prompting agents for maximum productivity             |
| [**🧠 Context Engineering**](Prompting-and-Context-Engineering.md) | MVI philosophy and plan-first workflows                                 |
| [**🔄 Agent Loop Guide**](Agent-Loop-Guide.md)                     | Iterative execution and self-improvement patterns                       |

---

## 🚀 Getting Started

OpenCode uses specialized agents configured in `opencode.json` to handle different aspects of software development.

### Core Philosophy

1. **Plan Before Action**: Use `lead-strategist` or `lead-architect` for analysis before major changes (uses Sequential Thinking MCP)
2. **Specialization Wins**: Use the right agent for the right task (e.g., `backend-laravel` for PHP, `frontend-ui-ux` for CSS)
3. **Intelligent Routing**: The `agent-router` plugin automatically recommends the best agent
4. **Workflow Automation**: Use `workflow-manager` skill for complex multi-step tasks with MCP integration
5. **Continuous Improvement**: The `docs-curator` agent uses `self-reflection` and `self-improver` skills

### Quick Start

```bash
# Switch to a specific agent
/agent backend-laravel

# Let the system recommend an agent (agent-router plugin)
Ask: "Which agent should handle Laravel authentication?"
→ Returns: 🎯 Recommended Agent: **backend-laravel** (score: 8)

# Run commands (delegated to configured agents)
/build          # Runs npm build via core-factory
/test           # Runs test suite via qa-guardian
/lint           # Runs linter checks via qa-guardian
/reflect        # Triggers self-reflection via docs-curator
/audit          # Full project audit: lint + tests via qa-guardian
/clean          # Clean project caches via devops-engineer
/db:init        # Initialize database via devops-engineer
/db:backup      # Backup database via devops-engineer
/process:check  # Check process health via devops-engineer
```

---

## 🛠️ Essential Tools

### MCP Servers (9 configured)

| Server                | Purpose                                    | Timeout |
| --------------------- | ------------------------------------------ | ------- |
| `context7`            | Up-to-date documentation and code examples | 60s     |
| `filesystem`          | File system operations                     | 30s     |
| `memory`              | Persistent knowledge graph                 | 15s     |
| `git`                 | Git repository operations                  | 20s     |
| `fetch`               | Web content fetching                       | 15s     |
| `sqlite`              | SQLite database operations                 | 15s     |
| `sequential-thinking` | Step-by-step reasoning                     | 30s     |
| `language-server`     | LSP integration                            | 20s     |
| `type-inject`         | TypeScript type injection                  | 20s     |

Use `mcp_list` to view all servers, `mcp_check` for health status, `mcp_toggle` to enable/disable.

### LSP Integration

Real-time code analysis via rust-analyzer, TypeScript LSP, PHP Intelephense, Tailwind CSS.

### Auto-Formatters

Built-in support for Biome (JS/TS), Prettier (CSS/HTML/MD), Pint (PHP), rustfmt (Rust), shfmt (Shell).

---

## 🎯 Model Configuration

| Provider                  | Models                                          |
| ------------------------- | ----------------------------------------------- |
| **opencode-go** (default) | `kimi-k2.6`, `glm-5.1`, `qwen3.6-plus`          |
| **cerebras**              | `qwen-3-235b-a22b-instruct-2507`, `zai-glm-4.7` |
| **lmstudio** (local)      | `qwen3.5-4b`, `gemma-4-e4b-it`, `gemma-3n-e4b`  |
| **opencode**              | `hy3-preview-free`                              |

Use `recommend_model` to get model suggestions based on your requirements (tool calling, reasoning).

---

## ⚡ Performance Optimization

OpenCode includes autonomous optimization capabilities via the `/autoresearch` command. This feature uses AI agents to iteratively optimize your code and measure improvements.

### Using /autoresearch

The `/autoresearch` command can optimize any HTML, JS, or CSS file with measurable performance metrics:

```bash
# Optimize a single file
/autoresearch docs/portal.html

# The system will:
# 1. Read docs/program.md for optimization instructions
# 2. Start Bun server (bun benchmark.js)
# 3. Run experiment loops (modify → benchmark → measure)
# 4. Keep improvements (git commit) or revert failures (git reset)
```

### Case Study: portal.html (37.5% Improvement)

| Phase                      | Load Time | Improvement |
| -------------------------- | --------- | ----------- |
| **Baseline**               | 0.8ms     | -           |
| **Exp 1: Fix invalid CSS** | 0.6ms     | 25%         |
| **Exp 2: Minify CSS**      | 0.5ms     | 37.5%       |

**Key Results**:

- Target was 20% improvement - achieved 37.5%
- 2 experiments completed in ~10 minutes
- All functionality preserved (nav, markdown rendering, callouts)

### Custom Benchmarks

Create a `benchmark.js` file for custom metrics:

```javascript
// benchmark.js - Bun server benchmark
const server = Bun.serve({
  port: 3000,
  fetch(request) {
    return Bun.file("your-file.html");
  },
});

// Measure load time over 50 samples
const samples = 50;
let totalTime = 0;
for (let i = 0; i < samples; i++) {
  const start = performance.now();
  await fetch("http://localhost:3000/your-file.html");
  totalTime += performance.now() - start;
}

console.log(
  JSON.stringify({
    load_time_ms: Number((totalTime / samples).toFixed(1)),
    samples: samples,
  })
);
server.stop();
```

Run with: `bun benchmark.js`

### Best Practices

1. **Define clear metrics** in `program.md` (load time, bundle size, etc.)
2. **Use Bun server** for accurate local benchmarking
3. **Set 20% improvement target** as a reasonable goal
4. **Review experiments** via `git log` on `autoresearch/` branch
5. **Keep program.md immutable** - only the target file should be modified

> [!TIP]
> See `docs/program.md` for a complete template and `skills/autoresearch/SKILL.md` for detailed documentation.

---

## 💡 Quick Tips

- **Agent Routing**: Use `route_agent "your task"` to get intelligent agent recommendations
- **Model Selection**: Use `recommend_model` to find the best model for your requirements
- **Skill Search**: Use `skill_search query:"keyword"` to discover relevant skills
- **MCP Management**: Use `mcp_list` and `mcp_check` to monitor MCP server health
- **Context Configuration**: Use `context_view` to see current context patterns, `context_add_include` to add more
- **Self-Improvement**: Use `/reflect` or ask `docs-curator` to analyze and improve configuration
- **Web Version**: Access at `http://127.0.0.1:59596/` when running `opencode web`

---

## 🔗 Plugin Ecosystem (12 plugins)

| Plugin                        | Purpose                                                                                                    |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `agent-router.ts`             | Intelligent task-to-agent routing                                                                          |
| `model-router.ts`             | Smart model selection based on capabilities                                                                |
| `mcp-manager.ts`              | MCP server health and toggle management                                                                    |
| `skill-manager.ts`            | Skill registry access and search                                                                           |
| `context-manager.ts`          | Dynamic context configuration                                                                              |
| `index.ts`                    | LM Studio management + self-improvement                                                                    |
| `brain-plugin/brain.ts`       | **RAG engine**: auto-index, hybrid search (keyword+dense+sparse), intent-aware reranking, codebase context |
| `jsonc-utils.ts`              | Shared JSONC parser (comment-safe)                                                                         |
| `extension-context-bridge.ts` | Trae IDE extension bridge                                                                                  |
| `language-context-bridge.ts`  | LSP integration bridge                                                                                     |
| `process-monitor.ts`          | Process monitoring                                                                                         |

> The **Brain Plugin** provides RAG-powered codebase context: auto-indexes your project, embeds code with LM Studio, and injects relevant chunks into LLM prompts. See [**Brain Plugin Docs**](brain-plugin-docs.md) for details.

> See [**Plugins Guide**](Plugins-Guide.md) for complete details.

---

> [!TIP]
> Need help with a specific stack? Check the [**Skills Guide**](Skills-Guide.md) to see how OpenCode auto-detects your project type. Use `route_agent` to let the system recommend the best agent for your task.
