# 🛠️ Skills Guide

Skills are reusable instructions that agents load on-demand via the native `skill` tool. They provide specialized workflows, best practices, and tool integrations.

> See the official docs: [opencode.ai/docs/skills](https://opencode.ai/docs/skills/)

---

## 🧐 What is a Skill?

A skill is a folder containing a `SKILL.md` file with YAML frontmatter. Agents discover skills automatically and load them when relevant to the task.

Each skill provides:

- **Instructions**: How to use specific tools and APIs
- **Best Practices**: Coding standards for a specific stack
- **Workflows**: Step-by-step guides for common tasks
- **MCP Integration**: References to MCP tools for enhanced capabilities

---

## 📂 Skill Locations

OpenCode searches these locations for skills (`<name>/SKILL.md`):

| Location                                    | Scope                           |
| ------------------------------------------- | ------------------------------- |
| `skills/<name>/SKILL.md`                    | Project (current configuration) |
| `.opencode/skills/<name>/SKILL.md`          | Project (OpenCode native)       |
| `~/.config/opencode/skills/<name>/SKILL.md` | Global (OpenCode native)        |
| `.claude/skills/<name>/SKILL.md`            | Project (Claude-compatible)     |
| `~/.claude/skills/<name>/SKILL.md`          | Global (Claude-compatible)      |

---

## 📋 Skill Format (SKILL.md)

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

| Field           | Purpose                                     |
| --------------- | ------------------------------------------- |
| `license`       | SPDX identifier (e.g., `MIT`, `Apache-2.0`) |
| `compatibility` | Platform compatibility (e.g., `opencode`)   |
| `metadata`      | String-to-string map for tags/audience info |

---

## 🎯 Available Skills

### Core Registered Skills

These skills are managed via `skills/index.json` with agent assignments:

| Skill                          | Category            | Agents                          |
| ------------------------------ | ------------------- | ------------------------------- |
| **`stack-context`**            | context-engineering | core-factory, lead-strategist   |
| **`self-reflection`**          | meta                | lead-strategist, lead-architect |
| **`self-improver`**            | meta                | core-factory, lead-strategist   |
| **`security-review`**          | security            | qa-guardian, docs-curator       |
| **`laravel-feature-scaffold`** | laravel             | backend-laravel, core-factory   |
| **`project-orchestration`**    | orchestration       | lead-strategist                 |
| **`ui-ux-pro-max`**            | design              | frontend-ui-ux                  |
| **`agent-browser`**            | testing             | qa-guardian                     |
| **`testing-strategy`**         | testing             | qa-guardian                     |
| **`database-design`**          | architecture        | lead-architect, core-factory    |
| **`deep-research`**            | research            | docs-curator                    |
| **`docs-governance-audit`**    | documentation       | docs-curator                    |
| **`git-release`**              | devops              | devops-engineer, core-factory   |
| **`react-reuse-audit`**        | frontend            | qa-guardian                     |
| **`workflow-manager`**         | orchestration       | lead-strategist                 |
| **`fullstack-dev`**            | web-development     | backend-api, frontend-ui-ux     |
| **`coding-agent`**             | development         | core-factory                    |
| **`config-doctor`**            | meta                | core-factory, devops-engineer   |
| **`skill-creator`**            | meta                | lead-architect                  |
| **`skill-vetter`**             | security            | qa-guardian                     |
| **`content-strategy`**         | marketing           | docs-curator                    |
| **`blog-writer`**              | content             | docs-curator                    |
| **`seo-content-writer`**       | content             | docs-curator                    |
| **`charts`**                   | data-visualization  | frontend-ui-ux                  |
| **`image-generation`**         | assets              | frontend-ui-ux                  |
| **`image-understand`**         | assets              | frontend-ui-ux                  |
| **`pdf`**                      | documents           | docs-curator                    |
| **`docx`**                     | documents           | docs-curator                    |
| **`ppt`**                      | documents           | docs-curator                    |
| **`xlsx`**                     | documents           | docs-curator                    |
| **`autoresearch`**             | research            | core-factory, lead-strategist   |

### All Skills (63 total)

The full skill registry is in `skills/index.json`. Browse available skills with `skill_list` or search with `skill_search query:"keyword"`.

### MCP Integration

Skills can leverage MCP servers for enhanced capabilities:

| MCP Server            | Used By Skills                    | Purpose                          |
| --------------------- | --------------------------------- | -------------------------------- |
| `context7`            | stack-context, deep-research      | Up-to-date documentation         |
| `sqlite`              | testing-strategy, database-design | Database operations, test data   |
| `sequential-thinking` | workflow-manager                  | Step-by-step reasoning           |
| `memory`              | self-improver, workflow-manager   | Persistent state across sessions |
| `fetch`               | agent-browser, deep-research      | Web content fetching             |

---

## 🔬 Spotlight: Autoresearch Skill

The `autoresearch` skill (located at `skills/autoresearch/SKILL.md`) enables autonomous experiment loops for code optimization.

### Key Features

- **Three-file architecture**: `program.md` (human-written instructions), target script (AI-modified), benchmark script (immutable)
- **Bun server benchmarking**: Uses `bun benchmark.js` for accurate local performance measurement
- **Git-based experiment tracking**: Each experiment = 1 commit on `autoresearch/` branch
- **Automatic revert**: Failed experiments are reverted with `git reset --hard HEAD~1`

### Real-World Example: portal.html Optimization

| Metric          | Value                                                     |
| --------------- | --------------------------------------------------------- |
| **Target**      | `docs/portal.html`                                        |
| **Baseline**    | 0.8ms load time                                           |
| **Final**       | 0.5ms load time                                           |
| **Improvement** | 37.5% (exceeds 20% target)                                |
| **Experiments** | 2 commits (`exp 1: Fix invalid CSS`, `exp 2: Minify CSS`) |

### Bun Benchmark Pattern

Create a `benchmark.js` for Bun server-based testing:

```javascript
// benchmark.js - Bun server benchmark
const server = Bun.serve({
  port: 3000,
  fetch(request) {
    // Serve target file
    return Bun.file("target.html");
  },
});

// Run 50 sequential requests
const samples = 50;
let totalLoadTime = 0;
for (let i = 0; i < samples; i++) {
  const start = performance.now();
  const response = await fetch("http://localhost:3000/target.html");
  await response.text();
  totalLoadTime += performance.now() - start;
}

console.log(
  JSON.stringify({
    load_time_ms: Number((totalLoadTime / samples).toFixed(1)),
    samples: samples,
  })
);
server.stop();
```

### program.md Template

Reference `docs/program.md` for the full template structure:

```markdown
# Research Program: Optimize [Target]

## Goal

Reduce [metric] by **20%** when measured via [method].

## Baseline Metric

- **Metric**: [metric_name] (average of N samples)
- **Benchmark**: `bun benchmark.js`
- **Target**: 20% reduction from baseline

## Constraints

- **Only modify**: [target files]
- **Max experiment time**: 5 minutes per iteration
- **No new dependencies**: Keep or remove external resources

## Exploration Areas

### 1. [Area 1]

### 2. [Area 2]

...
```

---

## 🚀 Using Skills

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

## ✍️ Creating a Skill

1. Create a folder: `skills/my-skill/` (or `.opencode/skills/my-skill/`)
2. Add a `SKILL.md` with YAML frontmatter
3. Register in `skills/index.json` if using the project registry:

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

## 🔗 Integration with Plugins

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

> [!TIP]
> Use `skill_search` to discover available skills, `skill_info` for details, and `route_agent` to find the best agent for your skill-specific task.
