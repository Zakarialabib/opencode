# 💬 Prompting Guide

Master the art of prompting OpenCode's 10 configured agents, 16 skills, and workflow orchestration features for maximum productivity.

---

## 📋 Table of Contents

1. [Prompting Basics](#prompting-basics)
2. [Agent-Specific Prompts](#agent-specific-prompts)
3. [Using Skills in Prompts](#using-skills-in-prompts)
4. [Multi-Agent Workflow Prompts](#multi-agent-workflow-prompts)
5. [Advanced Features](#advanced-features)
6. [Common Patterns](#common-patterns)
7. [Pro Tips](#pro-tips)

---

## 🎯 Prompting Basics

Every prompt should include: **Context + Task + Format**.

### The Golden Structure

```
[Context: Stack, constraints, relevant files]
[Task: What you want done]
[Format: How you want the result]
[Tools: Features to use - agent-router, parallel_groups, etc.]
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

### Core Agents (core-factory)

**Best for:** Implementation, strategic planning

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

### Backend Agents (backend-laravel, backend-api, backend-tauri)

**Best for:** Server-side logic, APIs, Tauri backend

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

### Frontend Agents (frontend-ui-ux)

**Best for:** UI components, React/Tailwind, design systems

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

### QA Agents (qa-guardian)

**Best for:** Testing, code review, security audits

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

### Leadership Agents (lead-strategist, lead-architect)

**Best for:** Architecture decisions, project planning, coordination

```
Using lead-architect:

Design the architecture for a real-time notification system with:

- WebSocket server (backend-api)
- Frontend integration (frontend-ui-ux)
- Scalability considerations (support 10k concurrent users)
- Error handling strategy (reconnection, message queuing)
- Use sequential-thinking MCP for trade-off analysis

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

### Documentation Governance

```
Use the docs-governance-audit skill to audit the docs/ folder:

- Check for outdated documentation (compare with code)
- Identify missing docs for new features
- Find inconsistencies with current codebase
- Generate a governance report with improvement priorities
- Use memory MCP to persist audit results
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

## 🚀 Advanced Features

### 1. Using Agent Router in Prompts

```
Using lead-strategist:

Execute the feature-development workflow with agent-router enabled:

Task: "Add user authentication"
→ Phase 1: Strategy & Analysis (auto-routed to lead-strategist)
→ Phase 2: Design & Planning (auto-routed to lead-architect)
→ Phase 3: Implementation (auto-routed to backend-laravel)
→ Phase 4: QA & Security (auto-routed to qa-guardian)
→ Phase 5: Documentation (auto-routed to docs-curator)

Check routing scores: Use route_agent tool to see agent scores.
```

### 2. Parallel Execution with parallel_groups

```
Using lead-strategist:

Implement the notification system with parallel execution:

parallel_groups:
  - [backend-api_task, frontend-ui-ux_task, qa-guardian_task]

All three tasks run simultaneously:
- backend-api: Implement notification API
- frontend-ui-ux: Build notification UI
- qa-guardian: Prepare test data and test cases

Synthesize results when all tasks complete (use task_id tracking).
```

### 3. Retry Policies for Resilience

```
Using qa-guardian:

Run flaky tests with retry policy:

retry_policy:
  max_attempts: 3
  backoff: exponential  # or linear

Test execution:
1. Run test suite
2. If failure AND attempts < 3:
   - Wait (backoff: 1s, 2s, 4s for exponential)
   - Retry test
3. If success OR max_attempts reached:
   - Report final result

Track retry metrics in sqlite MCP (performance feature).
```

### 4. MCP Integration in Prompts

```
Using lead-strategist:

Execute workflow with declarative MCP tool usage:

phases:
  - name: Strategy & Analysis
    mcp_tools:
      context7: [fetch_library_docs]
      memory: [create_entities, add_observations]
      sequential-thinking: [sequentialthinking]

  - name: Implementation
    mcp_tools:
      sqlite: [execute_query]  # For test data
      git: [check_diff]  # For change tracking

Prompt: "Use context7 MCP to fetch React docs, then use memory MCP to store the results."
```

### 5. Performance Tracking

```
Using devops-engineer:

Track workflow performance metrics:

performance:
  track_metrics: [time_to_complete, success_rate, token_usage]
  store_metrics_in: sqlite MCP

Before workflow:
- Record baseline metrics (build time, test coverage)
- Store in sqlite MCP

After workflow:
- Compare final vs baseline (sqlite MCP query)
- Generate performance report
- Use memory MCP to persist improvement trends
```

### 6. Security Scanning

```
Using qa-guardian:

Run security audit with automated scanning:

security:
  scan_on_phases: [Implementation, Verification]
  fail_on: [critical, high]

Scan process:
1. Scan for SQL injection vulnerabilities
2. Check for XSS vulnerabilities
3. Verify authentication & authorization
4. If critical/high issues found: Fail phase
5. Use git MCP to check commit history for security patches
```

---

## 📚 Common Patterns

### Code Review Request

```
Using qa-guardian, review the recent changes in pull request #123:

- Check code style against rules/laravel.md
- Verify TypeScript types are correct (use context7 MCP for docs)
- Ensure tests cover new functionality
- Look for security vulnerabilities (use security scanning feature)
- Provide a detailed review with line-specific comments

Output format: Markdown table with file, line, issue, severity.
```

### Refactoring Task

```
Using core-factory, refactor the authentication system:

- Extract auth logic into a service class
- Use dependency injection for better testability
- Follow the repository pattern for user data access
- Update all imports and usages
- Run linter and tests after changes

Use features:
- parallel_groups for independent refactoring tasks
- retry_policy: 3 attempts if tests fail
- memory MCP to store refactoring patterns
- sqlite MCP to track improvement metrics
```

### Documentation Update

```
Using docs-curator, update the API documentation:

- Scan all API endpoints in routes/api.php
- Generate OpenAPI specification (use context7 MCP for OpenAPI 3.0 docs)
- Update docs/api.md with new endpoints
- Add examples for each endpoint
- Verify all parameters are documented
- Use memory MCP to track documentation versions

Output: Updated docs/api.md + OpenAPI spec in docs/openapi.yaml.
```

### Performance Optimization

```
Using lead-architect and frontend-ui-ux:

Analyze and optimize the dashboard page performance:

1. Profile with React DevTools (simulate)
2. Identify unnecessary re-renders
3. Implement memoization with React.memo
4. Lazy load heavy components
5. Optimize bundle size

Use features:
- Use parallel_groups for steps 3, 4, 5
- Track time_to_optimize in sqlite MCP (performance feature)
- Use memory MCP to store optimization patterns
- Use react-reuse-audit skill for component analysis
```

---

## 💡 Pro Tips

1. **Use Thinking Blocks**: Agents use `<thinking>` blocks for reasoning - let them think!
2. **Reference Rules**: Mention specific rules files (e.g., "Follow rules/laravel.md")
3. **Specify Output Format**: "Provide the result as a Markdown table"
4. **Iterate**: If the first result isn't perfect, ask for refinements
5. **Use /commands**: Leverage built-in commands like `/build`, `/test`, `/lint`
6. **Features**: Explicitly mention features in prompts:
   - "Use agent-router to auto-route tasks"
   - "Use parallel_groups for independent tasks"
   - "Use retry_policy with 3 attempts"
   - "Track metrics in sqlite MCP"
   - "Enable security scanning for this phase"
7. **MCP Integration**: Reference specific MCP tools:
   - "Use context7 MCP to fetch React docs"
   - "Store results in memory MCP"
   - "Generate test data with sqlite MCP"
   - "Use sequential-thinking MCP for analysis"

---

## 🎓 Example: Complete Feature Request

```
/agent lead-strategist

I need to implement a "Task Management" feature. Please coordinate the full workflow:

REQUIREMENTS:
- Users can create, edit, delete tasks
- Tasks have: title, description, due date, priority, status
- Filter tasks by status and priority
- Sort by due date

WORKFLOW:
1. lead-strategist: Define detailed requirements (use memory MCP to store)
2. lead-architect: Design database schema and API contracts (use context7 MCP for Laravel docs)
3. backend-laravel:
   - Create migration for tasks table
   - Build TaskController with CRUD
   - Define API routes
   - Add Form Requests for validation
   (Use laravel-feature-scaffold skill)
   (Use retry_policy: max_attempts: 3)
4. frontend-ui-ux:
   - Create TaskList, TaskForm, TaskFilter components
   - Use shadcn/ui and Tailwind
   - Implement state management with zustand
   (Use ui-ux-pro-max skill for design tokens)
   (Use parallel_groups for independent components)
5. qa-guardian:
   - Write Pest tests for backend (use sqlite MCP for test data)
   - Write Vitest tests for frontend
   - Perform security audit (use security scanning feature)
   (Use testing-strategy skill)
6. docs-curator: Update API docs and user guide
   (Use memory MCP to persist documentation versions)
   (Track time_to_complete in sqlite MCP - performance feature)

Use the ANALYZE→PLAN→DELEGATE→SYNTHESIZE→VERIFY pattern with enhancements:
- ANALYZE: context7 MCP + memory MCP
- PLAN: sequential-thinking MCP
- DELEGATE: agent-router + parallel_groups + retry_policy
- SYNTHESIZE: memory MCP
- VERIFY: sqlite MCP (metrics) + security scanning

Exit criteria: All tests pass AND code coverage >80% AND no critical/high security issues
```

---

## 🛠️ CLI Prompts for Improving OpenCode

Copy and paste these prompts directly into the OpenCode CLI (`opencode web` or `npm start`) to improve OpenCode itself.

### 📋 Quick Improvements (Copy-Paste Ready)

#### 1. Optimize Agent Configuration

```bash
Using lead-strategist:

Analyze and optimize the agent configuration in opencode.json:

Context:
- Config file: opencode.json
- Current agents: 10 agents defined
- Goal: Improve task routing accuracy and response time

Task: Analyze agent-tool assignments and suggest optimizations

Steps (workflow):
1. ANALYZE: Read opencode.json and analyze agent configurations (use context7 MCP for docs)
2. PLAN: Identify misaligned tool assignments (use sequential-thinking MCP)
3. DELEGATE:
   - agent-router: Check routing scores for each agent (use parallel_groups)
   - model-router: Verify model assignments are optimal (retry_policy: 3 attempts)
4. SYNTHESIZE: Combine findings into optimization plan (use memory MCP to store)
5. VERIFY: Apply top 3 high-confidence changes and test (track metrics in sqlite MCP)

Output: Optimized opencode.json with before/after comparison.
Use exit_criteria: "all_agents_optimized AND routing_score_improved".
```

#### 2. Enhance Plugin Performance

```bash
Using lead-architect:

Improve the plugin system performance:

Context:
- Plugins directory: plugins/
- Current plugins: 10 plugins (agent-router, model-router, mcp-manager, etc.)
- Performance issue: Some plugins slow to load

Task: Analyze and optimize plugin loading and execution

Steps:
1. Use mcp-manager tool to check all MCP server health
2. Analyze plugin hooks in index.ts (use context7 MCP for TypeScript docs)
3. Identify bottlenecks:
   - Slow MCP server connections
   - Blocking hook executions
   - Redundant API calls
4. Apply optimizations:
   - Add timeouts to slow operations (use parallel_groups for testing)
   - Implement caching for repetitive checks
   - Use retry_policy: max_attempts: 3, backoff: exponential
5. Track improvements in sqlite MCP (performance feature):
   - plugin_load_time
   - hook_execution_time
   - mcp_connection_time

Output: Performance report with metrics stored in sqlite MCP.
```

#### 3. Improve Documentation Consistency

```bash
Using docs-curator:

Audit and improve all documentation in docs/:

Context:
- Docs folder: docs/ (7 markdown files)
- Check for: outdated examples, broken links, inconsistent formatting

Task: Full documentation audit and improvement

Steps (with agent-router):
1. Use agent-router to auto-route tasks:
   - docs-curator: Audit markdown files (use memory MCP to store findings)
   - lead-strategist: Check code examples against actual code (use context7 MCP)
   - qa-guardian: Verify formatting consistency (use parallel_groups)
2. For each doc:
   - Check all code examples work (retry_policy: 3 attempts)
   - Verify features are documented (use sequential-thinking MCP)
   - Fix broken internal links
3. Generate improvement report:
   - Use memory MCP to read all findings
   - Synthesize into prioritized action list
   - Store in sqlite MCP for tracking
4. Apply fixes:
   - Update outdated sections
   - Add missing features
   - Fix all broken links
5. VERIFY: Re-audit to ensure 100% compliance

Exit criteria: "all_docs_compliant AND zero_broken_links".
```

---

> \[!TIP]
> The more context and features you mention, the better the agents can help you. Don't hesitate to break complex tasks into smaller, manageable steps with parallel_groups and retry_policy.

---

### 🎯 Complete Example: Full System Optimization

Copy this entire prompt into the CLI for a complete OpenCode optimization:

```bash
/agent lead-strategist

Execute a full OpenCode optimization workflow:

## CONTEXT
- Project root: C:\opencode\
- Config: opencode.json (10 agents, 10 plugins, 9 MCP servers)
- Docs: docs/ (7 files)
- Workflows: workflows/ (2 files)
- Current model: opencode-go/kimi-k2.6

## TASK
Perform a complete system optimization including:
1. Agent configuration optimization
2. Plugin performance improvement
3. Documentation consistency audit
4. Workflow schema enhancement

## APPROACH (ANALYZE→PLAN→DELEGATE→SYNTHESIZE→VERIFY)

### PHASE 1: ANALYZE (Strategy & Analysis)
- Use agent-router for auto-routing to lead-strategist
- Use context7 MCP to fetch latest OpenCode documentation
- Use memory MCP to read previous optimization attempts
- Analyze opencode.json, plugins/, docs/, workflows/
- Output: Analysis report with improvement opportunities

### PHASE 2: PLAN (Design & Planning)
- Use sequential-thinking MCP for trade-off analysis
- Create optimization plan with workstreams:
  1. Agent optimization (use parallel_groups for independent agents)
  2. Plugin tuning (use retry_policy: 3 attempts)
  3. Docs audit (use mcp_tools: memory, context7)
  4. Workflow enhancement (use security scanning, notifications)
- Output: Detailed plan with dependencies mapped

### PHASE 3: DELEGATE (Implementation)
Execute all workstreams with features:

**Workstream 1: Agent Optimization**
- Task: backend-laravel, "Optimize agent-tool assignments in opencode.json"
- Use agent-router for auto-routing
- Use parallel_groups for independent agent optimizations
- Use retry_policy: max_attempts: 3, backoff: exponential

**Workstream 2: Plugin Performance**
- Task: core-factory, "Analyze and optimize all plugins in plugins/"
- Use mcp-manager tool to check MCP server health
- Use sqlite MCP to store performance baselines
- Apply optimizations and measure improvements

**Workstream 3: Documentation Audit**
- Task: docs-curator, "Audit and update all docs in docs/"
- Use memory MCP to store audit findings
- Use parallel_groups to audit multiple files simultaneously
- Fix all issues and verify with qa-guardian

**Workstream 4: Workflow Enhancement**
- Task: lead-strategist, "Enhance feature-development.yaml and bug-fix.yaml"
- Add notifications to all phases
- Enable security scanning on Implementation phases
- Add full performance tracking (time_to_complete, success_rate, token_usage)
- Store metrics in sqlite MCP

### PHASE 4: SYNTHESIZE (Combine Results)
- Use memory MCP to read all workstream results
- Combine optimizations into unified opencode.json
- Generate comprehensive improvement report:
  - Before/after metrics (from sqlite MCP)
  - Applied changes with rationale
  - Remaining opportunities
- Store final configuration

### PHASE 5: VERIFY (Quality Gates)
- Run /doctor to verify config health
- Test all workstreams:
  - Agent routing accuracy (use route_agent tool to check)
  - Plugin performance (measure with sqlite MCP)
  - Docs compliance (re-audit with docs-curator)
  - Workflow execution (run feature-development workflow)
- Use security scanning for critical components
- If all gates pass: DONE
- Else: Return to Phase 3 for failing workstreams (use retry_policy)

## EXIT CRITERIA
"all_workstreams_complete AND config_health>95% AND performance_improved AND docs_compliant"

## PERFORMANCE TRACKING
Track all metrics in sqlite MCP:
- time_to_optimize (per workstream)
- success_rate (per workstream)
- token_usage (total)
- config_health_improvement (%)
- plugin_performance_improvement (%)

## NOTIFICATIONS
Message: "OpenCode optimization complete! Health: 95%+, Performance: +20%"
```

---

### 💡 Tips for CLI Prompting

1. **Start with** **`/agent <name>`** to select the right agent
2. **Use keywords** in your prompts:
   - "use agent-router"
   - "use parallel_groups"
   - "use retry_policy: 3 attempts"
   - "track metrics in sqlite MCP"
   - "enable security scanning"
3. **Reference specific files** with full paths (e.g., `C:\opencode\opencode.json`)
4. **Mention MCP tools** explicitly (e.g., "use context7 MCP to fetch docs")
5. **Set exit criteria** for loops and workflows
6. **Use the Task tool** for delegating to SubAgents with task_id tracking

---

> \[!TIP]
> All prompts above are **copy-paste ready**! Just select the prompt, copy it, paste into the OpenCode CLI, and watch the magic happen.YU
