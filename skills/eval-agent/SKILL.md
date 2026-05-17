# Eval Agent - Capability & Regression Evaluation Skill

Use this skill when you need to evaluate OpenCode's performance on specific tasks using the Instrument → Trace → Eval → Annotate → Analyse loop.

## When to Use

- You want to measure OpenCode's context efficiency (does it read relevant files?)
- You want to measure token economy (is output concise?)
- You want to measure tool optimization (right tools, minimal calls?)
- You want to detect regressions before deploying changes
- You want actionable improvements based on evidence

## Eval Types

### Capability Eval (Green Path)
- **Goal**: Pass at 100%
- **Behavior**: Loop until thresholds met or max iterations reached
- **Use when**: Testing new capabilities, improving existing behavior

### Regression Eval (Red Path)
- **Goal**: Must always pass (100%)
- **Behavior**: STOP immediately on any failure
- **Use when**: Guarding existing capabilities, pre-deployment check

## Tools

### eval_start
Start a new eval trace session.

```
eval_start(
  task_id="my-eval-001",
  category="context_window",
  type="capability",  # or "regression"
  description="Find all API routes in monorepo",
  context_budget=50000,
  thresholds={
    "context_efficiency": 0.75,
    "token_economy": 0.80,
  }
)
```

### eval_log
Log events during execution for analysis.

```
eval_log(event_type="file_read", data={
  "path": "src/api/users.ts",
  "size": 4500,
  "relevant": true
})

eval_log(event_type="tool_call", data={
  "name": "glob",
  "params": {"pattern": "**/*.ts"},
  "success": true
})

eval_log(event_type="error", data={
  "type": "file_not_found",
  "message": "config.json not found",
  "recovered": true
})

eval_log(event_type="self_correction", data={})
```

### eval_end
End session and get evaluation results.

```
eval_end(
  final_turn={
    "input_tokens": 25000,
    "output_tokens": 1200,
    "files_accessed": 15,
    "errors": 1
  },
  output_path="evals/results/my-eval-001.json"
)
```

Returns:
```json
{
  "session_id": "eval-my-eval-001-...",
  "scores": {
    "context_efficiency": 0.73,
    "token_economy": 0.92,
    "tool_optimization": 0.85,
    "error_resilience": 1.0,
    "skill_alignment": 1.0,
    "overall": 0.86
  },
  "label": "PARTIAL_EFFICIENCY",
  "passed": false,
  "annotations": [
    {
      "type": "inefficiency",
      "severity": "warning",
      "observation": "Read 15 files but only 11 were relevant (4 wasted)",
      "impact": {"tokens_wasted": 20000, "context_lost_pct": 27},
      "actionable": {
        "category": "context",
        "suggestion": "Use path-based filtering: prefer 'src/api/*.ts' over '**/*.ts'"
      }
    }
  ],
  "insights": {
    "what_happened": ["Read 15 files but only 11 were relevant"],
    "why_it_matters": [{"tokens_wasted": 20000}],
    "how_to_fix": ["Use path-based filtering"],
    "rules_to_update": []
  }
}
```

### eval_run
Run the full loop automatically (start → execute → trace → eval → annotate → analyze → iterate).

```
eval_run(
  task={
    "id": "cap-ctx-001",
    "category": "context_window",
    "type": "capability",
    "description": "Find all API routes efficiently",
    "context_budget": 50000,
    "thresholds": {"context_efficiency": 0.80}
  },
  max_iterations=5
)
```

### eval_status
Check current session state.

```
eval_status()
```

## Score Labels

| Score | Label | Meaning |
|-------|-------|---------|
| 1.0 | `PERFECT_EFFICIENCY` | Optimal - textbook example |
| 0.9-0.99 | `EXCELLENT` | Minor optimization possible |
| 0.8-0.89 | `GOOD` | Solid performance |
| 0.7-0.79 | `PARTIAL_EFFICIENCY` | Noticeable waste, actionable fix |
| 0.5-0.69 | `NEEDS_WORK` | Significant improvement needed |
| 0.0-0.49 | `POOR` | Critical issues |

## Annotation Types

| Type | When | Actionable? |
|------|------|-------------|
| `inefficiency` | Wasted context/tools | Yes - add guidance |
| `redundancy` | Repeated work | Yes - add caching |
| `excellence` | Good pattern | Keep as is |
| `missing_context` | Should have loaded more | Yes - add context hints |
| `over_context` | Loaded too much | Yes - add budget awareness |
| `tool_mismatch` | Wrong tool | Yes - add routing guidance |
| `recovery_gap` | Error not handled | Yes - add error guidance |

## Workflow Examples

### Example 1: Context Efficiency Eval

```
# Start eval
eval_start(
  task_id="ctx-eff-test",
  category="context_window",
  type="capability",
  description="Analyze how efficiently OpenCode uses context when exploring codebase"
)

# ... execute task with file reads ...

# End and evaluate
eval_end(output_path="evals/results/ctx-eff-test.json")
```

### Example 2: Regression Check Before Deploy

```
# Start regression eval
eval_start(
  task_id="reg-skill-trigger",
  category="skill_triggering",
  type="regression",
  description="Verify skills still trigger correctly after config changes",
  thresholds={"skill_alignment": 1.0}  # Must be 100%
)

# ... execute with skill invocations ...

eval_end()

# If passed: safe to deploy
# If failed: STOP, fix before deploying
```

### Example 3: Full Iteration Loop

```
# Run until 100% or max 5 iterations
eval_run(
  task={
    "id": "token-economy",
    "category": "token_efficiency",
    "type": "capability",
    "description": "Test output conciseness",
    "thresholds": {"token_economy": 0.90}
  },
  max_iterations=5
)
```

## Integration with OpenCode

The eval plugin automatically:
- Intercepts tool calls during eval sessions
- Tracks file reads and context usage
- Captures errors and self-corrections
- Generates actionable annotations

## Creating Evals

Place eval definitions in:
- `evals/capability/` - For capability testing (iterate to 100%)
- `evals/regression/` - For regression guards (must always pass)

```json
{
  "id": "cap-001",
  "category": "context_window",
  "type": "capability",
  "description": "Task description",
  "context_budget": 50000,
  "thresholds": {
    "context_efficiency": 0.75,
    "token_economy": 0.80
  }
}
```

## Best Practices

1. **Regression first**: Run regression evals before capability improvements
2. **Specific thresholds**: Don't just say "pass" - specify what "pass" means
3. **Annotate everything**: The explanation makes evals actionable
4. **Iterate with evidence**: Each annotation is a potential improvement
5. **Track trends**: Store results to see improvement over time