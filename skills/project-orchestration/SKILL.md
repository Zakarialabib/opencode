# Project Orchestration Skill

## Overview

This skill enables OpenCode agents to orchestrate project tasks using Trae IDE's running context. It bridges Trae's MCP servers, language services, extensions, and process monitoring to provide deep, context-aware assistance.

## When to Use

Use this skill when:

- Working on SignSync project (Tauri + SolidJS + Laravel)
- Need deep code intelligence from Trae's language servers
- Want to leverage Trae's running MCP servers
- Need process monitoring and health checks
- Want project-specific, context-aware assistance

## Prerequisites

1. **Trae IDE must be running** with the project open
2. **`trae.md` must exist** in project root (process tree snapshot)
3. **Trae's extension host** should have MCP servers running
4. **Language servers** should be active (rust-analyzer, TypeScript, etc.)

## Skill Steps

### Step 1: Check Trae's Health

First, verify Trae IDE and its services are running:

```
Use tool: trae_process_health
```

Expected output: Should show MCP servers, extension hosts, language servers.

If Trae's not running:

- Start Trae IDE
- Open the project in Trae
- Regenerate `trae.md` if needed

### Step 2: Identify Required Context

Based on the task, determine what Trae context you need:

| Task Type                  | Context Needed             | Tool to Use                             |
| -------------------------- | -------------------------- | --------------------------------------- |
| Rust code editing          | rust-analyzer              | `trae_get_rust_context(filePath)`       |
| TypeScript editing         | TypeScript language server | `trae_get_typescript_context(filePath)` |
| CSS/Tailwind editing       | Tailwind extension         | `trae_suggest_tailwind_classes(query)`  |
| Config editing (YAML/JSON) | YAML/JSON language server  | `trae_get_extension_context('yaml')`    |
| Documentation lookup       | context7 MCP               | `mcp_context7_*` tools                  |
| Persistent memory          | knowledge-graph MCP        | `mcp_knowledge-graph_*` tools           |
| Process monitoring         | Trae process tree          | `trae_monitor_signsync`                 |

### Step 3: Check Context Availability

Before starting work, verify the required context is available:

```
Use tool: trae_check_mcp('context7')
Use tool: trae_language_server_status('rust')
Use tool: trae_extension_status
```

If a service isn't running:

- For MCP servers: Check Trae's extension host
- For language servers: Open a file of that type in Trae
- For extensions: Enable them in Trae's extensions panel

### Step 4: Execute Task with Context

Now execute the task using Trae's context:

**Example: Editing Rust File**

1. Get Rust context:

   ```
   Use tool: trae_get_rust_context("src-tauri/src/main.rs", "Watchdog")
   ```

2. Read the file:

   ```
   Use Read tool to read the file
   ```

3. Make changes with context-aware understanding

4. Validate with rust-analyzer:
   ```
   Re-run trae_get_rust_context to verify
   Check Trae's Problems panel for errors
   ```

**Example: Adding Tailwind Classes**

1. Get Tailwind context:

   ```
   Use tool: trae_suggest_tailwind_classes("flex")
   ```

2. Use suggestions in your HTML/JSX

3. Validate classes:
   ```
   Check Trae's IntelliSense for validation
   ```

### Step 5: Monitor Progress

While task is running, monitor relevant processes:

```
Use tool: trae_monitor_signsync
Use tool: trae_find_process('rust-analyzer')
Use tool: trae_top_processes('memory', 5)
```

If a critical process dies:

- Alert the user
- Check logs with `trae_process_list`
- Restart the service in Trae if needed

### Step 6: Validate Results

After completing the task, validate using Trae's context:

1. **Code validation**:
   - Rust: Check rust-analyzer diagnostics
   - TypeScript: Check TS server diagnostics
   - YAML/JSON: Check language server validation

2. **Process validation**:
   - Verify dev server is still running
   - Check memory usage hasn't spiked
   - Confirm MCP servers are still active

3. **Extension validation**:
   - Tailwind classes are valid
   - YAML config passes validation

## Tips

1. **Always check Trae first**: Don't spawn new services if Trae already has them
2. **Use bridge status**: Run `trae_bridge_status` to see what's available
3. **Monitor resources**: Use `trae_top_processes` to avoid overloading
4. **Graceful fallback**: If Trae's services aren't available, use OpenCode defaults
5. **Update trae.md**: Regenerate if process tree changes significantly

## Common Workflows

### Workflow 1: Rust Code Improvement

```
1. trae_check_mcp('knowledge-graph')  # Ensure persistent memory
2. trae_get_rust_context(filePath, symbol)  # Get code context
3. Read file and understand structure
4. Make improvements with context
5. trae_get_rust_context(filePath)  # Re-validate
6. Check Trae's Problems panel for errors
```

### Workflow 2: UI Development (Tailwind + SolidJS)

```
1. trae_get_typescript_context(filePath)  # TS context
2. trae_suggest_tailwind_classes(partialClass)  # Get class suggestions
3. Implement UI with suggestions
4. trae_extension_status  # Verify Tailwind extension is active
5. Check Trae's IntelliSense for validation
```

### Workflow 3: Process Monitoring During Build

```
1. trae_monitor_signsync  # Check all SignSync processes
2. trae_top_processes('memory', 10)  # Check resource usage
3. Start build process
4. Monitor with trae_process_list(sortBy: 'memory')
5. Alert if memory exceeds threshold
```

## Troubleshooting

| Issue                          | Solution                                               |
| ------------------------------ | ------------------------------------------------------ |
| `trae.md` not found            | Generate it from Trae IDE or create empty process tree |
| MCP server not found           | Check Trae's extension host is running                 |
| Language server not responding | Open a file of that type in Trae                       |
| Extension not found            | Enable extension in Trae's extensions panel            |
| Process tree outdated          | Regenerate `trae.md` from Trae                         |

## Example Prompts

**Good prompts that trigger this skill**:

- "Improve the Watchdog implementation using Trae's rust-analyzer context"
- "Add Tailwind classes to SignSync UI, check Trae's extension first"
- "Monitor SignSync build process using Trae's process tree"
- "Use Trae's context7 MCP to lookup Tauri documentation"

**Bad prompts (won't trigger skill)**:

- "Edit this file" (no Trae context mentioned)
- "Run build" (no monitoring requested)
- "Add CSS classes" (no Tailwind extension mentioned)

## Notes

- This skill requires Trae IDE to be running
- The `trae.md` file must be up-to-date
- If Trae's services aren't available, the skill will fall back to standard OpenCode tools
- Always validate context is current before making changes
- Monitor Trae's resource usage to avoid overloading

---

**Skill Version**: 1.0  
**Created**: 2026-04-28  
**Last Updated**: 2026-04-28
