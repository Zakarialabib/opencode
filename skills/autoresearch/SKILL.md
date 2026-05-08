---
name: "autoresearch"
description: "Integrate Karpathy's autoresearch pattern for autonomous experiment loops. Use AI agents to iteratively modify code, run benchmarks, and keep improvements. Invoke when user types /autoresearch or requests autonomous research."
---

# AutoResearch Skill

## Description

Integrates Andrej Karpathy's autoresearch pattern into OpenCode. Enables AI agents to autonomously run experiment loops - modifying code, running benchmarks, measuring results, and keeping improvements while reverting failures.

## Triggers

- User types: `/autoresearch [target]` or `/auto-research [topic]`
- User requests: "run autonomous research on [X]"
- System detects: optimization task with measurable metrics

## Core Concept

The autoresearch pattern uses a three-file architecture:

| File                          | Responsibility                        | Modified By |
| ----------------------------- | ------------------------------------- | ----------- |
| `program.md`                  | Research instructions and constraints | Human       |
| `train.py` (or target script) | Code being optimized                  | AI Agent    |
| `prepare.py` (or setup)       | Immutable infrastructure              | Never       |

## Workflow

### Phase 1: Setup Research Environment

1. **Detect Target**: Identify what to optimize (ML model, build time, bundle size, test speed, etc.)
2. **Define Metric**: Establish measurable validation metric (val_bpb, build time, bundle size, etc.)
3. **Create program.md**: Write research instructions in natural language
4. **Setup Agent**: Configure OpenCode agent with file edit + bash execution permissions

### Phase 2: Initialize Experiment Loop

1. **Read program.md**: Agent reads human-provided research instructions
2. **Modify Target**: Agent proposes changes to the target script
3. **Run Benchmark**: Execute fixed-time training/validation run
4. **Measure Result**: Compare against previous best metric
5. **Commit or Revert**:
   - Improvement → Keep changes, update baseline
   - No improvement → Git revert, try new approach

### Phase 3: Continuous Optimization

- Loop runs autonomously for N experiments or time duration
- Each experiment = ~5 minutes (configurable)
- Agent explores: architecture changes, hyperparameter tuning, optimization strategies
- Progress tracked via git history on feature branch

## Integration Patterns

### Pattern A: ML Training (Karpathy's Original)

```bash
git clone https://github.com/karpathy/autoresearch
cd autoresearch
uv run prepare.py  # One-time setup
# Point coding agent at repo with program.md instructions
```

### Pattern B: Generic Optimization (pi-autoresearch)

For non-ML targets (build speed, bundle size, test performance):

1. Define target script (e.g., `build.sh`, `webpack.config.js`)
2. Define metric extraction (e.g., parse build output for time)
3. Create `program.md` with optimization instructions
4. Agent loops: modify → benchmark → measure → keep/revert

### Pattern C: OpenCode Native

Integrate directly with OpenCode agents:

```json
{
  "agent": {
    "autoresearch": {
      "instructions": [
        "AUTORESEARCH: Run experiment loops with fixed time budgets.",
        "Read program.md for instructions.",
        "Modify target script, run benchmark, measure metric.",
        "Keep improvements (git commit), revert failures (git reset).",
        "Track experiments in git history on autoresearch/ branch."
      ],
      "tools": {
        "read": true,
        "write": true,
        "edit": true,
        "bash": true,
        "git": true
      },
      "permission": {
        "file": { "train.py": "allow", "program.md": "allow" },
        "bash": { "uv run*": "allow", "git*": "allow" }
      }
    }
  }
}
```

## Assets

- `assets/program-md-template.md`: Template for program.md files
- `assets/metric-extractors.md`: Common metric extraction patterns

## Best Practices

1. **Fixed Time Budget**: Keep experiments to 5-minute windows for comparability
2. **Single Metric**: Use one clear validation metric (val_bpb, build_seconds, etc.)
3. **Git Tracking**: Every experiment = one commit on feature branch
4. **Immutable Infrastructure**: Never let agent modify setup/preparation scripts
5. **Human Oversight**: Review program.md carefully - it's your "research org code"

## Example program.md

```markdown
# Research Program: Optimize GPT-2 Training

## Goal

Reduce validation loss (val_bpb) by exploring architecture and optimizer changes.

## Constraints

- Keep model under 200M parameters
- Training time fixed at 5 minutes per experiment
- Use Muon or AdamW optimizer

## Exploration Areas

- MLP width vs depth tradeoffs
- Learning rate schedules
- Weight decay strategies
- Gradient accumulation steps

## Forbidden

- Changing data preparation
- Modifying tokenizer
- Exceeding time budget
```

## References

- Original: https://github.com/karpathy/autoresearch
- Generic port: https://github.com/davebcn87/pi-autoresearch
- OpenClaw integration: https://github.com/aiming-lab/AutoResearchClaw
