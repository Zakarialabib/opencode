# 🔌 Plugins Guide

Plugins extend OpenCode's functionality via TypeScript modules that export hooks and custom tools. Plugins are registered in `opencode.json` under the `"plugin"` array.

---

## 🚀 Active Plugins

### 1. **agent-router.ts** - Intelligent Agent Routing

**Location**: `plugins/agent-router.ts`

#### Features

- **Task Analysis**: Automatically analyzes incoming messages to determine the best agent
- **Keyword Matching**: Scores agents based on keyword matches (2 points each)
- **Skill Matching**: Scores agents based on skill matches (3 points each)
- **Auto-suggestion**: Hooks into `chat.message` to suggest agent switching

#### Tools Provided

| Tool          | Description                                                       |
| ------------- | ----------------------------------------------------------------- |
| `route_agent` | Analyze a task and recommend the best agent with detailed scoring |
| `auto_route`  | Automatically suggest agent switching based on message content    |

#### Example Usage

```bash
Ask lead-strategist: "Which agent should handle Laravel authentication?"
# Returns: 🎯 Recommended Agent: **backend-laravel**
#           Role: Laravel, Livewire, PHP 8.3 development
#           Matched Keywords: laravel, authentication
#           Use: `/agent backend-laravel`
```

---

### 2. **model-router.ts** - Smart Model Selection

**Location**: `plugins/model-router.ts`

#### Features

- **Capability Registry**: Tracks tool calling and reasoning support per model
- **Smart Routing**: Recommends best model based on requirements (tools, reasoning)
- **Instruction Handling**: Converts instructions to system prompt for incompatible models

#### Tools Provided

| Tool              | Description                                |
| ----------------- | ------------------------------------------ |
| `check_model`     | Check capabilities of a specific model     |
| `recommend_model` | Recommend best model based on requirements |

#### Hook

- **`model.call`**: Intercepts model calls to handle instruction parameter differences

---

### 3. **mcp-manager.ts** - MCP Server Management

**Location**: `plugins/mcp-manager.ts`

#### Features

- **Server Listing**: Lists all configured MCP servers and their status
- **Health Checks**: Checks if MCP servers are responding
- **Toggle Control**: Enable/disable MCP servers (requires restart)

#### Tools Provided

| Tool         | Description                                      |
| ------------ | ------------------------------------------------ |
| `mcp_list`   | List all configured MCP servers and their status |
| `mcp_check`  | Check health of a specific MCP server            |
| `mcp_toggle` | Enable or disable an MCP server                  |

---

### 4. **skill-manager.ts** - Skill Registry Access

**Location**: `plugins/skill-manager.ts`

#### Features

- **Skill Listing**: Lists all registered skills with agent assignments
- **Skill Details**: Get comprehensive information about a specific skill
- **Skill Search**: Search skills by keyword, description, or tags

#### Tools Provided

| Tool           | Description                                     |
| -------------- | ----------------------------------------------- |
| `skill_list`   | List all registered skills (filter by category) |
| `skill_info`   | Get detailed information about a specific skill |
| `skill_search` | Search for skills by keyword or tag             |

---

### 5. **context-manager.ts** - Context Configuration

**Location**: `plugins/context-manager.ts`

#### Features

- **Context Viewing**: View current include/exclude patterns
- **Dynamic Updates**: Add/remove patterns from context configuration
- **Reset to Defaults**: Restore default context configuration

#### Tools Provided

| Tool                  | Description                            |
| --------------------- | -------------------------------------- |
| `context_view`        | View current context configuration     |
| `context_add_include` | Add pattern to context include list    |
| `context_add_exclude` | Add pattern to context exclude list    |
| `context_reset`       | Reset context configuration to default |

---

### 6. **extension-context-bridge.ts** - IDE Integration

**Location**: `plugins/extension-context-bridge.ts`

#### Purpose

Bridges context between OpenCode and IDE extensions for seamless integration.

---

### 7. **ide-mcp-bridge.ts** - IDE MCP Integration

**Location**: `plugins/ide-mcp-bridge.ts`

#### Purpose

Exposes MCP tools to IDE extensions, allowing IDEs to leverage OpenCode's MCP servers.

---

### 8. **language-context-bridge.ts** - LSP Integration

**Location**: `plugins/language-context-bridge.ts`

#### Purpose

Bridges language server context to agents for enhanced code intelligence.

---

### 9. **process-monitor.ts** - Process Management

**Location**: `plugins/process-monitor.ts`

#### Purpose

Monitors and manages background processes spawned by agents.

---

### 10. **index.ts** - Legacy LM Studio Plugin

**Location**: `plugins/index.ts`

#### Features

- **LM Studio Health Monitoring**: Checks server health before each message
- **Model Management**: Load/unload models, list available models
- **Self-Improvement Engine**: Generates config improvement proposals

#### Tools Provided

| Tool                        | Description                               |
| --------------------------- | ----------------------------------------- |
| `lmstudio_health`           | Check LM Studio server health and version |
| `lmstudio_models`           | List available models from LM Studio      |
| `lmstudio_load_model`       | Load a specific model in LM Studio        |
| `lmstudio_unload_model`     | Unload the current model                  |
| `apply_config_improvements` | Apply proposed config improvements        |
| `evaluate_agent`            | Evaluate agent performance metrics        |

#### Hooks

- **`chat.message`**: Pre-flight LM Studio health check
- **`tool.execute.after`**: Log tool usage patterns
- **`session.archived`**: Generate config improvement proposals

---

## 📦 External Plugins (npm)

| Plugin                        | Purpose                              |
| ----------------------------- | ------------------------------------ |
| `@zenobius/opencode-skillful` | Skill management and discovery tools |

### Installation

```bash
npm install -g @zenobius/opencode-skillful
```

---

## 🛠️ Plugin Configuration

Registered in `opencode.json`:

```json
{
  "plugin": [
    "C:\\opencode\\plugins\\index.ts",
    "C:\\opencode\\plugins\\agent-router.ts",
    "C:\\opencode\\plugins\\model-router.ts",
    "C:\\opencode\\plugins\\mcp-manager.ts",
    "C:\\opencode\\plugins\\skill-manager.ts",
    "C:\\opencode\\plugins\\context-manager.ts",
    "C:\\opencode\\plugins\\extension-context-bridge.ts",
    "C:\\opencode\\plugins\\ide-mcp-bridge.ts",
    "C:\\opencode\\plugins\\language-context-bridge.ts",
    "C:\\opencode\\plugins\\process-monitor.ts",
    "@zenobius/opencode-skillful"
  ]
}
```

---

## 🚀 Creating Your Own Plugin

OpenCode plugins are TypeScript modules that export a Plugin function:

```typescript
import { Plugin, tool } from "@opencode-ai/plugin";

const MyPlugin: Plugin = async ({ client, project, directory }) => {
  return {
    // Hook: Before each message
    "chat.message": async ({ sessionID, agent, messageID, message }) => {
      // Your logic here
      console.log(`Message from ${agent}: ${message.slice(0, 50)}...`);
    },

    // Hook: Before/after tool execution
    "tool.execute.before": async (input, output) => {
      if (input.tool === "bash") {
        // Modify bash commands
        output.args.command = escape(output.args.command);
      }
    },

    // Custom tools
    tool: {
      my_tool: tool({
        description: "My custom tool",
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

### Available Hooks

| Hook                              | Description                                 |
| --------------------------------- | ------------------------------------------- |
| `chat.message`                    | Called before/after each chat message       |
| `chat.params`                     | Modify parameters sent to LLM               |
| `tool.execute.before/after`       | Intercept tool calls before/after execution |
| `model.call`                      | Intercept model API calls                   |
| `session.archived`                | Called when session ends                    |
| `experimental.session.compacting` | Customize session compaction                |

---

## 📂 Plugin Structure

```
plugins/
├── agent-router.ts          # Intelligent agent routing
├── model-router.ts          # Smart model selection
├── mcp-manager.ts          # MCP server management
├── skill-manager.ts         # Skill registry access
├── context-manager.ts       # Context configuration
├── extension-context-bridge.ts  # IDE integration
├── ide-mcp-bridge.ts       # IDE MCP bridge
├── language-context-bridge.ts   # LSP integration
├── process-monitor.ts      # Process management
├── index.ts                # Legacy LM Studio plugin
└── README.md              # Plugin documentation
```

---

## 💡 Plugin Development Tips

1. **Use TypeScript**: Plugins are written in TypeScript and loaded by OpenCode
2. **Export Default**: Always export a default function that returns the plugin object
3. **Hook into Events**: Use hooks to intercept and modify OpenCode behavior
4. **Provide Tools**: Add custom tools that agents can call
5. **Error Handling**: Wrap async operations in try-catch blocks
6. **Logging**: Use `client.app.log()` for structured logging

---

> [!CAUTION]
> Plugins have access to your terminal and filesystem. Only use plugins from trusted sources and audit the code before enabling.

---

## 🔗 Integration with Agent Routing & Workflows

Plugins work together with the agent routing and workflow systems.

### Agent Router + Skill Manager

```
User: "Generate a PDF report"
→ agent-router: Detects "pdf" keyword, scores agents (3 points for skill match)
→ Recommends: qa-guardian (for agent-browser skill)
→ skill-manager: Confirms pdf skill is assigned to qa-guardian
→ Result: Use `/agent qa-guardian` then ask to generate PDF
```

### Model Router + Context Manager

```
User: "Analyze this complex architecture"
→ model-router: Recommends model with reasoning support (check_model tool)
→ context-manager: Ensures architecture files are in context (context_view tool)
→ Result: Uses appropriate model with full project context
```

### Plugin Hooks in Workflows

Plugins can hook into workflow events:

```typescript
// agent-router.ts hook example
"chat.message": async ({ sessionID, agent, messageID, message }) => {
  // Analyze message for workflow triggers
  if (message.includes("workflow") || message.includes("feature")) {
    const routing = analyzeTask(message);
    if (routing.recommendedAgent !== agent) {
      return `💡 Consider switching to ${routing.recommendedAgent} for this workflow`;
    }
  }
}
```

---

> [!TIP]
> Use the `route_agent` tool to let the system recommend the best agent for your task. Combine with `skill_search` to discover relevant skills, and `mcp_list` to verify MCP server availability.
