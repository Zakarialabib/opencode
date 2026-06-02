---
name: git-workflow
displayName: Git Workflow
description: Branching, rebasing, commit hygiene, and review-friendly history for agency delivery.
version: 1.0.0
category: foundation
tags:
  - git
  - branching
  - commits
  - pull-request
agents:
  - architect
  - developer
  - qa-devops
  - strategist
  - cto-governance
  - tpm-orchestrator
  - lead-backend
  - lead-frontend
  - lead-qa
  - dev-backend
  - dev-frontend
  - dev-devops
  - dev-qa
  - dev-docs
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
