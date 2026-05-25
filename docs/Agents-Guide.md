# 🤖 Agents Guide

OpenCode uses specialized agents configured in `opencode.json` to handle different aspects of software development. Each agent has tailored instructions, tools, permissions, and a specific role.

> See the official docs: [opencode.ai/docs/agents](https://opencode.ai/docs/agents/)

---

## 🎯 Configured Agents (15 configured)

These agents are configured in `opencode.json` under the `"agent"` key. The file is the source of truth for agent mode, permissions, and tools.

Local agent docs in `agents/*.md` provide the per-agent design and execution guidance. Keep those files synchronized with `opencode.json` when agent roles, mode, or permissions change.

## 📌 Agent docs audit status
- `qa-guardian.md`: removed invalid references to non-existent `qa-tester` and `security-scan` skills.
- `frontend-ui-ux.md`: corrected invalid `context7_resolve-library-id`, `context7_query-docs`, and `skill_use` tool names to match actual available tools.
- `plan.md`: corrected `Mode` to `subagent` to match `opencode.json`.

### Orchestration & Planning

| Agent                 | Mode      | Steps | Role                                                                                    |
| --------------------- | --------- | ----- | --------------------------------------------------------------------------------------- |
| **`build`**           | primary   | 50    | Primary orchestrator — decomposes requests, delegates specialists, synthesizes results. |
| **`plan`**            | subagent  | 20    | Read-only analyst — architecture review, gap analysis, risk assessment.               |
| **`explore`**         | subagent  | 15    | Fast codebase search — locate files, find patterns, answer structural questions.      |
| **`scout`**           | subagent  | 15    | External researcher — fetch docs, inspect dependencies, cross-reference upstream.     |
| **`lead-strategist`** | subagent  | 30    | Product architect — feasibility, gap analysis, strategic coordination.                |
| **`lead-architect`**  | subagent  | 30    | Technical architect — pattern integrity, dependency direction, structural soundness.  |

### Implementation & Delivery

| Agent                | Mode      | Steps | Role                                                                                                                |
| -------------------- | --------- | ----- | ------------------------------------------------------------------------------------------------------------------- |
| **`core-factory`**   | subagent  | 40    | Senior implementation engineer — fast, clean, correct production code.                                              |
| **`frontend-ui-ux`** | subagent  | 30    | Premium UI engineer — React + TypeScript + Tailwind + shadcn/ui.                                                   |
| **`backend-api`**    | subagent  | 30    | API specialist — Node/Express or Laravel, type-safe, validated.                                                     |
| **`backend-laravel`**| subagent  | 30    | Laravel 13 + Livewire 4 specialist — convention-strict, pest-tested.                                               |
| **`backend-tauri`**  | subagent  | 30    | Rust/Tauri specialist — safety-first, cargo-check-always.                                                          |
| **`android-kotlin`** | subagent  | 30    | Android/Kotlin native dev — Clean Architecture, Jetpack Compose, Tauri mobile bridge.                                |

### Validation & Operations

| Agent                 | Mode      | Steps | Role                                                                                   |
| --------------------- | --------- | ----- | -------------------------------------------------------------------------------------- |
| **`qa-guardian`**     | subagent  | 20    | Quality gatekeeper — finds problems, not solutions.                                    |
| **`devops-engineer`** | subagent  | 20    | Operations — database, processes, caches, dependency management.                       |
| **`docs-curator`**    | subagent  | 30    | Technical writer — accurate, concise, verified documentation.                         |

---

## 🛠️ Agent Tools & Permissions

Each agent has tailored tool access defined in `opencode.json`. The permission system controls what tools agents can use:

| Agent               | Core Tools                                            | Advanced Tools                                       |
| ------------------- | ----------------------------------------------------- | ---------------------------------------------------- |
| **core-factory**    | read, write, edit, bash, skill, grep, glob, todowrite | —                                                    |
| **lead-strategist** | skill, bash, read, lsp, codesearch, todowrite         | **task** (subagent delegation)                       |
| **lead-architect**  | read, write, edit, bash, skill, lsp, codesearch       | **task, mcp, context7, memory, sequential-thinking** |
| **frontend-ui-ux**  | read, write, edit, bash, skill, lsp, codesearch       | **task, mcp, context7, memory, sequential-thinking** |
| **backend-api**     | read, write, edit, bash, skill, lsp                   | —                                                    |
| **backend-laravel** | read, write, edit, bash, skill, lsp                   | —                                                    |
| **backend-tauri**   | read, write, edit, bash, skill, lsp                   | —                                                    |
| **qa-guardian**     | read, bash, skill, lsp                                | —                                                    |
| **devops-engineer** | read, write, edit, bash, skill                        | —                                                    |
| **docs-curator**    | read, write, edit, bash, skill, codesearch, lsp       | **websearch, webfetch, todowrite**                   |

> **Optimization Note (2026-05-08)**: qa-guardian is now READ-ONLY (removed write/edit). devops-engineer gained write/edit for config fixes. docs-curator gained LSP for code validation.

> **Note:** The `tools` key is deprecated in OpenCode. Prefer the `permission` system for fine-grained control. See [opencode.ai/docs/agents/#permissions](https://opencode.ai/docs/agents/#permissions).

---

## 🎯 Agent Orchestration

The `lead-strategist` coordinates complex tasks using the **Task tool** for SubAgent delegation, following an ANALYZE→PLAN→DELEGATE→SYNTHESIZE→VERIFY pattern.

### Example Flow: "Add real-time notifications"

1. **`lead-strategist`**: Defines requirements and outlines architecture
2. **`lead-architect`**: Details technical implementation approach (using Context7 + Sequential Thinking MCP)
3. **`backend-laravel`** or **`backend-api`**: Implements server-side logic
4. **`frontend-ui-ux`**: Builds UI components (using `ui-ux-pro-max` skill)
5. **`qa-guardian`**: Performs quality check, testing, and security review
6. **`docs-curator`**: Updates documentation

---

## 🚀 Using Agents

### Switch Agent

```bash
/agent frontend-ui-ux
```

Or use the **Tab** key to cycle through primary agents during a session.

### Let Agent Router Decide

```bash
# The agent-router plugin analyzes your task and recommends the best agent
Ask: "Which agent should handle this Laravel migration?"
→ Returns: 🎯 Recommended Agent: **backend-laravel** (score: 8)
```

### Delegate to Agent

```
"Add user authentication to the Laravel app"
→ lead-strategist decomposes and delegates:
  lead-architect → backend-laravel → qa-guardian → docs-curator
```

---

## 📝 Agent Configuration

Agents are configured in `opencode.json` under the `"agent"` key. Each entry supports:

```json
{
  "agent": {
    "my-agent": {
      "description": "What this agent does",
      "instructions": ["System instruction 1", "System instruction 2"],
      "tools": {
        "read": true,
        "write": true
      },
      "permission": {
        "edit": "allow",
        "bash": "ask"
      }
    }
  }
}
```

Key configuration options:

- **`description`** — Required. Brief description for agent routing
- **`model`** — Override the default model per agent
- **`temperature`** — Control randomness (0.0-1.0, lower = more deterministic)
- **`instructions`** — Array of system instructions
- **`tools`** — _(deprecated)_ Enable/disable specific tools. Prefer `permission`.
- **`permission`** — Fine-grained control: `"allow"`, `"ask"`, or `"deny"` per action

> See [opencode.ai/docs/agents](https://opencode.ai/docs/agents/) for the complete configuration reference.

---

## 🧠 Cognitive Role Variants (Optimization 2026-05-08)

Based on our agent configuration audit, we've identified three cognitive modes to optimize token usage and task alignment:

| Mode           | Purpose                          | Model             | Temperature | Tools                                                       | When to Use                                |
| -------------- | -------------------------------- | ----------------- | ----------- | ----------------------------------------------------------- | ------------------------------------------ |
| **plan-**      | Read-only analysis, architecture | `hy3-review-free` | 0.2         | read, grep, glob, codesearch, context7, sequential-thinking | "Analyze this code", "Design architecture" |
| **explore-**   | Research, web search, discovery  | `hy3-review-free` | 0.4         | read, websearch, webfetch, codesearch, skill                | "Research X topic", "Find examples"        |
| **implement-** | Code changes, implementation     | `hy3-review-free` | 0.3         | read, write, edit, bash, lsp, skill                         | "Fix this bug", "Add feature"              |

### Key Changes Applied:

1. **Model Downgrades**: 5 agents moved from `kimi-k2.6` (expensive) to `hy3-review-free` (75% cheaper)
2. **Temperature Tuning**: Implementation agents → 0.3, Planning agents → 0.2, Exploration → 0.4
3. **Tool Alignment**: Each agent now has tools matching their cognitive mode
4. **Least Privilege**: qa-guardian is now READ-ONLY, devops-engineer gained limited write

### Expected Improvements:

- **Token Savings**: ~75% on 5 agents
- **Routing Accuracy**: Target >85% (was 40% before fixes)
- **Config Health**: Target >95%

---

> [!TIP]
> Use the `route_agent` tool (from the agent-router plugin) to let the system recommend the best agent for your task. Each agent loads relevant skills automatically based on task context.
