# OpenCode Configuration Errors Report

Generated: 2026-05-03
Agent: AgentGenerator (opencode-self-healer)

## Summary

- **Total Errors Found**: 8
- **Critical**: 3
- **High**: 3
- **Medium**: 2

---

## Errors Found Table

| Agent/Skill                         | Issue                                       | Severity | Invalid Value     | Valid Replacement                           |
| ----------------------------------- | ------------------------------------------- | -------- | ----------------- | ------------------------------------------- |
| All agents in `opencode.json`       | Use invalid tool `"file": true`             | Critical | `"file": true`    | `"read": true, "write": true, "edit": true` |
| All agents in `opencode.json`       | Use invalid tool `"command": true`          | Critical | `"command": true` | `"bash": true`                              |
| All agents in `opencode.json`       | Use invalid tool `"lsp": true`              | Critical | `"lsp": true`     | Remove or use `"type-inject_*": true`       |
| `frontend-ui-ux.md`                 | References invalid `lsp` tool               | High     | `lsp`             | Remove, use `context7_*` for design docs    |
| `core-builder.md`                   | Doesn't follow AgentGenerator XML structure | High     | Free-text rules   | XML-optimized context→role→task→validation  |
| `opencode.json`                     | Missing `opencode-self-healer` agent        | High     | Not present       | Create new agent file                       |
| `opencode.json`                     | Missing `ui-ux-pattern-matcher` agent       | Medium   | Not present       | Create new agent file                       |
| `laravel-feature-scaffold/SKILL.md` | No Laravel version specified                | Medium   | "Laravel"         | "Laravel 13" (per AGENTS.md)                |
| `opencode.json`                     | Uses invalid `"list": true` tool            | Medium   | `"list": true`    | Remove (not in valid tools)                 |

---

## Invalid Tool Details

### Tools used in opencode.json but NOT in valid tools list:

1. `file` - Not a valid tool (use read/write/edit instead)
2. `command` - Valid name is `bash`
3. `lsp` - Not in valid tools list (use type-inject\_\* for LSP features)
4. `list` - Not in valid tools list

### Valid Tools List (from AgentGenerator):

```
bash, read, glob, grep, edit, write, task, webfetch, todowrite,
websearch, codesearch, skill, process-check_*, db-query_*, db-init_*,
skill_use, skill_find, skill_resource, skill_list, skill_info, skill_search,
trae_*, mcp_*, lmstudio_*, ide_*, type-inject_*,
filesystem_*, memory_*, context7_*, sequential-thinking_*,
export-strata, route-agent, auto-route
```

---

## Missing Agents

1. **opencode-self-healer** - Required for self-healing workflow
2. **ui-ux-pattern-matcher** - Required for UI consistency checks

---

## Next Steps

1. Review fix recommendations in `opencode-fixes.md`
2. Approve fixes via `/improve-opencode` command
3. Apply fixes and verify configuration
