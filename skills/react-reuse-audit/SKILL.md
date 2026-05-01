---
name: react-reuse-audit
description: Audit a React or React-like frontend for reuse opportunities across components, hooks, state boundaries, async flows, and UI patterns. Use when planning refactors, reducing duplication, extracting shared UI, designing design-system candidates, or evaluating whether repeated code should become a component, hook, utility, or feature module.
---

# React Reuse Audit

## Overview

Use this skill to inspect repeated frontend patterns and convert them into a practical extraction plan instead of a vague "make it reusable" review.

## Audit Workflow

1. Find duplication in JSX, state handling, async handling, or styling patterns.
2. Group duplication by likely extraction target.
3. Score each extraction by impact, effort, and coupling risk.
4. Recommend the smallest high-value extractions first.
5. Name likely target files or module locations when the codebase structure is known.

## Extraction Targets

### Extract a component when

- markup and behavior repeat together
- the same UI appears in multiple screens
- props can express the variation more cleanly than copy-paste

### Extract a hook when

- state transitions, effects, or async flows repeat
- logic is reused across unrelated UI trees
- the shared part is behavioral, not presentational

### Extract a utility when

- the reused code is pure logic or formatting
- React lifecycle is not involved
- testability improves by moving it out of components

### Extract a feature module when

- several components, hooks, and services belong to one domain
- cross-file coupling is already high
- the problem is organization, not just duplication

## Reuse Smells

- repeated loading, error, and empty states
- repeated modal or form shells
- repeated fetch-and-transform logic
- repeated table or card layouts with minor variants
- prop drilling that suggests shared state boundaries
- many similarly named components with copy-pasted structure

## Output Format

Prefer this response order:

1. highest-value reuse candidates
2. recommended extraction type for each candidate
3. risks or reasons not to extract yet
4. a phased refactor order
5. test implications if extraction happens

## Guardrails

- Do not extract abstractions only because code looks similar once.
- Prefer stable duplication over speculative abstraction.
- Avoid creating shared components that take too many boolean props.
- If duplication hides real domain differences, keep modules separate.
- Suggest co-location when extraction would worsen discoverability.

## Prompt Patterns

- "Audit this React feature for reusable components and hooks."
- "Find duplication across these dashboard screens and rank extraction opportunities."
- "Should these three modal flows become one shared component or stay separate?"
