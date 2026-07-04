# Skills Guide — the 46

A skill is a folder with a `SKILL.md` file. YAML frontmatter at the top, instructions below. Agents load skills on-demand via the `skill` tool when a task matches the description.

I started with zero skills and added them as I needed them. Now there are 46. Some are general-purpose, some are stack-specific, some are self-improvement (the ones I lean on hardest).

---

## what a skill actually is

```markdown
---
name: git-release
description: Create consistent releases and changelogs
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

That's it. The frontmatter tells the runtime what the skill is for. The body tells the agent how to use it. The agent decides when to load it based on the description.

---

## where skills live

The runtime searches, in order:

| Location | Scope |
| --- | --- |
| `skills/<name>/SKILL.md` | Project (this config) |
| `.opencode/skills/<name>/SKILL.md` | Project (opencode native) |
| `~/.config/opencode/skills/<name>/SKILL.md` | Global (opencode native) |
| `.claude/skills/<name>/SKILL.md` | Project (claude-compatible) |
| `~/.claude/skills/<name>/SKILL.md` | Global (claude-compatible) |

I keep everything in `skills/` for portability. The full registry is in `skills/index.json`. The runtime is told about the path via `opencode.json §skills.paths: ["./skills"]`.

---

## the 46, grouped by what they actually do

### build a feature (6)

| Skill | What it gives the agent |
| --- | --- |
| `laravel-feature-scaffold` | Laravel 13 + Livewire 4 feature scaffold: model, migration, controller, request, resource, test |
| `database-design` | Schema proposal workflow with FK relationships, indexes, and ER diagrams |
| `spec-driven-design` | Spec-first design workflow for non-trivial features |
| `dynamic-workflow` | Composable workflow steps that adapt to the task |
| `workflow-manager` | Create and manage yaml workflows |
| `stack-context` | Cross-stack awareness — detects current stack and adapts |

These are the ones that show up in every feature workflow. If you add a new agent, wire it to load these.

### code quality (6)

| Skill | What it gives the agent |
| --- | --- |
| `code-review` | Structured code review checklist |
| `react-reuse-audit` | Find React components that should be extracted, hooks that should be shared |
| `security-review` | Security audit template with OWASP top 10 |
| `testing-strategy` | Test matrix + coverage planning |
| `pest-testing` | Pest PHP patterns (not PHPUnit) |
| `testing-basics` | Testing fundamentals for new contributors |

I use `code-review` and `security-review` together for any PR-bound change. The `react-reuse-audit` is a sleeper hit — it's caught real duplication in my own code.

### docs + knowledge (10)

| Skill | What it gives the agent |
| --- | --- |
| `documentation` | Writing standards for project docs |
| `docs-governance-audit` | Audit docs for drift, staleness, missing pieces |
| `knowledge-architect` | Knowledge base structure and classification |
| `deep-research` | Structured research report template |
| `stitch-design-md` | The stitch `DESIGN.md` format (Google Labs' design spec) |
| `stitch-extract-design-md` | Extract a `DESIGN.md` from a Figma/code source |
| `stitch-manage-design-system` | Manage a design system from `DESIGN.md` |
| `stitch-taste-design` | Apply the stitch taste-quality bar to UI work |
| `stitch-code-to-design` | Map code to design tokens and components |
| `lsp-navigation` | LSP navigation patterns (go to def, find refs, etc.) |
| `project-memory` | Store and recall project context |

The 6 stitch skills came from a Google Labs design tool I was playing with. They're a coherent system for design-to-code. I keep them grouped because they only make sense together.

### self-improvement (6)

These are the ones I lean on hardest.

| Skill | What it gives the agent |
| --- | --- |
| `self-improver` | The full improvement cycle: env scan → knowledge gather → LSP analysis → skill audit → auto-format → adapt |
| `self-reflection` | Audit `opencode.json` and propose changes |
| `prompt-engineering` | Generate, rewrite, evaluate, audit, history for agent prompts |
| `skill-creator` | Scaffold a new skill with proper frontmatter |
| `skill-vetter` | Audit existing skills for quality issues |
| `config-doctor` | Audit + repair the harness config |

The self-improver + prompt-engineering + self-reflection trio is what makes the harness actually self-improving. Without them, the agents are static.

### git + release (2)

| Skill | What it gives the agent |
| --- | --- |
| `git-workflow` | Branch strategy, commit format, PR template |
| `git-release` | Tag, release notes, changelog, GitHub release |

The release skill is the only one I trigger manually — I want to be there for releases.

### Android (5)

The `android` skill is a parent with 5 sub-skills:

| Sub-skill | What it gives the agent |
| --- | --- |
| `android` (root) | Tauri mobile bridge overview |
| `compose` | Jetpack Compose patterns and conventions |
| `gradle` | Gradle build file structure and tasks |
| `testing` | JUnit, Espresso, UI testing |
| `debugging` | Logcat, debugger, common Android pitfalls |
| `deployment` | Build, sign, deploy to Play Store / sideload |

The android-kotlin agent loads these as needed.

### Tauri / desktop (1)

| Skill | What it gives the agent |
| --- | --- |
| `stack-context` (covered above) | Cross-stack awareness — Tauri, Electron, native desktop |

Most Tauri work is in the `backend-tauri` agent's prompt, not a separate skill. Skills are for things that change; Tauri conventions don't.

### office docs (5)

| Skill | What it gives the agent |
| --- | --- |
| `pdf` | Generate PDFs from HTML/Markdown via design engine |
| `ppt` | PowerPoint generation from HTML+python-pptx |
| `xlsx` | Excel generation with formulas, charts, styles |
| `docx` | Word docs with proper styles and structure |
| `charts` | Chart generation (echarts, matplotlib, mermaid, d3) |

Honest take: I include these because they're useful scaffolds. I've used `pdf` and `xlsx` in anger, the others mostly for one-off tasks. They're not all battle-tested. Treat them as starting points.

### web research (3)

| Skill | What it gives the agent |
| --- | --- |
| `web-search` | Multi-engine web search |
| `web-reader` | Fetch and parse web pages |
| `multi-search-engine` | Parallel search across Google, Bing, DuckDuckGo, Brave |

The `scout` and `research-analyst` agents use these.

### visual design (2)

| Skill | What it gives the agent |
| --- | --- |
| `ui-ux-pro-max` | Design data + reasoning for UI/UX work |
| `visual-design-foundations` | Color systems, spacing, typography |

The `frontend-ui-ux` agent loads these for any UI task.

### browser + automation (2)

| Skill | What it gives the agent |
| --- | --- |
| `agent-browser` | Browser automation for agents (Playwright-based) |
| `skill-creator` (covered) | Create new skills |

---

## how skills get loaded

Three trigger paths:

1. **Explicit.** The agent prompt references a skill by name: `Use the laravel-feature-scaffold skill to design this feature.` The agent calls `skill({ name: "laravel-feature-scaffold" })` and the skill body is injected into context.
2. **Implicit by description.** The runtime matches the task to skill descriptions. If a request mentions "CSV export" and the `xlsx` skill has a description mentioning "spreadsheet," the runtime can suggest loading it.
3. **Agent defaults.** Some agents have skills they always load. The `frontend-ui-ux` agent defaults to `ui-ux-pro-max` and `visual-design-foundations`.

I try not to load more than one skill per step. Loading multiple skills bloats context fast. Skills are loaded → used → discarded.

---

## how to add a skill

The minimum:

```bash
mkdir skills/my-skill
```

Then create `skills/my-skill/SKILL.md`:

```markdown
---
name: my-skill
description: One sentence — what is this for and when should an agent load it
compatibility: opencode
metadata:
  audience: who uses it
  workflow: github | jira | none
---

## What I do

- step 1
- step 2

## When to use me

Trigger conditions. Be specific.
```

Then add it to `skills/index.json` (the runtime discovers skills on the path, but the index is for tooling).

Then load it explicitly in an agent prompt if you want it to be the default for that agent:

```
"prompt": "...for security audits, use the security-review skill first."
```

The `skill-vetter` skill will tell you if your frontmatter is broken. The `/sync-docs` command will tell you if the path doesn't resolve.

---

## how to retire a skill

Delete the folder. Remove from `skills/index.json`. Run `/sync-docs` to confirm. Done.

Don't keep dead skills around. Stale skills cause more drift than they save time.

---

## the rules I follow

1. **One skill, one job.** A skill that tries to do everything does nothing well.
2. **Frontmatter is the contract.** The description is the only thing the runtime uses to decide. Write it like a 1-sentence ad.
3. **Body is for the agent, not the user.** The body is the instruction set. It's loaded into context, so keep it tight.
4. **No copy-paste from other skills.** Skills that are 90% the same as another skill should be merged.
5. **Test in real work, not in `/demo`.** A skill is real when it's been used to ship something.

---

## what to read next

- **The agents** that load these skills — [the-19-agents.md](the-19-agents.md)
- **The plugins** that manage the skill registry — [the-11-plugins.md](the-11-plugins.md)
- **How to write skills** — [skill-creator/SKILL.md](../skills/skill-creator/SKILL.md)
