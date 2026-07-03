# 🔌 Plugins Guide

Plugins extend OpenCode's functionality via TypeScript/JavaScript modules that export hooks and custom tools. They are registered in `opencode.json` under the `"plugin"` array and loaded at startup.

> See the official docs: [opencode.ai/docs/plugins](https://opencode.ai/docs/plugins/)

---

## 🚀 Active Plugins (8 total)

### Core Orchestration Plugins (5)

| #   | Plugin              | File                    | Purpose                                                                            |
| --- | ------------------- | ----------------------- | ---------------------------------------------------------------------------------- |
| 1   | **Self-Improve**    | `index.ts`              | LM Studio health checks, model management, config improvement proposals            |
| 2   | **Agent Router**    | `agent-router.ts`       | Intelligent task-to-agent routing with keyword/skill scoring                       |
| 3   | **MCP Manager**     | `mcp-manager.ts`        | List, check, toggle, and health-probe MCP servers                                  |
| 4   | **ADR Workflow**    | `adr-workflow.ts`       | Architecture Decision Record drafting and listing                                  |
| 5   | **Mobile Router**   | `mobile-tool-router.ts` | Android project detection and MCP tooling readiness check                          |
| 6   | **Workflow Router** | `workflow-router.ts`    | Agency lifecycle workflow recommendation based on task classification              |
| 7   | **Skill Manager**   | `skill-manager.ts`      | List, search, and inspect registered skills                                        |
| 8   | **Context Manager** | `context-manager.ts`    | Dynamic context include/exclude configuration                                      |
| 9   | **Memory Context**  | `memory-context.ts`     | Cross-session memory: stores decisions, patterns, conventions for prompt injection |

> Note: `jsonc-utils.ts` and `debug-logger.ts` are shared utility modules (not plugins). They are imported by other plugins at runtime.

## 🛠️ Tools Provided by Each Core Plugin

### Agent Router (`agent-router.ts`)

| Tool          | Description                                        |
| ------------- | -------------------------------------------------- |
| `route_agent` | Analyze task and recommend best agent with scoring |
| `auto_route`  | Automatically suggest agent switching              |

### MCP Manager (`mcp-manager.ts`)

| Tool         | Description                                        |
| ------------ | -------------------------------------------------- |
| `mcp_list`   | List all configured MCP servers and their status   |
| `mcp_check`  | Check health of a specific MCP server              |
| `mcp_toggle` | Enable or disable an MCP server (requires restart) |

### Skill Manager (`skill-manager.ts`)

| Tool           | Description                                       |
| -------------- | ------------------------------------------------- |
| `skill_list`   | List all registered skills (filter by category)   |
| `skill_info`   | Get detailed information about a specific skill   |
| `skill_search` | Search for skills by keyword, tag, or description |

### Context Manager (`context-manager.ts`)

| Tool                  | Description                                   |
| --------------------- | --------------------------------------------- |
| `context_view`        | View current context include/exclude patterns |
| `context_add_include` | Add pattern to context include list           |
| `context_add_exclude` | Add pattern to context exclude list           |
| `context_reset`       | Reset context configuration to defaults       |

### Memory Context (`memory-context.ts`)

| Tool              | Description                                                    |
| ----------------- | -------------------------------------------------------------- |
| `memory_store`    | Store a context fragment (decision, convention, solution, etc) |
| `memory_recall`   | Recall relevant context from past sessions                     |
| `memory_learn`    | Teach a pattern: when X triggers, suggest Y                    |
| `memory_find`     | Find learned patterns matching current task                    |
| `memory_session`  | Save or view current session summary                           |
| `memory_decision` | Log a key architectural decision                               |
| `memory_stats`    | Show memory storage statistics                                 |
| `memory_forget`   | Remove stored context by ID or type                            |

### Self-Improve (`index.ts`)

| Tool                        | Description                                     |
| --------------------------- | ----------------------------------------------- |
| `lmstudio_health`           | Check LM Studio server health and version       |
| `lmstudio_models`           | List available models from LM Studio            |
| `lmstudio_load_model`       | Load a specific model in LM Studio              |
| `lmstudio_unload_model`     | Unload the current model                        |
| `apply_config_improvements` | Apply proposed config improvements after review |
| `evaluate_agent`            | Evaluate agent performance metrics              |

---

## 📦 Plugin Registration

Plugins are registered in `opencode.json`:

```json
{
  "plugin": [
    "plugins/index.ts",
    "plugins/skill-manager.ts",
    "plugins/context-manager.ts",
    "plugins/agent-router.ts",
    "plugins/mcp-manager.ts",
    "plugins/adr-workflow.ts",
    "plugins/mobile-tool-router.ts",
    "plugins/memory-context.ts",
    "plugins/workflow-router.ts"
  ]
}
```

**Local plugins** (relative/absolute file paths) are loaded directly.  
**npm plugins** (package names) are installed automatically using Bun at startup. Packages are cached in `~/.cache/opencode/node_modules/`.

---

## 🏗️ Creating Your Own Plugin

A plugin is a TypeScript/JavaScript module that exports a default function receiving a context object and returning a hooks object.

### Basic Structure

```typescript
import { Plugin, tool } from "@opencode-ai/plugin";

const MyPlugin: Plugin = async ({ client, project, directory }) => {
  return {
    // Hooks — intercept and modify behavior
    "tool.execute.before": async (input, output) => {
      if (input.tool === "bash") {
        // Modify bash commands before execution
      }
    },

    // Custom tools — callable by agents
    tool: {
      my_tool: tool({
        description: "What this tool does",
        args: {
          param: tool.schema.string().describe("A parameter"),
        },
        async execute({ param }) {
          return `Result: ${param}`;
        },
      }),
    },
  };
};

export default MyPlugin;
```

### Context Object

The plugin function receives:

- **`client`**: SDK client for logging and AI interaction
- **`project`**: Current project information
- **`directory`**: Working directory path

### Available Hooks

| Hook                              | Description                           |
| --------------------------------- | ------------------------------------- |
| `tool.execute.before`             | Intercept tool calls before execution |
| `tool.execute.after`              | Intercept tool calls after execution  |
| `chat.message`                    | Before/after each chat message        |
| `chat.params`                     | Modify parameters sent to LLM         |
| `model.call`                      | Intercept model API calls             |
| `session.archived`                | Called when session ends              |
| `experimental.session.compacting` | Customize session compaction context  |

> See [opencode.ai/docs/plugins/#events](https://opencode.ai/docs/plugins/#events) for the complete list.

---

## 🔧 Utility: jsonc-utils.ts

The `jsonc-utils.ts` file provides a shared `parseJsonc()` function that all core plugins use to parse `opencode.json`. It correctly handles:

- **URLs with `https://`** — `//` inside strings is NOT treated as a comment
- **Single-line comments** (`// comment`) — stripped only when outside strings
- **Multi-line comments** (`/* comment */`) — stripped only when outside strings
- **Escaped characters** — `\"` and `\\` inside strings are preserved

```typescript
// Usage in any plugin:
import { parseJsonc } from "./jsonc-utils";

const config = parseJsonc(readFileSync("opencode.json", "utf8"));
```

---

## 📂 Plugin File Structure

```
plugins/
├── jsonc-utils.ts              # Shared JSONC parser (used by config-reading plugins)
├── debug-logger.ts             # Structured debug logging utility (dependency of mcp-manager)
├── index.ts                    # Self-improve + LM Studio tools + task delegation + checkpoints
├── skill-manager.ts            # Skill registry access (list, info, search)
├── context-manager.ts          # Context include/exclude configuration
├── agent-router.ts             # Intelligent task-to-agent routing
├── memory-context.ts           # Cross-session memory, pattern learning, context injection
├── mcp-manager.ts              # MCP server health, listing, toggling
├── adr-workflow.ts             # Architecture Decision Record automation
├── mobile-tool-router.ts       # Android/iOS project detection + MCP readiness
├── workflow-router.ts          # Agency lifecycle workflow routing
├── model-router.ts             # (unused — kept on disk for reference)
├── language-context-bridge.ts  # (unused — Trae IDE only, no trae.md)
├── process-monitor.ts          # (unused — Trae IDE only, no trae.md)
├── gate-validator.ts           # (unused — no consistent gate structures in workflows)
├── release-gate.ts             # (unused — trivial hardcoded list, not pipeline-connected)
└── __tests__/                  # Test suite
    └── index.test.ts           # Core plugin integration tests
```

---

## 💡 Plugin Development Tips

1. **Use TypeScript**: Import `Plugin` type from `@opencode-ai/plugin` for type safety
2. **Export Default**: Always use `export default` for the plugin function
3. **Use `parseJsonc`**: For reading config, import from `./jsonc-utils` to safely handle URLs in JSON
4. **Use `client.app.log()`**: For structured logging instead of `console.log`
5. **Error Handling**: Wrap async operations in try-catch to prevent plugin crashes
6. **Node.js Compatible**: Use `fs/promises` instead of Bun-specific APIs for portability

### Logging

```typescript
await client.app.log({
  body: {
    service: "my-plugin",
    level: "info",
    message: "Plugin initialized",
    extra: { key: "value" },
  },
});
```

Levels: `debug`, `info`, `warn`, `error`.

---

> [!CAUTION]
> Plugins have access to your terminal and filesystem. Only use plugins from trusted sources and audit the code before enabling.

---

## ⚡ Lazy Tool Loading (2026-05-08)

The MCP Manager now implements **lazy tool loading** to reduce initial context window by ~60%.

### How It Works

1. **Core tools always loaded**: read, write, edit, bash, grep, glob, list
2. **MCP tools loaded on-demand**: Based on keywords in user message
3. **Fallback**: If no keywords matched, load all tools (safe default)

### Keyword → Tool Mapping

| Keyword                      | MCP Tool Loaded     |
| ---------------------------- | ------------------- |
| database, query, sql         | sqlite              |
| commit, branch, git          | git                 |
| file, read, write, directory | filesystem          |
| http, web, api, url          | fetch               |
| docs, documentation          | context7            |
| remember, recall, history    | memory              |
| think, reasoning, analyze    | sequential-thinking |

### Example

```bash
# Message: "run database query on users table"
# Loaded: [read, write, edit, bash, grep, glob, list, sqlite]
# 8 tools vs ~12 full load = 33% reduction

# Message: "hello world"
# Loaded: [read, write, edit, bash, grep, glob, list]
# 7 tools (core only) = 42% reduction
```

### Performance

```bash
npm test -- --run plugins/__tests__/lazy-loading.test.ts
# 18 tests passed - verifies tool reduction targets
```

### Metrics Tracked

Tool loading metrics stored in SQLite:

```sql
CREATE TABLE tool_loading_metrics (
  timestamp TEXT,
  all_tools INT,
  loaded_tools INT,
  reduction_percent REAL
);
```

---

> [!TIP]
> Use `mcp_list` to verify MCP server status, `route_agent` to find the best agent for your task, `skill_search` to discover relevant skills, `draft_adr` to log architectural decisions, and `memory_store`/`memory_learn` to persist patterns across sessions. Combine with `list_lifecycle_workflows` to see available agency phases.

---

## 🔄 Dynamic Workflow Generation (2026-05-08)

OpenCode now supports **on-the-fly workflow generation** for any task type. No more relying on pre-defined templates!

### How It Works

1. **Parse task keywords** → Identify task type (CRUD, refactor, audit, optimize)
2. **Select phase templates** → Use predefined phase library
3. **Assemble workflow** → Combine phases with dependencies
4. **Validate** → Check all agents/MCPs exist
5. **Execute** → Run the generated workflow

### Usage

```bash
node scripts/generate-workflow.js "Refactor auth to use JWT"
```

### Generated Workflow Examples

| Input Task                 | Task Type | Phases | Agents Used                                                      |
| -------------------------- | --------- | ------ | ---------------------------------------------------------------- |
| "Refactor auth to use JWT" | REFACTOR  | 3      | software-architect, qa-guardian, core-factory                    |
| "Add user profile page"    | CREATE    | 5      | lead-strategist, frontend-ui-ux, software-architect, qa-guardian |
| "Fix login button crash"   | FIX       | 4      | qa-guardian, core-factory, backend-laravel, docs-curator         |

### Phase Templates Library

Available phases: `Strategy`, `Analysis`, `Design`, `Implementation`, `Triage`, `Fix`, `Verification`, `QA`, `Audit`, `Benchmark`, `Migration`, `Build`, `Deploy`, `Tests`, `Documentation`

### Generated Workflow Storage

Generated workflows are stored in: `workflows/auto/[slug]-[timestamp].yaml`

### Adding to opencode.json

To enable dynamic workflow generation:

```json
{
  "command": {
    "generate-workflow": {
      "template": "node scripts/generate-workflow.js $TASK",
      "description": "Generate workflow YAML for any task",
      "agent": "lead-strategist"
    }
  }
}
```
