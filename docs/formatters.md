# Formatter Configuration Guide

This document explains the formatter configuration for this OpenCode project.

## Overview

Formatters automatically run after file writes to maintain consistent code style. This project uses multiple formatters for different file types.

## Configured Formatters

### Biome (JavaScript/TypeScript)

**Files**: `.js`, `.jsx`, `.ts`, `.tsx`, `.json`, `.jsonc`

**Command**: `npx biome format --write $FILE`

**Features**:
- Fast formatting (written in Rust)
- Linting capabilities
- Import sorting
- JSON/JSONC support

**Configuration** (`biome.json`):
```json
{
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 100
  },
  "javascript": {
    "formatter": {
      "quoteStyle": "double",
      "semicolons": "always",
      "trailingCommas": "es5"
    }
  }
}
```

**Install**:
```bash
npm install --save-dev @biomejs/biome
npx biome init
```

---

### Prettier (CSS/HTML/Markdown/YAML)

**Files**: `.css`, `.scss`, `.html`, `.md`, `.yaml`, `.yml`

**Command**: `npx prettier --write $FILE`

**Features**:
- Extensive language support
- Plugin ecosystem
- Editor integration
- Opinionated defaults

**Configuration** (`.prettierrc`):
```json
{
  "printWidth": 100,
  "tabWidth": 2,
  "useTabs": false,
  "semi": true,
  "singleQuote": false,
  "trailingComma": "es5",
  "bracketSpacing": true,
  "arrowParens": "always",
  "proseWrap": "preserve",
  "htmlWhitespaceSensitivity": "css"
}
```

**Install**:
```bash
npm install --save-dev prettier
```

**Plugins**:
```bash
# For Tailwind CSS
npm install --save-dev prettier-plugin-tailwindcss

# For sorting imports
npm install --save-dev @trivago/prettier-plugin-sort-imports
```

---

### Black (Python)

**Files**: `.py`

**Command**: `black $FILE`

**Features**:
- Opinionated formatting
- Deterministic output
- PEP 8 compliant
- Type comment support

**Configuration** (`pyproject.toml`):
```toml
[tool.black]
line-length = 100
target-version = ['py38', 'py39', 'py310', 'py311', 'py312']
include = '\.pyi?$'
exclude = '''
/(
    \.git
  | \.venv
  | build
  | dist
  | __pycache__
)/
'''
```

**Install**:
```bash
pip install black
```

---

### gofmt (Go)

**Files**: `.go`

**Command**: `gofmt -w $FILE`

**Features**:
- Standard Go formatting
- No configuration needed
- Built into Go toolchain

**Usage**:
```bash
# Format a single file
gofmt -w file.go

# Format all Go files
gofmt -w .
```

---

### rustfmt (Rust)

**Files**: `.rs`

**Command**: `rustfmt $FILE`

**Features**:
- Official Rust formatter
- Configurable style
- Supports stable Rust

**Configuration** (`rustfmt.toml`):
```toml
max_width = 100
tab_spaces = 4
edition = "2021"
use_small_heuristics = "Default"
```

**Install**:
```bash
rustup component add rustfmt
```

---

## How Formatters Work in OpenCode

1. **After File Write**: When OpenCode writes to a file, it checks if a formatter is configured for that file extension.

2. **Formatter Execution**: The formatter command runs with `$FILE` replaced by the actual file path.

3. **Error Handling**: If formatting fails, OpenCode logs the error but doesn't revert the file changes.

## Adding Custom Formatters

Add a new formatter to `opencode.json`:

```json
{
  "formatter": {
    "my-formatter": {
      "command": ["my-formatter", "--fix", "$FILE"],
      "extensions": [".custom", ".myext"]
    }
  }
}
```

## Formatter Priority

When multiple formatters match the same extension, they run in the order defined in the configuration.

## Disabling Formatters

To disable a formatter temporarily:

```json
{
  "formatter": {
    "prettier": {
      "command": ["npx", "prettier", "--write", "$FILE"],
      "extensions": [],
      "disabled": true
    }
  }
}
```

## Editor Integration

### VS Code

Install extensions for real-time formatting:

```json
{
  "recommendations": [
    "biomejs.biome",
    "esbenp.prettier-vscode",
    "ms-python.black-formatter",
    "golang.go",
    "rust-lang.rust-analyzer"
  ]
}
```

### Settings

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "biomejs.biome",
  "[javascript]": {
    "editor.defaultFormatter": "biomejs.biome"
  },
  "[typescript]": {
    "editor.defaultFormatter": "biomejs.biome"
  },
  "[python]": {
    "editor.defaultFormatter": "ms-python.black-formatter"
  },
  "[go]": {
    "editor.defaultFormatter": "golang.go"
  },
  "[rust]": {
    "editor.defaultFormatter": "rust-lang.rust-analyzer"
  }
}
```

## Best Practices

1. **Consistency**: Use the same formatters across the team
2. **Configuration**: Commit formatter configs to version control
3. **Pre-commit Hooks**: Use husky to run formatters before commits
4. **CI/CD**: Verify formatting in CI pipelines

## Pre-commit Setup

Using husky and lint-staged:

```bash
npm install --save-dev husky lint-staged
npx husky init
```

`.husky/pre-commit`:
```bash
npx lint-staged
```

`package.json`:
```json
{
  "lint-staged": {
    "*.{js,jsx,ts,tsx,json,jsonc}": ["biome format --write"],
    "*.{css,scss,html,md,yaml,yml}": ["prettier --write"],
    "*.py": ["black"],
    "*.go": ["gofmt -w"],
    "*.rs": ["rustfmt"]
  }
}
```

## Troubleshooting

### Formatter Not Found

```bash
# Install the formatter
npm install --save-dev @biomejs/biome

# Or run directly
npx @biomejs/biome format --write .
```

### File Not Formatting

1. Check if the extension is in the formatter's `extensions` array
2. Verify the formatter is installed
3. Run the formatter command manually to check for errors

### Conflicting Formatters

If multiple formatters compete for the same file, specify which to use:

```json
{
  "formatter": {
    "biome": {
      "extensions": [".ts", ".tsx"]
    },
    "prettier": {
      "extensions": [".css", ".md"]
    }
  }
}
```
