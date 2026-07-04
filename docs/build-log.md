# Spec and Harness — what I shipped, what worked, what didn't

> **Date**: 2026-07-04
> **Status**: spec complete, harness deployed, all 4 layers live
> **What this is**: a build-in-public changelog for the 2.1.0 release. The honest version.

This is the doc I write when I finish a big push. The spec work, the harness work, the things that surprised me, the things that didn't ship. Reading this should give you a real picture of what landed and why.

---

## the goal (in one sentence)

Take [opencode](https://opencode.ai) — a config-driven, plugin-based, MCP-native AI coding CLI — and bolt on a 4-layer auto-harness that detects your project, routes tasks to specialists, keeps the docs honest, and remembers what you told it last week.

---

## what's in scope

The 4 layers, each with one sentence:

1. **Project discovery.** Read the manifests, figure out the stack, inject the profile.
2. **Agent routing + prompt engineering.** Pick the right agent for the task, score its output, rewrite the weak prompts.
3. **Doc-code sync.** Catch when the docs lie about the code.
4. **Session memory.** Remember past decisions, conventions, errors, and patterns.

Plus the wiring: 11 plugins, 19 agents, 46 skills, 20 slash commands, 9 yaml workflows.

---

## the spec (the plan I wrote before I wrote the code)

### layer 1 — project detection

| Spec | What it says |
| --- | --- |
| Read | `package.json`, `Cargo.toml`, `composer.json`, `build.gradle.kts`, `tauri.conf.json` |
| Detect | Stack: Tauri, Laravel, React, Solid, Node, Android, hybrid |
| Output | `ProjectProfile` injected into `chat.params` |
| Stored | None — re-derived on every workspace |
| Hook | `chat.params` |

### layer 2 — agent routing + prompt engineering

| Spec | What it says |
| --- | --- |
| Route | 5-tier complexity classifier. Keywords + skills + stack match. |
| Recommend | `route_agent` returns the best agent. `auto_route` switches with confirmation. |
| Score | 6 dimensions: relevance, completeness, accuracy, formatCompliance, actionability, efficiency |
| Rewrite | 6 strategies: more-examples, tighter-constraints, split-task, simplify, expand-context, different-role |
| Trigger | Score < 0.75 → rewrite. Score < 0.50 after rewrite → revert. |
| Store | Score + delta in memory |

### layer 3 — doc-code sync

| Spec | What it says |
| --- | --- |
| Check 1 | Agent frontmatter vs `opencode.json §agent.<name>` |
| Check 2 | README counts (agents, skills, plugins) vs actual |
| Check 3 | Docs referencing disabled MCPs |
| Check 4 | Workflows referencing disabled MCPs |
| Check 5 | Rules files referencing disabled MCPs |
| Output | CRITICAL / WARNING / INFO findings, file:line |
| Auto-fix | Frontmatter-only patches (with `autoFix: true`) |

### layer 4 — session memory

| Spec | What it says |
| --- | --- |
| Storage | JSON files in `.opencode/` (gitignored) |
| Tools | 8: store, recall, learn, find, session, decision, stats, forget |
| Inject | Top 4 relevant fragments on `chat.params` |
| Extract | Regex on `chat.message`: `Always X`, `Never X`, `Decision: X`, `Error: X`, `FIX: X` |
| Track | `tool.execute.after` records file edits |
| End | `session.archived` proposes config improvements + worklog summary |

---

## the harness (what I actually built)

### the 11 plugins

In load order, with one line each:

1. `index.ts` — self-improve engine, worklog, ambient LSP, LM Studio stubs, snapshot
2. `skill-manager.ts` — list/search/inspect the 46 skills
3. `memory-context.ts` — the brain, 8 tools, 3 hooks
4. `context-manager.ts` — dynamic include/exclude
5. `agent-router.ts` — 5-tier complexity classifier
6. `mcp-manager.ts` — list/check/toggle MCP servers
7. `adr-workflow.ts` — draft ADRs from decisions
8. `mobile-tool-router.ts` — Android detection
9. `workflow-router.ts` — map task to yaml workflow
10. `project-initializer.ts` — detect stack on first chat
11. `doc-sync.ts` — 5 drift checkers + auto-fix

### the 4 hooks in use

| Hook | Fired by | Used by |
| --- | --- | --- |
| `chat.params` | every LLM call | `memory-context`, `project-initializer` |
| `chat.message` | every agent reply | `memory-context` |
| `tool.execute.after` | every tool execution | `index`, `memory-context` |
| `session.archived` | session end | `index` |

### the 8 memory tools

`memory_store`, `memory_recall`, `memory_learn`, `memory_find`, `memory_session`, `memory_decision`, `memory_stats`, `memory_forget`.

### the 20 slash commands

`/harness`, `/sync-docs`, `/improve`, `/doctor`, `/reflect`, `/upgrade-config`, `/test`, `/lint`, `/build`, `/audit`, `/db:init`, `/db:backup`, `/check-updates`, `/sync-skills`, `/collect-conventions`, `/workflow-start`, and 4 more for migrations / cleanup.

---

## what worked (the parts I'm happy with)

### the memory layer

This is the part I underestimated when I started. Auto-extracting `Always X` from agent replies, then injecting the top 4 relevant past fragments on every `chat.params`, is *the* leverage in the whole system.

The first session feels normal. By session 5, the agents are doing things I told them to do two weeks ago without me asking. By session 20, the system has its own conventions.

It's a JSON file in `.opencode/`. No RAG, no embeddings, no vector DB. Regex + keyword scoring. Works on a Raspberry Pi. The fact that it doesn't need a real ML pipeline is the trick.

### the doc-sync plugin

Every time I rewrote `opencode.json` (which is often), the README and the agent .md files would drift. Within a week the counts were wrong, the MCP refs were stale, the frontmatter didn't match.

`doc-sync.ts` catches it on `/sync-docs`. Five checks, one of them auto-fixable. I run it after every config change. The fact that I don't have to manually keep the docs honest anymore is the second-biggest leverage after memory.

### the ambient LSP

After every `edit`, run the right LSP. Inject diagnostics next turn. This catches 80% of mechanical mistakes without any explicit verification step. The agents fix their own typos now.

### the agent-router

The 5-tier complexity classifier. When I ask "implement X," it routes to the stack specialist. When I ask "find Y," it routes to `explore` (3-tool-call budget). When I ask "should we do X," it routes to `lead-strategist`.

The default is "no match → core-factory." Better to default to the orchestrator than route wrong.

### the per-agent prompts

I wrote each one as a specific job description. "You are the QA gatekeeper. You find problems. You don't fix them. Your output is CRITICAL/WARNING/INFO. Your temperature is 0.05."

When the prompts are specific, the agents are specific. When they're vague, the agents are vague. The per-agent prompts in `agents/*.md` are the highest-leverage text in the whole repo.

---

## what didn't work (the honest version)

### the lmstudio provider stub

I stubbed out the `lmstudio` provider to return "not available" instead of breaking. The idea was "the rest of the code can reference lmstudio tools safely." The reality is: nobody uses lmstudio. I should have just removed it.

The stub is still in the code. It's a TODO I haven't gotten to.

### some of the skills

`pdf`, `ppt`, `xlsx`, `docx`, `charts` are useful scaffolds but I haven't battle-tested them. I've used `pdf` and `xlsx` in anger, the others for one-off tasks. They're starting points, not production.

Honest take: I included them because the harness wants to be complete. If you actually need to ship PDFs in production, audit the skill code first.

### the auto-fix path

`sync_check_file` with `autoFix: true` is supposed to patch frontmatter automatically. It works for the 80% case. The 20% where the agent prompt changed semantically still needs a human. I tried to make it more aggressive, ended up with patches that broke the config. Reverted.

It's conservative on purpose. The cost of a bad auto-fix is bigger than the cost of a manual fix.

### the `agent-router` confidence threshold

I started with a high threshold (only route if 90% confident). Too many tasks fell through to `core-factory`. Lowered to 70%. Now some tasks get routed wrong. The right number is probably 80%, with `core-factory` as the safe default.

Still tuning. The metric I want is "routed tasks that need to be re-routed manually" — currently ~15%. Want it under 5%.

### session length

I bound sessions at 20-30 turns and restart with a summary. The context bloat after 30 turns is real, but the cost of restarting is also real. I've considered a "compress context" hook that summarizes the last N turns. Haven't done it.

The memory layer is the partial answer. Future sessions have the conventions; they don't need the old conversation.

### the docs themselves

I wrote a lot of docs. The previous version was heavier, more corporate, more "we take X seriously." The rewrite you're reading now is the indie version. The previous version still exists in the commit history if you want to see what I tried to move away from.

The hard part of writing docs for an agentic system is that the system changes faster than the docs can keep up. `/sync-docs` is the answer for *drift*, but the answer for *staleness* is "rewrite the docs every quarter, not every month."

---

## the surprises

### the free model is good enough

I'm running on `opencode/deepseek-v4-flash-free` — a free tier model. The outputs are noticeably worse than GPT-4 for creative work, but they're good enough for the structured tasks (refactor, scaffolding, test writing, doc drafting). The harness compensates for the gaps (memory injection, ambient LSP, repeated attempts).

If you have a budget, use a better model. If you don't, the free tier + a good harness is a real workflow.

### the memory layer is more useful than I thought

I built it as an experiment. The first version was a single JSON file with no schema. It immediately became the most useful part of the system. The "remember what you said last week" feedback is the difference between "I have a chatbot" and "I have a team."

### the slash commands matter more than I expected

20 slash commands. I use 8 daily. They're the on-ramp for me. When I open a workspace, `/harness` is the first thing I type. The commands are the API I actually use; the chat is the interface for everything else.

### the YAML workflows are the underused part

I have 9 yaml workflows. I trigger 2-3 of them. The rest are there for when the task is exactly the choreographed shape. Most of the time I just chat.

The workflows are right for the cases I built them for. They're overkill for the average task. I should probably mark which ones are actually used daily.

### the rules in AGENT.md are more important than the agents

If I had to choose between "the 19 agent prompts" and "the 5 rules in AGENT.md §2," I'd keep the 5 rules. The rules are what make the agents consistent. The agents are what the rules apply to.

This is the leverage hierarchy: philosophy > architecture > implementation.

---

## the tradeoffs I made (and would make again)

| Tradeoff | What I chose | Why |
| --- | --- | --- |
| File-based memory | Yes, no RAG | Works on a Pi, zero deps, fast to debug |
| Free model | Yes, not GPT-4 | Cost: zero. Quality: good enough |
| 19 agents | Yes, not 1 generalist | Specialization > generality |
| 11 plugins | Yes, not 1 monolith | Each plugin under 200 lines, easy to read |
| 9 yaml workflows | Yes, but most unused | When the shape matches, they're faster than chat |
| 46 skills | Yes, not 20 | Coverage matters; the cost of an unused skill is low |
| 20 slash commands | Yes, but only 8 used | The 8 I use daily are worth 20 |
| Indie voice in docs | Yes, not corporate | Honest > polished |
| Conservative auto-fix | Yes, not aggressive | Bad auto-fix > no auto-fix |

---

## the open questions (the things I'm still figuring out)

1. **What's the right agent count?** 19 is what I have. Is that the right number? More = more specialization. Fewer = simpler routing. I think 19 is right for me; could be too many for someone else.
2. **What's the right memory window?** Top 4 fragments per turn. Sometimes I want more, sometimes fewer. The answer probably depends on the task.
3. **Should `lmstudio` stay?** Currently stubbed. Either remove it or wire it up. Currently it's just clutter.
4. **Should the workflows be triggered by chat patterns?** E.g., if I say "add a feature," auto-trigger `feature-development.yaml`. Currently I trigger them explicitly. Auto-trigger is convenient but feels like magic.
5. **Should the `session.archived` hook apply proposals directly?** Currently it generates a proposed file and I review. Auto-apply would be faster but riskier. The human-in-the-loop is on purpose.

---

## what to read next

- **The improvement cycle** — the live version of this — [the-improvement-cycle.md](the-improvement-cycle.md)
- **The system prompt** — [AGENT.md](../AGENT.md)
- **The agents** — [the-19-agents.md](the-19-agents.md)
- **The plugins** — [the-11-plugins.md](the-11-plugins.md)
- **The skills** — [the-46-skills.md](the-46-skills.md)
