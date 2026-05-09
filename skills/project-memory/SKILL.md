---
name: project-memory
description: Auto-loads project conventions from memory on agent startup. Eliminates need for users to repeatedly state preferences.
trigger: Automatic on session start, or /load-conventions command
allowed_tools: Memory(read_graph, search_nodes, create_entities), Read(rules/*)
---

# Project Memory Skill

This skill automatically loads project conventions into agent context at session start, eliminating the need for users to repeatedly state preferences.

## How It Works

### 1. Session Start Injection

On each agent session start, this skill:

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

## Usage

```bash
# Automatic on session start (no command needed)
/load-conventions  # Manual trigger
/conventions      # View current conventions
```

## Example Output

When agent starts, system prompt includes:

```
Project conventions:
- Use arrow functions, not function declarations
- Repository pattern for data access
- Use Pest over PHPUnit for testing
- Livewire 4 with Alpine.js 3, not newer versions
- Tailwind CSS, custom CSS only when necessary
- TypeScript strict mode enabled
- Environment variables in .env, never commit secrets
```

## Convention Types

### Coding Style Preferences

- Arrow functions vs function declarations
- const vs let usage
- Import order (stdlib, third-party, local)
- Comment style (JSDoc, inline, none)
- Line length limits

### Code Patterns

- Repository pattern for data access
- Service layer pattern
- DTO pattern
- Event-driven architecture
- Feature flags

### Project Conventions

- Testing framework (Pest vs PHPUnit)
- CSS approach (Tailwind vs custom)
- Component structure
- API design (REST vs GraphQL)
- Authentication (JWT vs sessions)

## Integration Points

### 1. Agent Startup Hook

In each agent's instructions, add:

```
Load project conventions from memory MCP at session start.
```

### 2. Task Completion Hook

After successful task, update memory:

```javascript
// Extract conventions from code written
const conventions = extractConventions(code);
memory.add_observations({
  entityName: "project-conventions",
  contents: conventions,
});
```

### 3. Weekly Validation

docs-curator reviews stored conventions and flags:

- Outdated conventions (version upgrades)
- Contradictions (conflicting patterns)
- Unused conventions (never referenced)

## Memory MCP Schema

```json
{
  "entityType": "convention",
  "name": "project-conventions",
  "observations": [
    {
      "text": "Use arrow functions over function declarations",
      "confidence": 0.8,
      "source": "frontend-ui-ux comments",
      "mentions": 7,
      "lastSeen": "2026-05-08"
    },
    {
      "text": "Use Pest for testing, not PHPUnit",
      "confidence": 0.9,
      "source": "qa-guardian test files",
      "mentions": 12,
      "lastSeen": "2026-05-08"
    }
  ]
}
```

## Convention Extraction Examples

| Code Pattern                | Extracted Convention             |
| --------------------------- | -------------------------------- |
| `const foo = () => {}`      | Prefer arrow functions           |
| `$this->repository->get()`  | Use repository pattern           |
| `test()` function in Pest   | Use Pest, not PHPUnit            |
| `<div x-data="{}">`         | Use Alpine.js, not React hooks   |
| `@wire:click`               | Use Livewire 4, not Livewire 3   |
| `clsx('flex', ...)`         | Use clsx for conditional classes |
| `tailwind.config.js` custom | Extend Tailwind theme            |

## Performance

- Memory query: ~50ms on session start
- Convention extraction: ~200ms post-task
- No performance impact on agent responsiveness

## Fallback Behavior

If memory MCP unavailable:

- Load from `rules/project-conventions.md`
- Ask user for key preferences
- Use empty conventions (no auto-loading)
