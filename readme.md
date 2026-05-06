# 🚀 OpenCode - AI Development Ecosystem

A complete AI-powered development environment featuring **19 specialized agents**, **40+ skills**, and **v2.0.0 workflow orchestration** with intelligent routing, parallel execution, and MCP integration.

---

## 📋 Table of Contents

- [Quick Start](#-quick-start)
- [Documentation](#-documentation)
- [Architecture](#-architecture)
- [Features](#-features)
- [Project Structure](#-project-structure)
- [Contributing](#-contributing)

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18+ with npm
- **lmstudio** (optional, for local models)
- **OpenCode CLI** installed globally

### Launch OpenCode

```bash
# Install dependencies
npm install

# Start OpenCode (recommended method)
npm start

# Or use the PowerShell script directly
./opencode-launch.ps1
```

### First Steps

1. **Switch to an agent**: `/agent backend-laravel`
2. **Get agent recommendation**: Ask "Which agent should handle Laravel auth?"
3. **Run commands**: `/build`, `/test`, `/lint`
4. **Use workflows**: Ask lead-strategist to "Add user authentication feature"

---

## 📚 Documentation

All documentation is centralized in the [`docs/`](docs/) folder:

| Document                                          | Description                                       |
| ------------------------------------------------- | ------------------------------------------------- |
| [**User-Guide.md**](docs/User-Guide.md)           | Basic usage, v2.0.0 features, quick start         |
| [**Workflows-Guide.md**](docs/Workflows-Guide.md) | Multi-agent workflow automation (v2.0.0)          |
| [**Skills-Guide.md**](docs/Skills-Guide.md)       | 40+ specialized capabilities with MCP integration |
| [**Plugins-Guide.md**](docs/Plugins-Guide.md)     | 10+ plugins including agent-router                |
| [**Agents-Guide.md**](docs/Agents-Guide.md)       | Complete agent reference (19 agents)              |
| [**Prompting-Guide.md**](docs/Prompting-Guide.md) | Effective prompt techniques                       |

### 🌟 What's New in v2.0.0?

- **Parallel Execution**: `parallel_groups` for independent tasks
- **Retry Policies**: Configurable `retry_policy` (max_attempts, backoff)
- **MCP Integration**: Declarative `mcp_tools` per workflow phase
- **Performance Tracking**: Metrics stored in sqlite MCP
- **Security Scanning**: Automated vulnerability scans on specified phases
- **Agent Router**: `use_agent_router: true` for automatic task-to-agent routing

---

## 🏗️ Architecture

### Swarm Architecture

OpenCode uses a **Swarm Architecture** where 19 specialized agents collaborate to solve problems:

```
┌─────────────────────────────────────────────────────────┐
│                   lead-strategist                      │
│         (Engineering Lead - Task Delegation)            │
└────────────────┬──────────────────────────┬────────────┘
                 │                          │
         ┌───────┴───────┐         ┌─────┴───────┐
         │   Backend      │         │   Frontend    │
         │   Agents (5)   │         │   Agents (1)  │
         └───────┬───────┘         └─────┬───────┘
                 │                          │
         ┌───────┴───────┐         ┌─────┴───────┐
         │  QA/Testing    │         │   DevOps     │
         │  Agents (4)    │         │   Agents (2)  │
         └───────┬───────┘         └─────┬───────┘
                 │                          │
         ┌───────┴──────────────────┴───────┐
         │        Core & Planning Agents (4)    │
         │   (core-builder, core-planner,      │
         │    lead-architect, lead-product)    │
         └──────────────────────────────────────┘
                 │
         ┌───────┴───────┐
         │  Docs Agents (3) │
         └─────────────────┘
```

### Agent Categories

| Category     | Agents                                                       | Specialization                     |
| ------------ | ------------------------------------------------------------ | ---------------------------------- |
| **Core**     | core-builder, core-planner                                   | Implementation, Strategic Planning |
| **Lead**     | lead-strategist, lead-architect                              | Orchestration, Architecture        |
| **Backend**  | backend-api, backend-laravel, backend-tauri, backend-systems | API, Laravel, Tauri, Systems       |
| **Frontend** | frontend-ui-ux                                               | UI/UX Engineering                  |
| **QA**       | qa-reviewer, qa-tester, qa-security, qa-debugger             | Review, Testing, Security, Debug   |
| **DevOps**   | devops-ops, devops-mcp                                       | Operations, MCP Specialist         |
| **Docs**     | docs-writer, docs-governor, docs-evolver                     | Writing, Governance, Evolution     |

---

## ✨ Features

### 🎯 Intelligent Agent Routing

The **agent-router plugin** automatically recommends the best agent for your task:

```bash
Ask lead-strategist: "Which agent should handle Laravel authentication?"
→ Returns: 🎯 Recommended Agent: **backend-laravel** (score: 8 points)
```

### 🔄 Workflow Orchestration v2.0.0

Complex multi-step tasks with advanced features:

```yaml
# feature-development.yaml (v2.0.0)
phases:
  - name: Strategy & Analysis
    use_agent_router: true
    mcp_tools:
      context7: [fetch_library_docs]
      memory: [create_entities]
    parallel_groups:
      - [research_auth_methods, analyze_existing_patterns]
```

**Key Features:**

- ✅ **Parallel Execution**: `parallel_groups` for independent tasks
- ✅ **Retry Policies**: Configure `max_attempts` and backoff strategies
- ✅ **MCP Integration**: Declarative `mcp_tools` per phase
- ✅ **Performance Tracking**: Metrics in sqlite MCP
- ✅ **Security Scanning**: Automated vulnerability scans

### 🔌 MCP Server Integration

8+ Model Context Protocol servers for enhanced capabilities:

| Server                | Purpose                    | Timeout |
| --------------------- | -------------------------- | ------- |
| `context7`            | Up-to-date documentation   | 30s     |
| `filesystem`          | File system operations     | 15s     |
| `memory`              | Persistent knowledge graph | 10s     |
| `git`                 | Git repository operations  | 20s     |
| `fetch`               | Web content fetching       | 15s     |
| `sqlite`              | SQLite database operations | 10s     |
| `sequential-thinking` | Step-by-step reasoning     | 30s     |
| `language-server`     | LSP integration            | 20s     |

### 🛠️ 40+ Specialized Skills

Skills provide domain-specific capabilities:

- **Development**: `laravel-feature-scaffold`, `fullstack-dev`, `stack-context`
- **Content**: `blog-writer`, `docs-governance-audit`, `deep-research`
- **Analysis**: `security-review`, `testing-strategy`, `database-design`
- **Automation**: `workflow-manager`, `self-improver`, `project-orchestration`
- **Media**: `pdf`, `ppt`, `xlsx`, `docx`, `image-generation`, `podcast-generate`
- **Research**: `market-research-reports`, `aminer-open-academic`, `ai-news-collectors`

---

## 📁 Project Structure

Clean, organized structure following web best practices:

```
opencode/
├── opencode.json          # Main configuration (agents, tools, plugins, MCP)
├── package.json           # Dependencies
├── README.md              # This file
├── .gitignore            # Git exclusions
├── biome.json            # Formatter config
├── .prettierrc           # Formatter config
├── config-schema.json    # Config validation
├── database.sqlite       # Persistent state
├── tui.json              # TUI config
│
├── agents/                # 19 specialized agent definitions
│   ├── lead-strategist.md
│   ├── backend-laravel.md
│   └── ... (17 more)
│
├── skills/                # 40+ specialized capabilities
│   ├── workflow-manager/  # v2.0.0 workflow orchestration
│   ├── agent-browser/     # Browser automation
│   └── ... (38 more)
│
├── plugins/               # 10+ TypeScript plugins
│   ├── agent-router.ts    # Intelligent task-to-agent routing
│   ├── model-router.ts    # Smart model selection
│   └── ... (8 more)
│
├── rules/                 # Code style guidelines
│   ├── laravel.md
│   ├── react.md
│   └── ... (4 more)
│
├── workflows/             # YAML workflow definitions (v2.0.0)
│   ├── feature-development.yaml
│   └── bug-fix.yaml
│
├── docs/                  # Centralized documentation
│   ├── User-Guide.md
│   ├── Workflows-Guide.md
│   └── ... (14 more)
│
├── tools/                 # Utility scripts
│   ├── config-optimizer.ts
│   └── db-query.ts
│
└── scripts/               # Build & deployment scripts
    ├── check-updates.ps1
    └── db-backup.ps1
```

**Total:** ~15 essential files in root (reduced from 20+ via cleanup)

---

## 🔧 Configuration

### Main Config: `opencode.json`

- **Model**: `opencode-go/kimi-k2.6` (default)
- **Providers**: opencode, lmstudio, cerebras, opencode-go
- **Agents**: 19 custom agents with specialized tools
- **MCP Servers**: 8+ servers with timeouts
- **Plugins**: 10+ plugins (agent-router, model-router, etc.)
- **Permissions**: Granular tool permissions, sensitive file protection

### Launch Scripts

- **Primary**: `npm start` (recommended)
- **Alternative**: `opencode-launch.ps1` (Windows PowerShell)

---

## 🤝 Contributing

### Adding a New Skill

1. Create skill directory: `skills/my-skill/`
2. Add `SKILL.md` with description and usage
3. Register in `skills/index.json`
4. Assign to appropriate agents

### Adding a New Plugin

1. Create plugin file: `plugins/my-plugin.ts`
2. Export Plugin function with hooks and tools
3. Register in `opencode.json` under `"plugin"`

### Workflow Contribution

1. Create YAML: `workflows/my-workflow.yaml`
2. Use v2.0.0 schema (`use_agent_router`, `parallel_groups`, etc.)
3. Document in `docs/Workflows-Guide.md`

---

## 📈 Performance & Cleanliness

Based on web best practices for codebase hygiene:

- ✅ **Reduced Clutter**: Root directory cleaned from 20+ to ~15 essential files
- ✅ **Duplicate Removal**: Eliminated redundant launch scripts
- ✅ **Build Artifacts**: Removed `.cache/`, `node_modules/` in `.gitignore`
- ✅ **Centralized Docs**: All documentation in `/docs/` folder
- ✅ **Consistent Structure**: Clear separation of concerns

> "The compound effect of cleanliness: After cleanup, new developers became productive in days instead of weeks." - Codebase Hygiene Best Practices

---

## 📄 License

MIT License - See LICENSE file for details (if applicable).

---

## 🆘 Support

- **Documentation**: Check [`docs/`](docs/) folder
- **Issues**: Report bugs via GitHub Issues
- **Discussions**: Join community discussions

---

**Last Updated**: 2026-05-06  
**Version**: 2.0.0 (Workflow Orchestration)  
**Clean Architecture**: ✅ Applied (15 essential root files)
