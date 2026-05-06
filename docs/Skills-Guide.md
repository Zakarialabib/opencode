# 🛠️ Skills Guide

Skills are specialized capabilities registered in `skills/index.json`, with `SKILL.md` as the entry point. Agents load skills automatically based on task context. Skills can leverage MCP servers for enhanced capabilities.

---

## 🧐 What is a Skill?

A skill is a directory containing a `SKILL.md` file and optional assets, registered in `skills/index.json`. It provides:

- **Instructions**: How to use specific tools (e.g., `agent-browser`).
- **Best Practices**: Coding standards for a stack (e.g., Laravel).
- **Workflows**: Step-by-step guides for common tasks.
- **MCP Integration**: Skills can reference MCP tools (context7, sqlite, sequential-thinking) for enhanced functionality.

---

## 📂 Skill Categories

### 1. **Registered Core Skills (`skills/`, registered in `skills/index.json`)**

These are managed skills with defined agent assignments and triggers. Many integrate with MCP servers:

| Skill                          | Category            | Agents                                                                                                | MCP Integration                      |
| ------------------------------ | ------------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------ |
| **`stack-context`**            | context-engineering | core-factory, core-planner, qa-debugger, qa-reviewer, backend-laravel, backend-tauri, lead-strategist | Uses `context7` for docs             |
| **`self-reflection`**          | meta                | lead-strategist, lead-architect                                                                       | -                                    |
| **`self-improver`**            | meta                | core-factory, core-planner, lead-strategist                                                           | Uses `memory` for persistence        |
| **`security-review`**          | security            | qa-guardian, docs-curator                                                                             | -                                    |
| **`laravel-feature-scaffold`** | laravel             | backend-laravel, core-factory                                                                         | -                                    |
| **`project-orchestration`**    | orchestration       | lead-strategist                                                                                       | -                                    |
| **`ui-ux-pro-max`**            | design              | frontend-ui-ux                                                                                        | -                                    |
| **`agent-browser`**            | testing             | qa-guardian                                                                                           | Uses `fetch` for web content         |
| **`testing-strategy`**         | testing             | qa-guardian                                                                                           | Uses `sqlite` for test data          |
| **`database-design`**          | architecture        | lead-architect, core-factory                                                                          | Uses `sqlite` for schema             |
| **`deep-research`**            | research            | docs-curator                                                                                          | Uses `context7`, `fetch`             |
| **`docs-governance-audit`**    | documentation       | docs-curator, docs-writer                                                                             | -                                    |
| **`git-release`**              | devops              | devops-engineer, core-factory                                                                         | -                                    |
| **`react-reuse-audit`**        | frontend            | qa-guardian                                                                                           | -                                    |
| **`workflow-manager`**         | orchestration       | lead-strategist, core-planner                                                                         | Uses `sequential-thinking`, `memory` |
| **`fullstack-dev`**            | web-development     | backend-api, frontend-ui-ux                                                                           | -                                    |

See `skills/index.json` for the full list of 16 registered skills.

### 2. **Community Skills (`skills/`)**

A collection of community-driven skills (e.g., `qingyan-research`, `xlsx`, `ppt`, `skill-creator`, `charts`, `blog-writer`, etc.).

### MCP Integration Patterns

Skills can leverage MCP servers for enhanced capabilities:

| MCP Server            | Used By Skills                    | Purpose                              |
| --------------------- | --------------------------------- | ------------------------------------ |
| `context7`            | stack-context, deep-research      | Fetch up-to-date documentation       |
| `sqlite`              | testing-strategy, database-design | Database operations, test data       |
| `sequential-thinking` | workflow-manager                  | Step-by-step reasoning for workflows |
| `memory`              | self-improver, workflow-manager   | Persistent state across sessions     |
| `fetch`               | agent-browser, deep-research      | Web content fetching                 |

---

## 🚀 Using Skills

### Automatic Loading

Skills are loaded automatically when an agent needs them. The **agent-router plugin** helps ensure the right agent (with the right skills) is selected:

```bash
# Let the system recommend the best agent for your task
Ask lead-strategist: "Which agent should handle Laravel authentication?"
→ Returns: 🎯 Recommended Agent: **backend-laravel**
→ Skills loaded: laravel-feature-scaffold, security-review
```

### Explicit Invocation

Delegate to the agent assigned to the skill. For example:

```bash
# Trigger agent-browser skill via qa-guardian agent
Ask qa-guardian to "Open https://example.com and check layout"

# Use skill_search tool to find relevant skills
Ask any agent: "Search for skills related to PDF"
→ Returns: pdf skill (assigned to qa-guardian)
```

### Using Skills with MCP Integration

When a skill uses MCP servers, ensure they are enabled:

```bash
# Check MCP server status
Use mcp_list tool → Verify context7, sqlite, etc. are enabled

# Example: stack-context skill with context7 MCP
Ask backend-tauri: "Analyze this Tauri project"
→ stack-context skill loads
→ Uses context7 MCP to fetch Tauri documentation
→ Returns: Project analysis with up-to-date docs
```

---

## 🎨 Spotlight: The UI/UX Skill

The `ui-ux-pro-max` skill (`skills/ui-ux-pro-max/SKILL.md`) provides agents with:

- Premium color palettes (HSL-based).
- Modern design patterns (Glassmorphism, Neumorphism).
- Responsive grid systems.

When you use the `frontend-ui-ux` agent, it leverages this skill to ensure your web apps meet premium design standards.

---

## ✍️ Creating a Skill

1. Create a folder in `skills/`.
2. Add a `SKILL.md` entry point with instructions.
3. Register the skill in `skills/index.json` with:
   - Agent assignments
   - Trigger conditions
   - Category and tags

Example `skills/index.json` entry:

```json
{
  "name": "my-custom-skill",
  "displayName": "My Custom Skill",
  "description": "Handles XYZ tasks with precision.",
  "category": "custom",
  "agents": ["core-factory"],
  "entryPoint": "SKILL.md"
}
```

---

## 🔗 Integration with Agent Router & Workflows

Skills work together with the agent routing and workflow systems:

### Agent Router + Skill Manager

```
User: "Generate a PDF report"
→ agent-router: Detects "pdf" keyword, recommends qa-guardian
→ skill-manager: Confirms pdf skill is assigned to qa-guardian
→ qa-guardian: Loads pdf skill automatically
→ Result: PDF generated using skill instructions
```

### Workflow Manager + Skills + MCP

```
User: "Add authentication feature"
→ workflow-manager: Creates phases using sequential-thinking MCP
→ Phase 1: lead-strategist uses stack-context skill + context7 MCP
→ Phase 2: backend-laravel uses laravel-feature-scaffold skill
→ Phase 3: qa-guardian uses testing-strategy skill + sqlite MCP
→ Result: Fully implemented feature with tests
```

---

> [!TIP]
> Use the `skill-creator` skill (`skills/skill-creator/SKILL.md`) to help draft new skill definitions! Use `skill_search` tool to discover existing skills, and combine with `route_agent` to find the best agent for your task.
