# AGENTS.md

## Project Overview

This is an OpenCode configuration project containing custom agents, skills, MCP server configs, and project rules.

## Project Structure

- `opencode.json`: Main OpenCode configuration file defining agents, tools, permissions, MCP servers, formatters, and commands.
- `agents/`: Directory containing custom agent definition files (e.g., lead-orchestrator.md, core-builder.md).
- `skills/`: Custom skills for specialized tasks (e.g., docs-governance-audit, laravel-feature-scaffold).
- `rules/`: Project rules for code style, formatting, and stack-specific guidelines (e.g., tauri.md, react.md, laravel.md).
- `plugins/`: Custom plugins for OpenCode (e.g., index.ts).

## Key Configurations

- **Model**: Uses opencode/hy3-preview-free as default, with hy3-review-free for reasoning tasks.
- **Agents**: 19 custom agents covering core, lead, frontend, backend, QA, devops, and docs roles.
- **MCP Servers**: 8 MCP servers enabled (context7, filesystem, memory, git, fetch, sqlite, sequential-thinking, language-server).
- **Tools**: All core tools enabled (write, edit, bash, read, glob, grep, list, task, skill, lsp, etc.).
- **Permissions**: Granular permissions for skills, commands, files, reads, edits, etc., with sensitive files (e.g., .env) protected.

## Coding Patterns

- Agent configurations follow OpenCode docs standards with role-specific tools and permissions.
- Instructions reference project rules and skills for stack-aware development.
- Formatters (biome, prettier) are configured for automatic code formatting.
- Self-improvement workflows are enabled via docs-evolver and core-builder agents.

## Recent Improvements (2026-05-01)

### Qwen Code-Inspired Adaptations for OpenCode

- **SubAgent Delegation**: Enhanced lead-orchestrator with Task tool patterns (context packaging, parallel execution, result synthesis)
- **Workflow Manager Skill**: Created `skills/workflow-manager/` with Qwen-inspired ANALYZE→PLAN→DELEGATE→SYNTHESIZE→VERIFY phases
- **Context Management**: Added `context` config to opencode.json for smart file inclusion/exclusion
- **Hybrid Thinking**: Integrated sequential-thinking MCP for planning phase, direct execution for implementation

### Configuration Fixes

- Created missing agent files: `agents/core-builder.md`, `agents/core-planner.md`
- Fixed agent references in `skills/index.json` (aligned with opencode.json agent names)
- Tightened file/edit permissions (changed `"*": "allow"` to `"*": "ask"` for files)
- Enabled memory MCP server for persistent context across sessions
- Added timeouts to all MCP servers (10-30s) to prevent hanging
