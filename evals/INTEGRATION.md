# OpenCode Eval Plugin - Integration Guide

## What's Been Created

### 1. Plugin: `plugins/eval-plugin.ts`
TypeScript plugin that integrates with OpenCode's plugin system.

**Tools provided:**
- `eval_start` - Start evaluation trace session
- `eval_log` - Log tool calls, file reads, errors during execution
- `eval_end` - End session, evaluate, get annotations
- `eval_run` - Full loop: execute → trace → eval → annotate → analyze → iterate
- `eval_status` - Check current session
- `eval_list` - List available evals

### 2. Skill: `skills/eval-agent/SKILL.md`
User-facing documentation for the eval agent.

### 3. Framework (Python reference): `evals/`
Python implementation with:
- `framework/types.py` - Type definitions
- `framework/scorer.py` - Scoring algorithms
- `framework/annotator.py` - Annotation generator
- `framework/analyzer.py` - Root cause analysis

---

## Quick Start

### 1. Register the Plugin

Add to `opencode.json`:

```json
{
  "plugin": [
    "plugins/eval-plugin.ts",
    ...
  ]
}
```

### 2. Run Your First Eval

```
Using eval-agent:

Run a context efficiency eval on finding API routes:

1. Start: eval_start(task_id="api-routes", category="context_window", type="capability", description="Find all API route handlers")

2. Execute the task (files will be auto-tracked)

3. End: eval_end(output_path="evals/results/api-routes.json")
```

---

## The Loop: Instrument → Trace → Eval → Annotate → Analyse

```
┌────────────────────────────────────────────────────────────────────┐
│                         EVALUATION LOOP                             │
│                                                                     │
│   INSTRUMENT:  eval_start() - setup context budget, thresholds    │
│       ↓                                                          │
│   TRACE:       eval_log() - capture tool calls, file reads,       │
│                      errors, skill triggers (auto via hooks)        │
│       ↓                                                          │
│   EVAL:         eval_end() - score context_efficiency,            │
│                      token_economy, tool_optimization, etc.        │
│       ↓                                                          │
│   ANNOTATE:     auto-generated explanations for each finding      │
│       ↓                                                          │
│   ANALYSE:      root cause + actionable recommendations           │
│       ↓                                                          │
│   ──────────────────────────────────────────────────────────────   │
│   │ Capability: If < 100% → loop back with improvements          │ │
│   │ Regression: If < 100% → STOP immediately, fix first          │ │
│   ──────────────────────────────────────────────────────────────   │
└────────────────────────────────────────────────────────────────────┘
```

---

## Example Usage

### Capability Eval (Green Path - Iterate to 100%)

```javascript
// Start capability eval
eval_start(
  task_id="token-economy",
  category="token_efficiency",
  type="capability",
  description="Test output conciseness on code explanations",
  context_budget=20000,
  thresholds={
    "token_economy": 0.90,
    "context_efficiency": 0.70
  }
)

// ... execute task ...

eval_end(final_turn={
  input_tokens: 15000,
  output_tokens: 1800,  // Should be < 1000 for better score
  files_accessed: 8,
  errors: 0
})

// Result:
// If passed: {"status": "passed", "scores": {...}}
// If failed: {"status": "iterate", "annotations": [...], "insights": {...}}
```

### Regression Eval (Red Path - Must Pass)

```javascript
// Start regression eval- MUST be 100%
eval_start(
  task_id="reg-skill-trigger",
  category="skill_triggering",
  type="regression",
  description="Verify skills still trigger after changes",
  thresholds={
    "skill_alignment": 1.0,  // Non-negotiable
    "tool_optimization": 1.0
  }
)

// ... execute with skill usage ...

eval_end()

// Result:
// If passed: {"status": "passed"} - Safe to deploy
// If failed: {"status": "regression_detected"} - STOP, fix immediately!
```

---

## Score Labels (Human-Readable)

| Score | Label | Meaning |
|-------|-------|---------|
| 1.0 | PERFECT_EFFICIENCY | Optimal |
| 0.9-0.99 | EXCELLENT | Minor tweaks |
| 0.8-0.89 | GOOD | Solid |
| 0.7-0.79 | PARTIAL_EFFICIENCY | Actionable fix |
| 0.5-0.69 | NEEDS_WORK | Significant |
| <0.5 | POOR | Critical |

---

## Annotations Make Evals Actionable

Every failing eval produces annotations:

```json
{
  "type": "inefficiency",
  "severity": "warning",
  "observation": "Read 25 files but only 8 relevant (68% wasted)",
  "impact": {
    "tokens_wasted": 85000,
    "context_lost_pct": 68
  },
  "actionable": {
    "category": "context",
    "suggestion": "Use 'src/api/*.ts' instead of '**/*.ts'",
    "rule": "rules/general.md"
  }
}
```

**Actionable insights include:**
- `what_happened` - What was observed
- `why_it_matters` - Impact (tokens, time, quality)
- `how_to_fix` - Specific suggestions
- `rules_to_update` - Which files to modify

---

## Auto-Tracking (Plugin Hooks)

The plugin automatically hooks into:
- `tool.execute.before` - Track tool calls
- `tool.execute.after` - Track file reads, errors, results

This means during an eval session, you don't need to manually call `eval_log` for every tool call - it's captured automatically.

---

## Eval Tasks Structure

```
evals/
├── README.md                         # Framework spec
├── framework/                       # Python scoring engine (reference)
│   ├── types.py
│   ├── scorer.py
│   ├── annotator.py
│   └── analyzer.py
├── capability/                      # Capability evals (iterate to 100%)
│   ├── context_window/eval.json
│   └── token_efficiency/eval.json
└── regression/                      # Regression evals (must pass)
    ├── skill_triggering/eval.json
    └── basic_functionality/eval.json
```

---

## CLI Access

```bash
# Run capability evals
opencode --eval --capability --iterations 5

# Run regression evals
opencode --eval --regression

# Run specific eval
opencode --eval --task evals/capability/context_window/eval.json
```

---

## Next Steps

1. Register plugin in `opencode.json`
2. Try: `eval_run` for a full iteration loop
3. Check results with `eval_status`
4. Apply annotations to improve OpenCode

---

## Architecture Notes

- **TypeScript plugin**: Uses `@opencode-ai/plugin` SDK, hooks into execution
- **Python reference**: Complete scoring algorithms in `evals/framework/`
- **Skill**: Natural language interface in `skills/eval-agent/`

The Python implementation can be used for:
- Batch evaluation runs
- Integration with CI/CD
- Historical trend analysis
- Custom scoring algorithms