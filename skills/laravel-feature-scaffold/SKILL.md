---
name: laravel-feature-scaffold
description: Scaffold Laravel features with consistent structure across routes, controllers, form requests, actions/services, models, policies, API resources, migrations, and tests. Use when adding a new Laravel feature, CRUD flow, endpoint, admin module, or refactor target that should follow clean Laravel layering instead of ad hoc file creation.
---

# Laravel Feature Scaffold

## Overview

Use this skill to turn a feature request into a Laravel implementation plan or scaffold shape that stays aligned with common Laravel layering.

Prefer generating the smallest set of files that produces a clean flow from route to validation to domain logic to response and tests.

## Workflow

1. Identify the feature boundary.
2. Decide whether it is web, API, admin, background, or mixed.
3. Map the request to the minimum Laravel layers needed.
4. Propose file names before writing code when the feature spans many files.
5. Keep controller code thin and move business logic into actions or services when logic is non-trivial.
6. Add validation and tests as part of the scaffold, not as an afterthought.

## Default File Set

For a standard CRUD or endpoint feature, prefer this shape:

- `routes/web.php` or `routes/api.php`
- controller
- form request for validation
- model updates only if the domain changes
- action or service if logic is shared, branching, or side-effect heavy
- API resource if the response shape matters
- migration if schema changes
- feature test and targeted unit test when logic is extracted

## Decision Rules

### Use a form request when

- request validation is non-trivial
- authorization belongs with the request
- the controller would otherwise become noisy

### Use an action or service when

- logic will be reused
- the controller would contain branching, orchestration, or side effects
- the feature touches external APIs, jobs, events, or multiple models

### Use a policy when

- access rules are tied to a model or resource
- authorization is more than simple middleware

### Use an API resource when

- the response shape should be stable
- you need conditional fields or nested transforms
- you want presentation separated from persistence

## Scaffold Output Shape

When asked to scaffold, prefer answering in this order:

1. file plan
2. route shape
3. request fields and rules
4. controller method signatures
5. extracted service or action responsibilities
6. test list

## Guardrails

- Prefer Eloquent and framework conventions over custom abstraction for simple features.
- Do not create a service layer for trivial pass-through CRUD.
- Do not put validation logic inline in large controllers when a form request fits.
- Do not invent repositories unless the codebase already uses them.
- Keep naming conventional and discoverable.

## Prompt Patterns

- "Scaffold a Laravel feature for product categories with CRUD and policy checks."
- "Plan the files for a new API endpoint that creates invoices and dispatches a job."
- "Refactor this controller into request plus service plus tests."
