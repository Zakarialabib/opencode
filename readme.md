# opencode — my agentic coding setup

I took [opencode](https://opencode.ai), the open source AI coding CLI, and bolted an entire engineering agency onto it. 19 agents, 46 skills, 11 plugins, 12 MCP servers, 9 yaml workflows, plus a memory system that learns from every session. One `npm start` and I have a full team.

This is a learning project. I share it so you can see what an opinionated, free-model-only agentic coding stack looks like in 2026.

---

## who I am

I'm **Zakaria Labib**, a software engineer who works across the stacks that show up in real projects — Tauri/Rust on the desktop, React/TypeScript on the web, Laravel/PHP on the server, Kotlin on Android. I got tired of writing the same agent prompt over and over, so I built a system that handles the boring orchestration for me.

The goal was simple: make opencode actually powerful by applying every best practice I could find, then share the result as open source so others can fork it.

Thanks to the opencode team for the foundation. Everything I built sits on top of their config format, plugin system, and MCP wiring.

---

## what I built on top

Opencode gives you a config file and a CLI. I used both as a substrate and added five layers:

| Layer | What it does | Where it lives |
| --- | --- | --- |
| **1. Project detection** | Reads `package.json`, `Cargo.toml`, `composer.json`, `build.gradle.kts` — figures out your stack automatically | `plugins/project-initializer.ts` |
| **2. Agent routing** | Classifies a task by complexity, picks the right agent | `plugins/agent-router.ts` |
| **3. Doc-code sync** | Spots when docs lie about the code (wrong skill counts, dead MCP refs, agent frontmatter drift) | `plugins/doc-sync.ts` |
| **4. Session memory** | Auto-extracts "Always X", "Decision: Y", "Error: Z" from every chat into a persistent store | `plugins/memory-context.ts` |
| **5. Self-improvement** | Watches the worklog, scores agent prompts, rewrites the weak ones | `plugins/index.ts` + `skills/self-improver/` |

The 11 plugins wire together like this:

```
session starts
  → project-initializer scans the repo
  → memory-context loads your past conventions
  → chat.params injects both into every LLM call
  → chat.message watches for new patterns to store
  → tool.execute.after tracks file edits + runs ambient LSP
  → session.archived generates config improvement proposals
```

You don't see any of this. You just see agents that know your stack and remember what you told them last week.

---

## the numbers (real ones, counted today)

- **19 agents** — 1 primary, 18 specialists
- **46 skills** — pdf, xlsx, ppt, docx, charts, laravel, react, security, testing, more
- **11 plugins** — orchestration, memory, routing, sync, mobile
- **12 MCP servers** — 9 enabled, 3 deliberately disabled
- **9 yaml workflows** — feature dev, bug fix, code review, docs, refactor, android, incident, lifecycle
- **20 slash commands** — `/build`, `/test`, `/harness`, `/sync-docs`, `/improve`, etc.
- **1 model** — `opencode/deepseek-v4-flash-free` (free tier, works on a laptop)

Total cost to run: zero. I don't have an OpenRouter bill because I never opened it.

---

## quick start (60 seconds)

```bash
# 1. clone
git clone https://github.com/yourname/opencode.git
cd opencode

# 2. install (one-time, ~30s)
npm install

# 3. start
npm start        # or: opencode.bat on Windows

# 4. inside the TUI, run the harness check
/harness
```

If `/harness` returns a project profile (stack, framework, package manager), you're in business. If it returns nothing, you don't have a stack file in the root — go write one, then come back.

---

## the 19 agents

I split the team the way a small studio would split it. One orchestrator, then specialists who only do their thing.

| Agent | What it owns |
| --- | --- |
| `core-factory` | The orchestrator. Decomposes requests, delegates to specialists, verifies results. 50 steps. |
| `lead-strategist` | Feasibility, gap analysis, the "should we even do this" voice. |
| `software-architect` | System design + Node/Bun backend. The technical backbone. |
| `frontend-ui-ux` | React + TypeScript + Tailwind + shadcn. Premium UI, no placeholder code. |
| `backend-laravel` | Laravel 13 + Livewire 4. Convention-strict, Pest-tested. |
| `backend-tauri` | Rust + Tauri. Safety-first, `cargo check` after every edit. |
| `android-kotlin` | Jetpack Compose, Clean Architecture, the Tauri mobile bridge. |
| `qa-guardian` | The gatekeeper. Finds problems, never fixes them. CRITICAL/WARNING/INFO output. |
| `integration-test` | Writes + runs Vitest, Pest, Playwright, JUnit. |
| `mobile-qa` | Runs the Android build on emulator, captures logs and screenshots. |
| `code-reviewer` | Read-only audit. Diffs, risks, no edits. |
| `devops-engineer` | Databases, processes, caches, deps. The ops person. |
| `docs-curator` | Technical writing. Accuracy over completeness. |
| `docs-evolver` | ADRs, changelog, doc/code drift fixes. |
| `plan` | Read-only analyst. Architecture review, never modifies files. |
| `explore` | Fast search. Locate files, find patterns, report back in 3 tool calls. |
| `scout` | External research. Webfetch, websearch, upstream docs. |
| `research-analyst` | Best-practices, library comparison. Web + context7 powered. |
| `refactor-architect` | Plans refactors, never implements. Ordered migration plan with rollback. |

Full per-agent prompts in [docs/the-19-agents.md](docs/the-19-agents.md).

---

## the 46 skills

Skills are reusable instruction sets that an agent loads on-demand. I grouped them by what they're actually for, not by what their README claims:

- **Build a feature** — `laravel-feature-scaffold`, `database-design`, `spec-driven-design`, `dynamic-workflow`, `workflow-manager`
- **Code quality** — `code-review`, `react-reuse-audit`, `security-review`, `testing-strategy`, `pest-testing`, `testing-basics`
- **Docs + knowledge** — `documentation`, `docs-governance-audit`, `knowledge-architect`, `deep-research`, `stitch-design-md`, `stitch-extract-design-md`, `stitch-manage-design-system`, `stitch-taste-design`, `stitch-code-to-design`, `lsp-navigation`, `project-memory`
- **Self-improvement** — `self-improver`, `self-reflection`, `prompt-engineering`, `skill-creator`, `skill-vetter`, `config-doctor`
- **Git + release** — `git-workflow`, `git-release`
- **Android** — `android` (with sub-skills for compose, gradle, testing, debugging, deployment)
- **Tauri / desktop** — `stack-context` (cross-stack)
- **Office docs** — `pdf`, `ppt`, `xlsx`, `docx`, `charts`
- **Web** — `web-search`, `web-reader`, `multi-search-engine`, `agent-browser`
- **Visual** — `ui-ux-pro-max`, `visual-design-foundations`

Full registry in [docs/the-46-skills.md](docs/the-46-skills.md).

---

## the 11 plugins

Each plugin is a small TypeScript file that exports hooks and custom tools. I kept them under 200 lines each so I can read them in one sitting.

| Plugin | What it does |
| --- | --- |
| `index.ts` | The self-improve engine. Worklog appender, ambient LSP, LM Studio stubs, prompt scoring. |
| `agent-router.ts` | 5-tier complexity classifier. Recommends the cheapest right agent. |
| `mcp-manager.ts` | List / check / toggle MCP servers at runtime. |
| `skill-manager.ts` | Search and inspect skills. |
| `memory-context.ts` | The brain. Stores fragments, recalls on `chat.params`, extracts on `chat.message`. |
| `context-manager.ts` | Dynamic include/exclude for context. |
| `adr-workflow.ts` | Draft ADRs from architectural decisions made mid-session. |
| `mobile-tool-router.ts` | Android detection + mobile MCP wiring. |
| `workflow-router.ts` | Maps a task to the right yaml workflow. |
| `project-initializer.ts` | Detects stack on first chat. |
| `doc-sync.ts` | 5 drift checkers + auto-fix for frontmatter. |

Full API in [docs/the-11-plugins.md](docs/the-11-plugins.md).

---

## the memory loop (this is the part I like most)

Every chat has three hooks firing invisibly:

1. **`chat.params`** — before the LLM call, injects 4 relevant past fragments + any matching patterns. The model sees "you said last week: Always run cargo check after Rust edits" and just does it.
2. **`chat.message`** — after the agent replies, regex-scans for `Always X`, `Never X`, `Decision: X`, `Error: X`, `FIX: X` and stores them. You don't call any tool. You just talk.
3. **`tool.execute.after`** — after every edit/write, records the file path for the session summary.

Storage is dead simple: JSON files in `.opencode/`. No RAG, no embeddings, no vector DB. Regex + keyword scoring. Works on a Raspberry Pi.

The 8 tools you can call directly:

```
memory_store   — save a convention, decision, solution, or pattern
memory_recall  — search past context by query
memory_learn   — teach a trigger → suggestion pattern
memory_find    — find patterns matching current task
memory_session — close a session with an outcome
memory_decision— log a decision in-flight
memory_stats   — see what you've accumulated
memory_forget  — remove stale context
```

After 5–10 sessions you'll have a corpus of conventions that the system auto-injects into every prompt. That's the part no other CLI does out of the box.

---

## the improvement cycle

I added a feedback loop so weak agent prompts get rewritten automatically. Full details in [docs/the-improvement-cycle.md](docs/the-improvement-cycle.md), short version:

```
score current output (0.0–1.0 across 6 dimensions)
  → if score < 0.75: pick a rewrite strategy by weakest dimension
  → rewrite the agent prompt
  → re-run the same task
  → store the delta in memory
  → end-of-session: propose config changes for human approval
```

Thresholds I tuned by hand:

- `0.75` — rewrite trigger
- `0.50` — kill switch (revert if a rewrite makes it worse)
- `+0.15` — minimum acceptable improvement

The self-improver skill runs this loop. The `prompt-engineering` skill provides the `generate / rewrite / evaluate / audit / history` commands. Together they turn agent prompts from "write once, hope for the best" into "write once, measure, improve".

---

## the YAML workflows

Some tasks are too choreographed for freeform delegation. I wrote 9 yaml workflows for those:

- `feature-development.yaml` — full lifecycle from strategy to release
- `bug-fix.yaml` — root cause + browser test + perf check
- `code-review.yaml` — security + quality + style in parallel
- `documentation.yaml` — gap discovery + auto-gen + audit
- `refactor.yaml` — refactor with risk tags and rollback
- `android-build-test-deploy.yaml` — Android pipeline
- `incident-response.yaml` — outage playbook
- `lifecycle-discovery.yaml`, `lifecycle-build.yaml`, `lifecycle-release.yaml` — agency lifecycle
- `sprint-ceremony.yaml` — standup + retro + planning

Trigger them by asking `lead-strategist` to start a workflow, or call them by name. Full schema in [docs/the-9-workflows.md](docs/the-9-workflows.md).

---

## the slash commands

20 of them, registered in `opencode.json`. The ones I actually use daily:

| Command | What it does |
| --- | --- |
| `/harness` | Run project detection, show the profile. First command I run in a new workspace. |
| `/sync-docs` | Drift scan across all docs. Surfaces wrong skill counts, dead MCP refs. |
| `/improve` | Trigger a self-improvement cycle on the current config. |
| `/doctor` | Audit + repair config. Like `/improve` but conservative. |
| `/reflect` | Same as `/improve` but goes through `lead-strategist` for analysis first. |
| `/upgrade-config` | Apply proposed changes after review. |
| `/test`, `/lint`, `/build` | Stack-agnostic dev commands routed to the right agent. |
| `/audit` | Full lint + test sweep via `qa-guardian`. |
| `/db:init`, `/db:backup`, `/check-updates` | Ops. |
| `/sync-skills`, `/collect-conventions` | Bridge project skills into the runtime + scan codebase for conventions. |

---

## the harness audit (run this weekly)

The health of the system fits in one screen. Run `/harness` or read the table:

| Check | Command | Healthy if |
| --- | --- | --- |
| Stack detection | `project_detect` | non-empty `detectedStack` |
| Agent routing | `route_agent task="debug test failure"` | returns a real agent name |
| Memory pipeline | `memory_stats` | fragments > 0 |
| Doc sync | `/sync-docs` | 0 CRITICAL drifts |
| Worklog | `cat .opencode/worklog.md` | last entry is recent |
| Prompt quality | `prompt-engineering history "core-factory"` | score trend is flat or improving |

If any row is red, the system will tell you which file to fix.

---

## project structure (the parts that matter)

```
opencode/
├── opencode.json          # the whole config — agents, plugins, mcp, permissions
├── AGENT.md               # canonical system prompt, loaded by every agent
├── readme.md              # you are here
├── agents/                # 19 .md files, one per agent
├── skills/                # 46 skill folders, each with SKILL.md
├── plugins/               # 11 TypeScript plugins
├── rules/                 # code style + delegation templates
├── workflows/             # 9 yaml workflows + 1 .md
├── docs/                  # what you're reading
├── tools/                 # tiny CLI helpers
├── scripts/               # ps1 + node scripts for ops
└── .opencode/             # runtime state (memory, worklog, snapshots)
```

Everything else is dependencies, cache, and `.gitignore`-d build output.

---

## the philosophy (short version)

Five rules I try to follow in every decision:

1. **Read before write.** Never edit a file I haven't read in full.
2. **Search before ask.** The model is fast and the docs are in the repo. Use them.
3. **Cite or concede.** If I can't source a claim, I mark it `[unverified]` or say "I don't know."
4. **Spec before code.** Anything touching 3+ files gets a written plan first.
5. **Verify before done.** Ambient LSP + tests + a self-review pass for one more bug.

These aren't new. They're in [AGENT.md](AGENT.md) §2 and they're the same rules any senior engineer follows. The point of an agentic system is to make them cheap to enforce.

---

## honesty notes (the stuff nobody says)

- This runs on a **free model** (`opencode/deepseek-v4-flash-free`). The outputs are good but not GPT-4 quality. If you need higher quality, swap the model in `opencode.json` — everything else stays the same.
- The memory layer is **file-based JSON** in `.opencode/`. It's gitignored. Don't lose that folder unless you want to lose your conventions.
- Some of the skills are **untested in real projects** (pdf, ppt, xlsx, docx, charts). I included them because they're useful scaffolds; tune them to your data.
- The `lmstudio` provider is **stubbed**. The plugin returns "not available" instead of breaking. If you have a local model server, point `baseURL` at it and it works.
- This is a **learning project**. I share it so others can learn from it, fork it, or argue with it. It's not a product, there's no roadmap, there's no SLA.

---

## shoutout

To the **opencode team** — the foundation is excellent. Config-driven, plugin-based, MCP-native. Everything in this repo is just an opinionated config + a handful of plugins on top.

To **Anthropic** for the agent-loop thinking that inspired the harness architecture.

To **every indie dev** shipping agentic coding setups and posting the receipts. The whole space is better because you're all posting your configs in public.

---

## license

MIT. See [LICENSE](LICENSE).

---

## contributing

Open an issue. Send a PR. Argue with my agent prompts in the discussions tab. The best contributions are ones that show me a better way to do something — I'm always learning.

See [CONTRIBUTING.md](CONTRIBUTING.md) for the boring details.

---

**Last updated**: 2026-07-04
**Version**: 2.1.0 — spec-driven harness, fully deployed
**Status**: Learning project, actively used, MIT licensed
