# ⚡ Workflows Guide

Workflows are automated, multi-agent sequences defined as YAML files in the `workflows/` directory, managed via the `workflow-manager` skill. Workflows integrate with the **agent-router plugin** for intelligent task-to-agent routing, leverage **MCP servers** for enhanced capabilities, and include advanced features like parallel execution, retry policies, and notification hooks.

---

## 🚀 Using Workflows

Workflows are triggered by delegating to the `lead-strategist` agent, which uses the Task tool for SubAgent delegation following the ANALYZE→PLAN→DELEGATE→SYNTHESIZE→VERIFY pattern with intelligent agent routing.

### Starting a Workflow

```bash
# Method 1: Direct delegation to lead-strategist
Ask lead-strategist: "Add user authentication feature"

# Method 2: Use agent-router to find the best agent
Ask: "Which agent handles workflow management?"
→ Returns: 🎯 Recommended Agent: **lead-strategist**
Then: Ask lead-strategist to start the workflow

# Method 3: Use workflow-manager skill directly
Ask lead-strategist: "Use workflow-manager skill to develop feature X"
→ Uses feature-development.yaml
→ Enables agent-router for all phases
→ Integrates MCP tools (context7, memory, sequential-thinking, git, sqlite)
```

### Available Workflows

| Workflow                             | Description                        | Key Features                                                           |
| ------------------------------------ | ---------------------------------- | ---------------------------------------------------------------------- |
| `workflows/feature-development.yaml` | Full feature development lifecycle | Parallel execution, MCP integration, retry policies, notifications     |
| `workflows/bug-fix.yaml`             | End-to-end bug resolution          | Root cause analysis, agent-browser integration, performance monitoring |
| `workflows/code-review.yaml`         | Automated code review              | Quality checks, security scan, actionable recommendations              |
| `workflows/documentation.yaml`       | Documentation generation & audit   | Gap discovery, auto-generation, quality audit, knowledge base updates  |

> [!NOTE]
> These workflows reference the full 10-agent setup configured in `opencode.json`. Customize agent assignments as needed.

---

## 🏗️ Core Workflows

### 1. `feature-development.yaml`

**Phases** (with intelligent agent routing and MCP integration):

| Phase                            | Agents                                                                           | MCP Tools                                  | Parallel Groups                                                            | Exit Criteria                                  |
| -------------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------ | -------------------------------------------------------------------------- | ---------------------------------------------- |
| **Strategy & Analysis**          | lead-strategist, software-architect, core-factory                                | context7, memory, sequential-thinking      | No                                                                         | requirements.md, architecture.md, roadmap.json |
| **Design & Planning**            | frontend-ui-ux, software-architect, backend-laravel                              | context7, sqlite, sequential-thinking      | [design_ui, define_api], [create_schema, plan_components]                  | api-spec.yaml, ui-mockups/, schema.sql         |
| **Implementation**               | core-factory, backend-laravel, backend-tauri, frontend-ui-ux, software-architect | context7, sqlite, git, filesystem          | [implement_backend, implement_api], [implement_frontend, setup_migrations] | All tests pass, no LSP errors                  |
| **Quality Assurance & Security** | qa-guardian                                                                      | context7, sqlite, git, sequential-thinking | [run_tests, browser_test], [security_scan, check_secrets]                  | >80% coverage, no critical issues              |
| **Documentation & Evolution**    | docs-curator                                                                     | context7, memory, git                      | No                                                                         | docs/ updated, changelog.md                    |

**Advanced Features**:

- `use_agent_router: true` in all phases for intelligent routing
- `retry_policy`: max_attempts: 3, backoff: exponential
- `notifications`: on_start, on_phase_complete, on_complete, on_failure
- `mcp_integration`: context7, memory, sequential-thinking, git, sqlite, filesystem

### 2. `bug-fix.yaml`

**Phases** (with enhanced orchestration):

| Phase                       | Agents                                                            | MCP Tools                                              | Parallel Groups                                                  | Exit Criteria                                     |
| --------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------ | ---------------------------------------------------------------- | ------------------------------------------------- |
| **Triage & Analysis**       | qa-guardian, lead-strategist, core-factory                        | context7, fetch, memory, sequential-thinking, git      | No                                                               | bug-report.md, root-cause.md with >80% confidence |
| **Fix Implementation**      | core-factory, software-architect, frontend-ui-ux, backend-laravel | context7, sqlite, git, filesystem, sequential-thinking | [implement_fix, update_docs], [write_tests, add_edge_cases]      | Fix addresses root cause, all tests pass          |
| **Verification & Testing**  | qa-guardian                                                       | context7, sqlite, git, sequential-thinking, fetch      | [run_tests, visual_verify], [security_scan, accessibility_check] | >80% coverage, performance within SLA             |
| **Documentation & Closure** | docs-curator, lead-strategist                                     | context7, memory, git                                  | No                                                               | changelog.md, troubleshooting.md updated          |

**Advanced Features**:

- `performance` tracking: time_to_triage, time_to_fix, time_to_verify, regression_count
- `security` scanning: scan_on_phases: [Fix Implementation, Verification & Testing]
- `error_handling`: strategy: continue-on-non-critical, fallback_agent: qa-guardian
- `agent_routing`: enabled: true, scoring_weights: keyword_match: 2, skill_match: 3

---

## 🛠️ How it Works: Workflow Manager Skill

The `workflow-manager` skill (`skills/workflow-manager/SKILL.md`) handles:

- Task scheduling with dependency management
- SubAgent delegation via the Task tool
- Integration with **sequential-thinking MCP** for planning phases
- Context packaging and result synthesis
- Integration with **agent-router** for intelligent agent selection per phase
- Integration with **MCP servers** (context7, memory, sqlite, git, fetch, filesystem) for enhanced capabilities
- **Parallel execution groups** for independent tasks
- **Retry policies** with exponential backoff and fallback agents
- **Notification hooks** for stakeholder communication
- **Performance monitoring** and metrics tracking

### Workflow Pattern

```
ANALYZE   → Understand request, identify components (uses context7 MCP, agent-router for best agent)
   ↓
PLAN      → Decompose into subtasks with dependencies (uses sequential-thinking MCP, memory MCP for persistence)
   ↓
DELEGATE  → Launch SubAgents in parallel via Task tool (uses agent-router for agent selection, parallel_groups for independent tasks)
   ↓
MONITOR   → Track SubAgent progress via task_id, retry on failure (uses retry_policy)
   ↓
SYNTHESIZE → Combine results into unified solution (uses memory MCP for state)
   ↓
VERIFY    → Fresh SubAgent for review/validation (uses qa-guardian)
   ↓
NOTIFY    → Stakeholder communication (uses notifications hooks, git MCP for tagging)
```

---

## ✍️ Creating Custom Workflows

Workflows are defined as YAML files in `workflows/` using the v2.0.0 schema. Register them in `skills/index.json` under the `workflow-manager` entry.

### Example `workflows/deploy.yaml`:

```yaml
name: Deployment Preparation
description: Advanced deployment workflow with audit, build, and monitoring
version: 2.0.0
trigger: manual

mcp_servers: [context7, memory, git, filesystem, sqlite]
env:
  NODE_ENV: production

phases:
  - name: Audit & Security
    agents: [qa-guardian, core-factory]
    use_agent_router: true
    tasks: [scan_for_credentials, check_vulnerabilities, audit_dependencies]
    artifacts: [security-audit.md, dependency-report.json]
    mcp_tools:
      context7: [fetch_library_docs]
      git: [log, diff]
    exit_criteria:
      - No critical/high security issues
      - dependency-report.json generated

  - name: Build & Test
    agents: [core-factory, qa-guardian]
    tasks: [run_npm_build, run_test_suite, generate_build_artifacts]
    dependencies: [Audit & Security]
    parallel_groups:
      - [run_npm_build, run_test_suite]
    mcp_tools:
      filesystem: [read_file, write_file]
      sqlite: [read_query]
    retry_policy:
      max_attempts: 2
      backoff: linear
    exit_criteria:
      - Build successful
      - All tests pass (>80% coverage)

  - name: Stage Deployment
    agents: [devops-engineer, lead-strategist]
    tasks: [deploy_to_staging, verify_deployment, run_smoke_tests]
    dependencies: [Build & Test]
    mcp_tools:
      git: [tag, push]
      fetch: [fetch_markdown]
    exit_criteria:
      - Staging deployment successful
      - Smoke tests pass

  - name: Production Deployment
    agents: [devops-engineer]
    tasks: [deploy_to_production, monitor_metrics, update_documentation]
    dependencies: [Stage Deployment]
    mcp_tools:
      git: [tag, push]
      memory: [create_entities]
    notifications:
      on_start:
        - notify: [devops-team, stakeholders]
        - channel: slack
      on_complete:
        - update: status-page
        - notify: [all-stakeholders]
    exit_criteria:
      - Production deployment successful
      - Metrics within SLA
      - Documentation updated

success_criteria:
  - All phases completed successfully
  - No security vulnerabilities
  - All tests pass
  - Deployment successful to production
  - Documentation updated

error_handling:
  strategy: fail-fast
  max_retries_per_task: 2
  fallback_agent: devops-engineer

agent_routing:
  enabled: true
  scoring_weights:
    keyword_match: 2
    skill_match: 3
```

### Advanced Features in v2.0.0

```yaml
# Parallel execution groups
parallel_groups:
  - [task_a, task_b] # These run in parallel
  - [task_c, task_d] # These also run in parallel

# Retry policies
retry_policy:
  max_attempts: 3
  backoff: exponential # or linear
  retry_on: [test_failure, timeout]
  fallback_agent: qa-guardian

# Notification hooks
notifications:
  on_start:
    - notify: [team-lead]
    - channel: slack
  on_phase_complete:
    - log_to: memory MCP
  on_complete:
    - update: project-portal
    - generate: release-notes.md
  on_failure:
    - alert: [oncall-engineer]
    - escalate_to: lead-strategist

# Performance monitoring
performance:
  track_metrics: [deployment_time, test_duration, rollback_count]
  store_metrics_in: sqlite MCP
  generate_report: performance-report.md
```

---

## 💡 Pro Tips

### Workflow Design Best Practices

1. **Use Agent Router**: Set `use_agent_router: true` in phases for intelligent agent selection
2. **Define Exit Criteria**: Clear exit criteria ensure phase completion quality
3. **Leverage Parallel Groups**: Identify independent tasks and run them in parallel
4. **Configure Retry Policies**: Handle transient failures gracefully with exponential backoff
5. **Integrate MCP Tools**: Use MCP tools for documentation, state, testing, and version control
6. **Set Up Notifications**: Keep stakeholders informed at each stage
7. **Track Metrics**: Use sqlite MCP to track workflow performance over time
8. **Version Your Workflows**: Use semantic versioning (e.g., 2.0.0) for workflow YAML files
9. **Monitor Performance**: Track time_to_complete, success_rate, rollback_count
10. **Implement Security Scanning**: Enable security scanning in sensitive phases

### MCP Servers in Workflows

| MCP Server            | When to Use                       | Example Workflow Phase        | Tools Used                               |
| --------------------- | --------------------------------- | ----------------------------- | ---------------------------------------- |
| `context7`            | Research, documentation, API docs | Strategy, Design, QA          | fetch_library_docs, search_documentation |
| `sqlite`              | Database operations, test data    | Implementation, QA            | read_query, write_query                  |
| `sequential-thinking` | Complex planning, analysis        | Plan, Verify                  | sequentialthinking                       |
| `memory`              | State persistence, history        | All phases                    | create_entities, add_observations        |
| `fetch`               | Web research, API calls           | Triage, Research              | fetch_markdown, fetch_html               |
| `git`                 | Version control operations        | Implementation, Documentation | add, commit, push, tag                   |
| `filesystem`          | File operations                   | Implementation, Documentation | read_file, write_file                    |

---

## 🔗 Integration with Agent Router, Plugins & Skills

Workflows seamlessly integrate with the agent routing system, MCP plugins, and skill ecosystem:

### Workflow + Agent Router

```
User: "Add authentication feature"
→ lead-strategist: Uses workflow-manager skill
→ workflow-manager: Creates phases with use_agent_router: true
→ Phase1 (Strategy): route_agent tool → Recommends core-factory
→ Phase2 (Design): route_agent tool → Recommends software-architect
→ Phase3 (Implementation): route_agent tool → Recommends backend-laravel
→ Phase4 (QA): route_agent tool → Recommends qa-guardian
→ Result: Each phase uses the best agent automatically with scoring
```

### Workflow + MCP Manager & Tools

```
Before workflow starts:
→ mcp-manager plugin: mcp_list tool → Verify all needed servers enabled
→ mcp-manager plugin: mcp_check tool → Check server health
→ Workflow executes with all MCP servers available:

Phase1: Uses context7 MCP (fetch_library_docs), memory MCP (create_entities)
Phase2: Uses sequential-thinking MCP (sequentialthinking), sqlite MCP (read_query)
Phase3: Uses git MCP (add, commit), filesystem MCP (read_file, write_file)
Phase4: Uses sqlite MCP (read_query), context7 MCP (fetch_library_docs)
```

### Workflow + Skill Manager & Skills

```
During workflow:
→ skill-manager plugin: skill_search tool → Find relevant skills
→ Agents automatically load skills assigned to them:
  - backend-laravel: laravel-feature-scaffold, security-review
  - qa-guardian: testing-strategy, agent-browser
  - docs-curator: deep-research, docs-governance-audit
→ Result: Each agent has the right skills for their tasks
```

---

## 🚀 Running Workflows

### Method 1: Direct Delegation

```bash
Ask lead-strategist: "Use workflow-manager to develop feature X"
→ Loads feature-development.yaml
→ Enables agent-router for all phases
→ Integrates MCP tools per phase
→ Runs with parallel execution, retry policies, notifications
```

### Method 2: Specific Workflow

```bash
Ask lead-strategist: "Run bug-fix workflow for issue #123"
→ Loads bug-fix.yaml
→ Triage phase: qa-guardian + agent-browser + fetch MCP
→ Fix phase: core-factory + backend-laravel + git MCP
→ Verify phase: qa-guardian + sqlite MCP
→ Document phase: docs-curator + memory MCP + git MCP
```

---

> [!NOTE]
> Workflows leverage OpenCode's multi-agent architecture, intelligent agent routing, advanced MCP integrations, parallel execution groups, retry policies, notification hooks, performance monitoring, and security scanning to turn manual prompt sequences into reliable, automated processes.

---

## 📚 Related Documentation

| Document                                                                          | Description                                | Key Topics                                       |
| --------------------------------------------------------------------------------- | ------------------------------------------ | ------------------------------------------------ |
| [**Agent Router**](Plugins-Guide.md#1-agent-routerts---intelligent-agent-routing) | Intelligent task-to-agent routing plugin   | route_agent, auto_route, scoring weights         |
| [**MCP Manager**](Plugins-Guide.md#3-mcp-manager-ts---mcp-server-management)      | MCP server health and toggle management    | mcp_list, mcp_check, mcp_toggle                  |
| [**Skill Manager**](Plugins-Guide.md#4-skill-manager-ts---skill-registry-access)  | Skill registry access and search           | skill_list, skill_info, skill_search             |
| [**Workflow Manager Skill**](Skills-Guide.md#workflow-manager)                    | Task scheduling skill                      | ANALYZE→PLAN→DELEGATE→SYNTHESIZE→VERIFY          |
| [**Task Tool**](Agents-Guide.md#integration-with-task-tool)                       | SubAgent delegation for parallel execution | task_id tracking, parallel groups                |
| [**Agent Guide**](Agents-Guide.md)                                                | Complete agent reference                   | 10 configured agents, agent-router integration   |
| [**Skills Guide**](Skills-Guide.md)                                               | 16 registered skills with MCP integration  | stack-context, testing-strategy, security-review |
