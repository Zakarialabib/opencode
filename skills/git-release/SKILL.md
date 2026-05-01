---
name: git-release
description: Create consistent releases and changelogs for Laravel and PHP projects
license: MIT
compatibility: opencode
metadata:
  audience: maintainers
  workflow: github
  language: php
---

## What I do
- Draft release notes from merged PRs and conventional commits
- Propose semantic version bumps (major.minor.patch)
- Generate copy-pasteable `gh release create` commands
- Create Laravel-specific changelog entries

## When to use me
Use this when preparing a tagged release for a Laravel/PHP project.
Ask clarifying questions if the target versioning scheme is unclear.

## Workflow
1. Check recent commits since last tag
2. Categorize changes (features, fixes, breaking)
3. Suggest version bump
4. Draft release notes
5. Provide release command