# Prompting & Context Engineering

Master the art of high-performance agentic development by understanding how to provide context and structure your requests.

> See the official docs: [opencode.ai/docs/agents](https://opencode.ai/docs/agents/)

---

## Core Philosophy: MVI (Minimal Viable Information)

The most common cause of agent failure is **context bloat**. Loading too much irrelevant information confuses the agent and wastes tokens.

- **Load only what you need**: Before starting a task, identify the 3-5 critical files or rules required.
- **Fetch current docs**: Always use context7 MCP to fetch current documentation instead of relying on training data.
- **Leverage Ambient LSP Feedback**: Syntax errors are automatically detected and injected into the model's context after each edit.

---

## Plan-First Workflow

All high-level tasks should follow the **Analyze > Plan > Approve > Execute** cycle.

1. **Analyze**: Describe your goal clearly.
2. **Discover**: The agent will search for relevant patterns and documentation.
3. **Plan**: The agent will propose a step-by-step implementation strategy.
4. **Approve**: You review the plan. **Execution only starts after your confirmation.**

---

## Effective SubAgent Delegation

Don't ask the `lead-strategist` to write code. Ask it to **orchestrate**.

- **Bad Prompt**: "Write a login page in React."
- **Good Prompt**: "Orchestrate the creation of a login page. Analyze our existing React patterns first, then delegate the implementation to `core-factory` and the security review to `qa-guardian`."

### When to Delegate

- **Complexity**: Tasks affecting more than 3 files.
- **Expertise**: Specific logic like API, Tauri, or Security.
- **Verification**: Always delegate reviews to a fresh agent to avoid bias.

---

## Tools for Context Engineering

- **LSP Integration**: Mention specific symbols or functions to trigger analysis. **Ambient LSP Feedback** surfaces syntax errors after edits.
- **MCP Servers**: Use `context7` for documentation and `memory` for cross-session context.
- **Self-Reflection**: Use `/reflect` to audit and improve configuration.
- **Agent Router**: Use `route_agent` to let the system recommend the best agent.

---

## Ambient LSP Feedback

OpenCode automatically detects syntax errors after file edits and injects them into the model's context.

### How It Works

```
1. User edits file X
2. tool.execute.after hook fires
3. Run quick syntax check (php -l, tsc --noEmit, biome check, cargo check)
4. Errors captured and stored per-session
5. Next chat turn: errors injected into model instructions
6. Model sees errors
7. Model self-corrects in the same turn
```

### Supported Checkers

| Extension  | Checker                | Speed  | Injection                       |
| ---------- | ---------------------- | ------ | ------------------------------- |
| `.php`     | `php -l`               | ~50ms  | Same turn (output.result)       |
| `.py`      | `python -m py_compile` | ~100ms | Same turn (output.result)       |
| `.ts/.tsx` | `tsc --noEmit`         | ~2-5s  | Next turn (output.instructions) |
| `.js/.jsx` | `npx biome check`      | ~1-3s  | Next turn (output.instructions) |
| `.rs`      | `cargo check`          | ~5-15s | Next turn (output.instructions) |
| `.vue`     | `npx tsc --noEmit`     | ~2-5s  | Next turn                       |
| `.svelte`  | `npx svelte-check`     | ~2-5s  | Next turn                       |

### Tips

- **Fast checks** (`.php`, `.py`) inject in the **same turn** via `output.result`
- **Slower checks** (`.ts`, `.rs`) queue async and inject in the **next turn** via `output.instructions`
- **Deduplication**: Same error suppressed if repeated within 30 seconds
- **Race-safe**: Pending checks are awaited before flushing

---

## Example: Full Context Engineering

```
Context:
- Stack: Tauri (Rust) + React (TypeScript) + Laravel (PHP)
- Target: src/components/FeatureComponent.tsx
- Pattern: src/components/ExistingComponent.tsx
- MCP: Use context7 for latest docs

Task: Implement new feature based on requirements

Plan:
1. ANALYZE: Profile current implementation (use core-factory)
2. RESEARCH: Fetch relevant documentation (context7 MCP)
3. DESIGN: Plan architecture (lead-architect)
4. IMPLEMENT: Execute with tests (core-factory, qa-guardian)
5. VERIFY: Ambient LSP catches syntax errors

Approve: [User confirms plan]
EXECUTE: core-factory implements with live Ambient LSP feedback
```

---

> Use the agent router (`route_agent`) to let the system recommend the best agent for your task. Combine with context7 MCP for up-to-date external documentation.
