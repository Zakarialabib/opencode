---
name: docs-governance-audit
description: Audit a large project with a docs folder against the actual codebase to find drift, stale guidance, missing documentation, redundancy, deprecated patterns, architecture mismatches, and improvement opportunities. Use when maintaining big repos, validating whether docs still match code, building governance reports, or planning systematic cleanup and enhancement work.
---

# Docs Governance Audit

Use this skill to turn a large docs-heavy project into a governance workflow instead of a one-off review.

## Audit Goals

Find and prioritize:

- docs-to-code drift
- missing docs for important modules
- stale or contradictory guidance
- deprecated APIs or patterns still documented
- redundant code or duplicate docs
- modules that need refactor, consolidation, or modernization

## Workflow

1. Map the documentation surface.
2. Map the code surface relevant to those docs.
3. Cross-check claimed paths, modules, and behaviors.
4. Classify findings by severity and type.
5. Produce an execution order, not just a report.

## Recommended Finding Types

Use these buckets:

- `Drift`: docs say one thing, code does another
- `Gap`: important code exists but docs do not
- `Redundancy`: duplicate docs, duplicate code paths, or repeated guidance
- `Deprecation`: docs or code still rely on outdated patterns
- `Enhancement`: worthwhile improvement, but not necessarily broken
- `Keep`: good patterns that should remain unchanged

## Output Format

Prefer this structure:

1. scope reviewed
2. findings table
3. priority plan
4. specific docs/code updates to perform next

## Good Prompts

- "Use the docs-governance-audit skill to compare `docs/` with the current codebase and rank the top cleanup opportunities."
- "Audit this large project for doc drift, deprecated patterns, and redundancy."
- "Build a governance report for the docs folder versus implementation."
