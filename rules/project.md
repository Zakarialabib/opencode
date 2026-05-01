# Project Rules

## Trae IDE Integration

### Language Server Rules

1. **Rust Files** (`*.rs`):
   - Always check Trae's rust-analyzer before editing
   - Use `trae_get_rust_context(filePath, symbol?)` to get context
   - Validate syntax with rust-analyzer after changes
   - Check for compilation errors via Trae's Problems panel

2. **TypeScript/JavaScript Files** (`*.ts`, `*.tsx`, `*.js`):
   - Always check Trae's TypeScript language server before editing
   - Use `trae_get_typescript_context(filePath)` to get context
   - Verify imports and type information
   - Check for diagnostic errors after changes

3. **CSS/Tailwind Files** (`*.css`, `*.html`):
   - Always check Trae's Tailwind extension before editing classes
   - Use `trae_suggest_tailwind_classes(partialClass)` for suggestions
   - Validate Tailwind classes before committing
   - Prefer Tailwind utility classes over custom CSS

4. **YAML/JSON Files** (`*.yaml`, `*.yml`, `*.json`):
   - Use Trae's YAML/JSON language servers for validation
   - Check schema validation before editing configs
   - Use `trae_get_extension_context('yaml')` for YAML context

### MCP Server Rules

5. **Prefer Trae's Running MCP Servers**:
   - Before spawning a new MCP server, check if Trae already has it
   - Use `trae_check_mcp(serverName)` to verify availability
   - Use `trae_bridge_status` to see all bridgeable servers
   - Fall back to local spawn only if Trae's not available

6. **Knowledge Graph Usage**:
   - Use Trae's knowledge-graph MCP for persistent memory
   - Don't spawn a separate instance if Trae's is running
   - Check status with `trae_list_mcp_servers`

7. **Context7 Documentation**:
   - Use Trae's context7 MCP for documentation lookup
   - Bridge to Trae's instance instead of spawning new one
   - Verify availability with `trae_check_mcp('context7')`

### Process Monitoring Rules

8. **Health Checks**:
   - Before starting work, check Trae's process health: `trae_process_health`
   - Monitor SignSync processes: `trae_monitor_signsync`
   - Verify critical services are running before editing

9. **Development Server Monitoring**:
   - Check if Tauri dev server is running via `trae_find_process('tauri')`
   - Monitor rust-analyzer PID before Rust work
   - Alert if memory usage exceeds thresholds (check `trae_top_processes`)

10. **Resource Awareness**:
    - Check Trae's total memory usage before heavy operations
    - Use `trae_process_list(sortBy: 'memory')` to identify resource hogs
    - Consider closing unused extensions if memory is low

### Extension Context Rules

11. **Tailwind CSS**:
    - For any UI work, query Trae's Tailwind extension first
    - Use `trae_get_extension_context('tailwind', query?)` for context
    - Validate class names with extension before using

12. **YAML Validation**:
    - For config files (opencode.json, etc.), use Trae's YAML extension
    - Check validation errors before committing config changes
    - Use `trae_get_extension_context('yaml')` for YAML context

### Project-Specific Rules (SignSync)

13. **Tauri + SolidJS + Laravel Stack**:
    - Recognize this is a Rust (Tauri) + TypeScript (SolidJS) + PHP (Laravel) project
    - Use appropriate language server for each stack
    - Bridge to Trae's rust-analyzer for Tauri backend work
    - Bridge to Trae's TypeScript server for SolidJS frontend work

14. **Cross-Stack Awareness**:
    - Changes in Tauri backend may affect SolidJS frontend
    - Changes in Laravel may affect both frontend and backend
    - Use Trae's process monitoring to verify all stacks are running

15. **Build & Deploy**:
    - Check Trae's process tree before building
    - Verify rust-analyzer is active before `cargo build`
    - Monitor build process memory usage

### General Orchestration Rules

16. **Always Check Trae First**:
    - Before any operation, check if Trae has relevant context
    - Use bridge tools to leverage Trae's running services
    - Don't duplicate services that Trae already provides

17. **Graceful Fallback**:
    - If Trae's services aren't available, fall back to OpenCode defaults
    - Log when falling back: "Trae's X not available, using local Y"
    - Don't fail if Trae's services are down

18. **Documentation**:
    - Update `trae-mcp-bridge.md` when adding new bridge capabilities
    - Document which Trae services are being used in agent logs
    - Keep `trae.md` up-to-date for accurate process monitoring

19. **Agent Coordination**:
    - Use project-orchestrator agent for project-aware tasks
    - Pass Trae context to specialized agents
    - Monitor agent progress via Trae's process monitoring

20. **Performance**:
    - Prefer Trae's IPC over spawning new processes (faster)
    - Reuse Trae's language servers (already warmed up)
    - Monitor Trae's CPU usage to avoid overloading

---

## Quick Reference

| Task | Tool to Use | Fallback |
|------|-------------|----------|
| Edit Rust file | `trae_get_rust_context` | Standard OpenCode tools |
| Edit TS file | `trae_get_typescript_context` | Standard OpenCode tools |
| Add Tailwind class | `trae_suggest_tailwind_classes` | Manual lookup |
| Check MCP server | `trae_check_mcp` | Spawn locally |
| Monitor processes | `trae_process_list` | Read trae.md manually |
| Validate YAML | `trae_get_extension_context('yaml')` | Manual validation |

---

**Last Updated**: 2026-04-28  
**Applies To**: All agents working on project with Trae IDE integration
