# MCP Tools Reference

This document provides detailed information about the MCP (Model Context Protocol) servers configured in this project.

## What is MCP?

The Model Context Protocol (MCP) is an open standard that enables AI assistants to connect to external tools and data sources. MCP servers provide tools, resources, and prompts that can be used by AI models.

## Configured MCP Servers

### Filesystem MCP

**Purpose**: File system operations for project files

**Server**: `@modelcontextprotocol/server-filesystem`

**Configuration:**
```json
{
  "filesystem": {
    "type": "local",
    "command": ["npx", "-y", "@modelcontextprotocol/server-filesystem", "/home/z/my-project"]
  }
}
```

**Available Tools:**
- `read_file` - Read file contents
- `write_file` - Write to files
- `list_directory` - List directory contents
- `create_directory` - Create directories
- `move_file` - Move/rename files
- `search_files` - Search for files
- `get_file_info` - Get file metadata

**Usage Example:**
```
Read the file src/main.ts
List all files in the components directory
Create a new file called utils.ts in the src folder
```

---

### Memory MCP

**Purpose**: Persistent memory for context across sessions

**Server**: `@modelcontextprotocol/server-memory`

**Configuration:**
```json
{
  "memory": {
    "type": "local",
    "command": ["npx", "-y", "@modelcontextprotocol/server-memory"]
  }
}
```

**Available Tools:**
- `save_memory` - Store information for later recall
- `recall_memory` - Retrieve stored information
- `list_memories` - List all stored memories
- `delete_memory` - Remove a stored memory

**Usage Example:**
```
Remember that the project uses TypeScript with strict mode
What do you know about this project's architecture?
```

---

### Fetch MCP

**Purpose**: Web content fetching

**Server**: `mcp-server-fetch`

**Configuration:**
```json
{
  "fetch": {
    "type": "local",
    "command": ["uvx", "mcp-server-fetch"]
  }
}
```

**Available Tools:**
- `fetch` - Fetch content from a URL
- `fetch_multiple` - Fetch from multiple URLs

**Usage Example:**
```
Fetch the content from https://example.com/api/docs
Get the latest release notes from the project's GitHub page
```

---

### Sequential Thinking MCP

**Purpose**: Structured thinking for complex problems

**Server**: `@modelcontextprotocol/server-sequential-thinking`

**Configuration:**
```json
{
  "sequential-thinking": {
    "type": "local",
    "command": ["npx", "-y", "@modelcontextprotocol/server-sequential-thinking"]
  }
}
```

**Available Tools:**
- `think` - Break down complex problems into steps
- `evaluate_step` - Evaluate progress on current step

**Usage Example:**
```
Let's think through this architecture decision step by step
Help me analyze this problem systematically
```

---

### SQLite MCP

**Purpose**: SQLite database operations

**Server**: `mcp-server-sqlite`

**Configuration:**
```json
{
  "sqlite": {
    "type": "local",
    "command": ["uvx", "mcp-server-sqlite"]
  }
}
```

**Available Tools:**
- `query` - Execute SQL queries
- `list_tables` - List all tables
- `describe_table` - Get table schema
- `create_table` - Create new tables

**Usage Example:**
```
Query the users table for active accounts
Create a new table called products with columns id, name, price
```

---

### GitHub MCP

**Purpose**: GitHub integration

**Server**: `@modelcontextprotocol/server-github`

**Configuration:**
```json
{
  "github": {
    "type": "local",
    "command": ["npx", "-y", "@modelcontextprotocol/server-github"],
    "env": {
      "GITHUB_TOKEN": "${GITHUB_TOKEN}"
    }
  }
}
```

**Required Environment:**
- `GITHUB_TOKEN` - GitHub Personal Access Token

**Available Tools:**
- `create_issue` - Create GitHub issues
- `create_pull_request` - Create pull requests
- `search_repositories` - Search for repos
- `get_file_contents` - Get file from GitHub
- `list_commits` - List repository commits
- `create_branch` - Create new branches

**Usage Example:**
```
Create an issue in myrepo/myproject about the bug
List recent commits in the main branch
```

---

### Git MCP

**Purpose**: Git operations support

**Server**: `mcp-server-git`

**Configuration:**
```json
{
  "git": {
    "type": "local",
    "command": ["uvx", "mcp-server-git", "--repository", "."]
  }
}
```

**Available Tools:**
- `git_status` - Show working tree status
- `git_log` - Show commit history
- `git_diff` - Show changes
- `git_branch` - List/create branches
- `git_commit` - Create commits

**Usage Example:**
```
Show me the git status
What changed in the last commit?
Create a new branch called feature/new-api
```

---

### Brave Search MCP

**Purpose**: Web search via Brave

**Server**: `@modelcontextprotocol/server-brave-search`

**Configuration:**
```json
{
  "brave-search": {
    "type": "local",
    "command": ["npx", "-y", "@modelcontextprotocol/server-brave-search"],
    "env": {
      "BRAVE_API_KEY": "${BRAVE_API_KEY}"
    }
  }
}
```

**Required Environment:**
- `BRAVE_API_KEY` - Brave Search API Key

**Available Tools:**
- `search` - Search the web
- `search_news` - Search news articles

**Usage Example:**
```
Search for the latest TypeScript 5.0 features
Find news about the recent npm security advisory
```

---

### Puppeteer MCP

**Purpose**: Browser automation and web scraping

**Server**: `@modelcontextprotocol/server-puppeteer`

**Configuration:**
```json
{
  "puppeteer": {
    "type": "local",
    "command": ["npx", "-y", "@modelcontextprotocol/server-puppeteer"]
  }
}
```

**Available Tools:**
- `navigate` - Navigate to URLs
- `screenshot` - Take screenshots
- `click` - Click elements
- `type` - Type text
- `evaluate` - Run JavaScript

**Usage Example:**
```
Navigate to https://example.com and take a screenshot
Fill out the form on the login page
```

---

### Slack MCP

**Purpose**: Slack integration

**Server**: `@modelcontextprotocol/server-slack`

**Configuration:**
```json
{
  "slack": {
    "type": "local",
    "command": ["npx", "-y", "@modelcontextprotocol/server-slack"],
    "env": {
      "SLACK_BOT_TOKEN": "${SLACK_BOT_TOKEN}",
      "SLACK_TEAM_ID": "${SLACK_TEAM_ID}"
    }
  }
}
```

**Required Environment:**
- `SLACK_BOT_TOKEN` - Slack Bot Token
- `SLACK_TEAM_ID` - Slack Team ID

**Available Tools:**
- `send_message` - Send messages to channels
- `list_channels` - List available channels
- `get_channel_history` - Get channel messages

**Usage Example:**
```
Send a message to #general about the deployment
List all channels in the workspace
```

---

### PostgreSQL MCP

**Purpose**: PostgreSQL database operations

**Server**: `@modelcontextprotocol/server-postgres`

**Configuration:**
```json
{
  "postgres": {
    "type": "local",
    "command": ["npx", "-y", "@modelcontextprotocol/server-postgres"],
    "env": {
      "POSTGRES_CONNECTION_STRING": "${POSTGRES_CONNECTION_STRING}"
    }
  }
}
```

**Required Environment:**
- `POSTGRES_CONNECTION_STRING` - PostgreSQL connection string

**Available Tools:**
- `query` - Execute SQL queries
- `list_tables` - List all tables
- `describe_table` - Get table schema

---

## Using MCP Tools in OpenCode

### Discovering Tools

In OpenCode, you can ask the agent about available tools:
```
What MCP tools are available?
List the tools from the filesystem server
```

### Using Tools

Simply describe what you want to do:
```
Search for files containing "API" in the src directory
Remember that we use Node.js 20 for this project
Fetch the documentation from the project's website
```

### Debugging MCP Issues

1. Check server status in OpenCode logs
2. Verify environment variables are set
3. Ensure required dependencies are installed
4. Check network connectivity for remote servers

## Adding Custom MCP Servers

To add a custom MCP server, edit `opencode.json`:

```json
{
  "mcp": {
    "my-custom-server": {
      "type": "local",
      "command": ["node", "path/to/server.js"],
      "env": {
        "API_KEY": "${MY_API_KEY}"
      },
      "description": "My custom MCP server"
    }
  }
}
```

For remote MCP servers:

```json
{
  "mcp": {
    "my-remote-server": {
      "type": "remote",
      "url": "https://api.example.com/mcp",
      "headers": {
        "Authorization": "Bearer ${API_KEY}"
      }
    }
  }
}
```

## Security Considerations

1. **API Keys**: Always use environment variables for secrets
2. **File Access**: Limit filesystem paths to project directories
3. **Network**: Be cautious with remote MCP servers
4. **Permissions**: Review what each MCP server can access
