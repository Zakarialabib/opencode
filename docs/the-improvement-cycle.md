# The Improvement Cycle — how the system gets better

This is the part I like most. The system watches its own work, scores it, rewrites the weak prompts, and stores what it learned. It's not magic. It's a feedback loop. The pieces fit together like this:

```
                    ┌─────────────────────────────────────────────┐
                    │         SELF-IMPROVEMENT LOOP               │
                    │                                              │
  ┌─────────┐  ┌────┴─────┐  ┌──────────┐  ┌────────────────┐    │
  │ Project │  │  Prompt  │  │  Agent   │  │   Doc-Code     │    │
  │ Detect  │─▶│ Engineer │─▶│  Route   │─▶│    Sync        │    │
  │(Layer 1)│  │(Layer 2) │  │(Layer 2) │  │  (Layer 3)     │    │
  └─────────┘  └────┬─────┘  └──────────┘  └────────────────┘    │
                    │                                              │
              ┌─────▼──────┐                                       │
              │  Session   │  chat.params ← conventions ←────┐    │
              │  Memory    │  chat.message → extract → store ─┤    │
              │ (Layer 4)  │  tool.execute.after → worklog   ─┤    │
              │            │  session.archived → proposals   ─┤    │
              └─────▲──────┘                                   │    │
                    │                                          │    │
              ┌─────┴──────┐                                   │    │
              │  Prompt    │  evaluate → score < 0.75?        │    │
              │  Quality   │  rewrite → deploy → next cycle  ──┘    │
              │  Feedback  │                                        │
              └────────────┘                                        │
                    └──────────────────────────────────────────────┘
```

This is the runtime picture. The rest of the doc is the practical version.

---

## what connects to what

| Hook | When it fires | What it does |
| --- | --- | --- |
| `chat.params` | Every LLM call | Inject project profile + memory + matched patterns |
| `chat.message` | Every agent reply | Auto-extract conventions / decisions / errors |
| `tool.execute.after` | After every edit/write | Append worklog + run ambient LSP |
| `session.archived` | Session ends | Generate config improvement proposals + summary |

The first two are the "memory loop." The third is the "audit loop." The fourth is the "meta loop."

---

## the 4 layers, in plain English

| Layer | What it does | Where it lives |
| --- | --- | --- |
| **1. Project discovery** | Reads manifests, figures out your stack | `plugins/project-initializer.ts` |
| **2. Agent routing + prompt engineering** | Picks the right agent, gives the right prompt | `plugins/agent-router.ts` + `skills/prompt-engineering/` |
| **3. Doc-code sync** | Spots when docs lie about the code | `plugins/doc-sync.ts` |
| **4. Session memory** | Remembers past decisions and conventions | `plugins/memory-context.ts` |

The self-improvement is the part that ties layer 2 and layer 4 together with feedback from layer 3.

---

## the runnable commands

### Layer 1 — discovery

```bash
project_detect    # detect stack + framework + package manager
project_status    # show current profile
```

Expected output:

```
[Project Profile]
Stack: Tauri + React + Laravel
Framework: React 19, Laravel 13, Tauri 2
Package Manager: npm
```

### Layer 2 — routing + prompts

```bash
# classify a task
recommend_model task="Add a user login form" agentName="core-factory"

# route to the best agent
route_agent task="Fix Rust IPC crash in tauri command"

# auto-route (with confirmation)
auto_route task="Design the database schema for a blog module"

# generate a new agent prompt
prompt-engineering generate "qa-guardian" \
  "Review all TypeScript changes for security vulnerabilities"

# rewrite an underperforming prompt
prompt-engineering rewrite "<current prompt>" \
  --reason "agent missed 3 SQL injection vectors" \
  --strategy "tighter-constraints"

# evaluate output quality
prompt-engineering evaluate "<agent output>" \
  --expected "<expected output>" \
  --criteria "relevance,completeness,accuracy"

# audit another agent's prompt
prompt-engineering audit "backend-laravel" \
  --target-task "Created a user API endpoint"

# view prompt version history
prompt-engineering history "qa-guardian" --limit 10
```

### Layer 3 — doc sync

```bash
/sync-docs                                # full drift scan
sync_check_file file="agents/code-reviewer.md"   # single file
# auto-fix: pass autoFix: true
```

### Layer 4 — memory

```bash
# store a decision or convention
memory_store type="convention" content="Always run cargo check after Rust edits" \
  tags='["rust", "tauri", "safety"]' source="core-factory"

# recall relevant context
memory_recall query="How should I handle Tauri state management?" limit=5

# learn a recurring pattern
memory_learn triggers='["migration", "rollback"]' \
  suggestion="Run `php artisan migrate:rollback` before the new migration" \
  context="Laravel database migrations"

# find patterns matching current task
memory_find task="Need to debug a Rust panic in Tauri command"

# view session stats
memory_stats

# log a decision mid-session
memory_decision decision="Using SQLite for local storage" tags='["database", "tauri"]'

# end session with outcome
memory_session outcome="success" task="Implemented login API with tests"
```

---

## the prompt improvement loop (the core cycle)

This is the one I run weekly. It works on any agent prompt that underperforms.

### step 1: evaluate

```
Input:  recent agent output
Output: quality score (0.0-1.0) + weakest dimension
```

The 6 dimensions I score on:

| Dimension | What it measures | If low → |
| --- | --- | --- |
| `relevance` | Agent stayed on topic | `simplify` |
| `completeness` | All task aspects addressed | `expand-context` |
| `accuracy` | Factually correct output | `more-examples` |
| `formatCompliance` | Followed output spec | `tighter-constraints` |
| `actionability` | Output directly usable | `split-task` |
| `efficiency` | Tokens not wasted | `simplify` |

The strategy is picked automatically by weakest dimension. You can override.

### step 2: rewrite (if score < 0.75)

```bash
prompt-engineering rewrite "$PROMPT" --reason "$WEAKNESS" --strategy "more-examples"
prompt-engineering rewrite "$PROMPT" --reason "$WEAKNESS" --strategy "tighter-constraints"
prompt-engineering rewrite "$PROMPT" --reason "$WEAKNESS" --strategy "split-task"
prompt-engineering rewrite "$PROMPT" --reason "$WEAKNESS" --strategy "simplify"
prompt-engineering rewrite "$PROMPT" --reason "$WEAKNESS" --strategy "expand-context"
prompt-engineering rewrite "$PROMPT" --reason "$WEAKNESS" --strategy "different-role"
```

### step 3: deploy & verify

```bash
# 1. deploy the rewritten prompt (update opencode.json agent.prompt)
# 2. run the same task again
# 3. re-evaluate
prompt-engineering evaluate "$NEW_OUTPUT" --expected "$EXPECTED"
# 4. compare: old 0.62 → new 0.81 → delta +0.19 ✓
```

### step 4: version & archive

```bash
memory_store type="tool-pattern" \
  content="qa-guardian: v3 → v4, strategy: tighter-constraints, delta: +0.19" \
  tags='["prompt-engineering", "qa-guardian", "rewrite"]'
```

The `session.archived` hook auto-archives on session end.

---

## the harness audit (the health check)

Run this daily or on context switch.

```bash
/harness      # full diagnostic
/sync-docs    # doc-code drift
/improve      # self-improvement cycle
```

### the health table

| Check | Command | Healthy if |
| --- | --- | --- |
| Stack detection | `project_detect` | non-empty `detectedStack` |
| Agent routing | `route_agent task="debug test failure"` | returns a real agent name |
| Memory pipeline | `memory_stats` | fragments > 0 |
| Doc sync | `/sync-docs` | 0 CRITICAL drifts |
| Worklog | `cat .opencode/worklog.md` | last entry is recent |
| Prompt quality | `prompt-engineering history "core-factory"` | score trend is flat or improving |

If any row is red, the system tells you which file to fix.

---

## the auto-extraction pipeline (the part that runs in the background)

The system learns from every conversation without me calling any tool. Three patterns trigger storage:

| Pattern in agent message | Stored as | Example |
| --- | --- | --- |
| `Always <X>` / `Never <Y>` | Convention | "Always run cargo check after Rust edits" |
| `Decision: <X>` / `Chosen: <X>` | Decision | "Decision: Use SQLite for local storage" |
| `Error: <X>` / `FIX: <X>` | Error-pattern | "Error: Tauri IPC timeout on large payloads" |

When a future session starts, the relevant fragments are injected:

```
## Session Memory Context

**Past context** (3 relevant fragments):
- [convention] Always run cargo check after Rust edits (from core-factory, ...)
- [decision] Using SQLite for local storage (from session abc123, ...)
- [error-pattern] Tauri IPC timeout on large payloads (from core-factory, ...)

**Auto-extracted context** (from past sessions):
Project conventions:
- Always run cargo check after Rust edits
- Never use `any` type in TypeScript
```

The agent sees "you said last week: Always X" and just does it. I don't have to remind.

---

## the session lifecycle (one full turn)

```
Session Start
  → chat.params injects project profile (Layer 1)
  → chat.params injects memory context (Layer 4)
  → chat.message auto-extracts patterns (Layer 4)

User / agent turn
  → repeat chat.params + chat.message
  → tool.execute.after → ambient LSP
  → next turn: diagnostics in context

Session End
  → session.archived → analyze patterns
  → generate config proposals (opencode.json.proposed)
  → append worklog summary
```

---

## the thresholds I tune

```yaml
# prompt quality
thresholds:
  rewrite_trigger: 0.75     # rewrite if score below this
  kill_switch: 0.50         # revert if a rewrite drops below this
  target: 0.80              # target quality score
  improvement_delta: 0.15   # minimum improvement from rewrite
```

```yaml
# system health
checks:
  stack_detected: true      # project_detect must return valid stack
  memory_fragments: "> 0"   # at least 1 fragment stored
  worklog_current: true     # last entry < 1 hour old
  doc_drift_critical: 0     # no CRITICAL drift findings
  agent_registration: 19    # all 19 agents in opencode.json
  skill_resolution: true    # all skills/index.json paths resolve
```

---

## troubleshooting (the 5 things that go wrong)

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| `recommend_model` returns "no complexity match" | Task too vague | Add specific keywords (implement, fix, design, etc.) |
| `sync_docs` finds drifts you disagree with | Agent .md frontmatter stale | Run `sync_check_file` with `autoFix: true` |
| Memory context not injecting | `.opencode/context-fragments.json` empty | Run some tasks first, or `memory_store` manually |
| `project_detect` returns empty | No config files found | Add `package.json`, `composer.json`, or `Cargo.toml` to the root |
| Prompt quality score stuck < 0.5 | Base prompt fundamentally wrong | Try `different-role` strategy, or write fresh with `generate` |

---

## the one full cycle (run it once to understand the system)

```bash
# 1. diagnose current state
/harness
project_detect

# 2. check for doc-code drift
/sync-docs

# 3. route the task
recommend_model task="Implement login system with JWT"

# 4. execute (agent does its work)
#     auto: chat.params injects context
#     auto: chat.message extracts patterns
#     auto: tool.execute.after appends worklog

# 5. evaluate
prompt-engineering evaluate "<output>" --criteria "completeness,accuracy,actionability"

# 6. improve if score < 0.75
prompt-engineering rewrite "<current prompt>" \
  --reason "agent missed edge case handling" \
  --strategy "more-examples"

# 7. verify
prompt-engineering evaluate "<new output>" --expected "<expected>"

# 8. archive
memory_store type="tool-pattern" \
  content="Prompt rewrite for X: strategy=more-examples, delta=+0.18" \
  tags='["prompt-engineering", "rewrite"]'

# 9. session end
#     auto: session.archived → opencode.json.proposed
#     review: opencode diff-config
#     apply: apply_config_improvements approve=true
```

That's the full loop. 9 steps. The system handles 7 of them automatically. The 2 that need me are step 6 (approve the rewrite) and step 9 (approve the config change).

---

## what to read next

- **The skills** that implement the loop — [self-improver](../skills/self-improver/SKILL.md), [prompt-engineering](../skills/prompt-engineering/SKILL.md)
- **The system prompt** that encodes the philosophy — [AGENT.md](../AGENT.md)
- **The plugins** that do the work — [the-11-plugins.md](the-11-plugins.md)
- **What got shipped** — [build-log.md](build-log.md)
