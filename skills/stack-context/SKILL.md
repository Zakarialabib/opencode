# Stack Context Engine

Auto-detects Tauri/React/Laravel stack context and pulls relevant documentation, coding standards, and tool recommendations using Context7. Use proactively when starting work on any stack file or when context switching between Rust/TypeScript/PHP.

## Purpose

Automatically detect the current stack (Tauri/Rust, React/TypeScript, Laravel/PHP) and provide:

1. **Relevant Context7 documentation** for the libraries in use
2. **Coding standards** from the appropriate rules file
3. **Tool recommendations** (formatters, linters, test frameworks)
4. **Common patterns** for the detected stack
5. **Orchestration** — coordinate cross-stack tasks and validate context availability

## Auto-Detection Logic

| File Pattern                              | Stack Detected         | Rules File         | Context7 Libraries                   |
| ----------------------------------------- | ---------------------- | ------------------ | ------------------------------------ |
| `*.rs`, `Cargo.toml`, `tauri.conf.json`   | **Tauri (Rust)**       | `rules/tauri.md`   | tauri, rust, serde, tokio            |
| `*.tsx`, `*.jsx`, `*.ts`, `vite.config.*` | **React (TypeScript)** | `rules/react.md`   | react, typescript, tailwindcss, vite |
| `*.php`, `artisan`, `composer.json`       | **Laravel (PHP)**      | `rules/laravel.md` | laravel, php, eloquent, pest         |

## Orchestration Workflow

Before starting work on any cross-stack task, verify required context:

1. **Check MCP server health** — ensure relevant servers (context7, memory, filesystem) are responding
2. **Check language server status** — rust-analyzer, TypeScript, PHP
3. **Identify all stacks involved** — use detection logic above
4. **Load rules for each stack**
5. **Pull Context7 docs for each** — use context7 MCP tools
6. **Provide unified context** — clear stack separation

### Example: Cross-stack Task

"Working on Tauri command that calls Laravel API"

- Load both `rules/tauri.md` and `rules/laravel.md`
- Pull Tauri IPC docs + Laravel API docs
- Validate both language servers are active
- Check MCP servers (context7, memory) are responding

## Context Validation

Before executing, verify:

| Service          | How to Check                            | Fallback                          |
| ---------------- | --------------------------------------- | --------------------------------- |
| MCP servers      | Check opencode.json mcp servers section | Use OpenCode defaults             |
| Language servers | LSP status tool                         | Open file of that type to trigger |
| File patterns    | `glob` to detect stack files            | Ask user for stack context        |
| Process health   | Check dev servers, background tasks     | Alert user, suggest restart       |

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

### Context Status
- MCP servers: [✅/❌]
- Language servers: [✅/❌]
- Processes: [✅/❌]
```

## Framework-Specific Guidance

### React/TypeScript (from fullstack-dev)

- Use existing shadcn/ui components instead of building from scratch
- `'use client'` and `'use server'` for client/server code
- Consistent card alignment: `p-4` or `p-6`, `gap-4` or `gap-6`
- Long list handling: `max-h-96 overflow-y-auto`
- Mobile-first responsive design with Tailwind breakpoints
- Minimum 44px touch targets for interactive elements
- Sticky footer: `min-h-screen flex flex-col` + `mt-auto` on footer
- Semantic HTML with ARIA support
- Loading states with spinners/skeletons during async operations
- Toast notifications for user action feedback
- Light/dark mode with `next-themes`

### Tauri/Rust

- Use `tauri::State` for shared resources, wrap with `Mutex` or `RwLock`
- Return `Result<T, String>` for commands
- Emit events with `app_handle.emit_all`, listen via `listen('event-name', ...)` in React
- Avoid blocking main thread; use async commands
- Refer to Tauri v2 documentation, not v1
- Audit `Cargo.toml` for unused dependencies

### Laravel/PHP

- Follow Laravel conventions: PascalCase models, snake_case tables
- Use laravel-feature-scaffold skill for new features
- Use pest-testing skill for tests
- Run `php artisan pint` after edits
- Import audit: check for unused imports after every file change

## When to Use

- **Proactively**: When user mentions a stack-specific task
- **On file open**: When reading `.rs`, `.tsx`, `.php` files
- **Before implementation**: To ensure standards compliance
- **During review**: To validate against stack conventions
- **Context switching**: When moving between frontend/backend/native
