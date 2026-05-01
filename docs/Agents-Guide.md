# 🤖 Software Engineering Team (Agents)

OpenCode uses a **Swarm Architecture** where 19 specialized agents collaborate to solve problems. Each agent belongs to a specific domain with tailored tools and instructions.

---

## 🏛️ Leadership & Orchestration

These agents oversee project strategy and coordinate the team.

| Agent                      | Role                | Key Skills                             | Temperature |
| :------------------------- | :------------------ | :------------------------------------- | :---------- |
| **`lead-orchestrator`**    | Engineering Lead    | workflow-manager, Task tool delegation | 0.2         |
| **`lead-architect`**       | Technical Architect | System design, architectural decisions | default     |
| **`lead-product-manager`** | Product Manager     | Requirements, prioritization, roadmap  | default     |

## 🔧 Core Agents

High-speed implementation and planning specialists.

| Agent              | Role                      | Focus                                      |
| :----------------- | :------------------------ | :----------------------------------------- |
| **`core-builder`** | Implementation Specialist | Direct file modification, batch operations |
| **`core-planner`** | Strategic Planner         | Read-only analysis, architecture discovery |

## 🎨 Frontend & Design

Responsible for user-facing experience and premium UI.

| Agent                | Role           | Key Skills                                               |
| :------------------- | :------------- | :------------------------------------------------------- |
| **`frontend-ui-ux`** | UI/UX Engineer | `ui-ux-pro-max`, `react-reuse-audit`, `image-generation` |

## ⚙️ Backend Development

Implementation experts for various technology stacks.

| Agent                 | Role               | Focus                           | Key Skills                 |
| :-------------------- | :----------------- | :------------------------------ | :------------------------- |
| **`backend-api`**     | API Developer      | REST/GraphQL, Prisma            | `fullstack-dev`            |
| **`backend-laravel`** | Laravel Specialist | Laravel 13, Livewire 4, PHP 8.3 | `laravel-feature-scaffold` |
| **`backend-tauri`**   | Tauri Specialist   | Rust, Tauri desktop apps        | Tauri ecosystem            |
| **`backend-systems`** | Systems Engineer   | Shell scripting, infrastructure | Low-level systems          |

## 🔍 Quality Assurance

Ensuring reliability, performance, and security.

| Agent             | Role                 | Focus                                  | Temperature |
| :---------------- | :------------------- | :------------------------------------- | :---------- |
| **`qa-reviewer`** | Senior Code Reviewer | Standards, performance, architecture   | default     |
| **`qa-tester`**   | Test Engineer        | Vitest, Pest, PHPUnit, cargo test      | default     |
| **`qa-security`** | Security Specialist  | Vulnerability scanning, secret leaks   | 0.1         |
| **`qa-debugger`** | Troubleshooter       | Browser debugging, root cause analysis | 0.1         |

## 🚀 Operations & Knowledge

Infrastructure, documentation, and continuous improvement.

| Agent               | Role                  | Focus                                      | Temperature |
| :------------------ | :-------------------- | :----------------------------------------- | :---------- |
| **`devops-ops`**    | Operations Agent      | Terminal execution, operational tasks      | default     |
| **`devops-mcp`**    | MCP Specialist        | MCP server research and integration        | default     |
| **`docs-writer`**   | Tech Writer           | Technical documentation                    | default     |
| **`docs-governor`** | Documentation Auditor | Governance, standards enforcement          | default     |
| **`docs-evolver`**  | Evolution Engine      | `self-improver`, research-driven evolution | 0.2         |

---

## 🎯 Team Orchestration Logic

The `lead-orchestrator` uses the **Task tool** for SubAgent delegation following the ANALYZE→PLAN→DELEGATE→SYNTHESIZE→VERIFY pattern.

**Example flow for "Add real-time notifications":**

1. **`lead-product-manager`**: Defines requirements
2. **`lead-architect`**: Outlines WebSocket architecture
3. **`backend-api`**: Implements server-side logic
4. **`frontend-ui-ux`**: Builds premium toast notification UI
5. **`qa-tester`**: Writes integration tests
6. **`qa-reviewer`**: Performs final quality check

---

## 🛠️ Agent Tools & Permissions

Each agent has tailored tool access defined in `opencode.json`:

- **Core agents**: read, edit, grep, glob, lsp, todowrite
- **Lead agents**: All core tools + task (SubAgent delegation), skill loading
- **QA agents**: read, command, lsp, skill (security-review, testing-strategy)
- **DevOps agents**: file, command, skill (git-release, deep-research)

---

## 💡 Using Agents

### Switch Agent

```bash
/agent frontend-ui-ux
```

### Delegate to Agent (via lead-orchestrator)

```
"Add user authentication to the Laravel app"
```

The lead-orchestrator will decompose and delegate to: `core-planner` → `backend-laravel` → `docs-writer` → `qa-reviewer` → `qa-tester`

---

> [!TIP]
> Each agent loads relevant skills automatically based on task context. Check `skills/index.json` for skill-to-agent mappings.
