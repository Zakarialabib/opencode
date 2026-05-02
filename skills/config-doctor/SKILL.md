# Config Doctor Skill

## Description
This skill ensures the integrity of the OpenCode configuration. It audits all agent markdown files, `opencode.json`, and skill definitions for schema compliance, identifying and fixing potential validation errors (like invalid frontmatter or incorrect tool types).

## Triggers
- **Pre-Launch Audit**: Run manually or automatically before a major session to ensure no configuration drift.
- **Config Update**: Triggered after modifying `opencode.json` or adding a new agent.
- **Troubleshooting**: Invoked when "Invalid input" or "Configuration is invalid" errors appear in the terminal.

## Workflow
1. **Agent Audit**: Scan `C:\opencode\agents\*.md` for YAML frontmatter. Ensure that if frontmatter exists, it does not contain an array-type `tools` field, as this conflicts with the core schema.
2. **Path Verification**: Verify that all file paths in `opencode.json` (plugins, agents, instructions) are absolute and exist.
3. **Skill Registry Check**: Verify `C:\opencode\skills\index.json` matches the directories in `C:\opencode\skills`.
4. **Validation**: Use the `config-validator.js` tool (if available) to run a JSON Schema validation against `opencode.json`.
5. **Self-Healing**: If errors are found, propose or automatically apply fixes (e.g., stripping invalid frontmatter).

## Best Practices
- **Prefer Absolute Paths**: Always use `C:\opencode\...` for system-wide configuration.
- **Instructions over Metadata**: Keep agent instructions in the body of the markdown file rather than complex frontmatter to avoid schema conflicts.
- **Dry-run First**: Always show the proposed configuration changes before applying them.
