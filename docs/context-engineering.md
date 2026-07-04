# Context Engineering — MVI and why context bloat kills agents

The most common cause of agent failure is **context bloat**. Loading too much irrelevant information confuses the model and wastes tokens. This doc is about the practice of getting the right context to the agent at the right time.

> If prompting is *what you say*, context engineering is *what the agent sees when it decides what to do*. The two are inseparable but distinct.

---

## the MVI principle

**MVI = Minimal Viable Information.** Load only what the agent needs to do the next step. Nothing more.

The instinct is the opposite. "Let me give the agent everything" feels safer. It's not. It's slower, more expensive, and the agent performs worse because the signal-to-noise ratio drops.

A 200K context window filled with junk is worse than a 32K context window with the right 30K.

---

## the 4 sources of context

Every agent sees a mix of these at every turn:

| Source | Size | Persistent? | Example |
| --- | --- | --- | --- |
| System prompt + instructions | 3-4K | yes, per session | `AGENT.md` + `rules/*.md` |
| Agent prompt | 200-1500 | yes, per session | The role-specific system prompt |
| Memory injection (chat.params) | 200-800 | yes, per session | Past conventions + matched patterns |
| Skill body (when loaded) | 500-2000 | no, per step | The skill being executed |
| User prompt + tool results | 1-5K | no, per turn | The actual work |
| Agent reply | 200-2000 | no, per turn | The next decision |

The first three are persistent — they shape every decision. The last three are transient — they shape one decision.

**The MVI question for each:** "Does the agent need this to make the *next* decision?" If no, don't load it.

---

## how the harness manages context automatically

Three things run invisibly to keep context tight:

### 1. chat.params injects only relevant fragments

The `memory-context.ts` plugin scores every stored fragment against the current message. Only the top 4 make it into the prompt. Old, off-topic fragments are filtered out.

```typescript
// in memory-context.ts
const relevant = getRelevantFragments(messageText, 4);
if (relevant.length === 0 && patterns.length === 0 && conventions.length === 0) return;
// inject only what matched
```

So you don't get a flood of past conventions. You get the 4 that matter for *this* message.

### 2. skills load on-demand, not by default

An agent doesn't load the `pdf` skill just because it exists. It loads the `pdf` skill because the current task matches the description. The runtime uses the frontmatter `description` as the trigger.

The harness has a hard rule (in `AGENT.md` §2.8): **one skill at a time**. Load → use → discard.

### 3. project profile is injected once

The `project-initializer.ts` plugin detects the stack on first chat and stores it. On every subsequent chat, the profile is injected as a single block — not a re-scan of every manifest.

So the agent doesn't re-read `package.json` and `Cargo.toml` and `composer.json` every turn. It remembers the result.

---

## how I manage context manually

When the system isn't enough, I do these things:

### trim the conversation

Long sessions accumulate context. After ~20 turns, the conversation history alone is 20K+ tokens. I run `memory_session outcome="..."` and start a fresh session. The memory layer preserves what was learned.

### pre-fetch with context7

For library-specific work, I do a `context7_query-docs` up front and paste the relevant excerpt into the prompt. Better than letting the agent fetch it mid-task (which costs a turn).

### explicit file lists

"Read these 3 files, then do X" is better than "look at the code." The agent doesn't waste a turn exploring.

### ask for the spec, not the implementation

If the implementation will touch 5 files, ask for the spec first. The spec is short. The implementation is long. The spec lets you course-correct cheaply.

### quote the constraint

"Keep the function under 30 lines" goes in the prompt. The agent's context window has the constraint, so the constraint is satisfied.

---

## the ambient LSP feedback (the cheapest context engineering)

After every `edit` or `write`, the `tool.execute.after` hook runs the right LSP. The diagnostics are injected into the *next* turn's context. The agent sees its own mistakes without me pointing them out.

This is context engineering at the right level. The feedback is:

- **Automatic** (no manual verification step)
- **Cheap** (LSP is local, fast)
- **Specific** (file:line:column + error code)
- **Non-noisy** (only on edit, only relevant diagnostics)

If I had to write "now run `tsc --noEmit` and read the output" in every prompt, the system would be unusable. The hook does it for free.

---

## plan-first workflow (the one rule that fixes most context problems)

**Analyze > Plan > Approve > Execute.**

When the agent has a plan, the context for the plan is small (the user's request + a few files). When the agent is implementing, the context balloons (every file read, every tool result).

Separating the two means the planning context stays small. The implementation context is bounded by the plan.

```
Turn 1-2: plan
  context: user request + requirements doc + a few files = ~5K tokens

Turn 3-N: implement
  context: plan + relevant files + tool results = ~50K tokens over the session
```

vs. doing it all in one turn:

```
Turn 1-N: plan + implement interleaved
  context: drifts between plan and implementation = ~80K tokens, much of it stale
```

The first is faster and the agent performs better.

---

## subagent delegation (the lever for big context)

When a sub-task has its own context needs, delegate to a subagent. The subagent has its own context window; the parent agent only sees the summary.

```
parent: "Add Stripe to the app"
  → delegates to backend-laravel (Stripe webhooks)
  → delegates to frontend-ui-ux (subscription UI)
  → both subagents have their own 200K context
  → parent only sees the final summaries
```

The parent agent's context stays small. The total work that can be done is much larger.

This is in `AGENT.md` §2.7: **delegate by specialty**. It's a context engineering rule as much as an organizational one.

---

## anti-patterns (the context engineering sins)

### the kitchen sink prompt

> "Here's the entire codebase, here's the full requirements doc, here's the design spec, here's every StackOverflow answer about this problem, now do the thing."

The agent drowns. It can't tell signal from noise. The output is mediocre.

**Fix:** trim to 3-5 files. Cite specifically.

### the implicit context assumption

> "Make it work like the other one" (without saying which "other one")

The agent has to guess. It might guess wrong. The output is wrong.

**Fix:** name the file. "Make it work like `app/Services/OrderExport.php`."

### the "I forgot to tell you" mid-task

> *After the agent already implemented:* "Oh and also it needs to support 3 more languages"

Now the agent has to revise, but the previous work is in the context. The new work conflicts with the old. The agent thrashes.

**Fix:** spend more time in the plan phase. Catch the missing requirements there.

### the long-lived session

> *A 50-turn session* with everything in the context

By turn 30, the agent is making decisions based on stale context. By turn 50, it's hallucinating.

**Fix:** bound sessions. After 20-30 turns, end the session, start a new one, inject the session summary.

### the "load everything" skill

> Loading 3 skills at once because "they might be relevant"

Each skill is 1-2K tokens. Three skills is 4-6K. The agent's context bloat just to be safe.

**Fix:** load one skill, use it, discard. If you need a second, load it after.

---

## how the harness encodes this

| Behavior | Where it's defined |
| --- | --- |
| MVI on memory injection | `plugins/memory-context.ts` → `chat.params` hook, limit=4 |
| One skill at a time | `AGENT.md` §2.8 |
| Plan before code | `AGENT.md` §3 (the 6-stage loop) |
| Delegate by specialty | `AGENT.md` §2.7 + `opencode.json §agent.core-factory.task` |
| Doom loop protection | `opencode.json §permission.doom_loop: "deny"` |
| Ambient LSP feedback | `plugins/index.ts` → `tool.execute.after` |
| Project profile once | `plugins/project-initializer.ts` |

---

## the rules I follow

1. **MVI by default.** Load the minimum. Add more only when the agent asks or the plan demands it.
2. **Plan before implementation.** The plan context is cheap. The implementation context is expensive.
3. **Delegate to subagents for big context.** The parent's context stays small.
4. **One skill at a time.** Load → use → discard.
5. **Bound session length.** 20-30 turns, then restart with a summary.

---

## what to read next

- **How to prompt well** given good context — [how-i-prompt.md](how-i-prompt.md)
- **How to read the agent loop** — [agent-loops.md](agent-loops.md)
- **The system prompt** that encodes these rules — [AGENT.md](../AGENT.md) §2
