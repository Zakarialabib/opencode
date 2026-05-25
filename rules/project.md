# Project Rules

## Language Server Rules

1. **Rust Files** (`*.rs`):
   - Use LSP diagnostics to check for compilation errors before and after edits
   - Verify imports and type information via TypeScript/Rust language servers
   - After changes, check for diagnostic errors

2. **TypeScript/JavaScript Files** (`*.ts`, `*.tsx`, `*.js`):
   - Use LSP for type checking and import validation
   - Verify type information before editing
   - Check for diagnostic errors after changes

3. **CSS/Tailwind Files** (`*.css`, `*.html`):
   - Prefer Tailwind utility classes over custom CSS
   - Validate Tailwind classes in class attribute suggestions

4. **YAML/JSON Files** (`*.yaml`, `*.yml`, `*.json`):
   - Validate schema before editing configs
   - Use JSON language server for opencode.json changes

## Project Stack

8. **Tauri + React + Laravel Stack**:
   - Tauri (Rust) for desktop backend
   - React (TypeScript) for frontend
   - Laravel (PHP) for web backend
   - Changes in Tauri backend may affect React frontend
   - Changes in Laravel may affect both frontend and backend

9. **Build & Deploy**:
   - Verify Rust toolchain before `cargo build`
   - Monitor build process memory usage
   - Use `brain_status` to check LM Studio availability before AI features

## Agent Coordination

10. **Delegation**:
    - Use `task` tool for parallel agent execution when independent
    - Pass brain plugin context (retrieved chunks, plan state) to sub-agents
    - Use `sequential-thinking` for trade-off analysis

11. **Memory MCP**:
    - Query memory MCP for project conventions at session start
    - Store discovered patterns for cross-session continuity
    - Fallback to brain_search if memory MCP is unavailable

## Retrieval Strategy

12. **Intent-Aware Search**:
    - `brain_search` auto-classifies intent (debug, refactor, feature, learn, test)
    - Reranker fires for learn, refactor, and feature intents (ONNX cross-encoder)
    - Memory-aware: chunks linked to known concepts get 15% score boost
    - Adaptive chunk count: high confidence → fewer chunks, low confidence → more

13. **Sparse Retrieval**:
    - Pseudo-SPLADE (IDF-weighted term scoring) available via `sparseSearch()`
    - Complements FTS5 keyword search with learned sparse relevance
    - Dense + keyword + sparse = true hybrid pipeline

---

**Last Updated**: 2026-05-17
**Applies To**: All agents working with brain plugin and OpenCode stack
