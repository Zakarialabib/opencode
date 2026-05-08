# 🔄 Agent Loop & Iterative Execution Guide#

OpenCode supports iterative execution patterns where agents run in loops, refine output, and continuously improve results using **workflow orchestration** with parallel execution, retry policies, and MCP integration.

> See the official docs: [opencode.ai/docs/plugins/#events](https://opencode.ai/docs/plugins/#events)

---

## 📋 Table of Contents#

1. [Understanding Agent Loops](#understanding-agent-loops)
2. [Basic Iterative Patterns](#basic-iterative-patterns)
3. [Using the Task Tool for Loops](#using-the-task-tool-for-loops)
4. [Workflow Engine](#workflow-engine)
5. [Ambient LSP Feedback in Loops](#ambient-lsp-feedback-in-loops)
6. [Self-Improvement Loops](#self-improvement-loops)
7. [Best Practices](#best-practices)

---

## 🔄 Understanding Agent Loops#

An **agent loop** is a pattern where an agent:

1. Produces output
2. Evaluates the result (with Ambient LSP Feedback)
3. Refines based on feedback
4. Repeats until criteria are met

### When to Use Loops#

| Scenario               | Loop Type            | Example                             |
| ---------------------- | -------------------- | ----------------------------------- |
| Code needs refinement  | Iterative refinement | "Refactor until test coverage >80%" |
| Design needs iteration | Creative loop        | "Generate 3 UI variants, pick best" |
| Self-improvement       | Evolution loop       | "Analyze and improve config weekly" |
| Data processing        | Batch loop           | "Process all files in directory"    |

### Features#

- **Ambient LSP Feedback**: Errors injected automatically after edits
- **Retry Policies**: Configure `max_attempts` and backoff strategy
- **Parallel Groups**: Execute independent loop iterations concurrently
- **MCP Integration**: Use `memory` MCP to persist loop state
- **Performance Tracking**: Metrics stored in `sqlite` MCP

---

## 🔁 Basic Iterative Patterns#

### Pattern 1: Simple Retry Loop#

**Use case:** Keep trying until success or max attempts.

```
Using core-factory:

Task: Implement the calculateTotal() function

Loop until: function passes all tests OR 3 attempts reached
1. Write implementation
2. Run tests (npm test -- --grep "calculateTotal")
3. If tests fail:
   - Analyze errors (Ambient LSP will show syntax errors automatically)
   - Refine implementation
   - Go to step 1
4. If tests pass: Return success

# Use retry_policy in workflow YAML
# retry_policy:
#   max_attempts: 3
#   backoff: exponential
```

### Pattern 2: Refinement Loop#

**Use case:** Gradually improve quality with MCP integration.

```
Using frontend-ui-ux:

Task: Create a premium dashboard card component

Refinement loop (max 5 iterations):
Iteration 1: Create basic component structure
Iteration 2: Add Tailwind styling (use context7 MCP for docs)
Iteration 3: Ensure responsive design (test at 3 breakpoints)
Iteration 4: Add accessibility attributes (WCAG AA)
Iteration 5: Optimize performance (React.memo, lazy loading)

Stop when: All checklist items complete

Checklist:
- [ ] Uses shadcn/ui base
- [ ] Responsive at all breakpoints
- [ ] Passes accessibility audit
- [ ] No unnecessary re-renders

# Store progress in memory MCP
# memory_create_entities for each iteration
```

### Pattern 3: Feedback Loop#

**Use case:** Incorporate feedback from other agents with parallel execution.

```
Using lead-strategist:

Task: Build user authentication system

Loop:
1. backend-laravel: Implement auth endpoints (use sqlite MCP for test data)
2. qa-guardian: Review code quality (parallel with step 3)
3. qa-guardian: Security audit (parallel with step 2)
4. IF feedback contains "must fix" items:
   - backend-laravel: Address feedback
   - Go to step 2
5. ELSE: Done

# Use parallel_groups for steps 2 & 3
# parallel_groups:
#   - [qa-guardian_task1, qa-guardian_task2]
```

---

## 🛠️ Using the Task Tool for Loops#

The **Task tool** enables launching SubAgents with enhanced patterns.

### Sequential Loop with Task Tool#

```
Using lead-strategist:

I need to implement a feature with iterative refinement.

Phase 1: Initial Implementation
Task: core-factory, "Create basic CRUD for Product model"

Phase 2: Review (loop until approved)
LOOP:
  Task: qa-guardian, "Review the Product CRUD code"
  IF review contains "changes needed":
    Task: core-factory, "Address review feedback: [feedback]"
    CONTINUE LOOP
  ELSE:
    BREAK

Phase 3: Testing
Task: qa-guardian, "Create comprehensive tests for Product CRUD"

Phase 4: Final Verification
Task: lead-architect, "Verify architecture alignment"

# Track with task_id and performance metrics
```

### Parallel Loop Pattern#

```
Using lead-strategist:

Task: Build and test the notification system

Parallel execution (all run simultaneously):
- Task 1: backend-api, "Implement notification API endpoints"
- Task 2: frontend-ui-ux, "Build notification UI components"
- Task 3: qa-guardian, "Prepare test data and test cases"

Synthesize results:
- Collect outputs from all tasks (use task_id tracking)
- Check for integration issues
- If issues found, delegate fixes to appropriate agents

# Use parallel_groups in workflow YAML
# parallel_groups:
#   - [backend_task, frontend_task, qa_task]
```

---

## ⚡ Workflow Engine#

The **Workflow Engine** (`workflow-manager` skill) provides YAML-based automation with advanced features.

### Key Features#

| Feature                  | Description                              | Usage               |
| ------------------------ | ---------------------------------------- | ------------------- |
| `use_agent_router: true` | Auto-route tasks to best agent per phase | Per phase in YAML   |
| `parallel_groups`        | Execute independent tasks concurrently   | Within phases       |
| `retry_policy`           | Configure max_attempts and backoff       | Per phase or global |
| `exit_criteria`          | Define conditions for phase completion   | Per phase           |
| `notifications`          | Webhook/Slack on phase completion        | Per phase           |
| `mcp_integration`        | Declarative MCP tool usage               | Per phase           |
| `performance`            | Track metrics (time, success, tokens)    | Global              |
| `security`               | Automated vulnerability scans            | Per phase           |

### Creating a Loop Workflow#

Create `workflows/iterative-development.yaml`:

```yaml
name: Iterative Feature Development
version: 2.0.0
description: Build features with continuous refinement loops

context:
  max_iterations: 5
  quality_threshold: 0.8

phases:
  - name: Initial Implementation
    use_agent_router: true
    mcp_tools:
      context7: [fetch_library_docs]
    agents: [core-factory]
    tasks: [implement_feature]
    artifacts: [implementation_code]

  - name: Review Loop
    use_agent_router: true
    mcp_tools:
      memory: [create_entities, add_observations]
    agents: [qa-guardian]
    loop:
      max_iterations: ${context.max_iterations}
      condition: "review_score >= ${context.quality_threshold}"
      on_fail: [core-factory: address_feedback]
    parallel_groups:
      - [qa-guardian_task]
    retry_policy:
      max_attempts: 3
      backoff: exponential
    tasks: [review_code, run_tests]

  - name: Security Audit
    agents: [qa-guardian]
    mcp_tools:
      git: [check_diff]
    tasks: [security_scan]
    security:
      scan_on_phases: [Security Audit]
      fail_on: [critical, high]

  - name: Documentation
    agents: [docs-curator]
    mcp_tools:
      memory: [create_entities]
    tasks: [update_docs]
    performance:
      track_metrics: [time_to_complete, success_rate]
      store_metrics_in: sqlite MCP

exit_criteria: "all_phases_complete AND quality_threshold_met"
notifications:
  on_phase_complete:
    webhook: "https://hooks.slack.com/..."
    message: "Phase {phase_name} completed successfully!"
```

---

## 🔍 Ambient LSP Feedback in Loops#

**New:** OpenCode now automatically detects syntax errors and injects them into the model's context.

### How It Helps Loops#

```
1. core-factory: edit file X
   ↓ (tool.execute.after fires)
2. Run quick syntax check (php -l, tsc --noEmit, biome check, cargo check)
   ↓ (error detected)
3. Errors captured and stored per-session
   ↓ (next turn)
4. Errors injected into model instructions
   ↓ (model sees)
5. Model self-corrects in the same turn
```

### Supported Checkers in Loops#

| Extension  | Checker                | Speed  | Injection                       |
| ---------- | ---------------------- | ------ | ------------------------------- |
| `.php`     | `php -l`               | ~50ms  | **Same turn** (output.result)   |
| `.py`      | `python -m py_compile` | ~100ms | **Same turn** (output.result)   |
| `.ts/.tsx` | `tsc --noEmit`         | ~2-5s  | Next turn (output.instructions) |
| `.js/.jsx` | `npx biome check`      | ~1-3s  | Next turn (output.instructions) |
| `.rs`      | `cargo check`          | ~5-15s | Next turn (output.instructions) |

### Loop with Ambient Feedback#

```
Using core-factory:

Task: Implement caching layer for products

Loop (max 5 attempts):
1. Write implementation (edit product.service.ts)
2. Ambient LSP automatically checks and shows errors
3. IF errors in output.result:
   - Fix errors immediately (same turn)
   - Go to step 1
4. ELSE IF tests fail:
   - Analyze and fix
   - Go to step 1
5. ELSE: Done

# Fast PHP/Python checks happen in same turn!
# Slower TS/Rust checks queue and inject in next turn.
```

---

## 🧬 Self-Improvement Loops#

OpenCode has built-in self-improvement capabilities via the `docs-curator` agent and `self-reflection` skill.

### Setting Up Automatic Self-Improvement#

**1. Configure the reflection schedule in `opencode.json`:**

```json
{
  "command": {
    "reflect": {
      "template": "echo 'Running self-reflection...'",
      "description": "Analyze and improve opencode config",
      "agent": "docs-curator",
      "schedule": "weekly",
      "loop": {
        "max_iterations": 10,
        "improvement_threshold": 0.05
      },
      "mcp_tools": ["memory", "sqlite", "sequential-thinking"]
    }
  }
}
```

**2. Using the self-reflection skill:**

```
Using docs-curator:

Run the self-reflection skill to analyze our configuration:

Loop (max 5 iterations):
1. Analyze current config using self-reflection skill (sequential-thinking MCP)
2. Generate improvement proposals (memory MCP for state)
3. Apply top 3 high-confidence proposals
4. Test: Run /doctor to verify config health
5. If health score improved by >5%: Continue loop
6. Else: Stop and report final config

# Store results in sqlite MCP for tracking
# performance:
#   track_metrics: [health_score_improvement]
#   store_metrics_in: sqlite MCP
```

---

## 📋 Best Practices#

### 1. Set Clear Termination Conditions#

**❌ Poor Loop (infinite risk):**

```
Keep refactoring the code until it's perfect
```

**✅ Good Loop (clear exit):**

```
Refactor the code with these exit conditions:
- All tests pass
- No lint warnings
- Maximum 5 iterations reached
- Quality threshold met (use exit_criteria)
```

### 2. Use the Memory MCP for State#

```
Loop iteration 1-N:
1. Read previous iteration results from memory MCP (memory_read_graph)
2. Build on previous work
3. Store current results: memory_create_entities
4. If new results worse than previous: Revert
```

### 3. Combine with Workflow Manager Skill#

The `workflow-manager` skill (Qwen-inspired) provides:

- ANALYZE: Understand the task (uses context7 MCP)
- PLAN: Create iteration plan (uses sequential-thinking MCP)
- DELEGATE: Assign to agents (uses agent-router, Task tool)
- SYNTHESIZE: Combine results (uses memory MCP)
- VERIFY: Check quality gates (uses sqlite MCP for metrics)

### 4. Monitor Loop Performance#

```
Before starting loop:
- Record baseline metrics (build time, test coverage, etc.)
- Store in sqlite MCP

During loop:
- Log each iteration's metrics (performance tracking)
- Use memory MCP to track progress

After loop:
- Compare final vs baseline (sqlite MCP query)
- Store improvement in knowledge graph (memory MCP)
```

### 5. Avoid Infinite Loops#

Always include:

- Maximum iteration count (`max_iterations` in loop config)
- Quality threshold (`exit_criteria`)
- Timeout mechanism (`timeout` in workflow YAML)

```yaml
loop:
  max_iterations: 10
  timeout: 300000 # 5 minutes
  stop_condition: "all_tests_pass OR max_iterations_reached"
  retry_policy:
    max_attempts: 3
    backoff: exponential
```

---

> [!WARNING]
> Always set maximum iteration counts and quality thresholds to prevent infinite loops. The `doom_loop` permission is set to `"deny"` by default for safety.

> [!TIP]
> Use the `memory` MCP server to persist loop state across sessions. This allows long-running loops to resume if interrupted.
