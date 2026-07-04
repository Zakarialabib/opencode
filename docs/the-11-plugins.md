# Plugins Guide — the 11

Plugins are TypeScript files that export hooks and custom tools. They run inside the opencode runtime. The full list is registered in `opencode.json §plugin`. I keep them under 200 lines each so I can read them in one sitting. If a plugin needs more, it's probably two plugins pretending to be one.

> **One file in, one file out.** A plugin exports a `Plugin` factory: `async ({ client, project, directory }) => { return { hooks, tool: {...} } }`. That's the whole contract. No magic.

---

## the 11, in load order

The order in `opencode.json` matters: plugins load top-to-bottom, and later plugins can reference earlier ones.

| # | File | What it does |
| --- | --- | --- |
| 1 | `index.ts` | The self-improve engine. Worklog appender, ambient LSP, LM Studio stubs, prompt scoring, workdir snapshot. |
| 2 | `skill-manager.ts` | List, search, inspect skills. Custom tools: `skill_list`, `skill_info`, `skill_search`. |
| 3 | `memory-context.ts` | The brain. Stores fragments, recalls on `chat.params`, extracts on `chat.message`, tracks edits. |
| 4 | `context-manager.ts` | Dynamic include/exclude for context. Custom tools: `context_view`, `context_add_include`, `context_add_exclude`, `context_reset`. |
| 5 | `agent-router.ts` | 5-tier complexity classifier. Recommends the cheapest right agent. Custom tools: `route_agent`, `auto_route`. |
| 6 | `mcp-manager.ts` | List / check / toggle MCP servers at runtime. |
| 7 | `adr-workflow.ts` | Draft ADRs from architectural decisions made mid-session. |
| 8 | `mobile-tool-router.ts` | Android detection + mobile MCP wiring. |
| 9 | `workflow-router.ts` | Maps a task to the right yaml workflow. |
| 10 | `project-initializer.ts` | Detects stack on first chat. Reads manifests, sets the project profile. |
| 11 | `doc-sync.ts` | 5 drift checkers + auto-fix for frontmatter. |

Plus two utility modules that are imported by plugins (not registered in the plugin array): `jsonc-utils.ts` and `debug-logger.ts`.

---

## the plugin anatomy

Every plugin has the same shape:

```typescript
import { type Plugin, tool } from "@opencode-ai/plugin";

const MyPlugin: Plugin = async ({ client, project, directory }) => {
  // 1. State goes here (loaded from disk, held in memory)
  const state = loadSomething(directory);

  return {
    // 2. Hooks: react to runtime events
    "chat.params": async (input, output) => { /* mutate before LLM call */ },
    "chat.message": async ({ sessionID, messages }) => { /* observe + persist */ },
    "tool.execute.after": async (input) => { /* track + check */ },
    "session.archived": async (sessionID) => { /* summarize + propose */ },

    // 3. Custom tools the agent can call
    tool: {
      my_tool: tool({
        description: "What this does",
        args: { /* zod schema */ },
        async execute(args) { /* return string */ },
      }),
    },
  };
};

export default MyPlugin;
```

Three things to know:

- **Hooks** are how the plugin sees runtime events. You can't block an event; you can only observe or mutate output.
- **Tools** are how the agent talks back. Each tool is a zod-validated function that returns a string.
- **State** is in-memory, but you can persist to disk in the `directory` you got from the factory.

---

## the hooks I actually use

Four hooks are wired across the plugins. Three are documented in the opencode docs, one isn't.

| Hook | When it fires | What I use it for |
| --- | --- | --- |
| `chat.params` | Before every LLM call | Inject past conventions, project profile, matched patterns |
| `chat.message` | After every chat message | Auto-extract conventions / decisions / errors from agent output |
| `tool.execute.after` | After every tool execution | Track file edits, run ambient LSP same-turn |
| `session.archived` | When a session ends | Generate config improvement proposals, write worklog summary |

The `chat.params` and `chat.message` hooks are the ones that make the system feel "alive" — past context gets pulled in, new patterns get stored out. Both fire invisibly. You never call them.

---

## per-plugin notes (what each one does, why I built it)

### `index.ts` — the self-improve engine

The largest plugin (~400 lines). It does:

- **Worklog appender.** Every meaningful action gets a one-line entry in `.opencode/worklog.md`. Format: `[<ISO timestamp>] <agent>: <action> — <result>`.
- **Ambient LSP.** After every edit/write, runs the right LSP for the file extension (`typescript-language-server` for `.ts`, `rust-analyzer` for `.rs`, `intelephense` for `.php`). Same-turn for PHP, next-turn for TS/Rust.
- **LM Studio stubs.** The plugin returns "not available" for LM Studio tools instead of breaking. Lets the rest of the code reference them safely.
- **Workdir snapshot.** Before destructive work, copies the workdir to `.opencode/snapshots/`. Rollback by `git checkout` or restore from snapshot.
- **Prompt scoring.** End-of-session, runs the `prompt-engineering` skill on each agent's recent output and proposes rewrites for weak prompts.

Why it's the first plugin loaded: it sets the worklog context that other plugins read.

### `memory-context.ts` — the brain

The most-used plugin. ~700 lines. Eight custom tools:

- `memory_store` — save a convention, decision, solution, pattern
- `memory_recall` — search past context by query
- `memory_learn` — teach a trigger → suggestion pattern
- `memory_find` — find patterns matching current task
- `memory_session` — close a session with an outcome
- `memory_decision` — log a decision in-flight
- `memory_stats` — see what you've accumulated
- `memory_forget` — remove stale context

Storage is file-based JSON in `.opencode/`:

- `context-fragments.json` — the brain
- `patterns.json` — learned trigger→suggestion pairs
- `session-summaries.json` — past sessions
- `opencode-memory.db` — SQLite for fast queries (optional)

No RAG, no embeddings, no vector DB. Regex + keyword scoring. Works on a Raspberry Pi.

The `chat.params` hook pulls the 4 most-relevant fragments by keyword match and injects them as a "## Session Memory Context" section in the system prompt. The `chat.message` hook scans the agent's last reply for `Always X`, `Never X`, `Decision: X`, `Error: X`, `FIX: X` and stores them.

### `agent-router.ts` — the bouncer

When a request comes in without an explicit `@agent-name`, this plugin scores it across:

- **Keyword match** — "implement", "fix", "design", "audit", "research"
- **Skill match** — if a skill is named, bias toward its agent
- **Stack match** — file path hints at a stack

If the score clears threshold, the agent is suggested. If not, `core-factory` handles it. Better to default to the orchestrator than route wrong.

Two custom tools: `route_agent` (recommend) and `auto_route` (auto-switch with confirmation).

### `doc-sync.ts` — the drift detector

Five checkers, run on `/sync-docs` or auto on `session.idle`:

1. `checkAgentFrontmatterVsConfig` — agent .md mode/temperature/color vs `opencode.json`
2. `checkReadmeClaims` — README agent/skill/plugin counts vs actual
3. `checkMCPRefs` — docs referencing disabled MCPs
4. `checkWorkflowMCPRefs` — workflows referencing disabled MCPs
5. `checkRuleMCPRefs` — rules files referencing disabled MCPs

Findings are CRITICAL / WARNING / INFO. Frontmatter-only fixes can auto-patch with `autoFix: true`. Structural fixes need a human.

### `project-initializer.ts` — the stack detector

On first chat, reads the manifest files:

- `Cargo.toml` → Tauri/Rust
- `tauri.conf.json` → Tauri
- `package.json` + `vite.config.*` → React/Node
- `composer.json` → PHP/Laravel
- `artisan` → Laravel specifically
- `build.gradle.kts` / `gradlew` → Android
- `package.json` + `solid` → Solid.js

Sets a `ProjectProfile` in memory. Injected into the system prompt on subsequent chats.

### `mcp-manager.ts` — the server toggle

List, check, toggle MCP servers at runtime. Useful for debugging — you can see which servers are alive without restarting opencode. Custom tools: `mcp_list`, `mcp_check`, `mcp_toggle`.

### `skill-manager.ts` — the skill registry

List, search, inspect the 46 skills. Custom tools: `skill_list`, `skill_info`, `skill_search`.

### `context-manager.ts` — the include/exclude

Dynamic include/exclude patterns for what gets pulled into context. Useful when you want to load a skill only for certain file types. Custom tools: `context_view`, `context_add_include`, `context_add_exclude`, `context_reset`.

### `adr-workflow.ts` — the ADR drafter

When the `lead-strategist` makes an architectural decision, this plugin can draft an ADR (Architecture Decision Record) into `docs/adr/`. Uses the standard "Context / Decision / Consequences" format.

### `mobile-tool-router.ts` — the Android bit

Detects Android projects (presence of `android/` directory + `build.gradle.kts`), wires up the mobile MCP tools. Lightweight — most of the Android work is in the `android-kotlin` agent's prompt.

### `workflow-router.ts` — the workflow bouncer

Maps a high-level task to a yaml workflow in `workflows/`. E.g., "add a feature" → `feature-development.yaml`, "fix a bug" → `bug-fix.yaml`. Custom tool: `workflow_list`, `workflow_start`.

---

## how to add a plugin

```bash
# 1. create the file
touch plugins/my-plugin.ts
```

```typescript
// 2. write it
import { type Plugin, tool } from "@opencode-ai/plugin";

const MyPlugin: Plugin = async ({ directory }) => {
  return {
    tool: {
      my_tool: tool({
        description: "What this does — keep it under 1 line",
        args: {
          query: tool.schema.string().describe("Input"),
        },
        async execute({ query }) {
          return `result for ${query}`;
        },
      }),
    },
  };
};

export default MyPlugin;
```

```json
// 3. register it in opencode.json §plugin
"plugin": [
  "plugins/index.ts",
  "plugins/my-plugin.ts"   // <-- new
]
```

That's it. Restart opencode. The tool is available to every agent that has `skill` permission.

---

## the rules I follow

1. **One plugin, one concern.** A plugin that does two things is two plugins.
2. **No shared state between plugins.** Each plugin owns its own state. If you need cross-plugin state, write to a file and read from it.
3. **Tools return strings.** The LLM sees a string. Return a string. JSON-stringify objects.
4. **Hooks degrade gracefully.** Wrap every hook body in try/catch. A broken hook should not break the agent.
5. **No side effects in tool definitions.** Tools describe what they do; they don't do anything until `execute()` is called.

---

## debugging tips

- **Add `console.log` to a hook** and watch the runtime logs. Most issues are obvious once you see the input/output.
- **Use the `debug-logger.ts` utility** for structured logs: `logger.debug("hook", "chat.params", { input, output })`.
- **Test in isolation.** Plugins are just TypeScript. You can `import` them in a test and call the hooks directly.

---

## what to read next

- **The agents** that call these tools — [the-19-agents.md](the-19-agents.md)
- **The skills** that complement the tools — [the-46-skills.md](the-46-skills.md)
- **The memory loop** that depends on `memory-context.ts` — see the README
- **The drift checkers** in `doc-sync.ts` — [/sync-docs command](start-here.md#the-20-slash-commands-in-priority-order)
