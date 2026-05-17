---
name: Spec-Driven Design
description: Formal specification and design-first development workflow. Use when building features, APIs, or UI components that require structured requirements before implementation.
allowed-tools: Read,Write,Edit,Glob,Grep,Bash,Skill
---

# Spec-Driven Design Skill

Use this skill when the user requests:

- "Design a feature" or "Create a spec"
- "Define the API contract"
- "Write specifications for..."
- "What are the requirements for..."
- "Build according to spec"
- Any work that starts with planning before coding

## Workflow

### Phase 1: Analysis

1. Clarify the problem statement and scope
2. Identify stakeholders and use cases
3. Determine constraints (tech stack, performance, security)

### Phase 2: Specification

1. Generate SPEC.md using the structure below
2. For UI/UX: Use `ui-ux-pro-max` skill for design tokens and patterns
3. For API: Define contracts with clear input/output schemas
4. Include acceptance criteria upfront

### Phase 3: Review

1. Present spec to user for approval
2. Iterate based on feedback
3. Lock spec before implementation

### Phase 4: Implementation

1. Build according to locked spec
2. Verify each acceptance criterion
3. Document any deviations

## Spec Structure

```markdown
# Feature Name

## Problem

What problem does this solve?

## Scope

- In: [what's included]
- Out: [what's excluded]

## Use Cases

1. [primary use case]
2. [secondary]

## Technical Design

### Data Model

\`\`\`typescript
// schema
\`\`\`

### API Contract

\`\`\`
POST /endpoint
Input: { ... }
Output: { ... }
\`\`\`

### UI Specification (if applicable)

Reference `ui-ux-pro-max` skill for design tokens

## Acceptance Criteria

- [ ] Criterion 1
- [ ] Criterion 2

## Risks

- [Risk]: [Mitigation]
```

## Integration

This skill integrates with other skills for specialized domains:

| Domain             | Skill to Load                             |
| ------------------ | ----------------------------------------- |
| UI/Visual Design   | `ui-ux-pro-max`                           |
| Visual Foundations | `visual-design-foundations`               |
| Charts/Data Viz    | `charts`                                  |
| Database Design    | (skill not available — use fullstack-dev) |
| API Contracts      | `fullstack-dev`                           |
| Testing Strategy   | `testing-strategy`                        |
| Laravel            | `laravel-feature-scaffold`                |

## Usage

```bash
# Start a spec-driven feature
/spec-driven-design
Design a user authentication flow with OAuth

# Design an API
/spec-driven-design
Create API spec for a billing service

# UI component spec
/spec-driven-design
Design a dashboard component with charts
```
