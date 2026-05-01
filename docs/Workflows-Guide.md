# ⚡ Workflows Guide

Workflows are automated, multi-agent sequences defined as YAML files in the `workflows/` directory, managed via the `workflow-manager` skill.

---

## 🏃 Using Workflows

Workflows are triggered by delegating to the `lead-orchestrator` agent, which uses the Task tool for SubAgent delegation following the ANALYZE→PLAN→DELEGATE→SYNTHESIZE→VERIFY pattern.

Predefined workflows:

- `workflows/feature-development.yaml`: Full feature development lifecycle
- `workflows/bug-fix.yaml`: End-to-end bug resolution

---

## 🏗️ Core Workflows

### 1. `feature-development`

**Phases**:

- **Strategy**: `lead-product-manager`, `lead-orchestrator`, `lead-architect` define requirements and architecture.
- **Design**: `frontend-ui-ux`, `backend-api`, `lead-architect` create UI/UX and API contracts.
- **Implementation**: `core-builder`, `backend-laravel`, `backend-api` execute changes with LSP validation.
- **Quality Assurance**: `qa-tester`, `qa-reviewer`, `qa-security` run tests and audits.
- **Documentation**: `docs-writer`, `docs-governor`, `docs-evolver` update guides and evolve the system.

### 2. `bug-fix`

**Phases**:

- **Triage & Reproduction**: `qa-debugger`, `lead-orchestrator` reproduce bugs via `agent-browser` skill.
- **Fix Implementation**: `core-builder`, `backend-api`, `frontend-ui-ux` implement fixes with regression tests.
- **Verification**: `qa-tester`, `qa-reviewer`, `qa-debugger` validate fixes and check for regressions.
- **Documentation**: `docs-writer`, `lead-product-manager` update release notes and troubleshooting guides.

---

## 🛠️ How it Works: Workflow Manager Skill

The `workflow-manager` skill (`skills/workflow-manager/SKILL.md`) handles:

- Qwen-inspired task scheduling with dependency management
- SubAgent delegation via the Task tool
- Integration with sequential-thinking MCP for planning
- Context packaging and result synthesis

---

## ✍️ Creating Custom Workflows

Workflows are defined as YAML files in `workflows/`. Register them in `skills/index.json` under the `workflow-manager` entry.

Example `workflows/deploy.yaml`:

```yaml
name: Deployment Preparation
version: 1.0.0
phases:
  - name: Audit
    agents: [qa-security]
    tasks: [scan_for_credentials, check_vulnerabilities]
  - name: Build
    agents: [core-builder]
    tasks: [run_npm_build, report_warnings]
  - name: Documentation
    agents: [docs-governor]
    tasks: [update_changelog]
```

---

## 💡 Pro Tips

- **Checkpointing**: The `memory` MCP server persists workflow state across sessions.
- **Parallel Execution**: Use the Task tool to launch independent SubAgents simultaneously.
- **Tool Access**: Workflows have full access to all configured MCP tools and skills.

---

> [!NOTE]
> Workflows leverage OpenCode's multi-agent architecture to turn manual prompt sequences into reliable, automated processes.
