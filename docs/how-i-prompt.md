# Prompting Guide — how I prompt 19 agents

This is the cheat sheet. The full system prompt is in `AGENT.md` (every agent reads it at session start). The per-agent prompts are in `opencode.json §agent.<name>.prompt`. This doc is the bridge — how to *talk* to the system given that structure.

> **Core rule:** agents are junior engineers with infinite patience. Prompt them like one. Specific, scoped, with success criteria.

---

## the decision tree (which agent do I call?)

```
What do you need?
│
├─ Write/change code
│  ├─ React/TypeScript UI ──────── @frontend-ui-ux
│  ├─ Laravel/PHP backend ──────── @backend-laravel
│  ├─ Rust/Tauri ───────────────── @backend-tauri
│  ├─ Android/Kotlin ───────────── @android-kotlin
│  ├─ Node/Bun API ─────────────── @software-architect
│  ├─ Refactor existing code ───── @refactor-architect (plan) → @core-factory (do)
│  └─ Don't know / mix of above ─ @core-factory (it'll figure it out)
│
├─ Plan / design
│  ├─ "Should we even do this?" ── @lead-strategist
│  ├─ Technical decisions ─────── @software-architect
│  └─ API contract design ──────── @software-architect
│
├─ Explore / understand
│  ├─ "Where is X?" ────────────── @explore
│  ├─ "How does Y work?" ───────── @explore
│  └─ Read-only analysis ───────── @plan
│
├─ Verify / audit
│  ├─ Quality / security ───────── @qa-guardian
│  ├─ Read-only diff review ────── @code-reviewer
│  └─ Tests + coverage ─────────── @integration-test
│
├─ Research
│  ├─ Best-practices / library compare ── @research-analyst
│  ├─ External docs / upstream ────────── @scout
│  └─ Web search ──────────────────────── @scout
│
├─ Ops
│  └─ DB / cache / deps / build ─── @devops-engineer
│
└─ Docs
   ├─ Write / update docs ──────── @docs-curator
   └─ ADRs / changelog / drift ─── @docs-evolver
```

If the answer is "none of the above, just do it," that's `@core-factory`.

---

## the 7 prompt patterns I use

### pattern 1: direct delegation

```
@backend-laravel add a CSV export endpoint to the orders controller.
Read app/Http/Controllers/OrderController.php first.
Return a streamed response. Add a Pest test.
```

The `@agent-name` prefix is a router override. The named agent handles it.

**When to use:** when you know exactly who should do the work.

### pattern 2: orchestrator + intent

```
Add a CSV export button to the orders page. Use Pest for tests.
```

No `@agent-name`. The orchestrator (`core-factory`) routes it. The orchestrator will probably delegate to `backend-laravel` + `frontend-ui-ux` in parallel.

**When to use:** when you don't care who does it, you just want it done.

### pattern 3: plan-first

```
Plan how we'd add Stripe subscriptions. Don't write code yet.
Delegate to lead-strategist. Show me the plan before any implementation.
```

The plan is the deliverable, not the code. Approval gate before implementation.

**When to use:** anything architectural, anything touching 3+ files, anything with budget implications.

### pattern 4: scope + constraints

```
Refactor the legacy order processor in src/legacy/orders.py.
Constraints:
  - no behavior change
  - keep public API stable
  - add tests for any new code path
  - delegate to refactor-architect first for the plan
```

The constraints go in the prompt. The agent's job is to satisfy them, not to invent new ones.

**When to use:** refactors, migrations, anything with non-negotiable constraints.

### pattern 5: meta-audit

```
Review the last 3 sessions' worklog. Find patterns where agents
underperformed. Propose prompt rewrites for the worst 2 agents.
Show the diffs before applying.
```

Asking the system to improve itself. The `prompt-engineering` and `self-improver` skills support this directly.

**When to use:** weekly maintenance, when something feels off, after a project milestone.

### pattern 6: read-only analysis

```
Use the plan agent to analyze the security implications of the
new auth flow. Don't modify any files. Produce a structured report.
```

Read-only by design. The `plan` agent has `edit: deny` so it physically can't write.

**When to use:** security reviews, architecture reviews, when you want a second opinion.

### pattern 7: spec from scratch

```
Use spec-driven-design skill. Spec a "CSV export" feature for the
orders module. Produce:
  - requirements.md
  - architecture.md
  - api-spec.yaml
  - test plan
Don't implement.
```

The skill does the work. The output is a set of files, not a chat reply.

**When to use:** new features, greenfield work, when you want the spec to live in the repo.

---

## prompt dos and don'ts

### do

- **Be specific.** "Add a column" → "Add a `status` enum column to `orders` table with values pending, paid, refunded, default pending, indexed."
- **Cite files.** "Read `app/Http/Controllers/OrderController.php`" beats "look at the orders code."
- **State constraints.** "Don't change the public API" / "Keep tests green" / "No new dependencies."
- **Name the agent** when you know who should handle it. Saves a router round-trip.
- **Include success criteria.** "Done when: tests pass, no LSP errors, formatter ran."

### don't

- **Don't be vague.** "Improve the code" is not a prompt. "Reduce the function below 30 lines and add types" is.
- **Don't ask the orchestrator for plan + implementation at once.** "Plan and then implement" usually means "implement without planning." Use mode 2 then mode 1.
- **Don't ask specialists to do other specialists' work.** "@backend-laravel write the React component" is a router mismatch.
- **Don't load multiple skills in one prompt.** Skills bloat context. Load one, use it, discard.
- **Don't ask the same agent 5 things in a row.** That's a workflow, not a prompt. Use `lead-strategist` to choreograph.

---

## token budget (the part nobody likes to think about)

Every prompt costs tokens. Every agent reply costs tokens. Every skill load costs tokens. Every memory injection costs tokens. Here's my rough budget for a single task:

| Phase | Budget | Why |
| --- | --- | --- |
| System prompt + instructions | 3000-4000 | Fixed cost per session |
| Agent prompt | 200-1500 | Varies by agent |
| Memory injection (chat.params) | 200-800 | Up to 4 fragments + patterns |
| Skill body (when loaded) | 500-2000 | One skill at a time |
| User prompt | 50-500 | Your actual ask |
| Tool results (LSP, file reads) | 200-3000 | Varies wildly |
| Agent reply | 200-2000 | Varies wildly |

**A typical turn: 6-10K tokens. A typical session: 50-200K tokens.**

A 200K context window is comfortable. A 32K window will hurt.

I track this in `.opencode/worklog.md` indirectly — if a session feels slow, it's probably context bloat. Restart the session; the memory layer preserves what was learned.

---

## how the harness helps with prompting

Three things happen automatically that make my prompts shorter:

1. **Stack detection** injects the project profile. I don't say "this is a Tauri+React+Laravel project" — the system already knows.
2. **Memory injection** pulls in past conventions. I don't repeat "Always run `php artisan pint`" every time — it's in the context.
3. **Past agent failures** are stored as error-patterns. The agent sees "Error: don't put `any` in the response type" before it makes the mistake.

So my prompts can be terse because the system does the heavy lifting. The 5-line prompt at the top of this doc would be a 20-line prompt in a system without these features.

---

## the meta-prompt (how I improve the agents)

Once a week, I run a session like this:

```
Use the self-improver skill. Read .opencode/worklog.md for the
last week. For each agent, score the last 5 outputs on:
  - relevance, completeness, accuracy, formatCompliance,
    actionability, efficiency
If any agent scores < 0.75, propose a prompt rewrite using
the prompt-engineering skill. Show the diffs. Don't apply yet.
```

The system proposes rewrites. I review, approve the good ones, reject the rest. That's the self-improvement loop in practice. Full details in [the-improvement-cycle.md](the-improvement-cycle.md).

---

## the rules I follow

1. **Specific beats clever.** A 1-line specific prompt beats a 5-line clever one.
2. **Cite or it didn't happen.** If the agent should look at a file, name the file.
3. **Success criteria in the prompt.** "Done when..." is a real line.
4. **One ask per turn.** Multi-part prompts are workflow territory.
5. **Trust the orchestrator.** If you don't know which agent, ask `core-factory`. Better than guessing wrong.

---

## what to read next

- **The agents** themselves — [the-19-agents.md](the-19-agents.md)
- **How to engineer the context** that surrounds the prompt — [context-engineering.md](context-engineering.md)
- **The system prompt** every agent reads — [AGENT.md](../AGENT.md)
