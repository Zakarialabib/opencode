# OpenCode + LM Studio Agent Instructions

This document provides instructions for AI agents working with this OpenCode configuration.

## Project Overview

This project is configured to work with **LM Studio** as the local LLM provider. LM Studio provides an OpenAI-compatible API (`/v1`) for inference and a native API (`/api/v1`) for health checks, model management, and diagnostics.

## Provider Configuration

### LM Studio Local Provider

- **Base URL**: `http://127.0.0.1:8080/v1`
- **Native API URL**: `http://127.0.0.1:8080/api`
- **API Key**: Not required (local)
- **Model**: Configured as `lmstudio/qwen3.5-4b` (default)
- **Context Window**: 8192 tokens (configurable in LM Studio)
- **Streaming**: Supported
- **Tools**: Supported

### Starting LM Studio

1. Launch LM Studio application
2. Load a model (e.g., Qwen 3.5 4B)
3. Start the local server on port 1234
4. Verify server is running at `http://127.0.0.1:8080/api/extra/version`

### Auto Model Loading

OpenCode automatically loads models before inference via the native API. Use `/lmstudio-load <model-id>` to manually load a specific model.

## Available Agents

### 1. Build Agent (Default)
- **Purpose**: Full capability agent for building and implementing features
- **Temperature**: 0.3
- **Capabilities**: All tools enabled
- **Use when**: Implementing new features, fixing bugs, refactoring

### 2. Plan Agent
- **Purpose**: Read-only analysis for planning without file modifications
- **Temperature**: 0.1
- **Capabilities**: Read-only (no write/edit/patch)
- **Use when**: Planning architecture, analyzing codebase, design discussions

### 3. Test Writer Agent
- **Purpose**: Generate comprehensive test suites
- **Temperature**: 0.2
- **Capabilities**: Can only write to test files (*.test.*, *.spec.*, test_*.py)
- **Use when**: Writing unit tests, integration tests, e2e tests

### 4. Docs Agent
- **Purpose**: Generate and update documentation
- **Temperature**: 0.3
- **Capabilities**: Can only write to markdown files (*.md, *.mdx)
- **Use when**: Writing README, API docs, guides

### 5. Security Agent
- **Purpose**: Security vulnerability scanning
- **Temperature**: 0.1
- **Capabilities**: Read-only analysis
- **Use when**: Security audits, vulnerability assessments

### 6. Review Agent
- **Purpose**: Code quality analysis
- **Temperature**: 0.2
- **Capabilities**: Read-only analysis
- **Use when**: Code reviews, pattern analysis

### 7. Debug Agent
- **Purpose**: Debugging and troubleshooting
- **Temperature**: 0.1
- **Capabilities**: All tools enabled
- **Use when**: Debugging errors, investigating issues

## MCP Servers

The following MCP (Model Context Protocol) servers are configured:

### File Operations
- **filesystem**: File system access for project files
- **memory**: Persistent memory across sessions
- **git**: Git operations support

### Web & Search
- **fetch**: Web fetching capabilities
- **brave-search**: Web search via Brave (requires API key)
- **puppeteer**: Browser automation and scraping

### Database
- **sqlite**: SQLite database operations
- **postgres**: PostgreSQL operations (requires connection string)

### Integrations
- **github**: GitHub integration (requires token)
- **slack**: Slack integration (requires token)

### Utilities
- **sequential-thinking**: Structured thinking for complex problems

## Custom Commands

| Command | Description |
|---------|-------------|
| `/explain` | Explain current code in detail |
| `/refactor` | Suggest refactoring improvements |
| `/test` | Generate tests for current code |
| `/document` | Generate documentation |
| `/security-check` | Run security analysis |
| `/optimize` | Optimize performance |
| `/lmstudio-health` | Check LM Studio server health |
| `/lmstudio-models` | List available models from LM Studio |
| `/lmstudio-load` | Load a model in LM Studio |

## LM Studio Integration Tools

OpenCode provides native LM Studio tools:

- **lmstudio_health**: Check server connectivity
- **lmstudio_models**: List loaded/available models
- **lmstudio_load_model**: Load a model with specific ID
- **lmstudio_unload_model**: Unload current model

## Formatters

Automatic formatting is configured for:

| Language | Formatter | Extensions |
|----------|-----------|------------|
| JavaScript/TypeScript | Biome | .js, .jsx, .ts, .tsx, .json, .jsonc |
| CSS/HTML/MD | Prettier | .css, .scss, .html, .md, .yaml, .yml |
| PHP | php-cs-fixer | .php |
| PHP | Pint | .php |

## Best Practices

### When Using LM Studio

1. **Context Management**: LM Studio models may have varying context windows. Keep prompts focused.

2. **Temperature Settings**:
   - Use lower temperature (0.1-0.2) for code generation
   - Use higher temperature (0.3-0.5) for creative tasks
   - Default of 0.3 works well for most tasks

3. **Model Selection**: Choose models appropriate for coding tasks:
   - Qwen, CodeLlama, DeepSeek-Coder for code
   - Mistral, Llama for general tasks

4. **Health Monitoring**: Use `/lmstudio-health` to check server status before important operations.

### When Working with Files

1. Use the `filesystem` MCP server for file operations
2. Always respect the formatter configuration
3. Follow existing code patterns in the project

### When Using MCP Tools

1. **Memory MCP**: Use to store important context across sessions
2. **Sequential Thinking**: Use for complex multi-step problems
3. **Fetch MCP**: Use for retrieving web content
4. **Git MCP**: Use for version control operations

## Troubleshooting

### LM Studio Not Responding

```bash
# Check health
/lmstudio-health

# Or manually:
curl http://127.0.0.1:8080/api/extra/version

# Check models
curl http://127.0.0.1:8080/api/v1/models
```

### Model Not Loading

1. Use `/lmstudio-models` to see available models
2. Use `/lmstudio-load <model-id>` to load a specific model
3. Check LM Studio logs for errors

### Context Too Long

- Reduce prompt size
- Adjust context limits in `opencode.json`
- Split large files into smaller chunks

### Slow Generation

- Ensure LM Studio has sufficient resources (RAM, GPU)
- Use smaller quantization models
- Close other applications to free memory

## Security Considerations

1. **Local Only**: LM Studio is typically accessed locally without authentication
2. **API Keys**: Never commit API keys to version control
3. **Permissions**: The configuration blocks dangerous commands (rm -rf /, sudo, etc.)
4. **Environment Variables**: Use `.env` file for secrets

## Knowledge Files

Additional documentation is available in the `knowledge/` directory:
- `lmstudio-api.md` - Complete API reference
- `mcp-tools.md` - MCP server usage guide
- `formatters.md` - Formatter configuration details