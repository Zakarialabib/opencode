---
name: lsp-navigation
description: Use the language server for precise navigation, symbol lookup, refactoring, and diagnostics.
compatibility: opencode
metadata:
  audience: developers
  workflow: lsp
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
