# Tauri (Rust) Stack Rules

## Context7 Documentation Sources
When working on Tauri backend, always pull docs from:
- **tauri** → `@tauri-apps/tauri` (v2)
- **tauri-cli** → `@tauri-apps/cli`
- **rust** → `rust-lang/rust`
- **serde** → `serde-rs/serde`
- **tokio** → `tokio-rs/tokio` (if async)
- **rusqlite** → `rusqlite/rusqlite` (if using SQLite)

Use Context7 MCP tool: `context7_resolve-library-id` then `context7_query-docs`

## Coding Standards

### Rust (Tauri Backend)
- Follow **Rust API Guidelines**: https://rust-lang.github.io/api-guidelines/
- Use `rustfmt` for formatting (config: `rustfmt.toml`)
- Use `clippy` for linting: `cargo clippy -- -D warnings`
- **Ownership**: Prefer borrowing over cloning; use `Arc<T>` for shared state
- **Error handling**: Use `thiserror` for library errors, `anyhow` for application errors
- **Async**: Use `tokio` with `#[tauri::command]` for async commands
- **State management**: Use `tauri::Manager::manage()` for app state

### Tauri-Specific
- Commands: Always use `#[tauri::command]` attribute
- State: Define struct with `tauri::State` for shared data
- IPC: Use `invoke()` from `@tauri-apps/api` in frontend
- Permissions: Define in `src-tauri/capabilities/` (Tauri v2)
- Window config: Use `tauri.conf.json` not programmatic creation

## Tools & Commands
| Tool | Command | Purpose |
|------|----------|---------|
| **rustfmt** | `cargo fmt` | Format Rust code |
| **clippy** | `cargo clippy` | Lint Rust code |
| **tauri-cli** | `cargo tauri dev` | Dev server |
| **tauri-cli** | `cargo tauri build` | Production build |
| **bindgen** | (auto) | FFI bindings if needed |

## Project Structure
```
src-tauri/
├── src/
│   ├── main.rs          # Entry point
│   ├── commands/        # Tauri commands
│   ├── state/           # App state structs
│   └── utils/          # Utility functions
├── Cargo.toml
└── tauri.conf.json
```

## Common Patterns
```rust
// Tauri command with state
#[tauri::command]
async fn my_command(state: tauri::State<'_, MyState>) -> Result<String, String> {
    Ok("done".to_string())
}

// Error handling
#[derive(Debug, thiserror::Error)]
enum AppError {
    #[error("Database error: {0}")]
    Database(#[from] rusqlite::Error),
}
```

## When to Use This Stack
- Building desktop app backend logic
- Need system-level access (files, hardware)
- Performance-critical operations
- SQLite/local database operations
