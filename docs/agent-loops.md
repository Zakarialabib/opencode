# Agent Loop Guide — loops, retries, ambient feedback

An agent loop is a pattern where an agent produces output, gets feedback, refines, and repeats. The harness wires this in three places: ambient LSP feedback, retry policies, and self-improvement cycles. This is the doc that explains how those pieces fit.

> If you're not sure what an "agent loop" means: it's the difference between an agent that tries once and an agent that gets better each turn. Most useful agentic systems are mostly loops.

---

## the 4 loop patterns I use

### pattern 1: ambient LSP feedback (always on)

After every `edit` or `write`, the `tool.execute.after` hook runs the right LSP for the file extension:

- `.ts` / `.tsx` ? `typescript-language-server` diagnostics
- `.rs` ? `rust-analyzer` diagnostics
- `.php` ? `intelephense` diagnostics
- `.css` / `.html` / etc. ? `tailwindcss-language-server`

The diagnostics are injected into the next turn's context. The agent sees its own mistakes without me pointing them out.

**The catch:** for TS and Rust, the LSP is async. The diagnostics land on the *next* turn, not the same turn. PHP and CSS are fast enough for same-turn feedback. The harness handles this — TS and Rust agents are trained to "wait one turn, then fix."

**Why it matters:** this is the cheapest loop in the system. It catches 80% of mechanical mistakes (unused imports, type errors, syntax issues) without any explicit verification step.

### pattern 2: retry on failure (per phase)

Workflows have a `retry_policy`:

```yaml
retry_policy:
  max_attempts: 3
  backoff: exponential
```

If a phase fails its exit criteria, the orchestrator retries. Exponential backoff (1s, 2s, 4s) so transient failures (network, MCP server hiccups) don't immediately burn the budget.

**When I use it:** for any phase that depends on external state (LSP server, MCP server, network). I don't retry for logic errors — those need a different approach, not another try.

### pattern 3: refinement loop (creative work)

For design work — UI variants, copy variations, architecture options — I run the same task N times and pick the best.

```
@frontend-ui-ux Generate 3 UI variants for the dashboard header.
Wait for all 3, then rank by visual hierarchy + accessibility.
```

The loop is: produce N ? evaluate ? pick. No automatic rewrite; a human (or `code-reviewer`) makes the call.

**When I use it:** for any task where "good" is subjective. UI, copy, architecture. Not for bug fixes or refactors.

### pattern 4: self-improvement loop (the meta-loop)

After a session, the system:

1. Scores each agent's recent output (relevance, completeness, accuracy, format compliance, actionability, efficiency)
2. If score < 0.75, picks a rewrite strategy by weakest dimension
3. Rewrites the agent prompt
4. Re-runs the same task
5. Stores the delta in memory

The full cycle is in [the-improvement-cycle.md](the-improvement-cycle.md). This is the loop that makes the system actually self-improving.

---

## how a task loops through the system

Here's a real example: I ask for "Add a CSV export to the orders page."

```
Turn 1: orchestrator receives request
  ? delegates to frontend-ui-ux (button) + backend-laravel (endpoint) in parallel
  ? chat.params injects past conventions (e.g., "Always use Pest, not PHPUnit")

Turn 2-N: frontend-ui-ux works
  ? reads existing button patterns
  ? writes the button component
  ? tool.execute.after fires ? LSP diagnostics injected next turn
  ? next turn: agent sees TS errors, fixes them
  ? loops 1-3 times until LSP clean

Turn 2-N (parallel): backend-laravel works
  ? reads existing controller patterns
  ? writes controller + FormRequest + Resource
  ? runs php artisan pint same-turn
  ? loops 1-2 times

Turn N+1: orchestrator synthesizes
  ? both agents report done
  ? delegates to qa-guardian for review
  ? qa-guardian runs tests, reports CRITICAL/WARNING/INFO

Turn N+2: orchestrator fixes CRITICALs
  ? re-delegates to the right specialist
  ? loops until qa-guardian reports 0 CRITICAL

Turn final: orchestrator reports to me
  ? I see the diff, run tests manually, ship
```

That's a 4-level nested loop. Each level is cheap, the total is fast.

---

## the 5 things that make loops actually work

### 1. concrete feedback

"Tests pass" is not feedback. "Test `OrderExportTest::test_csv_format` failed at line 42 with `Expected 'foo,bar\n' got 'foo,bar\r\n'`" is feedback. The agent needs the *actual error*, not a summary.

The harness tries to surface the actual error. If a tool returns truncated output, the loop is broken.

### 2. bounded retries

Every loop has a max. The default is 3 attempts. After that, escalate to me. The agent shouldn't burn 20 minutes retrying a doomed approach.

`retry_policy.max_attempts` enforces this.

### 3. different attempts, not the same attempt

A retry is only useful if the next attempt is different. If the agent keeps running the same broken command, that's a doom loop, not a retry.

`doom_loop: "deny"` in `opencode.json §permission` blocks the 3rd identical tool call. Forces the agent to rethink.

### 4. checkpoints

Before destructive work, the `index.ts` plugin copies the workdir to `.opencode/snapshots/`. If a loop goes off the rails, I can roll back. This is the safety net that lets me run loops unattended.

### 5. observability

Every meaningful action gets a one-line entry in `.opencode/worklog.md`. Format: `[<ISO timestamp>] <agent>: <action> — <result>`. When a loop misbehaves, I read the worklog and see exactly what happened.

```bash
# tail the worklog
tail -50 .opencode/worklog.md
```

That's the first thing I check when something is off.

---

## loop anti-patterns (the stuff that wastes time)

### the "retry harder" trap

When something fails, the instinct is to retry. Most of the time the right move is to change the approach. A loop that retries the same command N times is just slow, not better.

**Fix:** the `doom_loop: "deny"` permission enforces this. If the agent hits the same wall 3 times, it has to stop and ask.

### the "wait for the LLM to figure it out" trap

LLMs are not oracles. If the agent has tried 3 approaches and all 3 failed, the LLM is not going to magically invent a 4th. The right move is to escalate.

**Fix:** after 3 failed attempts, the orchestrator surfaces the failure to me with a clear summary.

### the "verify everything every turn" trap

Running the full test suite every turn is expensive. The harness uses ambient LSP for fast feedback (free) and reserves full test runs for phase boundaries (in the workflow yaml).

**Fix:** `exit_criteria` in workflows, not per-turn verification.

### the "ignore the loop" trap

Sometimes the agent gets the first attempt right and the loop is unnecessary. Don't make it run anyway. The "stop when done" rule in `AGENT.md` §1 covers this.

---

## how the harness encodes this

| Behavior | Where it's defined |
| --- | --- |
| Ambient LSP after every edit | `plugins/index.ts` ? `tool.execute.after` hook |
| Doom loop protection | `opencode.json §permission.doom_loop: "deny"` |
| Per-phase retry | `workflows/*.yaml` ? `retry_policy` |
| Snapshot before destructive | `plugins/index.ts` ? snapshot tool |
| Worklog appender | `plugins/index.ts` ? worklog tool |
| Self-improvement loop | `skills/self-improver/` + `plugins/index.ts` end-of-session |
| Prompt scoring | `plugins/index.ts` ? `evaluate_agent` tool |

---

## debugging a stuck loop

If a task is taking too long, here's the triage:

```bash
# 1. is the agent in a doom loop?
tail -30 .opencode/worklog.md
# look for: same tool call, same args, 3+ times

# 2. what was the last error?
# check the most recent assistant message in the TUI
# look for: error messages, failed exit criteria

# 3. is the task even doable?
# if the agent has tried 3 different approaches and failed, escalate to plan/explore

# 4. roll back if needed
# use git checkout or restore from .opencode/snapshots/
```

If none of that helps, kill the session and restart. The memory layer preserves what was learned, so you don't lose everything.

---

## the rules I follow

1. **Loops need feedback, not just retries.** A retry without new information is a waste.
2. **Loops need bounds.** Every loop has a max attempts. No infinite loops.
3. **Loops need observability.** If I can't see what's happening, the loop is broken.
4. **Loops need checkpoints.** Rollback is the safety net that makes unattended loops possible.
5. **Loops need to know when to stop.** "Done" is a real state, not just "ran out of attempts."

---

## what to read next

- **The improvement cycle** — the meta-loop that improves all the others — [the-improvement-cycle.md](the-improvement-cycle.md)
- **The system prompt** that encodes the loop rules — [AGENT.md](../AGENT.md) §2
- **The memory system** that loops depend on for context — [the-11-plugins.md](the-11-plugins.md#memory-contextts--the-brain)
