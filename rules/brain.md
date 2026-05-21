# Brain Plugin Usage

## When to use Brain tools
- Check `brain_diagnostic or brain_model_status` or `brain_diagnostic` when context quality matters — before non-trivial analysis, debugging, refactors, features, and docs audits
- Run `brain_index_project` when the index is empty, stale, or missing expected results
- Use `brain_search` or `brain_embed_test` for semantic codebase discovery before making decisions or edits
- After broad edits or generated files, confirm Brain can see new context with `brain_diagnostic or brain_model_status` or a targeted `brain_search`

## Workflow
1. **Health check** → `brain_diagnostic or brain_model_status` or `brain_diagnostic`
2. **Index if needed** → `brain_index_project`
3. **Search** → `brain_search` or `brain_embed_test`
4. **Read results** → Read top matching files directly
5. **Verify** → Confirm new context is indexed after edits
