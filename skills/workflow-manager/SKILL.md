# Workflow Manager Skill

## Overview

Qwen Code-inspired task scheduling and workflow management for complex multi-step development tasks.

## Workflow Assets

This skill includes pre-defined workflow templates:

- **bug-fix.yaml**: Professional bug fix workflow (Triage → Fix → Verify → Document)
- **feature-development.yaml**: Feature development workflow (Strategy → Design → Implement → QA → Docs)

Load these workflows for multi-phase projects.

## Triggers

- When user requests complex multi-step features
- When orchestrating multiple agents for large tasks
- When task dependencies need management
- When parallel execution is possible

## Qwen Code Task Scheduler Pattern

### Workflow Phases

```
1. ANALYZE  → Understand request, identify components
2. PLAN     → Decompose into subtasks using sequential-thinking
3. DELEGATE → Launch SubAgents in parallel where possible
4. MONITOR  → Track SubAgent progress via task_id
5. SYNTHESIZE → Combine results into unified solution
6. VERIFY   → Fresh SubAgent for review/validation
```

### Task Dependency Graph

```
User Request
    ├── Analyze (core-planner)
    ├── Plan (sequential-thinking + core-planner)
    └── Execute
        ├── Subtask A (agent-X) ──┐
        ├── Subtask B (agent-Y) ──┼──> Synthesize (lead-orchestrator)
        └── Subtask C (agent-Z) ──┘        │
                                           Verify (qa-reviewer)
                                              │
                                           Deliver to User
```

## Usage Patterns

### Pattern 1: Parallel SubAgent Execution

```markdown
Task: "Add user authentication to Laravel app"

1. Launch core-planner SubAgent to analyze existing auth patterns
2. Parallel delegation:
   - Task tool → backend-laravel: Create User model, migration
   - Task tool → backend-laravel: Setup routes, middleware
   - Task tool → docs-writer: Prepare API docs template
3. Monitor all three task_ids
4. Synthesize results
5. Verify with qa-reviewer SubAgent
```

### Pattern 2: Sequential with Dependencies

```markdown
Task: "Refactor database layer"

1. core-planner: Analyze current schema
2. lead-architect: Design new schema
3. backend-api: Implement new models
4. qa-tester: Write migration tests
5. core-builder: Execute migration
6. qa-reviewer: Validate refactor
```

### Pattern 3: Hybrid Thinking Mode

```markdown
For complex tasks requiring reasoning:

1. ENABLE sequential-thinking MCP
2. PLAN phase: Use sequential-thinking for step-by-step reasoning
3. EXECUTE phase: Direct implementation mode
4. REVIEW phase: Fresh context via separate SubAgent
```

## Tool Integration

### MCP Servers for Workflow

- **sequential-thinking**: Task decomposition, dependency analysis
- **context7**: Fetch documentation for each subtask
- **memory**: Persist workflow state across sessions
- **git**: Track changes per subtask

### LSP Integration

- Use language servers to validate each subtask's output
- Rust-analyzer for Tauri components
- TypeScript LSP for React components
- PHP LSP for Laravel components

## Best Practices

1. **Isolate SubAgent Context**: Each Task tool call gets fresh context
2. **Package Context**: Include all relevant file paths, LSP data in delegation
3. **Track task_ids**: Resume SubAgent sessions if needed
4. **Parallel When Possible**: Launch independent tasks simultaneously
5. **Synthesize Results**: Don't just concatenate - integrate solutions
6. **Fresh Review**: Use separate SubAgent for unbiased review

## Example: Full Workflow

```markdown
User: "Create a blog feature with comments"

Workflow Execution:

[Phase 1: ANALYZE]
Task tool → core-planner:

- Read existing Post model (if exists)
- Check routes/web.php for patterns
- Analyze database/migrations/
  Output: "Existing patterns: MVC structure, API resources used"

[Phase 2: PLAN]
Task tool → lead-orchestrator with sequential-thinking:

- Decompose: Post CRUD, Comment CRUD, Relationships, Tests
- Identify dependencies: Posts before Comments
- Plan parallel: Can do Post + Comment models simultaneously
  Output: Task list with dependencies

[Phase 3: DELEGATE - Parallel]
Task tool → backend-laravel (task_id: t1):

- Create Post model, migration, factory
- Setup Post API resource

Task tool → backend-laravel (task_id: t2):

- Create Comment model, migration
- Setup Comment API resource

Task tool → backend-laravel (task_id: t3):

- Create PostController, CommentController
- Define routes in api.php

[Monitor: Wait for t1, t2, t3 to complete]

[Phase 4: SYNTHESIZE]
Task tool → lead-orchestrator:

- Combine outputs from t1, t2, t3
- Resolve any conflicts
- Generate unified solution summary

[Phase 5: VERIFY]
Task tool → qa-reviewer (fresh context):

- Review all created files
- Check Laravel conventions
- Validate relationships

Task tool → qa-tester:

- Generate feature tests
- Run test suite

[Phase 6: DELIVER]
Present unified solution to user with:

- Summary of changes
- File list with descriptions
- Test results
- Next steps (if any)
```

## Configuration

Add to agent instructions:

```
When handling complex tasks:
1. Use workflow-manager skill
2. Follow ANALYZE → PLAN → DELEGATE → SYNTHESIZE → VERIFY
3. Launch SubAgents with Task tool
4. Track task_ids for monitoring
5. Synthesize results before delivering
```

## Integration with OpenCode

Register this skill in `skills/index.json`:

```json
{
  "name": "workflow-manager",
  "displayName": "Workflow Manager",
  "description": "Qwen Code-inspired task scheduling and workflow management for complex multi-step development tasks.",
  "version": "1.0.0",
  "category": "orchestration",
  "tags": ["workflow", "task-scheduling", "subagents", "orchestration"],
  "agents": ["lead-orchestrator", "core-planner"],
  "entryPoint": "SKILL.md"
}
```
