# OpenCode - AI Development Ecosystem

A complete AI-powered development environment featuring **12 specialized agents**, **63+ skills**, and **workflow orchestration** with intelligent routing, parallel execution, and MCP integration.

---

## Quick Start

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

# Or on Windows:
opencode.bat
```

### First Steps

1. **Switch to an agent**: `/agent backend-laravel`
2. **Get agent recommendation**: Ask "Which agent should handle Laravel auth?"
3. **Run commands**: `/build`, `/test`, `/lint`
4. **Use workflows**: Ask lead-strategist to "Add user authentication feature"

---

## Documentation

All documentation is centralized in the [`docs/`](docs/) folder:

| Document                                                                              | Description                                       |
| ------------------------------------------------------------------------------------- | ------------------------------------------------- |
| [**User-Guide.md**](docs/User-Guide.md)                                               | Basic usage, features, quick start                |
| [**Workflows-Guide.md**](docs/Workflows-Guide.md)                                     | Multi-agent workflow automation                   |
| [**Skills-Guide.md**](docs/Skills-Guide.md)                                           | 63+ specialized capabilities with MCP integration |
| [**Plugins-Guide.md**](docs/Plugins-Guide.md)                                         | 10+ plugins including agent-router                |
| [**Agents-Guide.md**](docs/Agents-Guide.md)                                           | Complete agent reference (12 agents)              |
| [**Agent-Loop-Guide.md**](docs/Agent-Loop-Guide.md)                                   | Iterative execution and retry patterns            |
| [**Prompting-Guide.md**](docs/Prompting-Guide.md)                                     | Effective prompt techniques                       |
| [**Prompting-and-Context-Engineering.md**](docs/Prompting-and-Context-Engineering.md) | Context engineering deep dive                     |

---

## Architecture

### Swarm Architecture

OpenCode uses a **Swarm Architecture** where specialized agents collaborate to solve problems:

```
lead-strategist (Orchestration)
├── Backend (api, laravel, tauri)
├── Frontend (ui-ux)
├── QA/DevOps (guardian, engineering)
├── Core (core-factory)
└── Docs (docs-curator)
```

### Agent Categories

| Category     | Agents                                      | Specialization                   |
| ------------ | ------------------------------------------- | -------------------------------- |
| **Core**     | core-factory                                | Core implementation              |
| **Lead**     | lead-strategist, software-architect             | Orchestration, Architecture      |
| **Backend**  | software-architect, backend-laravel, backend-tauri | API, Laravel, Tauri              |
| **Frontend** | frontend-ui-ux                              | UI/UX Engineering                |
| **QA**       | qa-guardian                                 | Review, Testing, Security, Debug |
| **DevOps**   | devops-engineer                             | Operations, MCP                  |
| **Docs**     | docs-curator                                | Writing, Governance, Evolution   |

---

## Features

### Workflow Orchestration

Complex multi-step tasks with advanced features:

```yaml
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

- **Parallel Execution**: `parallel_groups` for independent tasks
- **Retry Policies**: Configure `max_attempts` and backoff strategies
- **MCP Integration**: Declarative `mcp_tools` per phase
- **Performance Tracking**: Metrics in sqlite MCP
- **Security Scanning**: Automated vulnerability scans
- **Ambient LSP Feedback**: Automatic error detection after edits

### MCP Server Integration

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

### 63+ Specialized Skills

Skills provide domain-specific capabilities:

- **Development**: `laravel-feature-scaffold`, `fullstack-dev`, `stack-context`
- **Content**: `blog-writer`, `docs-governance-audit`, `deep-research`
- **Analysis**: `security-review`, `testing-strategy`, `database-design`
- **Automation**: `workflow-manager`, `self-improver`, `project-orchestration`
- **Media**: `pdf`, `ppt`, `xlsx`, `docx`, `image-generation`, `podcast-generate`
- **Research**: `market-research-reports`, `aminer-open-academic`, `ai-news-collectors`

---

## Project Structure

```
opencode/
├── opencode.json          # Main configuration
├── package.json           # Dependencies
├── README.md              # This file
├── CHANGELOG.md           # Release history
├── CONTRIBUTING.md        # Contribution guide
├── SECURITY.md            # Security policy
├── CODE_OF_CONDUCT.md     # Code of conduct
├── LICENSE                # MIT License
├── .gitignore             # Git exclusions
├── .env.example           # Environment template
├── tsconfig.json          # TypeScript config
├── vitest.config.ts       # Test configuration
│
├── agents/                # 12 specialized agent definitions
├── skills/                # 63+ specialized capabilities
├── plugins/               # 10+ TypeScript plugins
├── rules/                 # Code style guidelines
├── workflows/             # YAML workflow definitions
├── docs/                  # Centralized documentation
├── tools/                 # Utility scripts
├── scripts/               # Build & deployment scripts
├── .github/               # CI/CD workflows & templates
└── docs/adr/              # Architecture Decision Records
```

---

## Configuration

### Main Config: `opencode.json`

- **Model**: `opencode-go/kimi-k2.6` (default)
- **Providers**: opencode, lmstudio, opencode-go
- **Agents**: 12 custom agents with specialized tools
- **MCP Servers**: 8+ servers with timeouts
- **Plugins**: 10+ plugins (agent-router, model-router, etc.)
- **Permissions**: Granular tool permissions, sensitive file protection

### Launch Scripts

- **Primary**: `npm start` (recommended)
- **Cross-platform**: `opencode.bat` (Windows), `opencode.sh` (Unix/macOS)
- **JavaScript**: `node opencode-launch.js` (any platform)

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for detailed guidelines.

Quick reference:

- **Add a skill**: Create `skills/my-skill/SKILL.md`, register in `skills/index.json`
- **Add a plugin**: Create `plugins/my-plugin.ts`, register in `opencode.json`
- **Add a workflow**: Create `workflows/my-workflow.yaml` with v2.0.0 schema
- **Run tests**: `npm test` (Vitest suite)

---

## Performance & Cleanliness

- Root directory with ~15 essential files
- Build artifacts and dependencies in `.gitignore`
- Centralized documentation in `docs/`
- Consistent structure with clear separation of concerns

---

## License

MIT License - See [LICENSE](LICENSE) file for details.

---

## Support

- **Documentation**: Check [`docs/`](docs/) folder
- **Issues**: Report bugs via GitHub Issues
- **Discussions**: Join community discussions

---

**Last Updated**: 2026-05-08
**Version**: 2.0.0 (Workflow Orchestration)
