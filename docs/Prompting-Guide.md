# OpenCode Prompting Guide — All Case Scenarios

> **Version**: 2.0 (May 2026)
> **Stack**: Tauri (Rust) + React (TypeScript) + Laravel (PHP)
> **Reference**: [opencode.ai/docs](https://opencode.ai/docs)

---

## Table of Contents

1. [Agent Selection Quick Reference](#1-agent-selection-quick-reference)
2. [Basic Prompting Patterns](#2-basic-prompting-patterns)
3. [Feature Development](#3-feature-development)
4. [Bug Fixing](#4-bug-fixing)
5. [Refactoring](#5-refactoring)
6. [Code Review & Quality](#6-code-review--quality)
7. [Research & Learning](#7-research--learning)
8. [Testing](#8-testing)
9. [Documentation](#9-documentation)
10. [DevOps & Infrastructure](#10-devops--infrastructure)
11. [Cross-Stack Scenarios](#11-cross-stack-scenarios)
12. [Multi-Agent Orchestration](#12-multi-agent-orchestration)
13. [Self-Improvement & Evolution](#13-self-improvement--evolution)
14. [Edge Cases & Troubleshooting](#14-edge-cases--troubleshooting)
15. [Brain Plugin — RAG & Codebase Context](#15-brain-plugin--rag--codebase-context)
16. [Command Reference](#16-command-reference)
17. [Anti-Patterns to Avoid](#17-anti-patterns-to-avoid)

---

## 1. Agent Selection Quick Reference

### Decision Tree

```
What do you need to do?
│
├─ Write/change code
│  ├─ Building a new feature       → @build (core-factory)
│  ├─ Quick fix / small change     → @build
│  └─ Refactoring existing code    → @refactor-architect (plan) → @core-factory (implement)
│
├─ Plan / design
│  ├─ New feature architecture     → @lead-strategist
│  ├─ Technical decisions          → @lead-architect
│  └─ API contract design          → @lead-architect + @backend-api
│
├─ Explore / understand
│  ├─ "Where is X implemented?"    → @explore
│  ├─ "How does Y work?"           → @explore
│  └─ "Find all usages of Z"       → @explore
│
├─ Research
│  ├─ Best practices for X         → @research-analyst
│  ├─ Library comparison            → @scout
│  └─ Gap analysis                  → @research-analyst
│
├─ Review / test
│  ├─ Code quality audit           → @code-reviewer
│  ├─ Run tests                     → @integration-test
│  ├─ Security review              → @qa-guardian
│  └─ Full QA pass                 → @qa-guardian
│
├─ Documentation
│  ├─ Update docs                  → @docs-curator
│  ├─ Generate changelog           → @docs-evolver
│  └─ Write ADR                    → @docs-evolver
│
└─ Operations
   ├─ Database migrations          → @devops-engineer
   ├─ Build / deploy               → @devops-engineer
   └─ Dependency updates           → @devops-engineer
```

### Switch Between Agents

- **Tab key** in TUI: Cycle primary agents (build ↔ plan)
- **`@agent-name`** in chat: Invoke any subagent directly
- **`/switch agent-name`**: Change primary agent

---

## 2. Basic Prompting Patterns

### Pattern 1: Implement a Feature (Build Agent)

```
@build Implement user authentication middleware for the Tauri app.

Context:
- Stack: Tauri 2.x (Rust backend) + React frontend
- Need JWT-based auth with refresh tokens
- See existing pattern in src/auth/mod.rs for reference

Steps:
1. Read src/auth/mod.rs for current patterns
2. Create src/middleware/auth.rs with validate_token() function
3. Add Tauri command for login/logout
4. Wire up in main.rs

Constraints:
- Use thiserror for error types
- Return Result<T, String> for all commands
- Follow patterns in rules/tauri.md
```

### Pattern 2: Plan Before Building (Plan Agent)

```
@plan Design a notification system for our app.

Requirements:
- In-app notifications for events (new message, task assigned, etc.)
- Email notifications for critical events
- WebSocket for real-time delivery

Please produce:
1. Architecture diagram (text-based)
2. Data model for notifications
3. API endpoints needed
4. Sequence of implementation steps
5. Estimated effort per step

DO NOT write any code. Only plan.
```

### Pattern 3: Explore Codebase (Explore Agent)

```
@explore I need to understand how the authentication flow works in this project.

Please find and report:
1. All files related to authentication (grep for "auth", "jwt", "token", "session")
2. The main auth module structure
3. How auth state is managed (global state, context, store)
4. API endpoints related to auth
5. Any existing middleware or guards

Report file paths with line numbers for key sections.
Do NOT modify any code.
```

### Pattern 4: Quick Research (Scout Agent)

```
@scout Research the best practices for Rust error handling in Tauri apps 2026.

Focus on:
- thiserror vs anyhow patterns
- Error propagation in async Tauri commands
- User-friendly error messages

Also check:
- Latest Tauri v2 documentation on error handling
- Any breaking changes from Tauri v1

Report findings with URLs.
```

---

## 3. Feature Development

### Template: New Feature Request

```
@build Implement [FEATURE NAME].

Requirements:
[List specific requirements, acceptance criteria]

Tech Stack:
- [Which stack(s): Rust/TS/PHP]
- [Any specific libraries to use]

Existing Patterns to Follow:
- [Reference existing similar feature]
- [Link to rules/*.md if applicable]

Deliverables:
- [List files to create/modify]
- [Tests needed]
- [API changes]

IMPORTANT:
- Write tests first (TDD) or alongside implementation
- Run formatter after changes
- Verify with LSP before reporting done
```

### Feature: REST API Endpoint (Laravel)

```
@backend-laravel Create a RESTful API for user profile management.

Endpoints needed:
- GET /api/users/{id}/profile → UserProfileController@show
- PUT /api/users/{id}/profile → UserProfileController@update
- GET /api/users/{id}/settings → UserSettingsController@show

Requirements:
- JSON:API resource format (follow existing patterns in app/Http/Resources/)
- Form Request validation (use rules/laravel.md conventions)
- Rate limiting: 60 requests/minute per user
- Sanctum authentication required
- Update OpenAPI spec in docs/api.yaml

Model details:
- UserProfile: bio (text), avatar_url (string), timezone (string)
- UserSettings: theme (enum: light|dark|system), notifications_enabled (bool)

Run php artisan pint after formatting.
Run tests: php artisan test tests/Feature/UserProfileTest.php
```

### Feature: React Component with TypeScript

```
@frontend-ui-ux Create a UserSettingsPanel component.

Requirements:
- Theme toggle (light/dark/system) using existing design tokens
- Notification preferences (email, push, in-app) as toggle switches
- Save/Cancel buttons with loading states
- Accessible: proper ARIA labels, keyboard navigation
- Responsive: works on mobile (320px+) and desktop

Stack: React 19 + TypeScript + Tailwind 4 + shadcn/ui

Follow patterns from:
- src/components/UserProfile/UserProfileCard.tsx
- src/hooks/useTheme.ts

Verify with:
- TypeScript compilation (no errors)
- WCAG AA accessibility check
- Test: src/components/UserSettingsPanel.test.tsx
```

### Feature: Tauri Rust Command

```
@backend-tauri Add a Tauri command to export user data as JSON.

Command: exportUserData(userId: string) -> Result<String, String>

Location: src-tauri/src/commands/export.rs

Pattern to follow:
- Use tauri::State for DB access
- Return Result<String, String> with JSON string on success
- Add to src-tauri/src/main.rs plugin registration
- Write corresponding TypeScript binding in src/lib/export.ts
- Add error handling with user-friendly messages (no raw SQL errors)

Security:
- Validate userId format
- Sanitize output (no PII in error messages)
- Rate limit: max 3 exports per hour per user
```

---

## 4. Bug Fixing

### Pattern: Report + Fix

```
@build Fix bug in [COMPONENT/DESCRIPTION].

Bug: [What happens]
Expected: [What should happen]
Reproduced: [Steps to reproduce]

Root cause (if known): [Analysis]

Fix approach: [Specific change needed]

Reference:
- File: path/to/file at line N
- Related: issue #123, commit abc123
```

### Debug-First Approach

```
@qa-guardian Debug this issue:

Symptom: [describe]
Environment: [dev/staging/prod]
Logs: [paste relevant log output]
Stack trace: [paste if available]

Steps:
1. Identify root cause
2. Check for similar bugs in related code
3. Propose fix with file paths and line numbers
4. Suggest test to prevent regression
```

---

## 5. Refactoring

### Pattern: Code Smell Fix

```
@refactor-architect Analyze and plan refactoring for [AREA].

Known issues in [src/module/path]:
- [List specific problems: naming, coupling, duplication, etc.]
- [Reference audit findings if from codebase-audit.js]

Please:
1. Map the current structure
2. Identify all affected files
3. Propose target structure
4. Generate migration steps
5. Define rollback strategy

DO NOT make changes. Only plan and report.
```

### Pattern: Naming Convention Fix

```
@core-factory Standardize naming conventions in src/utils/.

Current issues (from audit):
- camelCase functions that should be snake_case
- File names that don't match exports
- Inconsistent constant casing

Rules to follow:
- TypeScript: camelCase (variables, functions), PascalCase (types, interfaces, components)
- Rust: snake_case (functions, variables), PascalCase (structs, enums)
- PHP: snake_case (methods, properties), PascalCase (classes)
- Files: kebab-case for all

IMPORTANT:
- Update all references when renaming
- Run tests after each rename
- Update documentation if API names change
```

### Pattern: Dependency Cleanup

```
@code-reviewer Audit imports and dependencies in src/components/.

Find:
1. Unused imports in every file
2. Duplicate dependencies in Cargo.toml / package.json
3. Circular import chains
4. Imports that should be path-aliased

Report format:
[CRITICAL/HIGH/MEDIUM/LOW] file:line - Issue: description
```

---

## 6. Code Review & Quality

### Pre-Merge Review

```
@qa-guardian Review this PR before merge.

Changes:
[Describe what changed or paste diff]

Focus areas:
1. Type safety — no `any`, proper generics
2. Error handling — no bare try/catch, proper Result types
3. Naming — follows project conventions
4. Performance — no N+1 queries, no unnecessary re-renders
5. Security — no secret exposure, proper validation
6. Testing — coverage adequate for changes

Output:
- List of issues with file:line references
- Severity ratings
- Fix suggestions
- Pass/fail verdict
```

### Security Audit

```
@qa-guardian Security audit of [MODULE/FEATURE].

Check:
1. Input validation and sanitization
2. Authentication and authorization checks
3. Secret/key management (no hardcoded credentials)
4. SQL injection prevention
5. XSS prevention in rendered content
6. CORS and CSP configuration
7. Dependency vulnerabilities (check package.json/Cargo.toml)
8. File upload security

Reference: OWASP Top 10, project SECURITY.md
```

---

## 7. Research & Learning

### Library Comparison

```
@research-analyst Compare these libraries for [USE CASE]:

Options:
- Library A (version X)
- Library B (version Y)
- Library C (version Z)

Evaluate on:
1. API surface and ease of use
2. Bundle size / performance
3. TypeScript support quality
4. Maintenance status (last commit, issues, releases)
5. Community size and documentation quality
6. Compatibility with our stack (Tauri + React + Laravel)
7. License

Report with: recommendation table, migration effort, risk assessment.
```

### Best Practice Research

```
@research-analyst Research current best practices for [TOPIC].

Context: We are building a [describe project] with [stack].

Focus on:
1. Official documentation recommendations
2. Community consensus (blog posts, talks)
3. Anti-patterns to avoid
4. Performance benchmarks if applicable
5. Migration path from our current approach

Sources must include URLs. Distinguish opinion from evidence.
```

---

## 8. Testing

### Generate Tests

```
@integration-test Generate tests for [MODULE/FEATURE].

Target: [file or module path]
Type: unit | integration | e2e
Framework: vitest | pest | playwright (choose based on stack)

Requirements:
- Cover all public functions/methods
- Include happy path, edge cases, error cases
- Follow existing test patterns in the project
- Target 80%+ coverage for this module

Generate:
1. Test file at [appropriate path]
2. Fixtures if needed
3. Mock setup
4. Run tests and report results
```

### Test Execution

```
@integration-test Run full test suite and report.

Commands:
1. npx vitest run --reporter=verbose (TypeScript tests)
2. cargo test --workspace (Rust tests)
3. php artisan test --colors=always (PHP tests)

Report:
- Pass/fail per test suite
- Coverage summary
- Any failures with root cause analysis
- Suggestions for flaky tests
```

---

## 9. Documentation

### Update Documentation

```
@docs-evolver Update documentation for [FEATURE/MODULE].

Current state: [Describe what exists]
Changes made: [What changed in code]

Tasks:
1. Update relevant docs/*.md files
2. Update inline code comments if needed
3. Update API documentation (OpenAPI spec)
4. Generate changelog entry
5. Create ADR if this is an architectural decision

Follow rules: rules/*.md, project conventions
Format with biome/prettier after edits.
```

### ADR Creation

```
@docs-evolver Create an Architecture Decision Record.

Title: [Decision Title]
Status: proposed | accepted | superseded | deprecated
Context: [Why is this decision needed?]
Decision: [What was decided]
Consequences:
- Positive: [list]
- Negative: [list]
Alternatives Considered:
1. [Option A] — why rejected
2. [Option B] — why rejected
3. [Chosen option]

File: docs/adr/YYYY-MM-DD-[slug].md
```

---

## 10. DevOps & Infrastructure

### Database Operations

```
@devops-engineer [TASK: db:init | db:backup | db:migrate]

For migrations:
- Review migration file at path/to/migration.php
- Run php artisan migrate --pretend first (dry run)
- Confirm before executing
- Test rollback: php artisan migrate:rollback

For backups:
- Run scripts/db-backup.ps1
- Verify backup integrity
- Store in configured location
```

### Build & Deploy

```
@devops-engineer Build and verify.

Steps:
1. npm run lint (ensure code quality)
2. npm run build (production build)
3. cargo build --release (Rust release)
4. Run smoke tests
5. Verify bundle size: npx bundlesize
6. Deploy to [target]

Rollback: git revert + redeploy previous tag.
```

---

## 11. Cross-Stack Scenarios

### Rust ↔ TypeScript Communication

```
@backend-tauri @frontend-ui-ux Add a new Tauri command + frontend integration.

Backend (@backend-tauri):
1. Create command in src-tauri/src/commands/[name].rs
2. Register in src-tauri/src/main.rs
3. Return Result<String, String> with JSON payload
4. Add error mapping

Frontend (@frontend-ui-ux):
1. Create TypeScript wrapper in src/lib/[name].ts
2. Use @tauri-apps/api invoke
3. Add types/interfaces
4. Create UI component consuming the data
5. Add error handling UI

Integration:
- Test IPC round-trip
- Handle loading/error states
- Verify with both rust-analyzer and TS compiler
```

### Laravel ↔ Frontend API Contract

```
@backend-api @frontend-ui-ux Define and implement API endpoint.

API Contract (@backend-api):
- Method: GET /api/resources
- Request: Query params (page, per_page, filters)
- Response: JSON:API format
- Auth: Sanctum token
- Rate limit: 60/min

Frontend (@frontend-ui-ux):
- Create API client function
- TypeScript types matching contract
- React Query / SWR integration
- Loading/error/empty states

Validation:
- Run both sides, verify contract matches
- Test edge cases (empty response, error, timeout)
```

---

## 12. Multi-Agent Orchestration

### Parallel Execution

```
@lead-strategist Coordinate parallel tasks.

Task A: @core-factory Implement user settings page
Task B: @backend-api Add settings API endpoints
Task C: @backend-laravel Add settings database migration

Run: A, B, C in parallel (no dependencies between them).
After completion: Integration test (@integration-test).
```

### Sequential with Review Gates

```
@lead-strategist Plan and execute feature.

Phase 1: @research-analyst → Research requirements
Phase 2: @lead-architect → Design architecture (wait for Phase 1)
Phase 3: @core-factory → Implement (wait for Phase 2)
Phase 4: @code-reviewer → Review (wait for Phase 3)
Phase 5: @integration-test → Test (wait for Phase 4)
Phase 6: @docs-evolver → Document (wait for Phase 5)

Each phase must complete before next begins.
Use task tool for orchestration.
```

### Complex Refactoring

```
@refactor-architect Lead [AREA] refactoring.

Step 1: @explore → Map current codebase structure
Step 2: @code-reviewer → Audit issues
Step 3: @research-analyst → Research target patterns
Step 4: Create refactoring plan (this agent)
Step 5: @core-factory → Execute changes
Step 6: @qa-guardian → Verify no regressions
Step 7: @docs-evolver → Update documentation
Step 8: @integration-test → Run full suite

Use memory to track progress across steps.
```

---

## 13. Self-Improvement & Evolution

### Trigger Self-Evolution

```
/evolve
```

OR:

```
@core-factory Run self-evolution cycle.

Use skill:self-evolver to:
1. Run codebase-audit.js analysis
2. Identify improvement opportunities
3. Research better patterns
4. Propose changes (with before/after)
5. Implement if approved
6. Run tests to validate
7. Update memory with learnings
```

### Auto-Research Loop

```
/autoresearch
```

The lead-strategist agent will:

1. Identify performance/quality metrics
2. Run experiments with code changes
3. Measure results
4. Keep improvements, revert failures
5. Log findings to memory

### Config Doctor

```
/doctor
```

Runs config-doctor skill to:

1. Validate opencode.json against schema
2. Check all agent files for compliance
3. Verify skill references
4. Fix issues found (with user approval)

---

## 14. Edge Cases & Troubleshooting

### "The model is not responding"

1. Check if LM Studio is running: `curl http://127.0.0.1:1234/v1/models`
2. Try switching provider: use `opencode-go` or `openrouter` as fallback
3. Check model name in config matches loaded model in LM Studio
4. Restart OpenCode: close all, run `opencode`

### "Agent is making too many tool calls / looping"

1. Set `steps` limit on the agent in opencode.json
2. Use `plan` agent first to constrain scope
3. Add explicit constraints in instructions: "Maximum 3 tool calls"
4. Check if the agent needs more context — provide file contents directly

### "Agent ignores my instructions"

1. Check agent's `mode` — subagents only activate when @mentioned
2. Check instructions for conflicting constraints
3. Make instructions more specific — add examples
4. Check that the model has enough tokens for full context
5. Try a more capable model (switch from 4B to 235B)

### "Code doesn't compile after agent changes"

1. Run LSP diagnostics immediately
2. Have agent read its own output and validate
3. Use `cargo check` / `tsc --noEmit` / `php -l` as validation step
4. Ask `@qa-guardian` to review specific file

### "Need to undo agent changes"

1. `/undo` — reverts last agent changeset
2. `/undo 3` — reverts last 3 changesets
3. `/redo` — reapplies
4. Git: `git diff HEAD~1` to inspect, `git checkout` to revert

### "Agent can't find a file or module"

1. Use `@explore` to locate the file
2. Check if imports use correct path aliases
3. Verify file exists: `ls [path]`
4. Check barrel exports (index.ts, mod.rs)

### "Poor quality output from agent"

1. Switch to a better model for that task
2. Add more specific instructions with examples
3. Provide reference code: "Follow the pattern in [file_path]"
4. Use `plan` agent first, then `build` for implementation
5. Lower temperature for more deterministic output (0.1-0.2)

### "Agent modifies wrong file"

1. Check file permissions in agent config — set to `"ask"` for sensitive paths
2. Add explicit exclusions: `"dist/**": "deny"`
3. Use scoped permissions per agent
4. Verify with `@code-reviewer` before merging

---

## 15. Brain Plugin — RAG &amp; Codebase Context

The **Brain Plugin** provides automatic RAG (Retrieval-Augmented Generation) for OpenCode. It indexes your project, embeds code with LM Studio, and injects relevant chunks into prompts automatically.

### How RAG Works (Automatic)

When you ask a question, the brain plugin:

1. **Classifies intent** via decision tree (debug, refactor, feature, test, learn)
2. **Prewarms** the embed model in LM Studio
3. **Embeds** your query and searches the project index (HNSW vector store)
4. **Injects** top-K code chunks into the prompt as context

No manual action needed — it just works on every `message.updated`.

### Manual Brain Commands

| Command               | Purpose                                                        |
| --------------------- | -------------------------------------------------------------- |
| `brain_diagnostic`    | Full pipeline check: health, cache, search, models             |
| `brain_status`        | Decision tree stats, index stats, memory graph, cache hit rate |
| `brain_search`        | Hybrid search: keyword + dense + sparse (RRF fusion)           |
| `brain_embed_test`    | Test what context a query would retrieve                       |
| `brain_model_load`    | Prewarm a model (chat/embed/draft)                             |
| `brain_model_unload`  | Free VRAM by unloading non-essential models                    |
| `brain_index_project` | Re-index current project (use `force:true` to rebuild)         |

### Prompting with RAG Context

The brain injects context as markdown code blocks at the top of your prompt:

````
## Context 1: `src/auth/login.ts:15-45`
```typescript
function authenticate(user, pass) { ... }
````

## Context 2: `src/auth/utils.ts:1-30`

```typescript
const TOKEN_EXPIRY = 3600;
```

---

User request: <your message>

```

You can also force context retrieval with:

```

@build Use brain_search to find auth-related files, then read them.

```

### Troubleshooting

| Symptom | Fix |
|---------|-----|
| RAG not injecting chunks | Run `brain_diagnostic` → check LM Studio is running → `brain_index_project force:true` |
| 0 search results | Run `brain_index_project force:true` to (re)index |
| LM Studio errors | Check LM Studio status at http://127.0.0.1:1234 — restart if needed |
| VRAM full | `brain_model_unload` to free non-essential models |
| Want to see what's indexed | `brain_status` shows chunk count, indexed projects, cache hit rate |

---

## 16. Command Reference

### System Commands

| Command           | Description                     | Agent |
| ----------------- | ------------------------------- | ----- |
| `/init`           | Initialize OpenCode for project | build |
| `/connect`        | Configure LLM provider          | —     |
| `/undo [n]`       | Revert last n changes           | —     |
| `/redo`           | Reapply reverted changes        | —     |
| `/model [name]`   | Switch active model             | —     |
| `/switch [agent]` | Switch primary agent            | —     |
| `/tab`            | Cycle primary agents            | —     |
| `/save [name]`    | Save session                    | —     |
| `/restore [name]` | Restore session                 | —     |
| `/diff`           | Show current changes            | —     |

### Custom Commands

| Command         | Description               | Agent           |
| --------------- | ------------------------- | --------------- |
| `/audit`        | Full lint + test          | qa-guardian     |
| `/test`         | Run test suite            | qa-guardian     |
| `/lint`         | Run linters               | qa-guardian     |
| `/build`        | Build project             | core-factory    |
| `/reflect`      | Analyze config            | docs-curator    |
| `/doctor`       | Audit & fix config        | lead-strategist |
| `/improve`      | Self-improvement analysis | core-factory    |
| `/evolve`       | Self-evolution cycle      | core-factory    |
| `/autoresearch` | Autonomous optimization   | lead-strategist |
| `/db:init`      | Initialize database       | devops-engineer |
| `/db:backup`    | Backup database           | devops-engineer |
| `/clean`        | Clear caches              | devops-engineer |

### Agent Invocation (in chat)

```

@build → core-factory (primary)
@plan → plan agent
@explore → explore subagent
@scout → scout subagent
@code-reviewer → code review agent
@lead-strategist→ strategic planning
@lead-architect → architecture analysis
@frontend-ui-ux → UI implementation
@backend-api → API development
@backend-laravel→ Laravel development
@backend-tauri → Rust/Tauri development
@qa-guardian → Testing & security
@devops-engineer→ Infrastructure
@docs-curator → Documentation
@refactor-architect → Refactoring coordination
@research-analyst → Research & analysis
@integration-test → Test generation/execution
@docs-evolver → Documentation sync

```

---

## 17. Anti-Patterns to avoid

### ❌ Vague Prompts

```

// BAD
@build Fix the bug.

// GOOD
@build Fix the N+1 query in UserController@index.
The endpoint loads 500 users and makes 500 individual queries
for the 'role' relationship. Use eager loading instead.
File: app/Http/Controllers/UserController.php:45

```

### ❌ Too Much at Once

```

// BAD
@build Build an entire e-commerce platform.

// GOOD
@build Create the Product model and migration.
Then: @build Create the ProductController
Then: @build Create the API routes
...

```

### ❌ Ignoring Existing Patterns

```

// Always reference existing code:
@build Follow the same pattern as UserController
in src/http/controllers/post-controller.ts.

```

### ❌ Not Validating

```

// Always ask for validation:
@build Implement feature X.
After implementation:

1. Run cargo check
2. Run npx tsc --noEmit
3. Run npm test
4. Report any errors

```

### ❌ Forgetting Tests

```

// Always specify testing:
@build Implement feature X with tests.

- Write unit tests for edge cases
- Run test suite after implementation
- Report coverage percentage

```

### ❌ Not Using the Right Agent

```

// DON'T use @build for planning
// DON'T use @plan for implementation
// DON'T use @explore for code changes
// Use @refactor-architect for refactoring plans
// Use @code-reviewer before merging

```

---

## Appendix A: Current Audit Status

From the latest `codebase-audit.js` run:

| Metric                       | Value                                     |
| ---------------------------- | ----------------------------------------- |
| Files scanned                | 105                                       |
| Total issues                 | 803                                       |
| Health score                 | 0/100 (heavily penalized for `any` types) |
| `any` types (ARCHITECTURE)   | 120 (all HIGH)                            |
| Redundancy (false positives) | 672 (mostly boilerplate matching)         |
| Import issues                | 5 (unused)                                |
| Naming issues                | 6                                         |

### Top Priority Actions

1. **Replace 120 `any` types** — Use TypeScript interfaces, generics, or `unknown`
2. **Fix Rust `unwrap()` calls** — Replace with `expect()` or proper error handling
3. **Standardize naming** — Follow conventions per stack
4. **Remove unused imports** — Clean up 5 identified imports
5. **Add `project` and `trae` metadata** — Already done in `opencode.json`

---

## Appendix B: Agent Quick Reference Card

| Agent              | Model                | Provider    | Best For                   |
| ------------------ | -------------------- | ----------- | -------------------------- |
| build              | qwen3.5-4b-reasoning | lmstudio    | Fast implementation        |
| plan               | qwen3.5-4b           | lmstudio    | Analysis & planning        |
| explore            | qwen3.5-4b           | lmstudio    | Codebase navigation        |
| scout              | qwen3.5-4b           | opencode-go | External research          |
| core-factory       | qwen3.5-4b-reasoning | lmstudio    | Implementation + evolution |
| lead-strategist    | qwen-3-235b          | cerebras    | Orchestration & strategy   |
| lead-architect     | qwen-3-235b          | cerebras    | Architecture decisions     |
| frontend-ui-ux     | qwen3.5-4b-reasoning | lmstudio    | UI components & design     |
| backend-api        | qwen3.5-4b-reasoning | lmstudio    | API endpoints & logic      |
| backend-laravel    | qwen3.5-4b-reasoning | lmstudio    | Laravel/PHP features       |
| backend-tauri      | qwen3.5-4b-reasoning | lmstudio    | Rust/Tauri commands        |
| qa-guardian        | qwen3.5-4b-reasoning | lmstudio    | Testing & security         |
| devops-engineer    | qwen3.5-4b-reasoning | lmstudio    | Infrastructure & ops       |
| docs-curator       | qwen-3-235b          | cerebras    | Documentation & evolution  |
| refactor-architect | qwen-3-235b          | cerebras    | Refactoring coordination   |
| code-reviewer      | qwen3.5-4b-reasoning | lmstudio    | Code quality analysis      |
| research-analyst   | qwen-3-235b          | cerebras    | Best practices & gaps      |
| integration-test   | qwen3.5-4b-reasoning | lmstudio    | Test gen & execution       |
| docs-evolver       | qwen-3-235b          | cerebras    | Doc sync & ADRs            |

> **All 15 agents have Brain plugin tools** (brain_diagnostic, brain_status, brain_search, brain_index_project) for RAG-powered codebase context.
```
