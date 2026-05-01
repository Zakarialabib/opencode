# 🌌 OpenCode User Guide

Welcome to the **OpenCode** ecosystem. This guide will help you navigate the agentic framework, leverage built-in skills, and automate your development workflow.

---

## 🧭 Navigation

| Section                                      | Description                                        |
| :------------------------------------------- | :------------------------------------------------- |
| [**👥 Engineering Team**](Agents-Guide.md)   | Meet your 19 domain-specialized AI agents.         |
| [**⚡ Workflows Guide**](Workflows-Guide.md) | Automate complex tasks with multi-agent workflows. |
| [**🔌 Plugins Guide**](Plugins-Guide.md)     | Extend OpenCode with the LM Studio plugin.         |
| [**🛠️ Skills Guide**](Skills-Guide.md)       | Deep dive into specialized capabilities and tools. |

---

## 🚀 Getting Started

OpenCode uses a **Swarm Architecture** where 19 specialized agents collaborate to solve problems.

### Core Philosophy

1. **Plan Before Action**: Use `core-planner` or `lead-orchestrator` for analysis before major changes.
2. **Specialization Wins**: Use the right agent for the right task (e.g., `backend-laravel` for PHP, `frontend-ui-ux` for CSS).
3. **Continuous Improvement**: The `docs-evolver` agent uses the `self-improver` skill to learn from your codebase.

### Quick Start

```bash
# Switch to a specific agent
/agent backend-laravel

# Run a command (delegates to configured agent)
/build          # Runs npm build via core-builder
/test           # Runs test suite via qa-tester
/lint           # Runs linter via qa-reviewer
/reflect        # Triggers self-reflection via docs-evolver
```

---

## 🛠️ Essential Tools

OpenCode integrates several high-performance tools:

- **MCP Servers**: context7 (docs), filesystem, memory, git, fetch, sqlite, sequential-thinking, language-server
- **LSP Integration**: Real-time code analysis via rust-analyzer, TypeScript LSP, PHP Intelephense
- **Auto-Formatters**: Built-in support for Biome (JS/TS) and Prettier (CSS/HTML/MD)

---

## 💡 Quick Tips

- **@[docs]**: Mention this to give agents access to the documentation directory.
- **Self-Improvement**: Use `/reflect` or ask `docs-evolver` to analyze and improve configuration.
- **Context7**: Automatically fetches up-to-date documentation for Tauri, React, Laravel via `stack-context` skill.
- **Task Tool**: The `lead-orchestrator` uses SubAgent delegation for complex multi-step tasks.

---

## 🎯 Model Configuration

- **Default Model**: `opencode/hy3-preview-free` (fast implementation)
- **Reasoning Model**: `opencode/hy3-review-free` (used by `lead-orchestrator` for complex planning)

---

> [!TIP]
> Need help with a specific stack? Check out the [**Skills Guide**](Skills-Guide.md) to see how OpenCode auto-detects your project type via the `stack-context` skill.
