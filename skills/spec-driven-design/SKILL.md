---
name: spec-driven-design
description: "Agency delivery methodology: spec-first → architect → build → verify. Use on every client feature, API, or UI component."
license: MIT
compatibility: opencode
metadata:
  audience: all-agents
  workflow: delivery
---

# Spec-Driven Design — Agency Delivery Methodology

> **Principle:** Every client deliverable starts with a spec. No code without an approved specification.

## When to Use

- Any feature, API, UI component, or integration for a client project
- Before delegating to `core-factory` or `backend-*` agents
- When estimating effort or defining scope
- When the requirements are ambiguous or incomplete

## Workflow

### Phase 1: Discovery & Analysis

1. Clarify the **problem statement** and business goal
2. Identify **users, roles, and workflows**
3. Document **constraints**: stack, performance, security, budget
4. Research existing solutions or patterns using `deep-research` / `web-search`
5. Produce a **one-pager** (100-200 words max) summarizing the scope

### Phase 2: Specification

1. Generate a structured `SPEC.md` in `<project-root>/docs/specs/<feature-name>.md`
2. Include:
   - **Overview**: What and why
   - **Requirements**: Functional + non-functional
   - **Architecture**: Components, data flow, stack decisions
   - **API Contracts**: Request/response schemas (if applicable)
   - **UI Specs**: Reference `ui-ux-pro-max` for design tokens
   - **Database Changes**: Reference `database-design` for migrations
   - **Acceptance Criteria**: Checklist format, testable
   - **Open Questions**: Anything unresolved
3. For UI features: Load `ui-ux-pro-max` skill for design tokens and component specs
4. For API features: Define contracts with explicit TypeScript/PHP types

### Phase 3: Review & Lock

1. Present spec to **lead-architect** or **lead-strategist** for sign-off
2. Iterate on feedback — spec is a living doc until locked
3. Once locked: create implementation tickets for each sub-task
4. Delegate sub-tasks to specialized agents via `task` tool

### Phase 4: Implementation & Verification

1. Build each sub-task according to locked spec
2. Verify each acceptance criterion — automated tests preferred
3. Document any deviations in an `ADR` (Architecture Decision Record)
4. Update `project-memory` with new patterns learned

## Spec Template

```markdown
# Feature: [Name]

## Problem
[What business problem does this solve?]

## Requirements
- [ ] [Functional requirement 1]
- [ ] [Functional requirement 2]
- [ ] [Non-functional: performance, security, accessibility]

## Architecture
[High-level diagram or component breakdown]

## API Contracts (if applicable)
```typescript
// Request
interface CreateFooRequest { ... }
// Response
interface FooResponse { ... }
```

## Database Changes
[Tables, columns, migrations needed]

## UI Specs
[Component tree, states (loading/empty/error/edge), responsive breakpoints]

## Acceptance Criteria
- [ ] [Criterion 1]
- [ ] [Criterion 2]

## Open Questions
- [ ] [Unresolved item]
```

## Quality Gates

Before marking a spec as "ready for implementation":

| Gate | Check |
|------|-------|
| Requirements | Every requirement is testable (not vague) |
| Architecture | Stack-appropriate, follows existing patterns |
| API | Request/response fully typed |
| UI | States defined: loading, empty, error, edge cases |
| DB | Migrations are reversible |
| Security | No auth bypass, input sanitized |
| Effort | Implementation effort estimated (hours/days) |

## Agent Handoff

| Phase | Lead Agent | Supporting Skills |
|-------|-----------|-------------------|
| Discovery | lead-strategist | deep-research, web-search |
| Specification | lead-architect | database-design, ui-ux-pro-max |
| Review | lead-strategist | — |
| Implementation | core-factory | coding-agent, laravel-feature-scaffold, pest-testing |
| Verification | qa-guardian | testing-strategy, agent-browser, security-review |
