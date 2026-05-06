# 🤖 Software Engineering Team (Agents)

OpenCode uses specialized agents configured in `opencode.json` to handle different aspects of software development. Each agent has tailored tools, instructions, and a specific role.

---

## 🏛️ Leadership & Strategy

These agents oversee project strategy, architecture, and coordination.

| Agent                 | Role                | Key Skills                                               | Temperature |
| :-------------------- | :------------------ | :------------------------------------------------------- | :---------- |
| **`lead-strategist`** | Strategic Lead      | workflow-manager, Task tool delegation, architecture     | 0.2         |
| **`lead-architect`**  | Technical Architect | System design, architectural decisions, Context7, Memory | 0.2         |

---

## 🔧 Core Implementation

High-speed implementation and direct file editing specialists.

| Agent              | Role                  | Focus                                                                         |
| :----------------- | :-------------------- | :---------------------------------------------------------------------------- |
| **`core-factory`** | Implementation Engine | Merged builder/planner - direct file modification, batch operations, planning |

---

## 🎨 Frontend & Design

Responsible for user-facing experience and premium UI.

| Agent                | Role           | Key Skills                                            |
| :------------------- | :------------- | :---------------------------------------------------- |
| **`frontend-ui-ux`** | UI/UX Engineer | `ui-ux-pro-max`, `react-reuse-audit`, `fullstack-dev` |

---

## ⚙️ Backend Development

Implementation experts for various technology stacks.

| Agent                 | Role               | Focus                         | Key Skills                 |
| :-------------------- | :----------------- | :---------------------------- | :------------------------- |
| **`backend-api`**     | API Developer      | REST/GraphQL, Prisma, Express | `fullstack-dev`            |
| **`backend-laravel`** | Laravel Specialist | Laravel, Livewire, PHP 8.3    | `laravel-feature-scaffold` |
| **`backend-tauri`**   | Tauri Specialist   | Rust, Tauri desktop apps      | Tauri ecosystem            |

---

## 🔍 Quality Assurance

Ensuring reliability, performance, and security.

| Agent             | Role       | Focus                                     | Temperature |
| :---------------- | :--------- | :---------------------------------------- | :---------- |
| **`qa-guardian`** | Unified QA | Code review, testing, security, debugging | 0.1         |

---

## 🚀 Operations & Knowledge

Infrastructure, documentation, and continuous improvement.

| Agent                 | Role              | Focus                                                           | Temperature |
| :-------------------- | :---------------- | :-------------------------------------------------------------- | :---------- |
| **`devops-engineer`** | Operations Agent  | Terminal execution, operational tasks, MCP management           | 0.1         |
| **`docs-curator`**    | Knowledge Manager | Documentation, self-improvement, system evolution, web research | 0.2         |

---

## 🎯 Agent Orchestration Logic

The `lead-strategist` coordinates complex tasks using the **Task tool** for SubAgent delegation following the ANALYZE→PLAN→DELEGATE→SYNTHESIZE→VERIFY pattern.

**Example flow for "Add real-time notifications":**

1. **`lead-strategist`**: Defines requirements and outlines architecture
2. **`lead-architect`**: Details technical implementation approach
3. **`backend-api`** or **`backend-laravel`**: Implements server-side logic
4. **`frontend-ui-ux`**: Builds UI components
5. **`qa-guardian`**: Performs quality check, testing, and security review
6. **`docs-curator`**: Updates documentation

---

## 🛠️ Agent Tools & Permissions

Each agent has tailored tool access defined in `opencode.json`:

- **core-factory**: read, write, edit, bash, skill, grep, glob, todowrite
- **lead-strategist**: skill, bash, read, lsp, codesearch, todowrite, task
- **lead-architect**: read, write, edit, bash, skill, lsp, codesearch, task, mcp, context7, memory, sequential-thinking
- **frontend-ui-ux**: read, write, edit, bash, skill, lsp, codesearch, task, mcp, context7, memory, sequential-thinking
- **backend-api**: read, write, edit, bash, skill, lsp
- **backend-laravel**: read, write, edit, bash, skill, lsp
- **backend-tauri**: read, write, edit, bash, skill, lsp
- **qa-guardian**: read, write, edit, bash, skill, lsp
- **devops-engineer**: read, bash, skill
- **docs-curator**: read, write, edit, bash, skill, codesearch, websearch, webfetch, todowrite

---

## 💡 Using Agents

### Switch Agent

```bash
/agent frontend-ui-ux
```

### Delegate to Agent (via lead-strategist)

```
"Add user authentication to the Laravel app"
```

The lead-strategist will decompose and delegate to: `lead-architect` → `backend-laravel` → `docs-curator` → `qa-guardian`

---

## 📝 Note on Agent Files

Additional agent definition files exist in the `agents/` directory for reference and planning:

- `agents/lead-strategist.md`, `agents/core-factory.md`, `agents/core-planner.md`
- `agents/backend-systems.md`, `agents/devops-mcp.md`, `agents/devops-ops.md`
- `agents/docs-governor.md`, `agents/docs-writer.md`
- `agents/qa-reviewer.md`, `agents/qa-tester.md`, `agents/qa-security.md`, `agents/qa-debugger.md`
- `agents/lead-product-manager.md`

These represent planned or legacy agent configurations. The currently active agents are defined in `opencode.json`.

---

> [!TIP]
> Each agent loads relevant skills automatically based on task context. Check `skills/index.json` for skill-to-agent mappings.
