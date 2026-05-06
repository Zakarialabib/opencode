# 🌌 OpenCode User Guide

Welcome to the **OpenCode** ecosystem. This guide will help you navigate the agentic framework, leverage built-in skills, plugins, and automate your development workflow.

---

## 🧭 Navigation

| Section                                      | Description                                                               |
| :------------------------------------------- | :------------------------------------------------------------------------ |
| [**👥 Engineering Team**](Agents-Guide.md)   | Meet your 10 configured AI agents with intelligent routing.               |
| [**⚡ Workflows Guide**](Workflows-Guide.md) | Automate complex tasks with multi-agent workflows.                        |
| [**🔌 Plugins Guide**](Plugins-Guide.md)     | Extend OpenCode with 10+ plugins including agent-router and MCP managers. |
| [**🛠️ Skills Guide**](Skills-Guide.md)       | Deep dive into 16 specialized capabilities with MCP integration.          |

---

## 🚀 Getting Started

OpenCode uses specialized agents configured in `opencode.json` to handle different aspects of software development, with intelligent routing and workflow orchestration.

### Core Philosophy

1. **Plan Before Action**: Use `lead-strategist` or `lead-architect` for analysis before major changes (uses sequential-thinking MCP).
2. **Specialization Wins**: Use the right agent for the right task (e.g., `backend-laravel` for PHP, `frontend-ui-ux` for CSS).
3. **Intelligent Routing**: The `agent-router` plugin automatically recommends the best agent.
4. **Workflow Automation**: Use `workflow-manager` skill for complex multi-step tasks with parallel execution and MCP integration.
5. **Continuous Improvement**: The `docs-curator` agent uses the `self-reflection` and `self-improver` skills to learn from your codebase.

### Quick Start

```bash
# Switch to a specific agent
/agent backend-laravel

# Let the system recommend an agent (agent-router plugin)
Ask: "Which agent should handle Laravel authentication?"
→ Returns: 🎯 Recommended Agent: **backend-laravel** (score: 8 points)

# Run a command (delegates to configured agent)
/build          # Runs npm build via core-factory
/test           # Runs test suite via qa-guardian
/lint           # Runs linter checks via qa-guardian
/reflect        # Triggers self-reflection via docs-curator

# Use workflow manager for complex tasks
Ask lead-strategist: "Add user authentication feature"
→ Loads feature-development.yaml
→ Phase 1: Strategy & Analysis (agent-router + context7 MCP)
→ Phase 2: Design & Planning (parallel_groups: backend + frontend)
→ Phase 3: Implementation (retry_policy: 3 attempts)
→ Phase 4: QA & Security (security scanning enabled)
→ Phase 5: Documentation & Evolution

# Check workflow status
Ask lead-strategist: "Show workflow performance metrics"
→ Returns: time_to_complete, success_rate, token_usage from sqlite MCP
```

---

## 🛠️ Essential Tools

OpenCode integrates several high-performance tools:

### MCP Servers (9 configured)

Configured in `opencode.json` with timeouts to prevent hanging:

| Server                | Purpose                                    | Timeout |
| --------------------- | ------------------------------------------ | ------- |
| `context7`            | Up-to-date documentation and code examples | 60s     |
| `filesystem`          | File system operations                     | 30s     |
| `memory`              | Persistent knowledge graph                 | 15s     |
| `git`                 | Git repository operations                  | 20s     |
| `fetch`               | Web content fetching                       | 15s     |
| `sqlite`              | SQLite database operations                 | 15s     |
| `sequential-thinking` | Step-by-step reasoning (MCP)               | 30s     |
| `language-server`     | LSP integration                            | 20s     |
| `type-inject`         | Type injection for PHP                     | 20s     |

All MCP servers are managed via the `mcp-manager` plugin (`mcp_list`, `mcp_check`, `mcp_toggle` tools).

### LSP Integration

Real-time code analysis via rust-analyzer, TypeScript LSP, PHP Intelephense

### Auto-Formatters

Built-in support for Biome (JS/TS), Prettier (CSS/HTML/MD), Pint (PHP), rustfmt (Rust), shfmt (Shell)

---

## 💡 Quick Tips

- **@[docs]**: Mention this to give agents access to the documentation directory.
- **Self-Improvement**: Use `/reflect` or ask `docs-curator` to analyze and improve configuration.
- **Context7**: Automatically fetches up-to-date documentation for Tauri, React, Laravel via `stack-context` skill.
- **Task Tool**: The `lead-strategist` uses SubAgent delegation for complex multi-step tasks.
- **Agent Routing**: Use `route_agent` tool to get intelligent agent recommendations based on task analysis.
- **Model Selection**: Use `recommend_model` tool to find the best model for your specific requirements.
- **Skill Search**: Use `skill_search` tool to discover relevant skills for your task.
- **MCP Management**: Use `mcp_list` and `mcp_check` to monitor MCP server health and status.

---

## 🎯 Model Configuration

- **Default Model**: `opencode-go/kimi-k2.6` (fast implementation with tool support)
- **Reasoning Model**: `opencode-go/kimi-k2.6` (used by `lead-strategist` for complex planning)
- **Multiple Providers**: opencode, lmstudio, cerebras configured in `opencode.json`
- **Smart Routing**: Use `model-router` plugin to automatically select best model based on task requirements (tools, reasoning)

---

## 🔗 Integrated Systems

OpenCode's power comes from the integration of multiple systems with workflow orchestration.

### Agent Routing + Workflow Management

```
User: "Add authentication feature"
→ agent-router: Analyzes task, recommends backend-laravel (score: 8)
→ workflow-manager: Loads feature-development.yaml
→ Phase 1: Strategy & Analysis (use_agent_router: true, context7 MCP)
  → lead-strategist: Analyze patterns (sequential-thinking MCP)
  → parallel_group: [research auth methods, check users table]
→ Phase 2: Design & Planning (mcp_tools: sqlite, context7)
  → backend-laravel: Design schema (parallel with frontend-ui-ux)
→ Phase 3: Implementation (retry_policy: 3 attempts)
  → backend-laravel: Create models, routes (parallel execution)
→ Phase 4: QA & Security (security: scan for vulnerabilities)
  → qa-guardian: Vulnerability scan (git MCP for commit history)
→ Phase 5: Documentation & Evolution
  → docs-curator: Update docs (memory MCP for state persistence)
→ Result: Fully implemented, tested, and documented feature
```

### Plugin Ecosystem (10 plugins)

- **agent-router.ts**: Intelligent task-to-agent routing
- **model-router.ts**: Smart model selection based on capabilities (tools, reasoning)
- **mcp-manager.ts**: MCP server health and toggle management
- **skill-manager.ts**: Skill registry access and search
- **context-manager.ts**: Dynamic context configuration
- Plus 5 more plugins for IDE integration, LSP bridging, and process monitoring

### Workflow Features at a Glance

| Feature                  | Description                              | Enabled by             |
| ------------------------ | ---------------------------------------- | ---------------------- |
| `use_agent_router: true` | Auto-route tasks to best agent per phase | agent-router plugin    |
| `parallel_groups`        | Execute independent tasks concurrently   | Task tool (built-in)   |
| `retry_policy`           | Configure max_attempts and backoff       | Task tool (built-in)   |
| `mcp_tools`              | Declarative MCP tool usage per phase     | mcp-manager plugin     |
| `performance`            | Track metrics (time, success, tokens)    | sqlite MCP             |
| `security`               | Automated vulnerability scanning         | git MCP + qa-guardian  |
| `notifications`          | Webhook/Slack on phase completion        | External webhook/Slack |
| `exit_criteria`          | Define phase completion conditions       | Task tool (built-in)   |

---

> [!TIP]
> Need help with a specific stack? Check out the [**Skills Guide**](Skills-Guide.md) to see how OpenCode auto-detects your project type via the `stack-context` skill. Use `route_agent` to let the system recommend the best agent for your task.
