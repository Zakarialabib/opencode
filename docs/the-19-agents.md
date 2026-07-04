# Agents Guide — meet the 19

I split the team the way a small studio splits it. One orchestrator, then a roster of specialists who only do their thing. Each agent has a tailored prompt, a permission profile, a temperature, and a role. The full config is in [`opencode.json`](../opencode.json) under `agent`. The per-agent .md files in `agents/` are kept in sync with that config.

> **Source of truth**: `opencode.json` wins. The .md frontmatter is for humans and for any tooling that reads files. If they disagree, the JSON wins.

---

## the roster at a glance

I group them by what they actually do, not by what their titles say.

### the orchestrator

| Agent | Why it exists |
| --- | --- |
| **core-factory** | The one. Decomposes requests, delegates to specialists, synthesizes results, runs verification. 50 steps. Temperature 0.3 — low enough to be reliable, high enough to be useful. The default. |

### the planners (read mostly, write sometimes)

| Agent | Why it exists |
| --- | --- |
| **lead-strategist** | "Should we even do this?" Feasibility, gap analysis, strategic coordination. The product architect. Temperature 0.4 because it does need to think laterally. |
| **software-architect** | "If we should, how?" System design, Node/Bun backend, the technical backbone. Temperature 0.2 — methodical. |
| **plan** | Read-only analyst. Architecture review, risk assessment, never modifies files. Temperature 0.1 — predictable. |
| **refactor-architect** | Plans refactors, never implements. Ordered migration plan with risk tags and rollback. The "before we touch this legacy code" voice. |

### the implementers (write code, run things)

| Agent | Why it exists |
| --- | --- |
| **frontend-ui-ux** | React + TypeScript + Tailwind + shadcn. Premium UI, no placeholder onClicks. Temperature 0.4 — design needs some creativity. |
| **backend-laravel** | Laravel 13 + Livewire 4. PascalCase models, snake_case tables, Form Requests, Pest. Runs `php artisan pint` after every edit. |
| **backend-tauri** | Rust + Tauri. `cargo check` after every edit, `Result<T, String>` for every IPC command, no `unsafe` without a comment. |
| **android-kotlin** | Jetpack Compose, Clean Architecture, the Tauri mobile bridge. Coroutines + Flow, sealed classes, no Java-style getters. |
| **devops-engineer** | Databases, processes, caches, dependencies. The ops person. Never runs destructive commands without confirmation. |

### the gatekeepers (find problems, don't fix them)

| Agent | Why it exists |
| --- | --- |
| **qa-guardian** | The quality gatekeeper. Temperature 0.05 — coldest in the team. Produces CRITICAL/WARNING/INFO findings with one-line fixes. |
| **code-reviewer** | Read-only audit. Diffs, risks, no edits. The "before merge" voice. |
| **integration-test** | Writes + runs Vitest, Pest, Playwright, JUnit. Stack-aware via file-path detection. |
| **mobile-qa** | Runs the Android build on emulator, captures logs and screenshots. The "does it actually work on a phone" voice. |

### the searchers (find things, report back)

| Agent | Why it exists |
| --- | --- |
| **explore** | Fast search. Maximum 3 tool calls per question. Locate files, find patterns, report file:line. Temperature 0.0 — pure search. |
| **scout** | External research. Webfetch + websearch, upstream docs, dependency comparison. Never modifies local files. |
| **research-analyst** | Best-practices + library comparison + gap analysis. Web + context7 powered. Never edits. |

### the writers (docs, ADRs, changelogs)

| Agent | Why it exists |
| --- | --- |
| **docs-curator** | Technical writing. Accuracy over completeness — never document what you haven't verified. |
| **docs-evolver** | ADRs, changelog, doc/code drift fixes. The one that can write to `docs/adr/` and `CHANGELOG.md` without asking. |

---

## per-agent cards (the personality notes)

### core-factory

**The orchestrator.** You'll be talking to this one most of the time. It parses your request, decides which specialists are needed, delegates in parallel when possible, synthesizes the results, and runs verification.

**Prompt excerpt:**

> "Analyze user requirements and decompose into sub-tasks. Delegate complex tasks to specialized agents with a compressed briefing. For simple tasks: implement directly with fast execution. Synthesize and validate results from all agents."

**Permissions:** can read, write, edit, run bash for git/npm/cargo/pint (allowed), can delegate to all 18 other agents (task permission set explicitly per agent).

**When I use it:** every complex request, and any request where I don't know which agent to call directly. It's the safe default.

---

### lead-strategist

**The product architect.** Asks "should we even do this?" before any work starts. Good for: feature planning, gap analysis, feasibility studies, deciding between approaches.

**When I use it:** before any non-trivial feature, any architectural change, any "do I rewrite or patch" decision.

---

### software-architect

**The technical backbone.** System design + Node/Bun backend. Makes the technical decisions: patterns, libraries, data flow, module boundaries. Also implements the Node layer.

**When I use it:** when I'm building an API, designing a system, or need a senior engineer to make the call.

---

### frontend-ui-ux

**The premium UI engineer.** React + TypeScript + Tailwind + shadcn. Has a hard rule: design tokens only (no hardcoded colors), shadcn primitives (no reimplementing Button), accessibility is not optional.

**When I use it:** any UI work. Also has 30 steps so it doesn't get stuck in a loop.

---

### backend-laravel

**The Laravel specialist.** Hard rules: PascalCase models, snake_case tables, Form Requests for all validation, Resource classes for API responses, PHP 8.2+ readonly properties, Pest (not PHPUnit). Runs `php artisan pint` on every edited `.php` file. No exceptions.

**When I use it:** any Laravel work. I don't let `core-factory` write Laravel unless the change is one line.

---

### backend-tauri

**The Rust/Tauri specialist.** Hard rules: `cargo check` after every edit, `Result<T, String>` for every IPC command, no `unsafe` without a `// SAFETY:` comment, `tauri::State<T>` wrapped in `Mutex`/`RwLock`, async via `tauri::async_runtime::spawn`. Never blocks the main thread.

**When I use it:** any Rust or Tauri work. The temperature is 0.2 — Rust doesn't reward creativity.

---

### android-kotlin

**The Android/Kotlin dev.** Clean Architecture, Jetpack Compose, the Tauri mobile bridge. Coroutines + Flow, sealed classes for state modeling, no Java-style getters. The Tauri→Android bridge uses the generated Kotlin bindings, not custom JNI.

**When I use it:** any Android work, and any Tauri mobile work.

---

### qa-guardian

**The gatekeeper.** Temperature 0.05 — the coldest in the team. Output is strict: `## [SEVERITY] file:line — description / Suggested fix: one-line`. CRITICAL, WARNING, INFO. Reads files, runs LSP, runs tests, runs lint, reports actual output — never says "tests should pass."

**When I use it:** before any merge, after any non-trivial change, as the second pass on every delegated task. It's the one that catches the off-by-one I missed.

---

### code-reviewer

**The read-only auditor.** Reviews diffs, identifies risks, produces CRITICAL/WARNING/INFO reports. Doesn't fix anything — reports and steps back.

**When I use it:** when I want a fresh pair of eyes on a diff without the reviewer "improving" my code.

---

### integration-test

**The test author + runner.** Generates tests (Vitest, Pest, Playwright, JUnit), runs them, reports coverage. Stack-aware via file-path detection. Can write and run.

**When I use it:** after implementing a feature, before declaring done.

---

### mobile-qa

**The Android QA.** Runs the Android build on emulator, captures logs and screenshots, runs UI tests on connected devices. The "does it work on a real phone" voice.

**When I use it:** after any Android feature work.

---

### devops-engineer

**The ops person.** Databases (init, migrate, backup, query via sqlite MCP), processes (health checks, restart), caches (clear npm/vendor/target), dependencies (check for updates, install).

**Hard rule:** never runs destructive commands (`rm -rf`, `DROP`, `TRUNCATE`) without explicit confirmation. Always prefers idempotent operations. Backups before destructive work.

**When I use it:** for any ops work. Never for code changes.

---

### docs-curator

**The technical writer.** Hard rule: never document what you have not verified. If you can't read the file, don't write about it. Code examples over verbal descriptions. Keep docs DRY: link to source files instead of duplicating content.

**When I use it:** for any documentation work. The system prompt explicitly forbids inventing features.

---

### docs-evolver

**The doc drift fixer.** The only agent that can write to `docs/adr/**`, `CHANGELOG.md`, and `README.md` without asking. Drafts ADRs from architectural decisions made mid-session. Keeps CHANGELOG.md aligned with commits.

**When I use it:** after an architectural decision, after a release, when `/sync-docs` reports drift.

---

### plan

**The read-only analyst.** Produces structured analysis in this exact format: `FINDINGS / RISKS / GAPS / DECISIONS NEEDED`. Never modifies files. Honest about what it can't verify — marks claims `[unverified]`.

**When I use it:** when I want a second opinion without the second opinion implementing anything.

---

### explore

**The search engine.** Maximum 3 tool calls per question. Answer with exact file paths and line numbers. If not found, say "not found" — never fabricate.

**When I use it:** constantly. It's the workhorse for "where is X" / "how does Y work" / "find all usages of Z."

---

### scout

**The external researcher.** webfetch + websearch. Compares upstream docs, fetches API references, never modifies local files. Includes source URLs for every claim.

**When I use it:** when I need to know what a library does, what changed in a new version, or what a competitor is up to.

---

### research-analyst

**The best-practices researcher.** Library comparison + gap analysis. Web + context7 powered. Read-only.

**When I use it:** when I'm choosing a library, evaluating a pattern, or doing a tech brief.

---

### refactor-architect

**The refactor planner.** Plans structural refactors, never implements them. Produces ordered migration plan with risk tags and rollback strategy.

**When I use it:** before touching legacy code, before any "let's clean this up" sprint.

---

## permission model (the rules I follow)

Every agent has a `permission` object. The rules:

1. **`read` is `allow` everywhere.** Even gatekeepers need to read.
2. **`edit` is `deny` for read-only agents** (`plan`, `code-reviewer`, `scout`, `research-analyst`, `refactor-architect`, `explore`, `qa-guardian`, `mobile-qa` mostly).
3. **`bash` is `ask` by default**, with specific commands whitelisted per agent. `core-factory` can run git/npm/cargo/pint without asking. The Rust agent can run cargo. The Laravel agent can run php/artisan/pest/pint.
4. **`task` is `deny` for read-only agents.** Specialists don't delegate; the orchestrator does.
5. **MCP permissions use the `_*` suffix** (`context7_*`, `memory_*`, `sqlite_*`, etc.). The actual server config is in `opencode.json §mcp`.

If you want to add a new agent, the template is:

```json
"new-agent": {
  "mode": "subagent",
  "steps": 20,
  "temperature": 0.2,
  "color": "#abcdef",
  "description": "One line — what does it own",
  "prompt": "The system prompt. Be specific about what it does NOT do.",
  "permission": {
    "read": "allow",
    "edit": "allow",
    "bash": { "*": "ask", "allowed-cmd": "allow" }
  }
}
```

And a matching `agents/new-agent.md` with a one-paragraph role summary. Keep them in sync. `/sync-docs` will tell you when they drift.

---

## how routing actually works

The `agent-router` plugin scores a task by:

1. **Keyword match** — words like "implement", "fix", "design", "audit", "research" map to different agent archetypes.
2. **Skill match** — if the task references a skill (e.g., "use laravel-feature-scaffold"), the router biases toward the matching agent.
3. **Stack match** — if the path or filename hints at a stack, the stack specialist wins.

If the score is below threshold, the router says "no match" and `core-factory` handles it. That's a feature, not a bug — better to default to the orchestrator than route wrong.

You can override the router with `@agent-name` syntax:

> "@backend-laravel add a CSV export endpoint to the orders controller"

The router is bypassed. The named agent handles it directly.

---

## what to read next

- **The skills** that these agents load on-demand — [the-46-skills.md](the-46-skills.md)
- **The plugins** that wire the memory and routing — [the-11-plugins.md](the-11-plugins.md)
- **The workflows** that choreograph multi-agent tasks — [the-9-workflows.md](the-9-workflows.md)
- **The system prompt** every agent reads at session start — [AGENT.md](../AGENT.md)
