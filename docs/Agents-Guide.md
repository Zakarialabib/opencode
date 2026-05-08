# 🤖 Agents Guide

OpenCode uses specialized agents configured in `opencode.json` to handle different aspects of software development. Each agent has tailored instructions, tools, permissions, and a specific role.

> See the official docs: [opencode.ai/docs/agents](https://opencode.ai/docs/agents/)

---

## 🎯 Active Agents (10 configured)

All agents are defined as `"primary"` mode in `opencode.json` under the `"agent"` key.

### Leadership & Strategy

| Agent                 | Model                       | Temperature | Role                                                                                    |
| --------------------- | --------------------------- | ----------- | --------------------------------------------------------------------------------------- |
| **`lead-strategist`** | `opencode/hy3-preview-free` | 0.2         | Strategic orchestrator — multi-agent delegation, workflow coordination, project roadmap |
| **`lead-architect`**  | `opencode/hy3-preview-free` | 0.2         | Technical architect — system design, Context7 docs, memory MCP, sequential-thinking     |

### Core Implementation

| Agent              | Model       | Temperature | Role                                                                                                                |
| ------------------ | ----------- | ----------- | ------------------------------------------------------------------------------------------------------------------- |
| **`core-factory`** | _(default)_ | _(default)_ | Fast implementation engine — direct file editing, read-edit-validate workflow, batch operations. **Default agent.** |

### Frontend & Design

| Agent                | Model                       | Temperature | Role                                                                                        |
| -------------------- | --------------------------- | ----------- | ------------------------------------------------------------------------------------------- |
| **`frontend-ui-ux`** | `opencode/hy3-preview-free` | 0.3         | Premium UI/UX — Next.js 16, TypeScript, Tailwind 4, shadcn/ui, design tokens, accessibility |

### Backend Development

| Agent                 | Model       | Temperature | Role                                                                                 |
| --------------------- | ----------- | ----------- | ------------------------------------------------------------------------------------ |
| **`backend-api`**     | _(default)_ | _(default)_ | API design & implementation — Node/Express or Laravel, REST/GraphQL, Prisma          |
| **`backend-laravel`** | _(default)_ | _(default)_ | Laravel 13 specialist — Livewire 4, Alpine.js 3, Eloquent, Form Requests, Pest tests |
| **`backend-tauri`**   | _(default)_ | _(default)_ | Rust/Tauri desktop apps — IPC commands, async runtime, state management              |

### Quality Assurance

| Agent             | Model                       | Temperature | Role                                                            |
| ----------------- | --------------------------- | ----------- | --------------------------------------------------------------- |
| **`qa-guardian`** | `opencode/hy3-preview-free` | 0.1         | Unified QA — code review, testing, security scanning, debugging |

### Operations & Knowledge

| Agent                 | Model                       | Temperature | Role                                                                                   |
| --------------------- | --------------------------- | ----------- | -------------------------------------------------------------------------------------- |
| **`devops-engineer`** | `opencode/hy3-preview-free` | 0.1         | Operational tasks — terminal execution, MCP management, backups, db operations         |
| **`docs-curator`**    | `opencode/hy3-preview-free` | 0.2         | Knowledge management — documentation, self-improvement, web research, system evolution |

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
| **qa-guardian**     | read, write, edit, bash, skill, lsp                   | —                                                    |
| **devops-engineer** | read, bash, skill                                     | —                                                    |
| **docs-curator**    | read, write, edit, bash, skill, codesearch            | **websearch, webfetch, todowrite**                   |

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
      "model": "opencode/hy3-preview-free",
      "temperature": 0.2,
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

> [!TIP]
> Use the `route_agent` tool (from the agent-router plugin) to let the system recommend the best agent for your task. Each agent loads relevant skills automatically based on task context.
