# 🔌 Plugins Guide

Plugins extend OpenCode's functionality via TypeScript/JavaScript modules that export hooks and custom tools. They are registered in `opencode.json` under the `"plugin"` array and loaded at startup.

> See the official docs: [opencode.ai/docs/plugins](https://opencode.ai/docs/plugins/)

---

## 🚀 Active Plugins (12 total)

### Core Plugins (7 — work in web + CLI)

| #   | Plugin              | File                 | Purpose                                                                    |
| --- | ------------------- | -------------------- | -------------------------------------------------------------------------- |
| 1   | **Self-Improve**    | `index.ts`           | LM Studio health checks, model management, config improvement proposals    |
| 2   | **Agent Router**    | `agent-router.ts`    | Intelligent task-to-agent routing with keyword/skill scoring               |
| 3   | **Model Router**    | `model-router.ts`    | Smart model selection based on tool/reasoning capabilities                 |
| 4   | **MCP Manager**     | `mcp-manager.ts`     | List, check, and toggle MCP servers                                        |
| 5   | **Skill Manager**   | `skill-manager.ts`   | List, search, and inspect registered skills                                |
| 6   | **Context Manager** | `context-manager.ts` | Dynamic context include/exclude configuration                              |
| 7   | **JSONC Utils**     | `jsonc-utils.ts`     | Shared utility for parsing JSONC config (with `//`-safe comment stripping) |

## 🛠️ Tools Provided by Each Core Plugin

### Agent Router (`agent-router.ts`)

| Tool          | Description                                        |
| ------------- | -------------------------------------------------- |
| `route_agent` | Analyze task and recommend best agent with scoring |
| `auto_route`  | Automatically suggest agent switching              |

### Model Router (`model-router.ts`)

| Tool              | Description                                                             |
| ----------------- | ----------------------------------------------------------------------- |
| `check_model`     | Check capabilities of a specific model (tools, reasoning, instructions) |
| `recommend_model` | Recommend best model based on requirements                              |

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
    "plugins/agent-router.ts",
    "plugins/skill-manager.ts",
    "plugins/context-manager.ts",
    "plugins/extension-context-bridge.ts",
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
├── jsonc-utils.ts              # Shared JSONC parser (used by all config-reading plugins)
├── index.ts                    # Self-improve + LM Studio tools
├── agent-router.ts             # Task-to-agent routing
├── model-router.ts             # Model capability routing
├── mcp-manager.ts              # MCP server management
├── skill-manager.ts            # Skill registry access
├── context-manager.ts          # Context configuration
└── tests/                      # Test suite
    ├── parseJsonc.test.js      # JSONC parser unit tests
    └── core-plugins-e2e.test.js # Core plugin integration tests
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
> Use `mcp_list` to verify MCP server status, `route_agent` to find the best agent for your task, and `skill_search` to discover relevant skills. Combine with `skill_list` to see available capabilities.

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
