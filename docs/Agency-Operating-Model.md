# Agency Operating Model

This repository now supports a hierarchical, RACI-aware OpenCode operating model for agency-style delivery. The model preserves existing agents and workflows while adding explicit roles, lifecycle workflows, gates, and governance rules.

## Topology

Executive tier:

- `cto-governance`: technology standards, ADR approval, stack direction, production exceptions
- `pm-portfolio`: scope, backlog priority, PRDs, user value, release content
- `tpm-orchestrator`: sprint planning, dependencies, unblock escalation, delivery flow

Leadership tier:

- `lead-backend`: API contracts, schema migrations, service boundaries
- `lead-frontend`: UI architecture, state patterns, accessibility, design-system coherence
- `lead-qa`: test strategy, coverage policy, release sign-off
- `lead-security`: threat models, auth flows, data handling, dependency risk
- `lead-data`: data models, analytics contracts, retention, reporting consistency

Execution tier:

- `dev-backend`, `dev-frontend`, `dev-devops`, `dev-qa`, `dev-docs`
- `core-factory`, `docs-curator`, `incident-responder`

## Lifecycle

Use `route_workflow` to select the right lifecycle workflow:

- `Lifecycle Discovery`: PRD, feasibility, ADR, threat model, sprint planning
- `Lifecycle Build`: implementation, code review, security review, E2E, performance validation
- `Lifecycle Release`: release notes, staging deploy, smoke tests, production release, monitoring
- `Incident Response`: severity classification, mitigation, hotfix routing, postmortem
- `Sprint Ceremony`: planning, unblock review, retrospective

## Gate Policy

Release gates:

1. `lsp-clean`
2. `tests-pass`
3. `security-scan`
4. `adr-compliance`
5. `pm-signoff`
6. `qa-signoff`
7. `cto-signoff` for major releases

Workflow phase gates declare required approvals and evidence. Use `validate_gate` to check readiness before moving to the next phase.

## ADR Policy

Create an ADR for significant schema, authentication, infrastructure, architectural, or service-boundary decisions. Use `draft_adr` to create a templated ADR under `docs/adr/`.

Required flow:

1. Domain lead drafts ADR.
2. Consulted roles add evidence and concerns.
3. `cto-governance` accepts, rejects, or requests changes.
4. Accepted ADRs become the source of truth for future implementation and review.

## Compatibility

Existing agent names remain in the repository for current workflows. The `agency.aliases` map in `opencode.json` documents the intended migration path from flat swarm names to agency roles.
