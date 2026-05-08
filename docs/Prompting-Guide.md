# 💬 Prompting Guide

Master the art of prompting OpenCode's 10 agents, 16 skills, and workflow orchestration for maximum productivity.

> See the official docs: [opencode.ai/docs/agents](https://opencode.ai/docs/agents/)

---

## 📋 Table of Contents

1. [Prompting Basics](#prompting-basics)
2. [Agent-Specific Prompts](#agent-specific-prompts)
3. [Using Skills in Prompts](#using-skills-in-prompts)
4. [Multi-Agent Workflow Prompts](#multi-agent-workflow-prompts)
5. [Ambient LSP Feedback](#ambient-lsp-feedback)
6. [Best Practices](#best-practices)

---

## 🎯 Prompting Basics

Every prompt should include: **Context + Task + Format + Tools**.

### The Golden Structure

```
[Context: Stack, constraints, relevant files]
[Task: What you want done]
[Format: How you want the result]
[Tools: Features to use — ambient LSP, agent-router, parallel_groups]
```

### Example

```
Context:
- Stack: Laravel + Livewire + Tailwind
- Current issue: User registration is slow (5+ seconds)
- Relevant files: app/Http/Controllers/Auth/RegisterController.php
- Performance requirement: <1 second response time

Task: Optimize the registration flow

Format: Provide a step-by-step optimization plan with code examples

Tools:
- Use agent-router to auto-route to backend-laravel
- Use parallel_groups for independent optimizations
- Use context7 MCP for Laravel docs
- Track performance metrics in sqlite MCP
```

---

## 🤖 Agent-Specific Prompts

### Core Implementation (`core-factory`)

**Best for:** Direct file editing, batch operations, planning.

```
Using core-factory:

Implement a caching layer for the product catalog:

Requirements:
- Use Redis for storage
- Cache product data for 1 hour
- Invalidate on product update
- Fallback to DB if Redis unavailable

Use the laravel-feature-scaffold skill for consistent structure.
```

### Backend Agents (`backend-laravel`, `backend-api`, `backend-tauri`)

**Best for:** Server-side logic, APIs, Tauri backend.

```
Using backend-laravel:

Create a REST API for the task management feature:

Endpoints needed:
- GET /api/tasks (list with filtering)
- POST /api/tasks (create)
- PUT /api/tasks/{id} (update)
- DELETE /api/tasks/{id} (delete)

Use Form Requests for validation.
Follow Laravel conventions.
Use context7 MCP to fetch latest Laravel docs.
```

### Frontend Agent (`frontend-ui-ux`)

**Best for:** UI components, React/Tailwind, design systems.

```
Using frontend-ui-ux:

Build a responsive dashboard card component:

Requirements:
- Use shadcn/ui as base
- Responsive at all breakpoints
- Show: title, value, trend icon, sparkline
- Support dark mode
- Use Tailwind utilities

Use ui-ux-pro-max skill for design tokens.
Reference: ui-ux-pro-max/data/styles.csv for color palette.
```

### QA Agent (`qa-guardian`)

**Best for:** Testing, code review, security audits.

```
Using qa-guardian:

Create a comprehensive test plan for the authentication system:

- Unit tests for JWT generation/validation
- Integration tests for login/logout flows
- Security tests for token expiration and refresh
- Performance tests for concurrent logins

Use the testing-strategy skill to define the test matrix.
Use sqlite MCP for test data generation.
```

### Leadership Agents (`lead-strategist`, `lead-architect`)

**Best for:** Architecture decisions, project planning, coordination.

```
Using lead-architect:

Design the architecture for a real-time notification system with:

- WebSocket server (backend-api)
- Frontend integration (frontend-ui-ux)
- Scalability considerations (support 10k concurrent users)
- Error handling strategy (reconnection, message queuing)
- Use sequential-thinking MCP for trade-off analysis.

Output: Architecture document with diagrams and implementation phases.
```

---

## 🛠️ Using Skills in Prompts

Skills provide specialized capabilities. Mention them explicitly for best results.

### Laravel Feature Scaffolding

```
Use the laravel-feature-scaffold skill to create a complete CRUD feature for:

- Product management
- Include: routes, controller, form requests, model, policy, views, tests
- Follow Laravel and Livewire patterns
- Use sqlite MCP to generate test data
```

### React Reuse Audit

```
Use the react-reuse-audit skill to analyze the src/components directory:

- Identify duplicate code patterns
- Suggest component extraction opportunities
- Recommend hook abstractions
- Provide a refactoring plan with parallel_groups for independent refactoring tasks
```

### UI/UX Design

```
Use the ui-ux-pro-max skill with data from:

- ui-ux-pro-max/data/styles.csv for color palette
- ui-ux-pro-max/data/typography.csv for font tokens
- ui-ux-pro-max/data/ui-reasoning.csv for UX patterns

Create a design system for the settings page.
Use parallel_groups to generate multiple variants simultaneously.
```

---

## 🔄 Multi-Agent Workflow Prompts

### Feature Development Workflow

```
Trigger the feature-development workflow for "User Profile Management":

ANALYZE: Review current user model and auth system (use context7 MCP)
PLAN: Design profile fields, routes, and UI (use sequential-thinking MCP)
DELEGATE (with features):
  - backend-laravel: Create migration, model, controller
    (use agent-router for auto-routing)
  - frontend-ui-ux: Build profile form and display pages
    (use parallel_groups for independent components)
  - qa-guardian: Write tests and review code
    (use retry_policy: 3 attempts with exponential backoff)
SYNTHESIZE: Combine results and update documentation (use memory MCP)
VERIFY: Run full test suite and manual testing (track metrics in sqlite MCP)

Exit criteria: All tests pass AND code coverage >80%
```

### Bug Fix Workflow

```
Trigger the bug-fix workflow for "Login fails with valid credentials":

1. qa-guardian: Reproduce and isolate the issue
   (use sequential-thinking MCP for root cause analysis)
2. core-factory: Analyze auth flow and identify root cause
   (use memory MCP to check previous similar issues)
3. backend-laravel: Implement the fix
   (use retry_policy: max_attempts: 3, backoff: linear)
4. qa-guardian: Write regression tests
   (use sqlite MCP for test data)
5. qa-guardian: Code review and security check
   (use security scanning feature for vulnerability detection)

Performance tracking: Store time_to_fix in sqlite MCP.
```

---

## 🔍 Ambient LSP Feedback

**New:** OpenCode now automatically detects syntax errors after file edits and injects them into the model's context.

### How It Works

```
1. You: "edit file X"
   ↓
2. tool.execute.after hook fires
   ↓
3. Run quick syntax check (php -l, tsc --noEmit, biome check, cargo check)
   ↓
4. Errors captured and stored per-session
   ↓
5. Next chat turn: errors injected into model instructions
   ↓
6. Model sees: "⚠️ X.ts: error TS2304: Cannot find name 'foo'"
   ↓
7. Model self-corrects in the same turn
```

### Supported Checkers

| Extension  | Checker                | Speed  |
| ---------- | ---------------------- | ------ |
| `.php`     | `php -l`               | ~50ms  |
| `.ts/.tsx` | `tsc --noEmit`         | ~2-5s  |
| `.js/.jsx` | `npx biome check`      | ~1-3s  |
| `.rs`      | `cargo check`          | ~5-15s |
| `.vue`     | `npx tsc --noEmit`     | ~2-5s  |
| `.svelte`  | `npx svelte-check`     | ~2-5s  |
| `.py`      | `python -m py_compile` | ~100ms |

### Tips

- **Fast checks** (`.php`, `.py`) inject in the **same turn** via `output.result`
- **Slower checks** (`.ts`, `.rs`) queue async and inject in the **next turn** via `output.instructions`
- **Deduplication**: Same error suppressed if repeated within 30 seconds
- **Race-safe**: Pending checks are awaited before flushing diagnostics

---

## 📚 Best Practices

### 1. Use the Golden Structure

Always provide: Context + Task + Format + Tools.

### 2. Leverage Agent Routing

```
# Let the system decide
Ask lead-strategist: "Which agent should handle Laravel authentication?"
→ Returns: 🎯 Recommended Agent: **backend-laravel** (score: 8)

# Or use the tool directly
Use route_agent tool with task: "optimize database queries"
```

### 3. Use Skills Explicitly

```
Use the laravel-feature-scaffold skill to...
Use the ui-ux-pro-max skill with...
Use the testing-strategy skill to...
```

### 4. Enable Advanced Features

```
Tools:
- Use agent-router to auto-route tasks
- Use parallel_groups for independent tasks
- Use retry_policy: 3 attempts with exponential backoff
- Use mcp_tools: context7, sqlite, memory, sequential-thinking
- Use performance tracking in sqlite MCP
- Use security scanning for sensitive phases
```

### 5. Reference Rules and Docs

```
Follow rules/laravel.md and rules/laravel-boost.md.
Use context7_resolve-library-id + context7_query-docs for up-to-date Laravel docs.
```

### 6. Monitor and Iterate

```
Track metrics in sqlite MCP:
- time_to_complete
- success_rate
- token_usage
- code_coverage
```

---

## 🎯 Complete Example: Full Feature Request

```
/agent lead-strategist

I need to implement a "Task Management" feature. Please coordinate the full workflow:

REQUIREMENTS:
- Users can create, edit, delete tasks
- Tasks have: title, description, due date, priority, status
- Filter tasks by status and priority
- Sort by due date

WORKFLOW (ANALYZE→PLAN→DELEGATE→SYNTHESIZE→VERIFY):

Phase 1: ANALYZE (lead-strategist + context7 MCP + memory MCP)
Phase 2: PLAN (sequential-thinking MCP)
Phase 3: DELEGATE:
  - backend-laravel: Migration, model, controller, Form Requests
    (use laravel-feature-scaffold skill, retry_policy: 3)
  - frontend-ui-ux: TaskList, TaskForm, TaskFilter components
    (use ui-ux-pro-max skill, parallel_groups)
  - qa-guardian: Pest tests + Vitest tests + security audit
    (use testing-strategy skill, sqlite MCP)
Phase 4: SYNTHESIZE (memory MCP)
Phase 5: VERIFY (sqlite MCP metrics, security scanning)

Exit criteria: All tests pass AND coverage >80% AND no critical issues
```

---

> [!TIP]
> The more context and features you mention, the better the agents can help you. Don't hesitate to break complex tasks into smaller, manageable steps with parallel_groups and retry_policy.

> [!NOTE]
> Ambient LSP Feedback is now live — if you edit a file with a syntax error, the model will see and fix it automatically in the next turn.
