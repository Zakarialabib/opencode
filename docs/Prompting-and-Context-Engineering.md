# 🧠 Prompting & Context Engineering#

Master the art of high-performance agentic development by understanding how to provide context and structure your requests.

> See the official docs: [opencode.ai/docs/agents](https://opencode.ai/docs/agents/)

---

## 🏛️ Core Philosophy: MVI (Minimal Viable Information)#

The most common cause of agent failure is **context bloat**. Loading too much irrelevant information confuses the agent and wastes tokens.

- **Load only what you need**: Before starting a task, identify the 3-5 critical files or rules required.
- **Use ContextScout**: Let the specialized subagent find the relevant standards for you.
- **Use ExternalScout**: Always fetch current documentation for external libraries instead of relying on the model's training data.
- **Leverage Ambient LSP Feedback**: Syntax errors are now automatically detected and injected into the model's context after each edit.

---

## 🧭 Plan-First Workflow#

All high-level tasks should follow the **Analyze → Plan → Approve → Execute** cycle.

1. **Analyze**: Describe your goal clearly.
2. **Discover**: The agent will search for relevant patterns and documentation.
3. **Plan**: The agent will propose a step-by-step implementation strategy.
4. **Approve**: You review the plan. **Execution only starts after your confirmation.**

---

## 👥 Effective SubAgent Delegation#

Don't ask the `lead-orchestrator` to write code. Ask it to **orchestrate**.

- **Bad Prompt**: "Write a login page in React."
- **Good Prompt**: "Orchestrate the creation of a login page. Analyze our existing React patterns first, then delegate the implementation to `core-factory` and the security review to `qa-security`."

### When to Delegate#

- **Complexity**: Tasks affecting more than 3 files.
- **Expertise**: Specific logic like Laravel, Tauri, or Security.
- **Verification**: Always delegate reviews to a "fresh" subagent to avoid bias.

---

## 🛠️ Tools for Context Engineering#

- **LSP Integration**: Mention specific symbols or functions to trigger deep analysis. **Ambient LSP Feedback** now automatically surfaces syntax errors after edits.
- **MCP Servers**: Use `context7` for documentation and `memory` for cross-session context.
- **Self-Reflection**: Use `/reflect` to ask the agents to audit and improve their own configuration.
- **Agent Router**: Use `route_agent` to let the system recommend the best agent for your task.

---

## 🔍 Ambient LSP Feedback#

**New:** OpenCode now automatically detects syntax errors after file edits and injects them into the model's context.

### How It Works#

```
1. You: "edit file X"
   ↓
2. tool.execute.after hook fires
   ↓
3. Run quick syntax check (php -l, tsc --noEmit, biome check, cargo check)
   ↓
4. Errors captured and stored per-session
   ↓
5. Next chat turn: errors injected into model instructions
   ↓
6. Model sees: "⚠️ X.ts: error TS2304: Cannot find name 'foo'"
   ↓
7. Model self-corrects in the same turn
```

### Supported Checkers#

| Extension  | Checker                | Speed  | Injection                       |
| ---------- | ---------------------- | ------ | ------------------------------- |
| `.php`     | `php -l`               | ~50ms  | **Same turn** (output.result)   |
| `.py`      | `python -m py_compile` | ~100ms | **Same turn** (output.result)   |
| `.ts/.tsx` | `tsc --noEmit`         | ~2-5s  | Next turn (output.instructions) |
| `.js/.jsx` | `npx biome check`      | ~1-3s  | Next turn (output.instructions) |
| `.rs`      | `cargo check`          | ~5-15s | Next turn (output.instructions) |
| `.vue`     | `npx tsc --noEmit`     | ~2-5s  | Next turn                       |
| `.svelte`  | `npx svelte-check`     | ~2-5s  | Next turn                       |
| `.py`      | `python -m py_compile` | ~100ms | **Same turn**                   |

### Tips#

- **Fast checks** (`.php`, `.py`) inject in the **same turn** via `output.result`
- **Slower checks** (`.ts`, `.rs`) queue async and inject in the **next turn** via `output.instructions`
- **Deduplication**: Same error suppressed if repeated within 30 seconds
- **Race-safe**: Pending checks are awaited before flushing#

---

## 📝 Example: Full Context Engineering#

```
Context:
- Stack: Laravel 13 + Livewire 4 + Tailwind 4
- Target: app/Http/Controllers/Auth/RegisterController.php
- Pattern: app/Http/Controllers/ProductController.php
- Rule: rules/laravel.md, rules/laravel-boost.md
- MCP: Use context7 for latest Laravel docs on rate limiting

Task: Optimize user registration (currently 5+ seconds)

Plan:
1. ANALYZE: Profile current implementation (use core-factory)
2. RESEARCH: Fetch Laravel rate limiting docs (context7 MCP)
3. IMPLEMENT: Add caching layer (delegate to backend-laravel)
4. TEST: Verify <1s response time (qa-guardian + sqlite MCP)
5. VERIFY: Ambient LSP will catch syntax errors automatically

Approve: [User confirms plan]
↓
EXECUTE: backend-laravel implements with live Ambient LSP feedback
```

---

> [!TIP]
> Use the **Thinking Mode** (`hy3-review-free` model) for the planning phase to ensure the most robust architectural decisions.

> [!NOTE]
> Ambient LSP Feedback is now live — if you edit a file with a syntax error, the model will see and fix it automatically in the next turn (or same turn for PHP/Python).
