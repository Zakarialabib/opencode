# 🔌 Plugins Guide

Plugins extend OpenCode's functionality via TypeScript modules that export hooks and custom tools. The current plugin is registered in `opencode.json` as `plugins/index.ts`.

---

## 🚀 Active Plugin: LM Studio Integration

**Location**: `plugins/index.ts`

### Features

1. **LM Studio Health Monitoring**
   - Automatically checks LM Studio server health before each chat message
   - Alerts if the server is unreachable

2. **Model Management Tools**
   - `lmstudio_health`: Check server status and version
   - `lmstudio_models`: List available models
   - `lmstudio_load_model`: Load a specific model
   - `lmstudio_unload_model`: Unload current model

3. **Self-Improvement Engine**
   - `apply_config_improvements`: Apply proposed config changes after review
   - `evaluate_agent`: Analyze agent performance metrics
   - Session analysis with improvement recommendations

### Plugin Hooks

- **`chat.message`**: Pre-flight LM Studio health check and model loading
- **`tool.execute.after`**: Log tool usage patterns for optimization
- **`session.archived`**: Generate config improvement proposals

---

## 📝 Plugin Configuration

Registered in `opencode.json`:

```json
{
  "plugin": ["C:\\opencode\\plugins\\index.ts"]
}
```

---

## 🛠️ Custom Tools Provided

| Tool                        | Description                                                   |
| :-------------------------- | :------------------------------------------------------------ |
| `lmstudio_health`           | Check LM Studio server health and display version             |
| `lmstudio_models`           | List available models from LM Studio server                   |
| `lmstudio_load_model`       | Load a specific model in LM Studio                            |
| `lmstudio_unload_model`     | Unload the current model                                      |
| `apply_config_improvements` | Apply proposed config improvements after human review         |
| `evaluate_agent`            | Evaluate specific agent performance and suggest optimizations |

---

## 🚀 Creating Your Own Plugin

OpenCode plugins are TypeScript modules that export a Plugin function:

```typescript
import { Plugin } from "@opencode-ai/plugin";

const MyPlugin: Plugin = async ({ client, project, directory }) => {
  return {
    // Hook: Before each message
    "chat.message": async ({ sessionID, agent, model }) => {
      // Your logic here
    },

    // Custom tools
    tool: {
      my_tool: tool({
        description: "My custom tool",
        args: { param: tool.schema.string() },
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

- **`chat.message`**: Called before/after each chat message
- **`chat.params`**: Modify parameters sent to LLM
- **`tool.execute.before/after`**: Intercept tool calls
- **`session.archived`**: Called when session ends

---

## 📂 Plugin Structure

```
plugins/
├── index.ts          # Main plugin (LM Studio integration)
└── README.md         # Plugin documentation
```

---

> [!CAUTION]
> Plugins have access to your terminal and filesystem. Only use plugins from trusted sources and audit the code before enabling.
