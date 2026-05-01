# Plugin Configuration

## Installation Note
Some plugins require manual installation due to npm permission restrictions. Run these in your terminal as Administrator if possible.

## Recommended Plugins (Install via npm)

### 1. Dynamic Context Pruning (`@tarquinen/opencode-dcp`)
**Purpose**: Optimizes token usage by pruning obsolete tool outputs from conversation context.
```bash
npm install -g @tarquinen/opencode-dcp
```
**Config Key**: `opencode-dcp`

### 2. Background Agents (`opencode-background-agents`)
**Purpose**: Claude Code-style background agents with async delegation and context persistence.
```bash
npm install -g opencode-background-agents
```
**Activation**: Use `/bg` command to spawn a background agent.

### 3. CC Safety Net (`cc-safety-net`)
**Purpose**: Catches destructive git and filesystem commands before they execute.
```bash
npm install -g cc-safety-net
```
**Activation**: Always active. Intercepts dangerous commands.

### 4. Oh My OpenCode & Oh My OpenCode Slim
**Purpose**: Provides core swarm orchestration logic and the `ulw` (ultrawork) keyword for automatic task decomposition. The Slim version is optimized for token efficiency (MVI).
```bash
npm install -g @nicedoc/oh-my-opencode
# OR for the slim version
npm install -g @nicedoc/oh-my-opencode-slim
```

### 5. Opencode Mem
**Purpose**: Implements the Semantic Memory layer using a local vector database for long-term context retention.
```bash
npm install -g opencode-mem
```

### 6. Pocket Universe
**Purpose**: Enables resilient async agents that can operate in the background without blocking your primary terminal thread.
```bash
npm install -g pocket-universe
```

### 7. Envsitter Guard
**Purpose**: Essential for the "Security Review" skill. Allows agents to inspect `.env` keys/fingerprints while preventing value leaks.
```bash
npm install -g envsitter-guard
```

### 8. Froggy
**Purpose**: Provides hooks to trigger automatic linting or formatting after the "Build Agent" modifies a file.
```bash
npm install -g opencode-froggy
```

## Built-in OpenCode Plugins (No Install Needed)

### 5. Model Announcer
**Purpose**: Automatically injects the current model name into the chat context.
**Activation**: Built-in. No configuration needed.

### 6. Agent Memory
**Purpose**: Letta-inspired persistent, self-editable memory blocks.
**Activation**: Built-in via `memory` MCP server already configured.

## Plugin Configuration in opencode.json

Add plugins to the `plugins` section:

```json
{
  "plugins": {
    "opencode-dcp": {
      "threshold": 0.7,
      "preserveRecent": 10
    },
    "cc-safety-net": {
      "blockPatterns": [
        "rm -rf",
        "git reset --hard",
        "git push --force"
      ]
    }
  }
}
```

## Best Practices
1. Run `/context` at end of each session to monitor token usage.
2. Trust CC Safety Net to block dangerous commands—never bypass it.
3. Use Background Agents for deep research tasks to avoid SSE timeouts.
4. Keep context files under 200 lines for optimal pruning efficiency.