---
name: workflow-manager
description: "Multi-step project delivery pipeline orchestration — decompose, delegate, verify, ship."
license: MIT
compatibility: opencode
metadata:
  audience: lead-strategist
  workflow: delivery
---

# Workflow Manager — Project Delivery Pipeline

> **Principle:** Every project is a pipeline of phases. Decompose complex work into parallel streams, delegate to specialized agents, verify at each gate.

## When to Use

- Starting a new client project or major feature
- Breaking down a complex task into sub-tasks
- Coordinating multiple agents on parallel workstreams
- Setting up CI/CD or delivery pipelines
- Project estimation and sprint planning

## Workflow

### Phase 1: Decompose

1. Take the project goal and break it into **independent workstreams**
2. Each workstream should map to one agent's expertise
3. Identify **dependencies** between workstreams (blocking relationships)
4. Estimate effort per workstream (hours/days)
5. Produce a **workflow DAG** (directed acyclic graph)

### Phase 2: Delegate

1. For each workstream, create a `task` with:
   - Target agent (core-factory, backend-laravel, frontend-ui-ux, etc.)
   - Clear brief referencing the spec
   - Success criteria (verifiable)
2. Run independent workstreams **in parallel** where possible
3. Sequential workstreams: chain with dependency tracking

### Phase 3: Verify

1. Each completed workstream triggers automated verification:
   - `pest-testing` or `testing-strategy` for test coverage
   - `security-review` for vulnerability scan
   - `agent-browser` for UI integration tests
2. Blocking issues: flag to lead-strategist immediately
3. All gates must pass before merge

### Phase 4: Ship

1. Generate release notes via `git-release`
2. Update `project-memory` with decisions and patterns
3. Produce client deliverable (docx, pdf, ppt as needed)
4. Tag release in git

## Workflow DAG Template

```
Project: [Name]
├── Phase 1: Foundation
│   ├── [ ] Database schema (→ backend-laravel)
│   ├── [ ] API contracts (→ backend-api)
│   └── [ ] UI component tree (→ frontend-ui-ux)
├── Phase 2: Core
│   ├── [→DB] Business logic (→ backend-laravel)
│   ├── [→API] API endpoints (→ backend-api)
│   └── [→UI] Screen implementation (→ frontend-ui-ux)
├── Phase 3: Integration
│   ├── [→Core] Integration tests (→ qa-guardian)
│   ├── [→Core] Security audit (→ qa-guardian)
│   └── [→Core] Performance benchmark (→ devops-engineer)
└── Phase 4: Delivery
    ├── [ ] Documentation (→ docs-curator)
    ├── [ ] Release (→ devops-engineer)
    └── [ ] Client handoff (→ lead-strategist)
```

## Agent Routing Matrix

| Task Type | Primary Agent | Backup Agent | Skills |
|-----------|--------------|--------------|--------|
| Backend API (Node) | backend-api | core-factory | — |
| Backend API (Laravel) | backend-laravel | core-factory | laravel-feature-scaffold, pest-testing |
| Frontend UI | frontend-ui-ux | core-factory | ui-ux-pro-max, visual-design-foundations |
| Mobile (Android) | android-kotlin | — | android, android-compose |
| Database | backend-laravel | lead-architect | database-design |
| Infrastructure | devops-engineer | — | git-release |
| Testing/QA | qa-guardian | — | testing-strategy, agent-browser, security-review |
| Documentation | docs-curator | — | pdf, docx, xlsx, ppt |
| Architecture | lead-architect | lead-strategist | spec-driven-design, knowledge-architect |
| Orchestration | lead-strategist | — | dynamic-workflow, self-improver |
