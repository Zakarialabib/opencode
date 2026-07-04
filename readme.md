# OpenCode - AI Development Ecosystem

A complete AI-powered development environment featuring **19 specialized agents**, **46 skills**, and **workflow orchestration** with intelligent routing, parallel execution, and MCP integration.

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

| Document                                                                              | Description                                      |
| ------------------------------------------------------------------------------------- | ------------------------------------------------ |
| [**User-Guide.md**](docs/User-Guide.md)                                               | Basic usage, features, quick start               |
| [**Workflows-Guide.md**](docs/Workflows-Guide.md)                                     | Multi-agent workflow automation                  |
| [**Skills-Guide.md**](docs/Skills-Guide.md)                                           | 46 specialized capabilities with MCP integration |
| [**Plugins-Guide.md**](docs/Plugins-Guide.md)                                         | 11 plugins including agent-router                |
| [**Agents-Guide.md**](docs/Agents-Guide.md)                                           | Complete agent reference (19 agents)             |
| [**Agent-Loop-Guide.md**](docs/Agent-Loop-Guide.md)                                   | Iterative execution and retry patterns           |
| [**Prompting-Guide.md**](docs/Prompting-Guide.md)                                     | Effective prompt techniques                      |
| [**Prompting-and-Context-Engineering.md**](docs/Prompting-and-Context-Engineering.md) | Context engineering deep dive                    |

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

| Category     | Agents                                                             | Specialization                            |
| ------------ | ------------------------------------------------------------------ | ----------------------------------------- |
| **Core**     | core-factory, plan, explore, scout                                 | Implementation, analysis, search          |
| **Lead**     | lead-strategist, software-architect                                | Orchestration, Architecture               |
| **Backend**  | software-architect, backend-laravel, backend-tauri, android-kotlin | API, Laravel, Tauri, Android              |
| **Frontend** | frontend-ui-ux                                                     | UI/UX Engineering                         |
| **QA**       | qa-guardian, integration-test, mobile-qa, code-reviewer            | Testing, Security, Debug, Audit           |
| **DevOps**   | devops-engineer                                                    | Operations, MCP                           |
| **Docs**     | docs-curator, docs-evolver                                         | Writing, Governance, ADRs, Changelog      |
| **Research** | research-analyst, refactor-architect                               | Best-practices, refactoring, dependencies |

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

### 46 Specialized Skills

Skills provide domain-specific capabilities:

- **Development**: `laravel-feature-scaffold`, `stack-context`, `database-design`
- **Content**: `docs-governance-audit`, `deep-research`, `knowledge-architect`
- **Analysis**: `security-review`, `testing-strategy`, `react-reuse-audit`
- **Automation**: `workflow-manager`, `self-improver`, `spec-driven-design`
- **Media**: `pdf`, `ppt`, `xlsx`, `docx`, `charts`
- **Research**: `web-search`, `web-reader`, `multi-search-engine`

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
├── agents/                # 19 specialized agent definitions
├── skills/                # 46 specialized capabilities
├── plugins/               # 11 TypeScript plugins
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

- **Model**: `opencode/deepseek-v4-flash-free` (default)
- **Providers**: opencode (primary), lmstudio (optional), openrouter (optional)
- **Agents**: 19 custom agents with specialized permissions
- **MCP Servers**: 12 servers with timeouts
- **Plugins**: 11 plugins (agent-router, memory-context, project-initializer, etc.)
- **Permissions**: Granular tool permissions, sensitive file protection

## Working on External Projects

OpenCode works on **any** project — Tauri desktop apps, Laravel APIs, React SPAs, Solid apps, Livewire dashboards, or plain PHP. The first step is always **stack detection**: agents read `package.json`, `Cargo.toml`, `composer.json` to determine the stack, then route to the correct specialists.

### Step 1: Stack Detection (automatic)

```bash
# Tell agents the project path — they detect the rest
@explore Map the project at C:\Projects\my-app.
Read the root: package.json, Cargo.toml, composer.json — which exist?
List top-level directories.
```

**Detection logic** (agents do this automatically):

| Manifest found               | Stack detected              | Router to                              |
| ---------------------------- | --------------------------- | -------------------------------------- |
| `Cargo.toml` + `tauri`       | Tauri desktop app           | `@backend-tauri` + `@frontend-ui-ux`   |
| `composer.json` + `laravel`  | Laravel web app             | `@backend-laravel`                     |
| `composer.json` + `livewire` | Livewire app                | `@backend-laravel` + `@frontend-ui-ux` |
| `package.json` + `react`     | React SPA                   | `@frontend-ui-ux`                      |
| `package.json` + `solid`     | Solid.js SPA                | `@frontend-ui-ux`                      |
| `composer.json` only         | Plain PHP project           | `@backend-laravel`                     |
| multiple manifests           | Hybrid (e.g. Tauri+Laravel) | Multiple agents in sequence            |

### Step 2: Generic Workflow (works for any stack)

Once the stack is known, the workflow is the same — only the agents change:

```
DISCOVERY → PLAN → IMPLEMENT (backend) → IMPLEMENT (frontend) → REVIEW → TEST
```

Here's how the same task looks across different stacks:

#### Tauri + React (desktop app detected from Cargo.toml + package.json)

```bash
@backend-tauri Add a Tauri command 'export_csv' to C:\Projects\my-app.
Read src-tauri/src/ for existing command patterns.
Return Result<String, String>.

@frontend-ui-ux Add an "Export CSV" button in C:\Projects\my-app.
Read src/components/ for existing patterns.
Use @tauri-apps/api invoke to call the Rust command.
```

#### Laravel + Livewire (web app detected from composer.json)

```bash
@backend-laravel Add a CSV export endpoint to C:\Projects\my-app.
Create a controller, route, and FormRequest.
Use Laravel Excel or streamed response.
Run php artisan pint.

@frontend-ui-ux Add an export button to the Livewire component.
Read existing Blade/Livewire patterns.
Wire to the export endpoint.
```

#### React SPA (frontend-only detected from package.json)

```bash
@frontend-ui-ux Add a CSV export feature to C:\Projects\my-app.
Read src/api/ for existing API client patterns.
Create the download function, error handling, loading state.
Use the existing button component style.
Run npm run typecheck.
```

#### Hybrid — Tauri backend + Laravel API

```bash
# Backend API (Laravel)
@backend-laravel Create the export endpoint in C:\Projects\my-api.
# Desktop shell (Tauri)
@backend-tauri Call the API from Rust via reqwest in C:\Projects\my-app.
# Frontend (React)
@frontend-ui-ux Add the export UI in C:\Projects\my-app.
```

### Step 3: Key Agent Routing by Stack

| Task                 | Tauri+React app           | Laravel+Livewire app      | React SPA             |
| -------------------- | ------------------------- | ------------------------- | --------------------- |
| **Codebase map**     | `@explore`                | `@explore`                | `@explore`            |
| **Feature plan**     | `@lead-strategist`        | `@lead-strategist`        | `@lead-strategist`    |
| **Backend work**     | `@backend-tauri` (Rust)   | `@backend-laravel` (PHP)  | `@software-architect` |
| **Frontend work**    | `@frontend-ui-ux` (React) | `@frontend-ui-ux` (Blade) | `@frontend-ui-ux`     |
| **Code review**      | `@code-reviewer`          | `@code-reviewer`          | `@code-reviewer`      |
| **Run tests**        | `@integration-test`       | `@integration-test`       | `@integration-test`   |
| **Quality/security** | `@qa-guardian`            | `@qa-guardian`            | `@qa-guardian`        |

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

**Last Updated**: 2026-07-04
**Version**: 2.1.0 (Spec-Driven Harness)
