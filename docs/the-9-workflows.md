# Workflows Guide — the 9 yaml files

Some tasks are too choreographed for freeform delegation. That's what workflows are for. A workflow is a yaml file in `workflows/` that defines a sequence of phases, each with agents, MCP tools, parallel groups, and exit criteria.

I started with one workflow (`feature-development.yaml`) and added the others when I noticed I was doing the same multi-step dance by hand. Now there are 9.

---

## the 9, grouped

### feature work (2)

| Workflow | What it choreographs |
| --- | --- |
| `feature-development.yaml` | The full feature lifecycle: strategy → design → implement → QA → docs. 5 phases, parallel where possible. The big one. |
| `refactor.yaml` | Plans a refactor, identifies risks, executes in waves, rolls back if regressions. |

### quality work (2)

| Workflow | What it choreographs |
| --- | --- |
| `bug-fix.yaml` | Root cause analysis → fix → regression test → perf check. Includes browser test via `agent-browser`. |
| `code-review.yaml` | Multi-pass review: security + quality + style in parallel. Produces CRITICAL/WARNING/INFO report. |

### operations (2)

| Workflow | What it choreographs |
| --- | --- |
| `incident-response.yaml` | The outage playbook: detect → triage → mitigate → postmortem. |
| `android-build-test-deploy.yaml` | Android pipeline: build → lint → test → emulator → deploy. |

### docs (1)

| Workflow | What it choreographs |
| --- | --- |
| `documentation.yaml` | Gap discovery → auto-generation → audit → update knowledge base. |

### agency lifecycle (3)

| Workflow | What it choreographs |
| --- | --- |
| `lifecycle-discovery.yaml` | The "kicking off a new project" dance: research → specs → first agents. |
| `lifecycle-build.yaml` | The "we're building it now" dance: sprint cycles + ceremonies. |
| `lifecycle-release.yaml` | The "shipping it" dance: smoke → docs → changelog → release. |

### ceremony (1)

| Workflow | What it choreographs |
| --- | --- |
| `sprint-ceremony.yaml` | Standup + retro + planning. The weekly ritual. |

There's also `workflows/self-improvement.md` (not yaml) — a markdown playbook for the self-improvement cycle. Lives in the same folder for discoverability.

---

## how to trigger a workflow

Three ways, in the order I use them:

### 1. ask `lead-strategist` (the default)

```
Ask lead-strategist: "Add user authentication feature"
```

`lead-strategist` matches the request to a workflow, reads the yaml, runs the phases. The `workflow-router` plugin does the matching automatically.

### 2. use the `workflow-manager` skill

```
Ask lead-strategist: "Use workflow-manager skill to develop feature X"
```

Same thing, but explicit about the skill. Useful when the auto-routing picks the wrong workflow.

### 3. call it by name

```
/workflow-start feature-development
```

The `/workflow-start` slash command is registered in `opencode.json`. Bypasses the router.

---

## what a workflow file looks like

Here's `feature-development.yaml` abridged:

```yaml
name: feature-development
version: 2.0.0
description: Full feature development lifecycle

phases:
  - name: Strategy & Analysis
    agents: [lead-strategist, software-architect, core-factory]
    use_agent_router: true
    mcp_tools:
      context7: [fetch_library_docs]
      memory: [create_entities, search_nodes]
      sequential-thinking: [sequentialthinking]
    parallel_groups:
      - [research_auth_methods, analyze_existing_patterns]
    exit_criteria:
      - requirements.md exists
      - architecture.md exists
      - roadmap.json exists

  - name: Design & Planning
    agents: [frontend-ui-ux, software-architect, backend-laravel]
    mcp_tools:
      context7: [fetch_library_docs]
      sqlite: [read_query]
      sequential-thinking: [sequentialthinking]
    parallel_groups:
      - [design_ui, define_api]
      - [create_schema, plan_components]
    exit_criteria:
      - api-spec.yaml exists
      - ui-mockups/ exists
      - schema.sql exists

  - name: Implementation
    agents: [core-factory, backend-laravel, backend-tauri, frontend-ui-ux, software-architect]
    mcp_tools: { context7: [...], sqlite: [...], git: [...], filesystem: [...] }
    parallel_groups:
      - [implement_backend, implement_api]
      - [implement_frontend, setup_migrations]
    retry_policy: { max_attempts: 3, backoff: exponential }
    exit_criteria:
      - all tests pass
      - no LSP errors

  - name: Quality Assurance & Security
    agents: [qa-guardian]
    parallel_groups:
      - [run_tests, browser_test]
      - [security_scan, check_secrets]
    exit_criteria:
      - coverage > 80%
      - no critical issues

  - name: Documentation & Evolution
    agents: [docs-curator]
    exit_criteria:
      - docs/ updated
      - changelog.md updated
```

That's the whole pattern. **Phases → agents + MCP + parallel groups + exit criteria.** Anything more complex is two workflows.

---

## the schema, field by field

| Field | Type | Required | What it means |
| --- | --- | --- | --- |
| `name` | string | yes | Unique identifier |
| `version` | string | yes | Schema version, currently `2.0.0` |
| `description` | string | yes | One line, shown in `workflow_list` |
| `phases` | array | yes | Ordered list of phase definitions |
| `phases[].name` | string | yes | Phase name, shown in logs |
| `phases[].agents` | array | yes | Which agents participate |
| `phases[].use_agent_router` | bool | no | Let the router pick the best agent per sub-task |
| `phases[].mcp_tools` | object | no | MCP servers and tools to enable |
| `phases[].parallel_groups` | array | no | Lists of sub-tasks that can run concurrently |
| `phases[].retry_policy` | object | no | `{ max_attempts, backoff }` |
| `phases[].exit_criteria` | array | no | Files / conditions that must be true to advance |
| `phases[].notifications` | object | no | Webhook / email / chat on phase complete |

---

## parallel groups, the part that actually saves time

This is where the leverage is. If a phase has 2 independent sub-tasks, you can run them in parallel:

```yaml
parallel_groups:
  - [design_ui, define_api]        # both run at the same time
  - [create_schema, plan_components]  # both run after the first group
```

The orchestrator runs group 1, waits for both, runs group 2, waits for both, advances. The wall-clock time is the slowest sub-task in each group, not the sum.

I use parallel groups for:

- `[research_X, analyze_Y]` — two independent investigations
- `[implement_backend, implement_frontend]` — clear separation
- `[run_tests, browser_test]` — tests can run independently

I avoid parallel groups when:

- The sub-tasks share files
- One sub-task's output is another's input
- The order matters for understanding the diff

---

## exit criteria, the part that prevents sloppy shipping

A phase doesn't advance until its exit criteria are met. Three forms:

```yaml
# 1. file existence
exit_criteria:
  - api-spec.yaml exists
  - schema.sql exists

# 2. test result (via the integration-test agent)
exit_criteria:
  - all tests pass
  - coverage > 80%

# 3. external check
exit_criteria:
  - qa-guardian reports 0 CRITICAL
```

The orchestrator checks these. If they fail, the phase retries per `retry_policy` or surfaces the failure.

---

## how to add a workflow

```bash
touch workflows/my-workflow.yaml
```

```yaml
name: my-workflow
version: 2.0.0
description: One line, what it does

phases:
  - name: Do the thing
    agents: [core-factory]
    mcp_tools: { context7: [fetch_library_docs] }
    exit_criteria:
      - result.md exists
```

That's a valid workflow. It'll be discovered by the `workflow-router` and listed in `workflow_list`.

---

## the rules I follow

1. **Phases are sequential. Sub-tasks are parallel.** A workflow is a sequence of phases; each phase can have parallel sub-tasks. Don't try to make phases parallel — it doesn't work.
2. **Exit criteria are concrete.** `tests pass` is a wish. `npm test exits 0` is a criterion. Use what the integration-test agent can verify.
3. **Agents, not skills, in the `agents` field.** Skills are loaded by agents as needed. Don't list them in the workflow — they'll be loaded automatically.
4. **MCP tools per phase.** Don't enable all MCP tools for all phases. Only enable what the phase needs. Saves context, reduces noise.
5. **Version the workflow.** When you change a workflow meaningfully, bump the version. The router can route by version if needed.

---

## what to read next

- **The agents** that these workflows coordinate — [the-19-agents.md](the-19-agents.md)
- **The plugins** that route and execute workflows — [the-11-plugins.md](the-11-plugins.md)
- **The improvement cycle** — a workflow that improves workflows — [the-improvement-cycle.md](the-improvement-cycle.md)
