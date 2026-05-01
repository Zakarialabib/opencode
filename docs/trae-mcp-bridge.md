# Trae MCP Bridge Documentation

## Overview

The Trae MCP Bridge allows OpenCode to reuse MCP (Model Context Protocol) servers that are already running in Trae IDE's extension host, instead of spawning duplicate instances.

## Why Bridge?

| Without Bridge | With Bridge |
|--------------|------------|
| Spawns new MCP server | Reuses Trae's running MCP |
| Wastes memory (duplicate processes) | Saves memory |
| Slower startup (cold start) | Faster (already warmed up) |
| Separate context | Shared context with Trae |

## How It Works

1. **Parse Trae's Process Tree**: Reads `trae.md` to discover running processes
2. **Identify MCP Servers**: Finds MCP servers in Trae's extension host
3. **Extract IPC Paths**: Determines how to connect to Trae's servers
4. **Bridge Connections**: Configures OpenCode to use Trae's instances

## Supported MCP Servers

| MCP Server | Package | Trae IPC Path |
|-----------|---------|---------------|
| knowledge-graph | @itseasy21/mcp-knowledge-graph | `\\?\pipe\trae-mcp-knowledge-graph` |
| context7 | @upash/context7-mcp | `\\?\pipe\trae-mcp-context7` |
| fs-mcp | @bunas/fs-mcp | `\\?\pipe\trae-mcp-fs` |
| sequential-thinking | @modelcontextprotocol/server-sequential-thinking | `\\?\pipe\trae-mcp-sequential` |

## Plugin: trae-mcp-bridge.ts

### Tools Provided

#### `trae_list_mcp_servers`
Lists all MCP servers currently running in Trae IDE.

**Usage**:
```
Use tool: trae_list_mcp_servers
```

**Output**:
```
MCP servers running in Trae:
- @itseasy21/mcp-knowledge-graph (PID: 12345, Memory: 45.2MB)
  IPC: \\?\pipe\trae-mcp-knowledge-graph
- @upash/context7-mcp (PID: 12346, Memory: 32.1MB)
  IPC: \\?\pipe\trae-mcp-context7
...
```

#### `trae_check_mcp`
Check if a specific MCP server is running in Trae.

**Args**:
- `serverName` (string): MCP server name to check

**Usage**:
```
Use tool: trae_check_mcp("knowledge-graph")
```

**Output**:
```
✅ Found "knowledge-graph" in Trae:
- PID: 12345
- Memory: 45.2MB
- IPC Path: \\?\pipe\trae-mcp-knowledge-graph

You can connect to this server instead of spawning a new one.
```

#### `trae_get_process_tree`
Get Trae IDE process tree for monitoring.

**Args**:
- `filter` (string, optional): Filter processes by name

**Usage**:
```
Use tool: trae_get_process_tree("mcp")
```

#### `trae_bridge_status`
Check which OpenCode MCP servers can be bridged to Trae.

**Usage**:
```
Use tool: trae_bridge_status
```

**Output**:
```
OpenCode MCP ↔ Trae Bridge Status:

✅ knowledge-graph: Bridged to Trae (PID: 12345)
✅ context7: Bridged to Trae (PID: 12346)
⚠️  fs-mcp: Will spawn locally (@bunas/fs-mcp)
⚠️  sequential-thinking: Will spawn locally (@modelcontextprotocol/server-sequential-thinking)

To bridge, ensure Trae has these MCP servers running in its extension host.
```

## Configuration

To enable bridging, update `opencode.json`:

```json
{
  "mcp": {
    "knowledge-graph": {
      "type": "trae-ipc",
      "channel": "\\\\?\\pipe\\trae-mcp-knowledge-graph",
      "fallback": ["npx", "-y", "@itseasy21/mcp-knowledge-graph"],
      "enabled": true
    },
    "context7": {
      "type": "trae-ipc",
      "channel": "\\\\?\\pipe\\trae-mcp-context7",
      "fallback": ["npx", "-y", "@upash/context7-mcp"],
      "enabled": true
    }
  }
}
```

### Fallback Behavior

If Trae's MCP server isn't available:
1. Try to connect to Trae's IPC → Fail
2. Fall back to `fallback` command → Spawn local instance
3. Log warning: "Trae's X not available, using local Y"

## Process Tree Format

Trae generates `trae.md` with process tree:

```json
{
  "name": "trae",
  "pid": 1234,
  "children": [
    {
      "name": "extensionHost",
      "pid": 5678,
      "children": [
        {
          "name": "node.exe",
          "pid": 9012,
          "cmd": "npx @itseasy21/mcp-knowledge-graph",
          "patched_name": "mcp-knowledge-graph"
        }
      ]
    }
  ]
}
```

## Troubleshooting

### Issue: No MCP servers found
**Solution**:
1. Ensure Trae IDE is running
2. Check `trae.md` exists and is up-to-date
3. Verify MCP servers are running in Trae's extension host

### Issue: Bridge not working
**Solution**:
1. Check IPC paths are correct
2. Verify Trae's extension host is running
3. Use `trae_bridge_status` to debug

### Issue: Duplicate processes
**Solution**:
1. Ensure `type: "trae-ipc"` is set in `opencode.json`
2. Check fallback isn't being triggered
3. Monitor with `trae_list_mcp_servers`

## Testing

Run these checks to verify bridge is working:

```
1. trae_list_mcp_servers  # Should show Trae's MCPs
2. trae_bridge_status     # Should show bridge status
3. trae_check_mcp("knowledge-graph")  # Should find it in Trae
```

## Limitations

1. **Windows-only**: Currently uses Windows named pipes (`\\?\pipe\`)
2. **Trae dependency**: Requires Trae IDE to be running
3. **Static IPC paths**: Assumes fixed pipe names (may need dynamic discovery)
4. **No live updates**: `trae.md` is a snapshot, not real-time

## Future Improvements

1. **Dynamic IPC discovery**: Query Trae for actual IPC paths
2. **Cross-platform support**: Use TCP sockets on Linux/Mac
3. **Live monitoring**: WebSocket connection to Trae's extension host
4. **Auto-bridge**: Automatically detect and bridge all compatible MCPs

## Related Files

- `c:\opencode\plugins\trae-mcp-bridge.ts` - Plugin implementation
- `c:\opencode\tools\process-check.ts` - Process checking utilities
- `c:\opencode\opencode.json` - Configuration file
- `c:\opencode\trae.md` - Process tree snapshot

---

**Last Updated**: 2026-04-28  
**Version**: 1.0  
**Author**: OpenCode Agent
