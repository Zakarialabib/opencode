name: self-improver
displayName: Self-Improver Engine
description: >
  Continuously improves the project by checking docs (web, Context7,
  opencode), using LSPs for code context, monitoring skills/plugins/scripts,
  and adapting best practices from OpenClaude, QwenCode, ClaudeCode.
  Auto-formats based on language detection.
category: meta
tags: [self-improvement, meta, learning, adaptation, opencode, claudecode, qwencode]
agents: [core-builder, lead-orchestrator, docs-evolver]
entryPoint: SKILL.md
---

# Self-Improver Engine

## Purpose
Autonomously improve the project by:
1. **Learning** from opencode docs, Context7, web docs
2. **Analyzing** code via LSPs (rust-analyzer, TS server, PHP)
3. **Monitoring** skills repos, plugins, scripts for updates
4. **Adapting** features from OpenClaude, QwenCode, ClaudeCode
5. **Auto-formatting** based on detected language

## Workflow

### Phase 1: Environment Scan
```
1. Detect project stack (Tauri/Rust, React/TS, Laravel/PHP)
2. Load relevant LSP contexts (rust-analyzer, TS server, PHP)
3. Check opencode.json for current config
4. Scan skills/ and plugins/ directories
```

### Phase 2: Knowledge Gathering
```
1. Pull opencode docs via Context7:
   - context7_resolve-library-id: "opencode"
   - context7_query-docs: "configuration", "skills", "agents"

2. Check competitor features:
   - OpenClaude: Check https://github.com/opencode-ai/opencode
   - ClaudeCode: Check https://docs.anthropic.com/claude-code
   - QwenCode: Check https://github.com/QwenLM/Qwen

3. Scan for updates:
   - skills/ directory (new skills added?)
   - plugins/ directory (new plugins?)
   - package.json (dependency updates?)
```

### Phase 3: Analysis via LSP
```
1. Rust files → rust-analyzer context
   - Check: trae_get_rust_context(filePath)
   - Analyze: diagnostics, suggestions, unused imports

2. TypeScript files → TS language server
   - Check: trae_get_typescript_context(filePath)
   - Analyze: errors, warnings, type coverage

3. PHP files → PHP language server (Intelephense)
   - Check: trae_get_php_context(filePath)
   - Analyze: PSR-12 compliance, type hints, Laravel 13+ patterns
```

### Phase 4: GLM Skill Audit
```
1. Scan glm-skills/ directory
2. Read glm-skills/glm-skills.json registry
3. Verify that all scripts use 'opencode' CLI instead of 'clawdhub'
4. Suggest adaptations for new GLM skills added by user
```

### Phase 5: Auto-Format by Language
```
Detect file extension → Apply formatter:

| Extension | Formatter | Command |
|-----------|-----------|---------|
| .rs | rustfmt | cargo fmt |
| .ts, .tsx, .js, .jsx | biome | npx biome format --write $FILE |
| .php | pint | ./vendor/bin/pint $FILE |
| .py | black | black $FILE |
| .md, .yaml, .yml | prettier | npx prettier --write $FILE |
```

### Phase 5: Adaptation & Improvement
```
1. Compare current config with best practices:
   - OpenClaude: Check .opencode/ config patterns
   - ClaudeCode: Check Claude.md patterns
   - QwenCode: Check qwen.config patterns

2. Suggest improvements:
   - Missing MCP servers?
   - Unused skills that could help?
   - Performance optimizations?
   - Security hardening?

3. Apply safe improvements automatically:
   - Format files on save
   - Update dependencies (with permission)
   - Add missing config fields
```

## Integration Points

### With LSP Tools
```typescript
// Get LSP context before editing
const rustContext = await trae_get_rust_context("src/main.rs");
const tsContext = await trae_get_typescript_context("src/App.tsx");
```

### With Context7
```
1. context7_resolve-library-id → "opencode"
2. context7_query-docs → "self-improvement patterns"
3. Apply learned patterns to project
```

### With Filesystem Monitoring
```
Monitor these paths for changes:
- skills/ → new skills available
- plugins/ → new plugins available
- opencode.json → config changes
- rules/ → new rules added
```

## Output Format

When invoked, provide:

```
## Self-Improver Report

### Environment
- Stack: [Tauri + React + Laravel]
- LSPs: [rust-analyzer ✅, TS server ✅, PHP ❌]
- OpenCode version: [from config]

### Knowledge Gathered
- OpenCode docs: [key learnings]
- Competitor features: [OpenClaude: X, ClaudeCode: Y, QwenCode: Z]

### Analysis Results
- Rust files: [diagnostics count]
- TS files: [error count]
- PHP files: [PSR-12 compliance]

### Improvements Applied
- [Auto-formatted X files]
- [Added Y to config]
- [Updated Z dependency]

### Recommendations
- [Suggestion 1]
- [Suggestion 2]
```

## When to Use
- **Proactively**: On file save (if configured)
- **Scheduled**: Daily/weekly improvement runs
- **On request**: User asks "improve the project"
- **Context switch**: When moving between stacks

## Safety Guards
1. **Never auto-commit** without permission
2. **Never delete** files automatically
3. **Always ask** before major config changes
4. **Log all actions** to improvement.log
5. **Rollback capability** via git

## Example: Learning from OpenClaude
```
1. Fetch OpenClaude repo structure via GitHub MCP
2. Compare with current opencode.json
3. Identify missing features:
   - OpenClaude has: "auto-test-on-save"
   - Current: missing
4. Suggest: Add "test-on-save" to config
5. Implement if approved
```
