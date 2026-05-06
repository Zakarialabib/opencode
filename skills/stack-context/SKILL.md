---
name: stack-context
displayName: Stack Context Engine
description: >
  Auto-detects Tauri/React/Laravel stack context and pulls relevant
  documentation, coding standards, and tool recommendations using Context7.
  Use proactively when starting work on any stack file or when
  context switching between Rust/TypeScript/PHP.
category: context-engineering
tags: [context, documentation, standards, tauri, react, laravel, context7]
agents: [build, plan, debug, code-reviewer, laravel-expert, tauri-expert, project-orchestrator]
entryPoint: SKILL.md
---

# Stack Context Engine

## Purpose

Automatically detect the current stack (Tauri/Rust, React/TypeScript, Laravel/PHP) and provide:

1. **Relevant Context7 documentation** for the libraries in use
2. **Coding standards** from the appropriate rules file
3. **Tool recommendations** (formatters, linters, test frameworks)
4. **Common patterns** for the detected stack

## Auto-Detection Logic

| File Pattern                              | Stack Detected         | Rules File         | Context7 Libraries                   |
| ----------------------------------------- | ---------------------- | ------------------ | ------------------------------------ |
| `*.rs`, `Cargo.toml`, `tauri.conf.json`   | **Tauri (Rust)**       | `rules/tauri.md`   | tauri, rust, serde, tokio            |
| `*.tsx`, `*.jsx`, `*.ts`, `vite.config.*` | **React (TypeScript)** | `rules/react.md`   | react, typescript, tailwindcss, vite |
| `*.php`, `artisan`, `composer.json`       | **Laravel (PHP)**      | `rules/laravel.md` | laravel, php, eloquent, pest         |

## Usage

### Step 1: Detect Stack

```bash
# For current file or task, check patterns above
# If multiple stacks present, prioritize by task context
```

### Step 2: Load Rules

Read the appropriate rules file:

- Tauri → `rules/tauri.md`
- React → `rules/react.md`
- Laravel → `rules/laravel.md`

### Step 3: Pull Context7 Docs

Use Context7 MCP tools to get latest documentation:

**For Tauri:**

```
1. context7_resolve-library-id → query: "Tauri v2"
2. context7_query-docs → libraryId: "/tauri-apps/tauri", query: "[specific task]"
```

**For React:**

```
1. context7_resolve-library-id → query: "React hooks"
2. context7_query-docs → libraryId: "/facebook/react", query: "[specific task]"
```

**For Laravel:**

```
1. context7_resolve-library-id → query: "Laravel 11 Eloquent"
2. context7_query-docs → libraryId: "/laravel/laravel", query: "[specific task]"
```

### Step 4: Apply Standards

- Load coding standards from rules file
- Check if project uses recommended tools (biome, clippy, pint)
- Suggest improvements if standards not met

## Context Switching

When switching between stacks in the same task:

1. Identify all stacks involved
2. Load rules for each stack
3. Pull Context7 docs for each
4. Provide unified context with clear stack separation

Example: "Working on Tauri command that calls Laravel API"
→ Load both `rules/tauri.md` and `rules/laravel.md`
→ Pull Tauri IPC docs + Laravel API docs

## Output Format

When invoked, provide:

```
## Stack Detected: [Tauri/React/Laravel]

### Coding Standards
- [Key standards from rules file]

### Context7 Documentation
- [Library]: [Key patterns/docs retrieved]

### Recommended Tools
- [Formatter]: [command]
- [Linter]: [command]
- [Tests]: [framework]

### Common Patterns
[Relevant code examples for the task]
```

## When to Use

- **Proactively**: When user mentions a stack-specific task
- **On file open**: When reading `.rs`, `.tsx`, `.php` files
- **Before implementation**: To ensure standards compliance
- **During review**: To validate against stack conventions
- **Context switching**: When moving between frontend/backend/native

## Integration with Other Skills

- Works with `testing-strategy` to suggest stack-specific tests
- Feeds into `code-reviewer` for standards compliance
- Supports `laravel-expert` and `tauri-expert` agents
- Enhances `project-orchestrator` with multi-stack context
