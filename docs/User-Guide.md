# 🌌 OpenCode User Guide

Welcome to the **OpenCode** ecosystem. This guide helps you navigate the agentic framework, leverage built-in skills, plugins, and automate your development workflow.

---

## 🧭 Navigation

| Section                                                            | Description                                                          |
| ------------------------------------------------------------------ | -------------------------------------------------------------------- |
| [**👥 Agents Guide**](Agents-Guide.md)                             | Meet your 19 configured AI agents with intelligent routing           |
| [**⚡ Workflows Guide**](Workflows-Guide.md)                       | Automate complex tasks with multi-agent workflows                    |
| [**🔌 Plugins Guide**](Plugins-Guide.md)                           | Extend OpenCode with plugins including agent-router and MCP managers |
| [**🛠️ Skills Guide**](Skills-Guide.md)                             | Deep dive into 44 specialized skills with MCP integration            |
| [**💬 Prompting Guide**](Prompting-Guide.md)                       | Master the art of prompting agents for maximum productivity          |
| [**🧠 Context Engineering**](Prompting-and-Context-Engineering.md) | MVI philosophy and plan-first workflows                              |
| [**🔄 Agent Loop Guide**](Agent-Loop-Guide.md)                     | Iterative execution and self-improvement patterns                    |

---

## 🚀 Getting Started

OpenCode uses specialized agents configured in `opencode.json` to handle different aspects of software development. You use it by describing what you need in natural language — agents handle the decomposition, research, implementation, and verification.

### Core Philosophy

1. **Plan Before Action**: Use `lead-strategist` or `software-architect` for analysis before major changes (uses Sequential Thinking MCP)
2. **Specialization Wins**: Use the right agent for the right task (e.g., `backend-laravel` for PHP, `frontend-ui-ux` for CSS)
3. **Intelligent Routing**: The `agent-router` plugin automatically recommends the best agent
4. **Workflow Automation**: Use `workflow-manager` skill for complex multi-step tasks with MCP integration
5. **Continuous Improvement**: The `docs-curator` agent uses `self-reflection` and `self-improver` skills

### Working on an External Project

OpenCode works on **any** project — Tauri desktop apps, Laravel APIs, React SPAs, Solid.js apps, Livewire dashboards, or plain PHP. The first step is always **stack detection**: agents read `package.json`, `Cargo.toml`, `composer.json` automatically, then route to the correct specialists.

#### Step 0: Stack Detection (automatic)

```bash
# Just tell agents the project path — they detect the rest
@explore Map the project at C:\Projects\my-app.
Read package.json, Cargo.toml, composer.json — which exist?
List top-level directories and src/ structure.
```

**What agents detect** (they read manifest files, never guess):

| Manifest found               | Stack detected       | Routes to agents                       |
| ---------------------------- | -------------------- | -------------------------------------- |
| `Cargo.toml` + `tauri`       | Tauri desktop app    | `@backend-tauri` + `@frontend-ui-ux`   |
| `composer.json` + `laravel`  | Laravel web app      | `@backend-laravel` (PHP)               |
| `composer.json` + `livewire` | Livewire app         | `@backend-laravel` + `@frontend-ui-ux` |
| `package.json` + `react`     | React SPA            | `@frontend-ui-ux`                      |
| `package.json` + `solid`     | Solid.js SPA         | `@frontend-ui-ux`                      |
| `composer.json` only         | Plain PHP project    | `@backend-laravel`                     |
| Multiple manifests           | Hybrid (multi-stack) | Multiple agents in sequence            |

#### Step 1: Plan (stack-agnostic)

```bash
# Same prompt structure — works for any detected stack
@lead-strategist Plan a "CSV export" feature for C:\Projects\my-app.
First read the project's existing patterns (manifests, src/, routes).
Propose implementation plan matching the actual stack.
DO NOT write code — only plan.
```

**What happens**: `@lead-strategist` reads the project's actual files, detects the stack from manifests, then produces a stack-appropriate plan with files-to-touch and verification steps.

#### Step 2: Implement Backend (agent chosen by stack)

```bash
# If stack is Tauri (Rust detected from Cargo.toml)
@backend-tauri Add a Tauri command 'export_csv' to C:\Projects\my-app.
Read src-tauri/src/ for existing command patterns.
Return Result<String, String>. Run cargo check.

# If stack is Laravel (PHP detected from composer.json)
@backend-laravel Add a CSV export endpoint to C:\Projects\my-app.
Create a controller, route, FormRequest. Run php artisan pint.

# If stack is plain PHP
@backend-laravel Add a CSV export script to C:\Projects\my-app.
Read existing src/ structure. Match existing patterns.
```

#### Step 3: Implement Frontend (agent chosen by stack)

```bash
# If frontend is React/Solid (detected from package.json)
@frontend-ui-ux Add an export button to C:\Projects\my-app.
Read src/components/ for existing UI patterns.
Use the project's existing fetch/invoke pattern. Run tsc.

# If frontend is Livewire/Blade (detected from composer.json + livewire)
@frontend-ui-ux Add an export button to C:\Projects\my-app.
Read existing Livewire components for pattern matching.
Match Blade/Tailwind conventions.
```

#### Step 4: Review (stack-agnostic)

```bash
@code-reviewer Review the new code in C:\Projects\my-app.
Check: naming conventions, error handling, security, unused imports.
Report CRITICAL/WARNING/INFO findings.
```

#### Step 5: Test (detected from project manifests)

```bash
@integration-test Run the test suite in C:\Projects\my-app.
Detect test framework from package.json / composer.json.
Run: appropriate command (vitest, pest, cargo test, etc.).
Report pass/fail with root cause.
```

#### Quick Reference: Per-Stack Agent Routing

| Task                 | Tauri+React             | Laravel+Livewire         | React SPA           | Plain PHP           |
| -------------------- | ----------------------- | ------------------------ | ------------------- | ------------------- |
| **Codebase map**     | `@explore`              | `@explore`               | `@explore`          | `@explore`          |
| **Plan feature**     | `@lead-strategist`      | `@lead-strategist`       | `@lead-strategist`  | `@lead-strategist`  |
| **Backend**          | `@backend-tauri` (Rust) | `@backend-laravel` (PHP) | (frontend-only)     | `@backend-laravel`  |
| **Frontend**         | `@frontend-ui-ux`       | `@frontend-ui-ux`        | `@frontend-ui-ux`   | (none)              |
| **Code review**      | `@code-reviewer`        | `@code-reviewer`         | `@code-reviewer`    | `@code-reviewer`    |
| **Run tests**        | `@integration-test`     | `@integration-test`      | `@integration-test` | `@integration-test` |
| **Quality/security** | `@qa-guardian`          | `@qa-guardian`           | `@qa-guardian`      | `@qa-guardian`      |

**Key principle**: Never guess the stack — agents detect it from `package.json`, `Cargo.toml`, `composer.json` automatically. The same workflow (Discover → Plan → Implement → Review → Test) works for any project. You just specify the path; agents handle the rest.

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

### MCP Servers (12 configured, 9 enabled)

| Server                | Status      | Purpose                                    | Timeout |
| --------------------- | ----------- | ------------------------------------------ | ------- |
| `context7`            | ✅ enabled  | Up-to-date documentation and code examples | 45s     |
| `git`                 | ✅ enabled  | Git repository operations                  | 30s     |
| `memory`              | ✅ enabled  | Persistent knowledge graph                 | 45s     |
| `sequential-thinking` | ✅ enabled  | Step-by-step reasoning                     | 45s     |
| `type-inject`         | ✅ enabled  | TypeScript type discovery                  | 45s     |
| `stitch`              | ✅ enabled  | Google Stitch design system sync           | 45s     |
| `filesystem`          | ✅ enabled  | File system operations                     | 45s     |
| `sqlite`              | ✅ enabled  | SQLite database queries                    | 30s     |
| `vercel-grep`         | ✅ enabled  | Public repo code search                    | 30s     |
| `fetch`               | ⏸️ disabled | Use `webfetch` built-in instead            | 30s     |
| `language-server`     | ⏸️ disabled | Built-in LSP handles this                  | 45s     |
| `personal-knowledge`  | ⏸️ disabled | Personal knowledge base                    | 30s     |
| `everything`          | ⏸️ disabled | MCP test server                            | 30s     |

Use `mcp_list` to view all servers, `mcp_check` for health status, `mcp_toggle` to enable/disable.

### LSP Integration

Real-time code analysis via rust-analyzer, TypeScript LSP, PHP Intelephense, Tailwind CSS.

### Auto-Formatters

Built-in support for Biome (JS/TS), Prettier (CSS/HTML/MD), Pint (PHP), rustfmt (Rust), shfmt (Shell).

---

## 🎯 Model Configuration

| Provider       | Models                                           | Use Case                    |
| -------------- | ------------------------------------------------ | --------------------------- |
| **lmstudio**   | `gemma-4-e4b-it`, `gemma-4-e2b-it`, `qwen3.5-4b` | Local, free, fast inference |
| **openrouter** | `ring-2.6-1t:free`, `laguna-m.1:free`            | Free cloud models           |

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
- **Skill Search**: Use `skill_search query:"keyword"` to discover relevant skills
- **MCP Management**: Use `mcp_list` and `mcp_check` to monitor MCP server health
- **Project Detection**: Use `project_detect` to auto-detect stack and framework
- **Doc Sync**: Use `/sync-docs` to detect and fix doc-code drift
- **Harness Check**: Use `/harness` to verify auto-harness initialization
- **Context Configuration**: Use `context_view` to see current context, `context_add_include` to add more
- **Self-Improvement**: Use `/reflect` or `/improve` to analyze and improve configuration
- **Web Version**: Access at `http://127.0.0.1:4096/` when running `opencode web`

---

## 🔗 Plugin Ecosystem (11 registered)

| Plugin                   | Purpose                                |
| ------------------------ | -------------------------------------- |
| `index.ts`               | Self-improvement, ambient LSP, worklog |
| `skill-manager.ts`       | Skill loading and management           |
| `memory-context.ts`      | Session memory, auto-extraction        |
| `context-manager.ts`     | Context compression and optimization   |
| `agent-router.ts`        | Agent recommendation, complexity       |
| `mcp-manager.ts`         | MCP health and tool routing            |
| `adr-workflow.ts`        | ADR creation and management            |
| `mobile-tool-router.ts`  | Android detection and tools            |
| `workflow-router.ts`     | YAML workflow orchestration            |
| `project-initializer.ts` | Stack/framework/package auto-detection |
| `doc-sync.ts`            | Doc-code drift detection (5 checkers)  |

> See [**Plugins Guide**](Plugins-Guide.md) for complete details on all available plugins.

---

> [!TIP]
> Need help with a specific stack? Check the [**Skills Guide**](Skills-Guide.md) to see how OpenCode auto-detects your project type. Use `route_agent` to let the system recommend the best agent for your task.
