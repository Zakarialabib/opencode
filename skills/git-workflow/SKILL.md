---
name: git-workflow
description: Branching, rebasing, commit hygiene, and review-friendly history for agency delivery.
compatibility: opencode
metadata:
  audience: developers
  workflow: git
---

# Git Workflow

Use this skill when you need disciplined version control behavior across delivery streams.

## Core Rules

- Keep branches small and purpose-built.
- Prefer descriptive commit messages with a single concern per commit.
- Rebase or merge consciously, based on the repo's current release flow.
- Avoid mixing unrelated work in the same branch unless the user asked for a bundle.
- Treat `git status` and `git diff` as the first check before and after edits.

## Outputs

- Clean branch plan
- Commit sequence recommendation
- Review notes for PR readiness
