---
name: lsp-navigation
displayName: LSP Navigation
description: Use the language server for precise navigation, symbol lookup, refactoring, and diagnostics.
version: 1.0.0
category: foundation
tags:
  - lsp
  - symbols
  - diagnostics
  - refactor
agents:
  - software-architect
  - core-factory
  - qa-guardian
  - backend-laravel
  - frontend-ui-ux
---

# LSP Navigation

Use this skill when you need code-aware navigation instead of plain text search.

## Core Rules

- Prefer go-to-definition, references, and diagnostics over guesswork.
- Check types and symbols before making structural edits.
- Verify refactors against the actual language server output.
- Treat diagnostics as part of the implementation loop, not a separate phase.

## Outputs

- Symbol map
- Refactor targets
- Diagnostic summary
