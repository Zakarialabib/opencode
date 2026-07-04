# User Guide — your first session

This is the doc I wish I'd had when I started. It's the 10-minute tour: clone, install, start, do one real thing, end the session. After that you can read the rest of the docs in whatever order you want.

---

## the 10-minute tour

### 0. open the project

```bash
cd opencode
```

The `opencode.json` in the root is the whole config. If you want to know what 19 agents + 11 plugins + 12 MCP servers looks like in one file, open it. It's 850 lines and well-commented.

### 1. install deps (~30s)

```bash
npm install
```

This pulls in the opencode runtime, the type definitions for the plugin API, and the test runner (vitest). Nothing exotic.

### 2. start the TUI

```bash
npm start
```

You should see a terminal UI with the active agent name in the header (defaults to `core-factory`), a chat input at the bottom, and a session sidebar.

### 3. first command: check the harness

Inside the TUI, type:

```
/harness
```

The `core-factory` agent runs `project_detect` → `project_status` and reports:

```
[Project Profile]
Stack: opencode (this repo is a Tauri+React+Laravel workspace)
Default Agent: core-factory
Model: opencode/deepseek-v4-flash-free
Plugins: 11 active
Memory: 0 fragments (empty — expected on first run)
```

If the stack line is empty, you don't have a manifest file in the root. Add one — `package.json`, `Cargo.toml`, `composer.json`, or `build.gradle.kts` — and run `/harness` again.

### 4. ask for something real

The first thing I always do is a real task, not a demo. Try:

> "I'm a Tauri+React+Laravel dev. Read `agents/core-factory.md` and tell me what permissions it has."

The `explore` agent will spin up, find the file, read it, and report. Three tool calls, ten seconds.

### 5. end the session

When you're done, run:

```
memory_session outcome="success" task="first session, just exploring"
```

That writes a summary to `.opencode/session-summaries.json`. The next time you start a session in the same project, that summary is in the context.

---

## the philosophy, in five rules

These are the rules I baked into `AGENT.md` §2. Every agent in the system follows them. The agents that don't, get rewritten by the self-improver.

1. **Read before write.** An agent that edits a file it didn't read is guessing. Don't let agents guess.
2. **Search before ask.** The model is fast. The docs are in the repo. Use them before pinging me.
3. **Cite or concede.** Every claim about a library, an API, a file — must come from a tool call. No fabrications.
4. **Spec before code.** More than 3 files or more than 1 architectural decision? Write the plan first.
5. **Verify before done.** Ambient LSP + tests + a self-review pass. The same rules a senior engineer follows.

If you only remember one thing, remember this: **agents are not magic. They're a junior engineer with infinite patience. Supervise them like one.**

---

## how a task actually flows

Here's the lifecycle, no marketing:

```
you: "Add a CSV export button"
  ↓
core-factory: parses the request, looks at the stack, picks the right agent
  ↓
core-factory: delegates to frontend-ui-ux (UI) + backend-laravel (API) in parallel
  ↓
both agents: read existing files, write changes, run ambient LSP
  ↓
core-factory: synthesizes, runs qa-guardian on the diff
  ↓
qa-guardian: reports CRITICAL/WARNING/INFO findings
  ↓
core-factory: fixes CRITICALs, reports back to you
  ↓
you: see the diff, run tests, ship
```

No "AI magic" step. No hand-wavy "the agents collaborated." Just clear delegation + clear verification.

---

## the 3 modes of working with this

### mode 1: "just do it"

You describe what you want. `core-factory` does the rest. Good for: bug fixes, small features, routine refactors.

> "Add a `created_at` index to the `orders` table migration"

That's it. One sentence. The orchestrator does the rest.

### mode 2: "let's plan first"

You explicitly ask for a plan. Good for: features that touch 3+ files, architectural decisions, anything risky.

> "Plan how we'd add Stripe subscriptions to this app. Don't write code yet."

`lead-strategist` takes the request, produces a written plan, asks for approval, then delegates.

### mode 3: "I want to do it myself, you help"

You use `plan` (read-only) for analysis and `explore` for search, but you write the code. Good for: learning, sensitive changes, performance work.

> "@explore find all uses of the `legacy_order_processor` function"

---

## working on a project that isn't this repo

The harness works on any project — Tauri apps, Laravel APIs, React SPAs, plain PHP, mixed stacks. Stack detection runs on the first chat.

```bash
# Point the agents at any project
@explore Map the project at C:\Projects\my-app.
Read package.json, Cargo.toml, composer.json — which exist?
List top-level directories and src/ structure.
```

The router reads the manifests and picks the right specialist. The rest is the same.

| Manifest found | Stack detected | Routes to |
| --- | --- | --- |
| `Cargo.toml` + `tauri` | Tauri desktop app | `@backend-tauri` + `@frontend-ui-ux` |
| `composer.json` + `laravel` | Laravel web app | `@backend-laravel` |
| `composer.json` + `livewire` | Livewire app | `@backend-laravel` + `@frontend-ui-ux` |
| `package.json` + `react` | React SPA | `@frontend-ui-ux` |
| `package.json` + `solid` | Solid.js SPA | `@frontend-ui-ux` |
| `composer.json` only | Plain PHP | `@backend-laravel` |
| Multiple manifests | Hybrid (multi-stack) | Multiple agents in sequence |

---

## the 20 slash commands, in priority order

The 20 commands are in `opencode.json` §command. The 8 I actually use, in the order I use them:

| Command | When I use it |
| --- | --- |
| `/harness` | First command in a new workspace. |
| `/sync-docs` | After any config change, to make sure the docs didn't drift. |
| `/improve` | Once a week, on the harness config itself. |
| `/test` | Before committing. |
| `/lint` | After every save, via the formatter hook. |
| `/build` | When I need a binary. |
| `/db:backup` | Before any migration work. |
| `/check-updates` | Once a month. |

The other 12 (`/doctor`, `/reflect`, `/upgrade-config`, `/audit`, `/clean`, `/db:init`, `/sync-skills`, `/collect-conventions`, and 4 more) are useful but I don't hit them daily. Full list in the README.

---

## troubleshooting (the 5 things that actually break)

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| `/harness` returns empty | No manifest in repo root | Add `package.json`, `Cargo.toml`, `composer.json`, or `build.gradle.kts` |
| Agent output is off-topic | Memory injected stale conventions | `memory_forget` the bad ones, or start a fresh session |
| `route_agent` returns "no match" | Task is too vague | Add specific verbs: "implement", "fix", "design", "audit" |
| `/sync-docs` flags 30 drifts | You just rewrote the config | Run with `autoFix: true` for frontmatter-only fixes |
| `memory_recall` returns nothing | You're on a new project, or `.opencode/` was deleted | That's expected. It'll fill up as you work |

---

## the day-2 setup

After your first session, do this once:

1. **Add your stack conventions.** Type things like "Always use `pest`, not `phpunit`" or "Decision: stick with SQLite for local storage" in normal conversation. The `chat.message` hook auto-extracts them.
2. **Run `/sync-docs`** to clean up any drift from the rewrite you just did.
3. **Set up a cron job** (or a reminder) to run `/harness` weekly. It's the canary.
4. **Read [docs/the-improvement-cycle.md](the-improvement-cycle.md)** when you're ready for the self-improvement loop. That's where the real leverage is.

---

## what to read next

- **The agents** — [the-19-agents.md](the-19-agents.md)
- **The skills** — [the-46-skills.md](the-46-skills.md)
- **The plugins** — [the-11-plugins.md](the-11-plugins.md)
- **The workflows** — [the-9-workflows.md](the-9-workflows.md)
- **The improvement cycle** — [the-improvement-cycle.md](the-improvement-cycle.md)
- **The system prompt itself** — [AGENT.md](../AGENT.md) — this is what every agent reads at session start. The whole philosophy in one file.
