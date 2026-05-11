---
name: dynamic-workflow
description: Generates workflow YAML on-the-fly for any task using phase templates and keyword analysis. Eliminates the need for pre-defined templates.
trigger: /generate-workflow [task description] or "generate a workflow for [task]"
allowed_tools: Bash(workflow-engine:*), Read(opencode.json), Read(workflows/*.yaml), Write(workflows/auto/*)
---

# Dynamic Workflow Generator

This skill automatically generates valid workflow YAML files based on task description, using a library of reusable phase templates.

## Core Concept

1. **Parse task keywords** → Identify task type (CRUD, refactor, audit, optimize, etc.)
2. **Select phase templates** → Choose from predefined phase library
3. **Assemble workflow** → Combine phases with dependencies
4. **Validate** → Ensure all agents/MCPs exist
5. **Execute** → Run the generated workflow

## Usage

```bash
/generate-workflow "Refactor the auth system to use JWT instead of sessions"
```

Output:

```
Generated: workflows/auto/refactor-auth-jwt-20260508-143022.yaml
Phases: 6 (Strategy → Design → Backend → Frontend → Migration → QA)
```

## Keyword Task Type Mapping

| Task Keywords                  | Task Type | Default Phases                                 |
| ------------------------------ | --------- | ---------------------------------------------- |
| add, create, new feature       | CREATE    | Strategy → Design → Implementation → QA → Docs |
| modify, update, change         | UPDATE    | Strategy → Implementation → QA → Docs          |
| delete, remove, cleanup        | DELETE    | Strategy → Verification → QA → Docs            |
| refactor, rewrite, restructure | REFACTOR  | Analysis → Implementation → QA                 |
| fix, bug, error, issue         | FIX       | Triage → Fix → Verification → Docs             |
| audit, review, scan, check     | AUDIT     | Analysis → Audit → Report                      |
| optimize, improve, performance | OPTIMIZE  | Analysis → Implementation → Benchmark → QA     |
| test, coverage                 | TEST      | Setup → Tests → Coverage Report                |
| migrate, migrate data          | MIGRATE   | Analysis → Migration → Verification            |
| deploy, release, publish       | DEPLOY    | Build → Test → Deploy → Verify                 |

## Phase Templates Library

### Strategy / Analysis Phase

```yaml
- name: Strategy & Analysis
  description: Analyze requirements and create technical plan
  agents: [lead-strategist, lead-architect]
  use_agent_router: true
  mcp_tools:
    context7: [fetch_library_docs]
    memory: [create_entities]
    sequential-thinking: [sequentialthinking]
  exit_criteria:
    - requirements.md exists and is complete
```

### Design / Planning Phase

```yaml
- name: Design & Planning
  description: Premium UI/UX design and API contracts
  agents: [frontend-ui-ux, backend-api, lead-architect]
  use_agent_router: true
  mcp_tools:
    context7: [fetch_library_docs]
    sqlite: [read_query]
  dependencies: [Strategy & Analysis]
```

### Implementation Phase

```yaml
- name: Implementation
  description: Core development with LSP context
  agents: [core-factory, backend-laravel]
  use_agent_router: true
  mcp_tools:
    context7: [fetch_library_docs]
    git: [add, commit]
    filesystem: [read_file, write_file]
  dependencies: [Design & Planning]
```

### QA / Verification Phase

```yaml
- name: Quality Assurance
  description: Testing, security, and performance validation
  agents: [qa-guardian]
  mcp_tools:
    git: [diff, log]
    sequential-thinking: [sequentialthinking]
  dependencies: [Implementation]
```

### Documentation Phase

```yaml
- name: Documentation
  description: Technical documentation and updates
  agents: [docs-curator]
  mcp_tools:
    memory: [create_entities, search_nodes]
    git: [add, commit]
```

## MCP Server Requirements

Add MCP requirements based on task keywords:

| Task Keyword             | Required MCP Servers |
| ------------------------ | -------------------- |
| database, query, sql     | sqlite               |
| git, commit, branch      | git                  |
| web, api, http           | fetch                |
| docs, library, reference | context7             |
| remember, recall         | memory               |
| analyze, think           | sequential-thinking  |

## Workflow Generation Process

### Step 1: Parse Task

Extract keywords from task description:

- "Refactor the auth system to use JWT" → [refactor, auth, JWT]

### Step 2: Select Task Type

Match keywords to task type:

- refactor → REFACTOR

### Step 3: Select Phase Templates

From task type, select default phases:

- REFACTOR → [Analysis, Implementation, QA]

### Step 4: Customize Phases

For JWT auth refactor, enhance the phases:

- Add: database MCP to Implementation (for token storage)
- Add: security to QA phase

### Step 5: Validate

- Check all referenced agents exist in opencode.json
- Check all MCP servers are enabled
- Check for circular dependencies

### Step 6: Generate YAML

Output to: `workflows/auto/[slug]-[timestamp].yaml`

## Constraint Engine

### Agent Availability Check

```typescript
function validateAgents(agents: string[]): boolean {
  const opencode = JSON.parse(readFile("opencode.json"));
  const validAgents = Object.keys(opencode.agent);
  return agents.every((a) => validAgents.includes(a));
}
```

### MCP Server Check

```typescript
function validateMCP(servers: string[]): boolean {
  const opencode = JSON.parse(readFile("opencode.json"));
  const validMCP = Object.keys(opencode.mcp);
  return servers.every((s) => validMCP.includes(s));
}
```

### Circular Dependency Check

```typescript
function checkCircularDeps(phases): boolean {
  const visited = new Set();
  const deps = phases.map((p) => p.dependencies || []).flat();
  // DFS to detect cycles
}
```

## Example Generated Workflow

Input: "Refactor the auth system to use JWT instead of sessions"

Output: `workflows/auto/refactor-auth-jwt-20260508.yaml`

```yaml
name: JWT Auth Refactor
description: Refactor auth system to use JWT instead of sessions
version: 2.0.0
trigger: auto-generated

mcp_servers:
  - context7
  - sqlite
  - git
  - filesystem

phases:
  - name: Analysis
    agents: [lead-architect]
    tasks: [analyze_current_auth, identify_token_handling]
    mcp_tools:
      context7: [fetch_library_docs]
      memory: [search_nodes]

  - name: Implementation
    agents: [backend-laravel, core-factory]
    tasks: [implement_jwt_middleware, create_token_service, update_login_controller]
    mcp_tools:
      sqlite: [write_query, read_query]
      git: [commit]
    dependencies: [Analysis]

  - name: Frontend Update
    agents: [frontend-ui-ux]
    tasks: [update_auth_context, add_token_to_storage]
    mcp_tools:
      context7: [fetch_library_docs]
    dependencies: [Implementation]

  - name: QA
    agents: [qa-guardian]
    tasks: [run_auth_tests, verify_token_expiry, security_scan]
    mcp_tools:
      git: [diff]
    dependencies: [Frontend Update]
```

## Performance Metrics

Store workflow execution metrics in SQLite:

```sql
CREATE TABLE generated_workflows (
  timestamp TEXT,
  task_type TEXT,
  phases_count INT,
  agents_used TEXT,
  execution_time_seconds REAL,
  success BOOLEAN,
  error_message TEXT
);
```

## Best Practices

1. **Start Simple**: Complex workflows still use basic phase templates
2. **Validate Early**: Check agents/MCPs before generating
3. **Track Metrics**: Store success/failure for learning
4. **Reuse Phases**: Build phase library over time
5. **Fallback**: If generation fails, use feature-development.yaml

## Fallback Behavior

If dynamic generation fails:

1. Log error to memory MCP
2. Fall back to `feature-development.yaml` or `bug-fix.yaml`
3. Notify user: "Using template workflow due to generation failure"
