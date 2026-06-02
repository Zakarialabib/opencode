# Skills Guide

Skills are reusable instructions that agents load on-demand via the native `skill` tool. They provide specialized workflows, best practices, and tool integrations.

> See the official docs: [opencode.ai/docs/skills](https://opencode.ai/docs/skills/)

---

## What is a Skill?

A skill is a folder containing a `SKILL.md` file with YAML frontmatter. Agents discover skills automatically and load them when relevant to the task.

Each skill provides:

- **Instructions**: How to use specific tools and APIs
- **Best Practices**: Coding standards for a specific stack
- **Workflows**: Step-by-step guides for common tasks
- **MCP Integration**: References to MCP tools for enhanced capabilities

---

## Skill Locations

OpenCode searches these locations for skills (`<name>/SKILL.md`):

| Location                                    | Scope                           |
| ------------------------------------------- | ------------------------------- |
| `skills/<name>/SKILL.md`                    | Project (current configuration) |
| `.opencode/skills/<name>/SKILL.md`          | Project (OpenCode native)       |
| `~/.config/opencode/skills/<name>/SKILL.md` | Global (OpenCode native)        |
| `.claude/skills/<name>/SKILL.md`            | Project (Claude-compatible)     |
| `~/.claude/skills/<name>/SKILL.md`          | Global (Claude-compatible)      |

---

## Skill Format (SKILL.md)

Each `SKILL.md` must start with YAML frontmatter:

```markdown
---
name: git-release
description: Create consistent releases and changelogs
license: MIT
compatibility: opencode
metadata:
  audience: maintainers
  workflow: github
---

## What I do

- Draft release notes from merged PRs
- Propose a version bump
- Provide a copy-pasteable `gh release create` command

## When to use me

Use this skill when preparing a tagged release.
Ask clarifying questions if the versioning is unclear.
```

### Required Fields

| Field         | Requirements                                                                                         |
| ------------- | ---------------------------------------------------------------------------------------------------- |
| `name`        | 1–64 chars, lowercase alphanumeric with hyphens (`^[a-z0-9]+(-[a-z0-9]+)*$`), must match folder name |
| `description` | 1–1024 chars, specific enough for agents to choose correctly                                         |

### Optional Fields

| Field           | Purpose                                                     |
| --------------- | ----------------------------------------------------------- |
| `license`       | SPDX identifier (e.g., `MIT`, `Apache-2.0`)                 |
| `compatibility` | Platform compatibility (e.g., `opencode`)                   |
| `metadata`      | String-to-string map for tags/audience info                 |
| `agents`        | Default agent assignments (overrides index.json if present) |

---

## Skill Registry

Skills are registered in `skills/index.json` with agent assignments. There are currently **44 registered skills**.

### By Category

#### Coding & Implementation

| Skill                      | Agents                              | Description                         |
| -------------------------- | ----------------------------------- | ----------------------------------- |
| `coding-agent`             | core-factory                        | Structured coding with verification |
| `laravel-feature-scaffold` | backend-laravel, core-factory       | Laravel feature scaffolding         |
| `database-design`          | software-architect, backend-laravel | DB schema design                    |
| `react-reuse-audit`        | frontend-ui-ux                      | React component reuse audit         |
| `android`                  | android-kotlin, devops-engineer     | Android dev core                    |
| `android-compose`          | android-kotlin                      | Jetpack Compose UI                  |
| `android-gradle`           | android-kotlin, devops-engineer     | Gradle build system                 |
| `android-testing`          | android-kotlin                      | Android testing                     |
| `android-debugging`        | android-kotlin, devops-engineer     | Android debug & inspect             |
| `android-deployment`       | android-kotlin, devops-engineer     | Android deployment                  |

#### Testing & Security

| Skill              | Agents                       | Description                  |
| ------------------ | ---------------------------- | ---------------------------- |
| `testing-strategy` | qa-guardian                  | Test planning and coverage   |
| `pest-testing`     | backend-laravel, qa-guardian | Pest testing for Laravel/PHP |
| `security-review`  | qa-guardian                  | Vulnerability assessment     |
| `skill-vetter`     | qa-guardian                  | Skill security vetting       |
| `agent-browser`    | scout                        | Web browsing automation      |

#### UI/Design

| Skill                       | Agents         | Description                        |
| --------------------------- | -------------- | ---------------------------------- |
| `ui-ux-pro-max`             | frontend-ui-ux | Premium UI/UX design tokens        |
| `visual-design-foundations` | frontend-ui-ux | Typography, color, spacing         |
| `charts`                    | frontend-ui-ux | Chart and visualization generation |
| `web-shader-extractor`      | frontend-ui-ux | WebGL/Canvas effect extraction     |

#### Meta & Ops

| Skill                | Agents                              | Description                    |
| -------------------- | ----------------------------------- | ------------------------------ |
| `self-improver`      | core-factory, lead-strategist       | Self-evolution and improvement |
| `self-reflection`    | lead-strategist, software-architect | Config effectiveness analysis  |
| `config-doctor`      | core-factory, devops-engineer       | Configuration integrity        |
| `skill-creator`      | software-architect                  | Create and optimize skills     |
| `project-memory`     | docs-curator, core-factory          | Conventions and memory         |
| `prompt-engineering` | core-factory, lead-strategist       | Prompt patterns                |

#### Orchestration & Process

| Skill                | Agents                              | Description                       |
| -------------------- | ----------------------------------- | --------------------------------- |
| `stack-context`      | core-factory, lead-strategist       | Stack detection and context       |
| `workflow-manager`   | lead-strategist                     | Multi-step workflow orchestration |
| `dynamic-workflow`   | lead-strategist                     | Dynamic workflow management       |
| `spec-driven-design` | software-architect, lead-strategist | Spec before implementation        |

#### Research & Analysis

| Skill                     | Agents                           | Description                      |
| ------------------------- | -------------------------------- | -------------------------------- |
| `deep-research`           | docs-curator, software-architect | Domain research                  |
| `knowledge-architect`     | docs-curator, software-architect | Knowledge graph management       |
| `qingyan-research`        | docs-curator                     | Deep web research + HTML reports |
| `market-research-reports` | docs-curator                     | 50+ page market reports          |
| `contentanalysis`         | docs-curator                     | Content creation and analysis    |

#### Content & Marketing

| Skill                | Agents       | Description                |
| -------------------- | ------------ | -------------------------- |
| `content-strategy`   | docs-curator | Marketing content strategy |
| `seo-content-writer` | docs-curator | SEO-optimized content      |
| `storyboard-manager` | docs-curator | Story planning             |

#### Documents & Media

| Skill  | Agents       | Description               |
| ------ | ------------ | ------------------------- |
| `pdf`  | docs-curator | PDF creation              |
| `docx` | docs-curator | Word document creation    |
| `ppt`  | docs-curator | Presentation creation     |
| `xlsx` | docs-curator | Excel file manipulation   |
| `TTS`  | docs-curator | Text-to-speech generation |

#### Search & Utility

| Skill                 | Agents                        | Description             |
| --------------------- | ----------------------------- | ----------------------- |
| `web-search`          | scout, docs-curator           | Web search              |
| `web-reader`          | scout, docs-curator           | Page content extraction |
| `multi-search-engine` | scout, docs-curator           | Multi-engine search     |
| `auto-target-tracker` | core-factory                  | Target tracking         |
| `agent-browser`       | scout                         | Browser automation      |
| `git-release`         | devops-engineer, docs-curator | Release management      |

#### Social & Creative

| Skill      | Agents       | Description                |
| ---------- | ------------ | -------------------------- |
| `anti-pua` | docs-curator | Anti-manipulation analysis |

### Agent → Skills Assignment

| Agent                  | Assigned Skills                                                                                                                                                                                                                                                         |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **core-factory**       | coding-agent, auto-target-tracker, config-doctor, laravel-feature-scaffold, project-memory, prompt-engineering, self-improver, stack-context, xlsx                                                                                                                      |
| **lead-strategist**    | dynamic-workflow, prompt-engineering, self-improver, self-reflection, spec-driven-design, stack-context, workflow-manager                                                                                                                                               |
| **software-architect** | database-design, deep-research, knowledge-architect, self-reflection, skill-creator, spec-driven-design                                                                                                                                                                 |
| **frontend-ui-ux**     | charts, react-reuse-audit, ui-ux-pro-max, visual-design-foundations, web-shader-extractor                                                                                                                                                                               |
| **backend-laravel**    | database-design, laravel-feature-scaffold, pest-testing                                                                                                                                                                                                                 |
| **backend-tauri**      | —                                                                                                                                                                                                                                                                       |
| **qa-guardian**        | pest-testing, security-review, skill-vetter, testing-strategy                                                                                                                                                                                                           |
| **devops-engineer**    | android, android-gradle, android-debugging, android-deployment, config-doctor, git-release                                                                                                                                                                              |
| **docs-curator**       | anti-pua, content-strategy, contentanalysis, deep-research, docx, git-release, knowledge-architect, market-research-reports, multi-search-engine, pdf, ppt, project-memory, qingyan-research, seo-content-writer, storyboard-manager, TTS, web-reader, web-search, xlsx |
| **scout**              | agent-browser, web-reader, web-search, multi-search-engine                                                                                                                                                                                                              |
| **android-kotlin**     | android, android-compose, android-gradle, android-testing, android-debugging, android-deployment                                                                                                                                                                        |

---

## MCP Server Integration

| MCP Server            | Used By Skills                       | Purpose                          |
| --------------------- | ------------------------------------ | -------------------------------- |
| `context7`            | stack-context                        | Up-to-date documentation         |
| `sqlite`              | testing-strategy, database-design    | Database operations, test data   |
| `sequential-thinking` | workflow-manager, spec-driven-design | Step-by-step reasoning           |
| `memory`              | self-improver, project-memory        | Persistent state across sessions |
| `filesystem`          | all skills                           | File operations                  |

---

## Using Skills

### Automatic Discovery

Agents discover available skills via the `skill` tool descriptor and load them when relevant. Use the `skill-manager` plugin tools to explore:

```bash
# List all registered skills
skill_list

# Search for skills by keyword
skill_search query:"pdf"

# Get detailed info about a skill
skill_info skillName:"git-release"
```

### Explicit Loading

Agents load skills by calling the native `skill` tool:

```
skill({ name: "git-release" })
```

### Skill Permissions

Control which skills agents can access via pattern matching in `opencode.json`:

```json
{
  "permission": {
    "skill": {
      "*": "allow",
      "internal-*": "deny",
      "experimental-*": "ask"
    }
  }
}
```

| Permission | Behavior                   |
| ---------- | -------------------------- |
| `allow`    | Skill loads immediately    |
| `deny`     | Skill hidden from agents   |
| `ask`      | User prompted for approval |

---

## Creating a Skill

1. Create a folder: `skills/my-skill/` (or `.opencode/skills/my-skill/`)
2. Add a `SKILL.md` with YAML frontmatter (name, description required)
3. Register in `skills/index.json` if using the project registry:

```json
{
  "name": "my-custom-skill",
  "description": "Handles XYZ tasks with precision.",
  "agents": ["core-factory"],
  "category": "custom"
}
```

4. Follow the frontmatter standard:
   - `name`: lowercase, hyphens, matches folder name
   - `description`: 1-1024 chars, specific enough for agent routing
   - `license`: SPDX identifier (optional)
   - `compatibility`: e.g., `opencode` (optional)
   - `metadata`: tags/audience info (optional)

---

## Integration with Plugins

### Agent Router + Skill Manager

```
User: "Generate a PDF report"
→ agent-router: Detects "pdf" keyword, recommends docs-curator
→ skill-manager: Confirms pdf skill is available
→ docs-curator: Loads pdf skill automatically
→ Result: PDF generated using skill instructions
```

### MCP Manager + Skills

```
Before using context7-dependent skills:
→ mcp-manager: mcp_list → Verify context7 is enabled
→ mcp-manager: mcp_check serverName:"context7" → Check health
→ stack-context skill: Uses context7 to fetch up-to-date docs
```

---

> **Tip:** Use `skill_search` to discover available skills, `skill_info` for details, and `route_agent` to find the best agent for your skill-specific task.
