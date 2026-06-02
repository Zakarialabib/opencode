---
name: testing-basics
displayName: Testing Basics
description: Unit, integration, and regression testing fundamentals for reliable delivery.
version: 1.0.0
category: foundation
tags:
  - tests
  - regression
  - unit
  - integration
agents:
  - core-factory
  - qa-guardian
  - backend-laravel
  - frontend-ui-ux
---

# Testing Basics

Use this skill when a change needs test coverage, repro steps, or a simple verification plan.

## Core Rules

- Add a regression test for every bug fix when practical.
- Match the test type to the behavior being changed.
- Keep assertions specific enough to catch regressions without overspecifying internals.
- Treat failed or skipped tests as active risk.

## Outputs

- Test plan
- Regression coverage notes
- Verification checklist
