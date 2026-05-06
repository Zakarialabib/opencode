# Workflow Manager Skill

## Overview

Advanced Qwen Code-inspired task scheduling and workflow management for complex multi-step development tasks with intelligent agent routing, MCP integration, and robust error handling.

## Workflow Assets

This skill includes pre-defined workflow templates (version 2.0.0):

- **bug-fix.yaml**: Advanced bug fix workflow with intelligent triage, root cause analysis, and comprehensive verification (Triage → Fix → Verify → Document)
- **feature-development.yaml**: Complete feature development workflow with parallel execution and MCP integration (Strategy → Design → Implement → QA → Docs)
- **code-review.yaml**: Multi-agent code review workflow (Analyze → Review → Security → Performance → Document)
- **deployment.yaml**: Deployment preparation workflow (Audit → Build → Test → Stage → Production → Monitor)

Load these workflows for multi-phase projects.

## Triggers

- When user requests complex multi-step features
- When orchestrating multiple agents for large tasks
- When task dependencies need management
- When parallel execution is possible
- When intelligent agent routing is needed
- When MCP integration is required for documentation, state persistence, or testing

## Qwen Code Task Scheduler Pattern

### Workflow Phases

```
1. ANALYZE   → Understand request, identify components, use agent-router for best agent selection
2. PLAN      → Decompose into subtasks using sequential-thinking MCP
3. DELEGATE  → Launch SubAgents in parallel where possible (use Task tool)
4. MONITOR   → Track SubAgent progress via task_id
5. SYNTHESIZE → Combine results into unified solution
6. VERIFY    → Fresh SubAgent for review/validation
```

### Task Dependency Graph

```
User Request
    ├── Analyze (core-planner + agent-router)
    ├── Plan (sequential-thinking + core-planner)
    └── Execute
        ├── Subtask A (agent-X) ──┐
        ├── Subtask B (agent-Y) ──┼──> Synthesize (lead-strategist)
        └── Subtask C (agent-Z) ──┘        │
                                           Verify (qa-reviewer)
                                              │
                                           Deliver to User
```

## Usage Patterns

### Pattern 1: Parallel SubAgent Execution with Agent Routing

```markdown
Task: "Add user authentication to Laravel app"

1. Launch core-planner SubAgent to analyze existing auth patterns
   → Use agent-router tool: route_agent("authentication laravel")
   → Returns: backend-laravel (score: 15)

2. Parallel delegation with intelligent routing:
   - Task tool → backend-laravel: Create User model, migration
   - Task tool → backend-laravel: Setup routes, middleware
   - Task tool → docs-writer: Prepare API docs template
   - Task tool → qa-security: Security review of auth flow

3. Monitor all task_ids
4. Synthesize results using lead-strategist
5. Verify with qa-reviewer SubAgent
```

### Pattern 2: Sequential with Dependencies & MCP Integration

```markdown
Task: "Refactor database layer"

1. core-planner: Analyze current schema
   → Use context7 MCP: Fetch database migration docs
   → Use memory MCP: Store current schema state

2. lead-architect: Design new schema
   → Use sqlite MCP: Query existing data
   → Use sequential-thinking: Plan migration strategy

3. backend-api: Implement new models
   → Use context7 MCP: Fetch ORM docs
   → Use git MCP: Track changes per model

4. qa-tester: Write migration tests
   → Use sqlite MCP: Setup test database
   → Use context7 MCP: Fetch testing library docs

5. core-builder: Execute migration
   → Use git MCP: Commit migration files
   → Use memory MCP: Update schema state

6. qa-reviewer: Validate refactor
   → Use sequential-thinking: Review all changes
```

### Pattern 3: Hybrid Thinking Mode with MCP Tools

```markdown
For complex tasks requiring reasoning:

1. ENABLE sequential-thinking MCP
   → Use sequential-thinking tool for step-by-step reasoning

2. ANALYZE phase:
   → Use agent-router tool: route_agent(task_description)
   → Use context7 MCP: Fetch relevant documentation
   → Use memory MCP: Load historical context

3. PLAN phase:
   → Use sequential-thinking: Decompose with reasoning
   → Use context7 MCP: Fetch library examples
   → Use memory MCP: Store plan for persistence

4. EXECUTE phase:
   → Direct implementation mode
   → Use git MCP: Track all changes
   → Use filesystem MCP: Read/write files

5. REVIEW phase:
   → Fresh context via separate SubAgent
   → Use sequential-thinking: Review decisions
   → Use qa-reviewer: Code quality check
```

### Pattern 4: Event-Driven Workflow with Error Handling

```markdown
Task: "Monitor and fix production issues"

1. Setup trigger:
   → Use process-monitor plugin: Monitor error logs
   → On error: Trigger bug-fix workflow

2. Triage with agent-browser:
   → Use fetch MCP: Search for similar issues
   → Use memory MCP: Check historical bugs
   → Use sequential-thinking: Root cause analysis

3. Fix with retry policy:
   → max_attempts: 3
   → backoff: exponential
   → fallback_agent: qa-debugger

4. Verify with parallel testing:
   → qa-tester: Automated tests (use sqlite MCP for test data)
   → qa-debugger: Browser verification (use agent-browser skill)
   → qa-security: Security scan (use context7 MCP for security patterns)

5. Document with notification:
   → Use git MCP: Tag fix in repository
   → Use memory MCP: Persist solution for future
   → Notify stakeholders via notifications
```

## Tool Integration

### MCP Servers for Workflow

| MCP Server              | Purpose                                 | Workflow Phases                    |
| ----------------------- | --------------------------------------- | ---------------------------------- |
| **context7**            | Documentation and code examples         | All phases (ANALYZE, PLAN, VERIFY) |
| **memory**              | Persistent state and historical context | All phases (state persistence)     |
| **sequential-thinking** | Step-by-step reasoning                  | ANALYZE, PLAN, VERIFY              |
| **git**                 | Version control and blame analysis      | EXECUTE, VERIFY, Documentation     |
| **sqlite**              | Test data and state management          | PLAN, EXECUTE, VERIFY              |
| **fetch**               | Web research and issue search           | ANALYZE, VERIFY                    |
| **filesystem**          | File operations                         | EXECUTE, Documentation             |

### LSP Integration

- Use language servers to validate each subtask's output
- Rust-analyzer for Tauri components
- TypeScript LSP for React components
- PHP LSP for Laravel components

### Agent Router Integration

```markdown
# In each workflow phase, use agent-router for intelligent routing:

1. Call route_agent tool with task description
2. Get recommended agent with scoring breakdown
3. Use Task tool to delegate to recommended agent
4. Monitor task progress via task_id
5. Synthesize results from all agents
```

## Advanced Features

### Parallel Execution Groups

```yaml
parallel_groups:
  - [task_a, task_b] # These run in parallel
  - [task_c, task_d] # These also run in parallel
dependencies: [Previous Phase]
```

### Retry Policies

```yaml
retry_policy:
  max_attempts: 3
  backoff: exponential # or linear
  retry_on: [test_failure, lsp_error, timeout]
  fallback_agent: qa-debugger
```

### Exit Criteria

```yaml
exit_criteria:
  - All tests pass with >80% coverage
  - No LSP diagnostics errors
  - Code follows project rules (from rules/)
  - Documentation updated
```

### Notification Hooks

```yaml
notifications:
  on_start:
    - notify: [engineering-lead]
    - channel: slack
  on_phase_complete:
    - log_to: memory MCP
  on_complete:
    - update: project-portal
    - generate: release-notes.md
  on_failure:
    - alert: [engineering-lead, qa-debugger]
    - escalate_to: lead-strategist
```

## Best Practices

1. **Isolate SubAgent Context**: Each Task tool call gets fresh context
2. **Package Context**: Include all relevant file paths, LSP data in delegation
3. **Track task_ids**: Resume SubAgent sessions if needed
4. **Parallel When Possible**: Launch independent tasks simultaneously
5. **Synthesize Results**: Don't just concatenate - integrate solutions
6. **Fresh Review**: Use separate SubAgent for unbiased review
7. **Use Agent Router**: Let the system recommend the best agent for each task
8. **Leverage MCP Tools**: Use context7 for docs, memory for state, sqlite for data
9. **Implement Retry Logic**: Handle failures gracefully with exponential backoff
10. **Monitor Performance**: Track metrics in sqlite MCP for continuous improvement

## Example: Full Advanced Workflow

```markdown
User: "Create a blog feature with comments, authentication, and API"

Workflow Execution:

[Phase 1: ANALYZE with Agent Router]
Task tool → core-planner + route_agent tool:
Input: "blog feature with comments authentication API"
Output: Recommended agents: - backend-laravel (score: 18) for models, migrations - lead-architect (score: 12) for API design - frontend-ui-ux (score: 10) for UI components

Use context7 MCP: Fetch Laravel documentation
Use memory MCP: Store analysis results
Output: "Existing patterns: MVC structure, API resources used"

[Phase 2: PLAN with Sequential Thinking]
Task tool → lead-strategist + sequential-thinking MCP:
Input: Analysis from Phase 1
Use sequential-thinking: Decompose with reasoning
Output: Task list with dependencies: - Post CRUD (depends on: none) - Comment CRUD (depends on: Post) - Authentication (depends on: none) - API endpoints (depends on: Post, Comment) - Tests (depends on: all above)

[Phase 3: DELEGATE - Parallel Execution]

# Group 1: Parallel (no dependencies)

Task tool → backend-laravel (task_id: t1):

- Create Post model, migration, factory
- Setup Post API resource
  Use sqlite MCP: Setup test database

Task tool → backend-laravel (task_id: t2):

- Create Comment model, migration
- Setup Comment API resource
  Use context7 MCP: Fetch relationship docs

Task tool → backend-laravel (task_id: t3):

- Implement authentication middleware
  Use context7 MCP: Fetch Laravel auth docs

# Group 2: After Group 1 completes

Task tool → backend-api (task_id: t4):

- Create PostController, CommentController
- Define routes in api.php
  Use git MCP: Commit controller files

Task tool → frontend-ui-ux (task_id: t5):

- Create React components for blog
- Design comment UI
  Use context7 MCP: Fetch React component patterns

[Monitor: Wait for t1, t2, t3, t4, t5 to complete]
[Use task_id tracking to monitor progress]

[Phase 4: SYNTHESIZE]
Task tool → lead-strategist:

- Combine outputs from t1, t2, t3, t4, t5
- Resolve any conflicts
- Generate unified solution summary
  Use memory MCP: Persist synthesized solution

[Phase 5: VERIFY with Fresh Agents]
Task tool → qa-reviewer (fresh context):

- Review all created files
- Check Laravel conventions
- Validate relationships
  Use sequential-thinking: Review decisions

Task tool → qa-tester:

- Generate feature tests
- Run test suite
  Use sqlite MCP: Test with sample data

Task tool → qa-security:

- Scan for authentication vulnerabilities
- Check for secret leaks
  Use context7 MCP: Fetch security best practices

[Phase 6: DELIVER with Documentation]
Task tool → docs-writer:

- Update API documentation
- Create user guide for blog feature
  Use context7 MCP: Fetch documentation patterns

Present unified solution to user with:

- Summary of changes
- File list with descriptions
- Test results (>80% coverage)
- Security audit (no critical issues)
- Performance benchmarks (within SLA)
- Next steps (if any)

[Post-Completion]

- Use git MCP: Tag release v1.0.0
- Use memory MCP: Store feature pattern for future
- Notify stakeholders via notifications
```

## Configuration

Add to agent instructions:

```
When handling complex tasks:
1. Use workflow-manager skill (version 2.0.0)
2. Follow ANALYZE → PLAN → DELEGATE → SYNTHESIZE → VERIFY
3. Launch SubAgents with Task tool
4. Use agent-router tool for intelligent routing
5. Leverage MCP tools (context7, memory, sequential-thinking, sqlite, git)
6. Track task_ids for monitoring
7. Implement retry policies for resilience
8. Synthesize results before delivering
9. Use notification hooks for stakeholder communication
```

## Integration with OpenCode

Register this skill in `skills/index.json`:

```json
{
  "name": "workflow-manager",
  "displayName": "Advanced Workflow Manager",
  "description": "Qwen Code-inspired task scheduling and workflow management for complex multi-step development tasks with intelligent agent routing, MCP integration, and robust error handling.",
  "version": "2.0.0",
  "category": "orchestration",
  "tags": [
    "workflow",
    "task-scheduling",
    "subagents",
    "orchestration",
    "agent-routing",
    "mcp-integration"
  ],
  "agents": ["lead-strategist", "core-factory"],
  "entryPoint": "SKILL.md",
  "workflows": [
    "workflows/feature-development.yaml",
    "workflows/bug-fix.yaml",
    "workflows/code-review.yaml",
    "workflows/deployment.yaml"
  ]
}
```

## Workflow YAML Schema (Version 2.0.0)

```yaml
name: Workflow Name
description: Workflow description with intelligent orchestration
version: 2.0.0
trigger: manual | webhook | schedule

# Global configuration
mcp_servers: [context7, memory, sequential-thinking, git, sqlite, fetch, filesystem]
env:
  KEY: value

phases:
  - name: Phase Name
    description: Phase description
    agents: [agent1, agent2]
    use_agent_router: true # Enable intelligent routing
    tasks: [task1, task2]
    artifacts: [file1, file2]
    dependencies: [Previous Phase]
    mcp_tools:
      context7: [fetch_library_docs]
      memory: [create_entities]
    parallel_groups:
      - [task1, task2]
    retry_policy:
      max_attempts: 3
      backoff: exponential
    exit_criteria:
      - Criterion 1
      - Criterion 2

success_criteria:
  - Overall criterion 1
  - Overall criterion 2

notifications:
  on_start: ...
  on_complete: ...
  on_failure: ...

error_handling:
  strategy: continue-on-non-critical
  max_retries_per_task: 3
  fallback_agent: qa-debugger

agent_routing:
  enabled: true
  scoring_weights:
    keyword_match: 2
    skill_match: 3

mcp_integration:
  context7:
    purpose: Documentation
    phases: [all]
```

## Tips for Workflow Authors

1. **Use Agent Router**: Set `use_agent_router: true` in phases for intelligent agent selection
2. **Define Exit Criteria**: Clear exit criteria ensure phase completion quality
3. **Leverage Parallel Groups**: Identify independent tasks and run them in parallel
4. **Configure Retry Policies**: Handle transient failures gracefully
5. **Integrate MCP Tools**: Use MCP tools for documentation, state, testing, and version control
6. **Set Up Notifications**: Keep stakeholders informed at each stage
7. **Track Metrics**: Use sqlite MCP to track workflow performance over time
8. **Version Your Workflows**: Use semantic versioning (e.g., 2.0.0) for workflow YAML files
