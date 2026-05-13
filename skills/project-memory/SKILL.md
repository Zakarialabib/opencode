---
name: project-memory
description: "Project conventions, memory, and documentation governance. Auto-loads conventions on session start, audits docs for drift, and manages project knowledge."
trigger: Automatic on session start, or /load-conventions, /audit-docs commands
allowed_tools: Memory(read_graph, search_nodes, create_entities), Read(rules/*, docs/*), Grep, Glob
---

# Project Memory & Docs Governance

This skill combines project memory (convention tracking) with documentation governance (drift detection and audit). It auto-loads conventions on session start and provides tools to keep documentation aligned with code.

## Part 1: Project Memory

### 1. Session Start Injection

On each agent session start:

1. Queries memory MCP for `project-conventions` entity
2. Loads all observations with confidence score >= 0.7
3. Formats as "Project conventions:" block
4. Injects into agent system prompt automatically

### 2. Convention Extraction

After each successful task:

1. Analyzes user interactions for implicit preferences
2. Checks if preference mentioned 3+ times
3. Assigns confidence score based on:
   - Frequency: times mentioned / 10
   - Consistency: no contradictions found
   - Age: newer = higher score
4. Stores in memory MCP with confidence

### 3. Confidence Scoring

| Mention Count | Score      | Action               |
| ------------- | ---------- | -------------------- |
| 1-2           | 0.1-0.2    | Track only           |
| 3-4           | 0.5-0.6    | Tentative convention |
| 5+            | 0.7-0.9    | Active convention    |
| Contradiction | Reset to 0 | Remove               |

### 4. Per-Agent Conventions

Different agents load different convention sets:

```
backend-laravel → PHP/Laravel conventions
frontend-ui-ux → React/Tailwind conventions
qa-guardian → Testing conventions
core-factory → General coding conventions
```

### 5. Memory MCP Schema

```json
{
  "entityType": "convention",
  "name": "project-conventions",
  "observations": [
    { "text": "Use arrow functions over function declarations", "confidence": 0.8 },
    { "text": "Use Pest for testing, not PHPUnit", "confidence": 0.9 }
  ]
}
```

## Part 2: Docs Governance Audit

Audit the docs folder against the actual codebase to find drift, stale guidance, and missing documentation.

### Audit Goals

- **Drift**: docs say one thing, code does another
- **Gap**: important code exists but docs do not
- **Redundancy**: duplicate docs, duplicate code, repeated guidance
- **Deprecation**: docs or code still rely on outdated patterns
- **Enhancement**: worthwhile improvement, but not necessarily broken
- **Keep**: good patterns that should remain unchanged

### Audit Workflow

1. Map the documentation surface (glob `docs/**/*.md`)
2. Map the code surface relevant to those docs (grep for module names, paths)
3. Cross-check claimed paths, modules, and behaviors
4. Classify findings by severity and type
5. Produce an execution order, not just a report

### Output Format

```
1. scope reviewed
2. findings table
3. priority plan
4. specific docs/code updates to perform next
```

### Good Prompts

- "Use project-memory to compare docs/ with the current codebase and rank cleanup opportunities."
- "Audit this project for doc drift and deprecated patterns."
- "Build a governance report for docs folder versus implementation."

## Usage

```bash
# Automatic on session start (no command needed)
/load-conventions  # Manual trigger
/conventions       # View current conventions
/audit-docs        # Run docs governance audit
```

## Integration Points

### Agent Startup Hook

In each agent's instructions:
```
Load project conventions from memory MCP at session start.
```

### Task Completion Hook

After successful task, update memory with new conventions.

### Weekly Validation

docs-curator reviews stored conventions and flags:
- Outdated conventions (version upgrades)
- Contradictions (conflicting patterns)
- Unused conventions (never referenced)

## Fallback Behavior

If memory MCP unavailable:
- Load from `rules/project-conventions.md`
- Ask user for key preferences
- Use empty conventions (no auto-loading)
