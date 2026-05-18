# Auto-Formatting Rules

## Language-Based Formatter Selection

When a file is saved or explicitly formatted, auto-detect the language and apply the correct formatter:

| File Extension    | Language   | Formatter    | Command                          | Config File      |
| ----------------- | ---------- | ------------ | -------------------------------- | ---------------- |
| `.rs`             | Rust       | **rustfmt**  | `cargo fmt`                      | `rustfmt.toml`   |
| `.ts`, `.tsx`     | TypeScript | **biome**    | `npx biome format --write $FILE` | `biome.json`     |
| `.js`, `.jsx`     | JavaScript | **biome**    | `npx biome format --write $FILE` | `biome.json`     |
| `.json`, `.jsonc` | JSON       | **biome**    | `npx biome format --write $FILE` | `biome.json`     |
| `.css`, `.scss`   | Styles     | **prettier** | `npx prettier --write $FILE`     | `.prettierrc`    |
| `.html`           | HTML       | **prettier** | `npx prettier --write $FILE`     | `.prettierrc`    |
| `.md`             | Markdown   | **prettier** | `npx prettier --write $FILE`     | `.prettierrc`    |
| `.yaml`, `.yml`   | YAML       | **prettier** | `npx prettier --write $FILE`     | `.prettierrc`    |
| `.php`            | PHP        | **pint**     | `./vendor/bin/pint $FILE`        | `pint.json`      |
| `.py`             | Python     | **black**    | `black $FILE`                    | `pyproject.toml` |

## Auto-Format on Save

When `formatter.<tool>.disabled` is `false` in `opencode.json`:

1. Detect file extension
2. Match to formatter in config
3. Run formatter command
4. Log result to formatter.log

## Formatter Priority

1. **Project config** (biome.json, .prettierrc, pint.json) overrides defaults
2. **opencode.json formatter config** is secondary
3. **LSP formatting** (if available) is preferred for on-save

## Integration with LSP

Before formatting, check if LSP can format:

- **rust-analyzer**: `textDocument/formatting`
- **TypeScript**: `textDocument/formatting`
- **PHP**: `textDocument/formatting`

If LSP available, use it. Fall back to CLI formatter.

## Self-Reflection Integration

The `self-reflection` skill monitors:

1. New files → auto-format on first save
2. Language detection → suggest formatter config
3. Missing formatters → suggest installation
4. Competitor features → adapt formatting patterns from OpenClaude/ClaudeCode

## Example: Format Detection

```bash
# File: src/main.rs
# Detected: Rust
# Formatter: rustfmt
# Command: cargo fmt -- src/main.rs

# File: src/App.tsx
# Detected: TypeScript/React
# Formatter: biome
# Command: npx biome format --write src/App.tsx

# File: app/Http/Controllers/UserController.php
# Detected: PHP/Laravel
# Formatter: pint
# Command: ./vendor/bin/pint app/Http/Controllers/UserController.php
```

## When to Use

- **On file save**: If configured in opencode.json
- **On explicit request**: User asks "format this file"
- **During self-improvement**: Auto-format new files
- **During code review**: Check formatting compliance
