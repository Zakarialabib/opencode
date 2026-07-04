---
name: self-improver
displayName: Self-Improver Engine
description: >
  Continuously improves the project by checking docs (web, Context7,
  opencode), using LSPs for code context, monitoring skills/plugins/scripts,
  and adapting best practices.
category: meta
tags: [self-improvement, meta, learning, adaptation, opencode]
agents: [core-factory, lead-strategist]
license: MIT
compatibility: opencode
---

# Self-Improver Engine

Continuously improves the project by checking docs (web, Context7, opencode), using LSPs for code context, monitoring skills/plugins/scripts, and adapting best practices from OpenClaude, QwenCode, ClaudeCode. Auto-formats based on language detection.

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
1. Rust files → cargo check
   - Run: cargo check --message-format=short
   - Analyze: compilation errors, warnings, unused imports

2. TypeScript files → tsc --noEmit
   - Run: npx tsc --noEmit [file]
   - Analyze: type errors, import resolution, unused variables

3. PHP files → php -l (lint) + PHP Language Server
   - Run: php -l [file]
   - Analyze: syntax errors, PSR-12 compliance, Laravel conventions
```

### Phase 4: OpenCode Skill Audit

```
1. Scan skills/ directory for new/updated SKILL.md files
2. Read skills/index.json registry for consistency
3. Verify all skill paths resolve to actual files on disk
4. Suggest adaptations for new or modified skills
```

### Phase 5: Auto-Format by Language

```
Detect file extension → Apply formatter (per rules/auto-format.md):

| Extension | Formatter | Command |
|-----------|-----------|---------|
| .rs | rustfmt | cargo fmt |
| .ts, .tsx, .js, .jsx | biome | npx biome format --write $FILE |
| .json, .jsonc | biome | npx biome format --write $FILE |
| .php | pint | php artisan pint $FILE |
| .css, .scss, .html, .md, .yaml, .yml | prettier | npx prettier --write $FILE |
```

### Phase 6: Adaptation & Improvement

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
// Get LSP diagnostics before editing (ambient — auto-fires after edit/write)
// Use type-inject for type lookups:
const typeInfo = await type_inject_lookup_type("MyComponent");

// Use bash for LSP checks:
// cargo check --message-format=short  (Rust)
// npx tsc --noEmit                    (TypeScript)
// php -l                              (PHP)
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

## Example: Improvement Cycle

```
1. Run project detection to understand current stack:
   project_detect → project_status

2. Check for doc-code drift:
   sync_docs → review findings

3. Review session memory for recurring patterns:
   memory_stats → memory_recall { query: "known issues" }

4. Identify gaps:
   - Missing auto-format config for certain file types?
   - Stale agent prompts in opencode.json?
   - Dead skill references in index.json?

5. Apply safe improvements (ask before major changes)
```
