# Trae Process Monitoring

This file serves as a reference for Trae-specific process monitoring and IDE integration.

## Critical Services

- **OpenCode CLI**: Local orchestration and agentic reasoning.
- **rust-analyzer**: Language server for Tauri (Rust).
- **TypeScript Server**: Language server for SolidJS/React.
- **Laravel Server**: PHP backend logic.
- **SignSync Sync**: Background synchronization service.

## Health Status

- **Bridge**: Connected to Trae IDE IPC.
- **LSP**: Active for all stacks.
- **MCP**: 8 servers enabled.

## Monitoring Instructions

1. Use `trae_process_list` to get real-time PID and memory data.
2. Cross-reference with this file to identify critical service health.
3. Alert if `rust-analyzer` or `Laravel` servers are unresponsive.
