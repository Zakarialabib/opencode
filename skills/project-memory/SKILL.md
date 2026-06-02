---
name: project-memory
description: "Cross-project conventions, architecture decisions, and pattern library for agency workflow consistency."
license: MIT
compatibility: opencode
metadata:
  audience: all-agents
  workflow: memory
---

# Project Memory — Agency Knowledge Management

> **Principle:** Every project is a learning opportunity. Capture decisions, patterns, and conventions so future work compounds.

## When to Use

- Starting a new client project
- After completing a major feature or milestone
- When discovering a reusable pattern or workaround
- When an architecture decision is made
- Before handing off to another agent or team member

## Knowledge Categories

### 1. Project Conventions

Track per-project:
- Stack versions (Laravel 13, React 19, Tailwind 4, etc.)
- Coding style preferences (PascalCase models, snake_case DB, etc.)
- Testing framework (Pest 4, Vitest, JUnit 5)
- CI/CD pipeline details
- Deployment targets and infrastructure

### 2. Architecture Decision Records (ADRs)

Each ADR captures:
- **Context**: Why was this decision needed?
- **Decision**: What was chosen?
- **Alternatives**: What was considered and rejected?
- **Consequences**: What does this mean for future work?

Store in `docs/adr/<project>/<YYYY-MM-DD>-<title>.md`

### 3. Pattern Library

Reusable solutions to common problems:
- Authentication flow (Laravel Sanctum + SPA)
- File upload pattern (signed URLs + S3)
- Real-time updates (Laravel Reverb + SSE)
- API versioning strategy
- Error handling convention

### 4. Client Preferences

Per-client notes:
- Stakeholder names and roles
- Preferred communication style
- Known pain points
- Decision-making process

## Workflow

### On Project Start

1. Create project context file: `docs/project-memory/<project-name>/README.md`
2. Document stack, conventions, and team structure
3. Record initial architecture decisions
4. Set up tracking for patterns as they emerge

### On Milestone Complete

1. Review what was learned during the milestone
2. Extract reusable patterns to the pattern library
3. Update ADRs if decisions changed
4. Record effort estimates vs actuals for future estimation

### On Agent Handoff

1. Summarize current state in `< 100 words`
2. Reference relevant ADRs and patterns
3. Flag any open decisions or blockers
4. Point to the most relevant files in the codebase

## Memory Structure

```
docs/project-memory/
└── <project-name>/
    ├── README.md          # Project overview, stack, conventions
    ├── stakeholders.md    # Client contacts, roles, preferences
    ├── decisions/         # ADRs
    │   ├── 2026-01-15-auth-strategy.md
    │   └── 2026-02-20-deployment-target.md
    └── patterns/          # Reusable solutions
        ├── api-error-handling.md
        └── file-upload.md
```

## Agent Roles

| Agent | Memory Responsibility |
|-------|----------------------|
| software-architect | ADRs, pattern definitions, architecture decisions |
| lead-strategist | Stakeholder info, project roadmap, scope decisions |
| core-factory | Implementation patterns, code conventions |
| docs-curator | Memory file maintenance, cross-project knowledge |
