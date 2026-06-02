# OpenCode Prompting Guide — All Case Scenarios

> **Version**: 3.1 (May 2026)
> **Stack**: `{{ project_stack }}` (e.g., Tauri + React + Laravel)
> **Project**: `{{ project_name }}` (e.g., opencode)
> **Reference**: [opencode.ai/docs](https://opencode.ai/docs)
> **Token Budget**: Keep prompts under 200 tokens for simple tasks, under 500 for complex orchestration

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
13. [Skills System](#13-skills-system)
14. [MCP Servers & Tools](#14-mcp-servers--tools)
15. [Self-Improvement & Evolution](#15-self-improvement--evolution)
16. [Edge Cases & Troubleshooting](#16-edge-cases--troubleshooting)
17. [Command Reference](#17-command-reference)
18. [Anti-Patterns to Avoid](#18-anti-patterns-to-avoid)
19. [Token Budget & Efficient Orchestration](#19-token-budget--efficient-orchestration)

---

## 1. Agent Selection Quick Reference

### Decision Tree

```
What do you need to do?
│
├─ Write/change code
│  ├─ Building a new feature       → @core-factory
│  ├─ Quick fix / small change     → @core-factory
│  ├─ React/TypeScript UI          → @frontend-ui-ux
│  ├─ Laravel/PHP backend          → @backend-laravel
│  ├─ Rust/Tauri layer             → @backend-tauri
 │  ├─ Node/Express API             → @software-architect
│  ├─ Android/Kotlin native        → @android-kotlin
│  └─ Refactoring existing code    → @refactor-architect (plan) → @core-factory (implement)
│
├─ Plan / design
│  ├─ New feature architecture     → @lead-strategist
 │  ├─ Technical decisions          → @software-architect
 │  └─ API contract design          → @software-architect
│
├─ Explore / understand
│  ├─ "Where is X implemented?"    → @explore
│  ├─ "How does Y work?"           → @explore
│  └─ "Find all usages of Z"       → @explore
│
├─ Research
│  ├─ Best practices for X         → @research-analyst
│  ├─ Library comparison           → @scout
│  ├─ Dependency inspection        → @scout
│  └─ Gap analysis                 → @research-analyst
│
├─ Review / test
│  ├─ Code quality audit           → @code-reviewer
│  ├─ Run tests                    → @integration-test
│  ├─ Security review              → @qa-guardian
│  ├─ Mobile QA (Android)          → @mobile-qa
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
   ├─ Dependency updates           → @devops-engineer
   └─ Skill sync / config check    → @devops-engineer
```

### Agents Overview

| Agent                 | Type     | Best For                                      |
| --------------------- | -------- | --------------------------------------------- |
| `@core-factory`       | primary  | Orchestration, implementation, delegation     |
| `@plan`               | subagent | Read-only analysis, architecture review       |
| `@explore`            | subagent | Codebase search, file location                |
| `@scout`              | subagent | External research, dependency inspection      |
| `@lead-strategist`    | subagent | Product strategy, feasibility, gap analysis   |
| `@software-architect` | subagent | System design, Node/Bun backend, code quality |
| `@frontend-ui-ux`     | subagent | React/TypeScript UI, Tailwind, shadcn/ui      |
| `@backend-laravel`    | subagent | Laravel/PHP, Livewire, Eloquent               |
| `@backend-tauri`      | subagent | Rust/Tauri commands, IPC, safety              |
| `@android-kotlin`     | subagent | Kotlin/Compose, Android native                |
| `@qa-guardian`        | subagent | Quality gates, security, testing              |
| `@devops-engineer`    | subagent | DB ops, builds, caches, dependencies          |
| `@docs-curator`       | subagent | Technical writing, README, guides             |
| `@code-reviewer`      | subagent | Code standards, naming, redundancy            |
| `@docs-evolver`       | subagent | Doc sync, changelog, ADRs                     |
| `@integration-test`   | subagent | Test gen, execution, coverage analysis        |
| `@mobile-qa`          | subagent | Android UI testing, device compat             |
| `@refactor-architect` | subagent | Refactoring plans, structural analysis        |
| `@research-analyst`   | subagent | Best practices, benchmarks, gaps              |

### Switch Between Agents

- **Tab key** in TUI: Cycle primary agents (core-factory ↔ plan)
- **`@agent-name`** in chat: Invoke any subagent directly
- **`/switch agent-name`**: Change primary agent
- Agents not in `opencode.json` `agent` section (code-reviewer, docs-evolver, integration-test, mobile-qa, refactor-architect, research-analyst) are loaded from `.opencode/agents/*.md` and invocable via `@name`

---

## 2. Basic Prompting Patterns

### Pattern 1: Implement a Feature (Build Agent)

```
@core-factory Implement {{ feature_name }} for the {{ project_name }} app.

Context:
- Stack: {{ project_stack }}
- Need {{ brief_requirement }}
- See existing pattern in {{ reference_file }} for reference

Steps:
1. Read {{ reference_file }} for current patterns
2. Create {{ new_file }} with {{ function_name }}()
3. Wire up in {{ integration_point }}

Constraints:
- Use {{ error_library }} for error types
- Return {{ return_type }} for all commands
- Follow patterns in {{ rules_file }}
```

### Pattern 2: Plan Before Building (Plan Agent)

```
@plan Design a {{ feature_name }} system for {{ project_name }}.

Requirements:
- {{ requirement_1 }}
- {{ requirement_2 }}
- {{ requirement_3 }}

Please produce:
1. Architecture diagram (text-based)
2. Data model
3. API endpoints needed
4. Sequence of implementation steps
5. Estimated effort per step

DO NOT write any code. Only plan.
```

### Pattern 3: Explore Codebase (Explore Agent)

```
@explore I need to understand how {{ feature_area }} works in this project.

Please find and report:
1. All files related to {{ topic }} (grep for {{ search_terms }})
2. The main module structure
3. How state is managed (global state, context, store)
4. API endpoints related to {{ topic }}
5. Any existing middleware or guards

Report file paths with line numbers for key sections.
Do NOT modify any code.
```

### Pattern 4: Quick Research (Scout Agent)

```
@scout Research the best practices for {{ topic }} in {{ year }}.

Focus on:
- {{ aspect_1 }}
- {{ aspect_2 }}
- {{ aspect_3 }}

Also check:
- Latest {{ library }} documentation on {{ topic }}
- Any breaking changes from version {{ old_version }}

Report findings with URLs.
```

---

## 3. Feature Development

### Template: New Feature Request

```
@core-factory Implement {{ feature_name }}.

Requirements:
{{ bullet_list_of_requirements }}

Tech Stack:
- {{ stack_layer_1 }}
- {{ stack_layer_2 }}

Existing Patterns to Follow:
- {{ reference_feature_1 }}
- {{ link_to_rules }}

Deliverables:
- {{ files_to_create_or_modify }}
- {{ tests_needed }}
- {{ api_changes }}

IMPORTANT:
- Write tests first (TDD) or alongside implementation
- Run formatter after changes
- Verify with LSP before reporting done
```

### Feature: REST API Endpoint (Laravel)

```
@backend-laravel Create a RESTful API for {{ resource_name }}.

Endpoints needed:
- GET /api/{{ resource }} → {{ Controller }}@index
- POST /api/{{ resource }} → {{ Controller }}@store
- GET /api/{{ resource }}/{id} → {{ Controller }}@show
- PUT /api/{{ resource }}/{id} → {{ Controller }}@update
- DELETE /api/{{ resource }}/{id} → {{ Controller }}@destroy

Requirements:
- JSON:API resource format (follow existing patterns in {{ resource_dir }})
- Form Request validation (use {{ rules_file }} conventions)
- Rate limiting: {{ rate_limit }}
- {{ auth_mechanism }} authentication required
- Update OpenAPI spec in {{ api_docs_file }}

Model details:
- {{ ModelName }}: {{ field_list }}

Run php artisan pint after formatting.
Run tests: php artisan test {{ test_path }}
```

### Feature: React Component with TypeScript

```
@frontend-ui-ux Create a {{ ComponentName }} component.

Requirements:
- {{ requirement_1 }}
- {{ requirement_2 }}
- {{ requirement_3 }}
- Accessible: proper ARIA labels, keyboard navigation
- Responsive: works on mobile (320px+) and desktop

Stack: {{ frontend_stack }}

Follow patterns from:
- {{ reference_component_1 }}
- {{ reference_hook_1 }}

Verify with:
- TypeScript compilation (no errors)
- WCAG AA accessibility check
- Test: {{ test_file_path }}
```

### Feature: Tauri Rust Command

```
@backend-tauri Add a Tauri command to {{ action_description }}.

Command: {{ command_name }}(params) -> Result<{{ return_type }}, String>

Location: {{ file_path }}

Pattern to follow:
- Use tauri::State for DB access
- Return Result<T, String> with JSON string on success
- Add to {{ registration_file }} plugin registration
- Write corresponding TypeScript binding in {{ ts_binding_file }}
- Add error handling with user-friendly messages

Security:
- Validate {{ input }} format
- Sanitize output (no PII in error messages)
- Rate limit: {{ rate_limit }}
```

### Feature: Android Kotlin (Jetpack Compose)

```
@android-kotlin Create a {{ ScreenName }} screen.

Requirements:
- Jetpack Compose UI following Material 3
- ViewModel with StateFlow state management
- Clean Architecture: Presentation → Domain → Data
- Room database integration for local storage

Stack: {{ android_stack }}

Follow patterns from:
- {{ reference_screen }}
- {{ reference_viewmodel }}

Verify:
- ./gradlew assembleDebug passes
- Permissions declared in AndroidManifest.xml
- Dark mode & accessibility supported
```

---

## 4. Bug Fixing

### Pattern: Report + Fix

```
@core-factory Fix bug in {{ component_or_description }}.

Bug: {{ what_happens }}
Expected: {{ what_should_happen }}
Reproduced: {{ steps_to_reproduce }}

Root cause (if known): {{ analysis }}

Fix approach: {{ specific_change_needed }}

Reference:
- File: {{ file_path }} at line N
- Related: issue #{{ number }}, commit {{ hash }}
```

### Debug-First Approach

```
@qa-guardian Debug this issue:

Symptom: {{ describe }}
Environment: {{ dev_or_staging_or_prod }}
Logs: {{ paste_relevant_log_output }}
Stack trace: {{ paste_if_available }}

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
@refactor-architect Analyze and plan refactoring for {{ area }}.

Known issues in {{ module_path }}:
- {{ specific_problems }}
- {{ reference_audit_findings }}

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
@core-factory Standardize naming conventions in {{ directory }}.

Current issues (from audit):
- {{ issue_1 }}
- {{ issue_2 }}
- {{ issue_3 }}

Rules to follow:
- {{ language_1 }}: {{ conventions_1 }}
- {{ language_2 }}: {{ conventions_2 }}
- {{ language_3 }}: {{ conventions_3 }}

IMPORTANT:
- Update all references when renaming
- Run tests after each rename
- Update documentation if API names change
```

### Pattern: Dependency Cleanup

```
@code-reviewer Audit imports and dependencies in {{ directory }}.

Find:
1. Unused imports in every file
2. Duplicate dependencies in {{ manifest_files }}
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
{{ describe_what_changed_or_paste_diff }}

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
@qa-guardian Security audit of {{ module_or_feature }}.

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

### Code Quality Audit

```
@code-reviewer Audit code quality in {{ directory }}.

Focus:
1. Naming convention violations
2. Unused imports and exports
3. Code duplication (>5 lines identical)
4. Dead code (unused functions, commented code)
5. TODO/FIXME older than 30 days
6. God files (>300 lines, mixed responsibilities)
7. Missing error handling paths

Output format:
[SEVERITY] [CATEGORY] file_path:line_number
- Issue: description
- Suggested fix: brief recommendation
```

---

## 7. Research & Learning

### Library Comparison

```
@research-analyst Compare these libraries for {{ use_case }}:

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
6. Compatibility with {{ project_stack }}
7. License

Report with: recommendation table, migration effort, risk assessment.
```

### Best Practice Research

```
@research-analyst Research current best practices for {{ topic }}.

Context: We are building a {{ describe_project }} with {{ project_stack }}.

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
@integration-test Generate tests for {{ module_or_feature }}.

Target: {{ file_or_module_path }}
Type: unit | integration | e2e
Framework: {{ vitest_or_pest_or_playwright }}

Requirements:
- Cover all public functions/methods
- Include happy path, edge cases, error cases
- Follow existing test patterns in the project
- Target 80%+ coverage for this module

Generate:
1. Test file at {{ appropriate_path }}
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

### Mobile Testing (Android)

```
@mobile-qa Run Android UI test suite.

Steps:
1. Use `android-emulator` to start emulator (API {{ level }})
2. Use `mobile` to install debug APK
3. Use `mobile` to launch main activity
4. Run UI automation through defined user flows
5. Capture screenshots at each step
6. Report any crashes, ANRs, or visual regressions

Device targets: {{ device_matrix }}
```

---

## 9. Documentation

### Update Documentation

```
@docs-evolver Update documentation for {{ feature_or_module }}.

Current state: {{ describe_what_exists }}
Changes made: {{ what_changed_in_code }}

Tasks:
1. Update relevant {{ docs_dir }}/*.md files
2. Update inline code comments if needed
3. Update API documentation (OpenAPI spec)
4. Generate changelog entry
5. Create ADR if this is an architectural decision

Follow rules: {{ rules_dir }}/*.md, project conventions
Format with biome/prettier after edits.
```

### ADR Creation

```
@docs-evolver Create an Architecture Decision Record.

Title: {{ decision_title }}
Status: proposed | accepted | superseded | deprecated
Context: {{ why_is_this_decision_needed }}
Decision: {{ what_was_decided }}
Consequences:
- Positive: {{ list }}
- Negative: {{ list }}
Alternatives Considered:
1. {{ option_a }} — why rejected
2. {{ option_b }} — why rejected
3. {{ chosen_option }}

File: docs/adr/YYYY-MM-DD-{{ slug }}.md
```

---

## 10. DevOps & Infrastructure

### Database Operations

```
@devops-engineer {{ task_db_init_or_db_backup_or_db_migrate }}

For migrations:
- Review migration file at {{ path_to_migration }}
- Run php artisan migrate --pretend first (dry run)
- Confirm before executing
- Test rollback: php artisan migrate:rollback

For backups:
- Run {{ backup_script }}
- Verify backup integrity
- Store in configured location
```

### Build & Deploy

```
@devops-engineer Build and verify.

Steps:
1. {{ lint_command }} (ensure code quality)
2. {{ build_command }} (production build)
3. {{ release_build_command }}
4. Run smoke tests
5. Verify bundle size: {{ bundle_check_command }}
6. Deploy to {{ target }}

Rollback: git revert + redeploy previous tag.
```

### Dependency Management

```
@devops-engineer Check and update dependencies.

Steps:
1. Run {{ check_updates_script }}
2. Review changelogs for breaking changes
3. Update {{ manifest_files }} with new versions
4. Run tests to verify compatibility
5. Report any security advisories

Focus on: {{ dependency_list }}
```

---

## 11. Cross-Stack Scenarios

### Rust ↔ TypeScript Communication

```
@backend-tauri @frontend-ui-ux Add a new Tauri command + frontend integration.

Backend (@backend-tauri):
1. Create command in {{ command_file_path }}
2. Register in {{ main_registration_file }}
3. Return Result<{{ type }}, String> with JSON payload
4. Add error mapping

Frontend (@frontend-ui-ux):
1. Create TypeScript wrapper in {{ ts_wrapper_path }}
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
@software-architect @frontend-ui-ux Define and implement API endpoint.

API Contract (@software-architect):
- Method: {{ http_method }} /api/{{ endpoint }}
- Request: {{ query_params }}
- Response: {{ response_format }}
- Auth: {{ auth_mechanism }}
- Rate limit: {{ limit }}

Frontend (@frontend-ui-ux):
- Create API client function
- TypeScript types matching contract
- {{ data_fetching_library }} integration
- Loading/error/empty states

Validation:
- Run both sides, verify contract matches
- Test edge cases (empty response, error, timeout)
```

### Tauri Mobile (Rust ↔ Android)

```
@backend-tauri @android-kotlin Add mobile support for {{ feature }}.

Rust/Tauri side (@backend-tauri):
1. Ensure command works on mobile Tauri target
2. Handle platform-specific differences (file paths, permissions)
3. Add mobile-specific error handling

Android Native side (@android-kotlin):
1. Add Kotlin bridge code in {{ android_bridge_path }}
2. Register in AndroidManifest.xml
3. Handle Android permissions (camera, storage, etc.)
4. Test on emulator via `cargo tauri android dev`

Integration:
- Verify command works on desktop AND mobile
- Test on API {{ min_api }}+
- Check Play Store compliance
```

---

## 12. Multi-Agent Orchestration

### Parallel Execution

```
@lead-strategist Coordinate parallel tasks.

Task A: @core-factory Implement {{ feature_a }}
Task B: @software-architect Add {{ feature_b }}
Task C: @devops-engineer Run {{ task_c }}

Run: A, B, C in parallel (no dependencies between them).
After completion: Integration test (@integration-test).
```

### Sequential with Review Gates

```
@lead-strategist Plan and execute {{ feature_name }}.

Phase 1: @research-analyst → Research requirements
Phase 2: @software-architect → Design architecture (wait for Phase 1)
Phase 3: @core-factory → Implement (wait for Phase 2)
Phase 4: @code-reviewer → Review (wait for Phase 3)
Phase 5: @integration-test → Test (wait for Phase 4)
Phase 6: @docs-evolver → Document (wait for Phase 5)

Each phase must complete before next begins.
Use task tool for orchestration.
```

### Complex Refactoring

```
@refactor-architect Lead {{ area }} refactoring.

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

### Full Mobile Feature Pipeline

```
@lead-strategist Coordinate mobile feature: {{ feature_name }}.

Phase 1: @research-analyst → Research mobile patterns
Phase 2: @software-architect → Design architecture
Phase 3: @backend-tauri → Implement Rust backend (parallel)
Phase 4: @android-kotlin → Implement Android UI (parallel)
Phase 5: @frontend-ui-ux → Implement web fallback (parallel)
Phase 6: @mobile-qa → Test on {{ device_targets }} (after Phase 3-5)
Phase 7: @qa-guardian → Security audit
Phase 8: @docs-evolver → Document mobile setup

Track platform-specific decisions in memory.
```

---

## 13. Skills System

### Overview

This project has **{{ skills_total_count }} skills** available via the `skill:` tool. Skills provide specialized workflows for common tasks. Use `skill:{{ skill_name }}` in any agent prompt to load that skill's instructions.

### Skills Table by Category

| Category           | Count  | Skills                                                                                                                                                        |
| ------------------ | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **meta**           | 7      | config-doctor, prompt-engineering, self-improver, self-reflection, skill-creator, skill-evolution, skill-refiner                                              |
| **process**        | 5      | dynamic-workflow, spec-driven-design, stack-context, workflow-manager, plan-mode                                                                              |
| **testing**        | 3      | agent-browser, pest-testing, testing-strategy                                                                                                                 |
| **search**         | 3      | multi-search-engine, web-search, web-reader                                                                                                                   |
| **research**       | 2      | deep-research, knowledge-architect                                                                                                                            |
| **design**         | 7      | stitch-code-to-design, stitch-design-md, stitch-extract-design-md, stitch-manage-design-system, stitch-taste-design, ui-ux-pro-max, visual-design-foundations |
| **documents**      | 4      | docx, pdf, ppt, xlsx                                                                                                                                          |
| **data**           | 1      | database-design                                                                                                                                               |
| **framework**      | 1      | laravel-feature-scaffold                                                                                                                                      |
| **release**        | 1      | git-release                                                                                                                                                   |
| **security**       | 2      | security-review, skill-vetter                                                                                                                                 |
| **mobile**         | 6      | android, android-compose, android-gradle, android-testing, android-debugging, android-deployment                                                              |
| **implementation** | 1      | coding-agent                                                                                                                                                  |
| **analysis**       | 1      | react-reuse-audit                                                                                                                                             |
| **visualization**  | 1      | charts                                                                                                                                                        |
| **project**        | 1      | project-memory                                                                                                                                                |
| **Total**          | **46** |                                                                                                                                                               |

### Skill-Enabled Workflows

```
@core-factory Use skill:coding-agent to implement {{ feature_name }}.
Use skill:prompt-engineering to optimize the prompt structure.
skill:stack-context to detect current stack state.
```

```
@qa-guardian Use skill:testing-strategy to plan test coverage.
skill:security-review to audit {{ module_name }}.
skill:agent-browser for visual QA screenshots.
```

```
@refactor-architect Use skill:spec-driven-design to define target architecture.
skill:knowledge-architect to map current codebase structure.
```

---

## 14. MCP Servers & Tools

### Overview

MCP (Model Context Protocol) servers extend agent capabilities with specialized tools. Use them via:

- Direct tool calls (e.g., `context7_query-docs()`)
- Agent tool permissions (configured per-agent in `opencode.json`)
- The `mcp` general permission (allows all MCP tools)

### Configured MCP Servers

| Server                  | Status      | Purpose                                       | How to Use                                                |
| ----------------------- | ----------- | --------------------------------------------- | --------------------------------------------------------- |
| **context7**            | ✅ enabled  | Documentation lookup for well-known libraries | `context7_resolve-library-id()` / `context7_query-docs()` |
| **git**                 | ✅ enabled  | Git operations (log, diff, status, blame)     | `git_log()`, `git_diff()`, `git_blame()`                  |
| **sequential-thinking** | ✅ enabled  | Complex multi-step reasoning                  | `sequential-thinking` tool in prompts                     |
| **type-inject**         | ✅ enabled  | TypeScript type discovery & lookup            | `type-inject_lookup_type()`, `type-inject_list_types()`   |
| **stitch**              | ✅ enabled  | Google Stitch design system sync              | `stitch_*` commands for design tokens                     |
| **filesystem**          | ✅ enabled  | File read/write operations                    | Direct file tool calls                                    |
| **memory**              | ⏸️ disabled | Persistent memory across sessions             | Enable in `opencode.json`                                 |
| **fetch**               | ⏸️ disabled | URL content fetching                          | Enable for fetch rules                                    |
| **sqlite**              | ⏸️ disabled | Database queries via MCP                      | Enable for DB analysis                                    |
| **language-server**     | ⏸️ disabled | LSP diagnostics                               | Enable for cross-file analysis                            |
| **personal-knowledge**  | ⏸️ disabled | Personal knowledge base                       | Enable with `bunx opencode-personal-knowledge`            |
| **everything**          | ⏸️ disabled | MCP test server                               | For testing MCP integrations                              |

> **Token Tip**: Only load MCP tools you actually need. Use `context7_query-docs()` for specific library docs, not generic `mcp` tool calls.

### MCP Usage Patterns

**Documentation Lookup (context7):**

```
context7_query-docs({
  "libraryId": "{{ library_id }}",
  "query": "{{ what_you_need }}"
})
```

**Complex Reasoning (sequential-thinking):**
Load the sequential-thinking MCP tool for trade-off analysis, multi-step architecture decisions, or any problem requiring step-by-step reasoning.

**Type Discovery (type-inject):**

```
type-inject_lookup_type({ "name": "{{ TypeName }}", "includeUsages": true })
type-inject_list_types({ "kind": ["interface", "type"] })
```

**Git Operations (git MCP):**

```
git_log({ "maxCount": 10 })
git_diff({ "path": "{{ file_path }}" })
```

### Plugin System

The project has {{ plugin_count }} plugins extending agent functionality:

- `plugins/index.ts` — Plugin registry and initialization
- `plugins/skill-manager.ts` — Skill loading and management
- `plugins/context-manager.ts` — Context compression and optimization

Plugins are loaded automatically on session start.

---

## 15. Self-Improvement & Evolution

### Trigger Self-Evolution

```
@core-factory Run self-evolution cycle.

Use skill:self-reflection to:
1. Run analysis on current configuration
2. Identify improvement opportunities
3. Research better patterns
4. Propose changes (with before/after)
5. Implement if approved
6. Run tests to validate
7. Update memory with learnings
```

### Auto-Research Loop

The lead-strategist agent can run autonomous optimization:

1. Identify performance/quality metrics
2. Run experiments with code changes
3. Measure results
4. Keep improvements, revert failures
5. Log findings to memory

### Config Doctor

```
@devops-engineer /doctor
```

Runs config-doctor to:

1. Validate opencode.json against schema
2. Check all agent files for compliance
3. Verify skill references
4. Fix issues found (with user approval)

### Skill Sync

```
@devops-engineer /sync-skills
```

Bridges project skills to the `skill()` tool via directory junctions.
Run after adding/removing skills from the `skills/` directory.

### Collect Conventions

```
@lead-strategist /collect-conventions
```

Scans the codebase and extracts project conventions into memory.
Useful when onboarding to a new project or after major refactoring.

---

## 16. Edge Cases & Troubleshooting

### "The model is not responding"

1. Check if LM Studio is running: `curl http://127.0.0.1:1234/v1/models`
2. Try switching provider: use `opencode-go` or `openrouter` as fallback
3. Check model name in config matches loaded model
4. Restart OpenCode: close all, run `opencode`

### "Agent is making too many tool calls / looping"

1. Set `steps` limit on the agent in opencode.json
2. Use `plan` agent first to constrain scope
3. Add explicit constraints: "Maximum 3 tool calls"
4. Check if the agent needs more context — provide file contents directly
5. For local models, reduce token window if context is too large

### "Agent ignores my instructions"

1. Check agent's `mode` — subagents only activate when @mentioned
2. Check instructions for conflicting constraints
3. Make instructions more specific — add examples
4. Check that the model has enough tokens for full context
5. Try a more capable model (switch from small to large)

### "Code doesn't compile after agent changes"

1. Run LSP diagnostics immediately
2. Have agent read its own output and validate
3. Use `cargo check` / `tsc --noEmit` / `php -l` as validation step
4. Ask `@qa-guardian` to review specific file
5. Check formatter ran (biome/prettier/pint/rustfmt)

### "Need to undo agent changes"

1. `/undo` — reverts last agent changeset
2. `/undo 3` — reverts last 3 changesets
3. `/redo` — reapplies
4. Git: `git diff HEAD~1` to inspect, `git checkout` to revert

### "Agent can't find a file or module"

1. Use `@explore` to locate the file
2. Check if imports use correct path aliases
3. Verify file exists with glob
4. Check barrel exports (index.ts, mod.rs)
5. Check `.opencode/agents/` for loadable agent definitions

### "Poor quality output from agent"

1. Switch to a better model for that task
2. Add more specific instructions with examples
3. Provide reference code: "Follow the pattern in {{ file_path }}"
4. Use `plan` agent first, then `build` for implementation
5. Lower temperature for more deterministic output (0.05-0.2)
6. Use `sequential-thinking` MCP for complex reasoning

### "Agent modifies wrong file"

1. Check file permissions in agent config — set to `"ask"` for sensitive paths
2. Add explicit exclusions: `"dist/**": "deny"`
3. Use scoped permissions per agent
4. Verify with `@code-reviewer` before merging

### "MCP server not working"

1. Check if server is enabled in `opencode.json` `mcp` section
2. Verify dependencies installed (npx, uvx, bunx commands)
3. Check timeout setting (increase for slow servers)
4. Run manually: `npx -y @modelcontextprotocol/server-name`
5. Check for port conflicts or environment variables

---

## 17. Command Reference

### System Commands

| Command           | Description                     | Agent        |
| ----------------- | ------------------------------- | ------------ |
| `/init`           | Initialize OpenCode for project | core-factory |
| `/connect`        | Configure LLM provider          | —            |
| `/undo [n]`       | Revert last n changes           | —            |
| `/redo`           | Reapply reverted changes        | —            |
| `/model [name]`   | Switch active model             | —            |
| `/switch [agent]` | Switch primary agent            | —            |
| `/tab`            | Cycle primary agents            | —            |
| `/save [name]`    | Save session                    | —            |
| `/restore [name]` | Restore session                 | —            |
| `/diff`           | Show current changes            | —            |

### Custom Commands

| Command                | Description                     | Agent           | Model   |
| ---------------------- | ------------------------------- | --------------- | ------- |
| `/audit`               | Full lint + test suite          | qa-guardian     | default |
| `/test`                | Run test suite                  | qa-guardian     | default |
| `/lint`                | Run linters                     | qa-guardian     | default |
| `/build`               | Build project                   | core-factory    | default |
| `/doctor`              | Audit & fix config              | lead-strategist |
| `/improve`             | Self-improvement analysis       | core-factory    | default |
| `/reflect`             | Analyze config effectiveness    | lead-strategist |
| `/clean`               | Clear project caches            | devops-engineer | default |
| `/db:init`             | Initialize database             | devops-engineer | default |
| `/db:backup`           | Backup database                 | devops-engineer | default |
| `/process:check`       | Check processes & health        | devops-engineer | default |
| `/check-updates`       | Check dependency updates        | devops-engineer | default |
| `/sync-skills`         | Bridge skills via junctions     | devops-engineer | default |
| `/collect-conventions` | Extract project conventions     | lead-strategist | default |
| `/upgrade-config`      | Full self-reflection + proposal | lead-strategist |

### Agent Invocation (in chat)

```
@core-factory → core-factory (primary)
@plan → plan agent
@explore → explore subagent
@scout → scout subagent
@code-reviewer → code review agent (from .opencode/agents/)
@lead-strategist → strategic planning
@software-architect → System design, Node/Bun backend, code quality
@frontend-ui-ux → UI implementation
@backend-laravel → Laravel development
@backend-tauri → Rust/Tauri development
@android-kotlin → Android/Kotlin native
@qa-guardian → Testing & security
@devops-engineer → Infrastructure
@docs-curator → Documentation
@docs-evolver → Doc sync & ADRs (from .opencode/agents/)
@refactor-architect → Refactoring coordination (from .opencode/agents/)
@research-analyst → Research & analysis (from .opencode/agents/)
@integration-test → Test gen & execution (from .opencode/agents/)
@mobile-qa → Mobile QA/testing (from .opencode/agents/)
```

---

## 18. Anti-Patterns to Avoid

### ❌ Vague Prompts

```
// BAD
@core-factory Fix the bug.

// GOOD
@core-factory Fix the N+1 query in {{ Controller }}@{{ method }}.
The endpoint loads {{ count }} records and makes {{ count }} individual queries
for the '{{ relation }}' relationship. Use eager loading instead.
File: {{ file_path }}:{{ line_number }}
```

### ❌ Too Much at Once

```
// BAD
@core-factory Build an entire e-commerce platform.

// GOOD
@core-factory Create the {{ ModelName }} model and migration.
Then: @core-factory Create the {{ ModelName }}Controller
Then: @core-factory Create the API routes
Then: @frontend-ui-ux Create the product listing page
...
```

### ❌ Ignoring Existing Patterns

```
// Always reference existing code:
@core-factory Follow the same pattern as {{ ExistingClass }}
in {{ reference_file }}.
```

### ❌ Not Validating

```
// Always ask for validation:
@core-factory Implement {{ feature_name }}.
After implementation:
1. Run {{ validation_command_1 }}
2. Run {{ validation_command_2 }}
3. Run {{ test_command }}
4. Report any errors
```

### ❌ Forgetting Tests

```
// Always specify testing:
@core-factory Implement {{ feature_name }} with tests.

- Write unit tests for edge cases
- Run test suite after implementation
- Report coverage percentage
```

### ❌ Not Using the Right Agent

```
// DON'T use @core-factory for planning
// DON'T use @plan for implementation
// DON'T use @explore for code changes
// DON'T use @scout for local file edits
// Use @refactor-architect for refactoring plans
// Use @code-reviewer before merging
// Use @mobile-qa for Android testing
// Use @integration-test for automated test runs
```

### ❌ Forgetting Permissions

```
// DON'T give agents unrestricted tool access
// DO scope permissions in opencode.json per agent
// DO use "ask" for destructive operations
// DO set "deny" for paths like .env, node_modules, vendor
```

### ❌ Not Using MCP / Skills

```
// DON'T solve complex reasoning without tools
// DO use sequential-thinking for trade-off analysis
// DO use context7 for library documentation lookup
// DO use skill: for specialized workflows
// DO use type-inject for TypeScript type discovery
```

---

## 19. Token Budget & Efficient Orchestration

### Why Token Efficiency Matters

Every token costs money and time. A 100-token prompt that could be 20 tokens wastes 80% of your budget. For local models (LM Studio), excessive tokens slow inference. For API models (OpenRouter), they increase cost.

### Token Budget Rules

| Rule                  | Guideline                                      | Example                                                                |
| --------------------- | ---------------------------------------------- | ---------------------------------------------------------------------- |
| **Prompt length**     | Keep under 200 tokens for simple tasks         | "Fix N+1 in UserController@index"                                      |
| **Context injection** | Only inject files the agent will actually read | Don't paste entire file if agent only needs 1 function                 |
| **Agent selection**   | Use the cheapest agent that can do the job     | `@explore` for file search, not `@core-factory`                        |
| **Delegation depth**  | Max 3 levels deep                              | strategist → architect → implementer                                   |
| **Skill loading**     | Load only the skill you need, not all skills   | `skill:coding-agent` not `skill:coding-agent,skill:prompt-engineering` |
| **MCP tools**         | Use specific MCP tools, not generic ones       | `context7_query-docs()` not `mcp` generic                              |

### Token-Efficient Prompt Patterns

#### Pattern 1: Direct Command (Lowest Token Cost)

```
@core-factory Fix the N+1 query in UserController@index.
Use eager loading for the 'posts' relationship.
File: app/Http/Controllers/UserController.php:45
```

**Tokens**: ~30 | **Use when**: You know exactly what to fix

#### Pattern 2: Delegated Research (Medium Token Cost)

```
@lead-strategist Coordinate: optimize the user dashboard.

Phase 1: @explore → Find all dashboard-related files
Phase 2: @core-factory → Implement optimizations (wait for Phase 1)
Phase 3: @qa-guardian → Verify performance (wait for Phase 2)
```

**Tokens**: ~60 | **Use when**: Task spans multiple agents

#### Pattern 3: Parallel Execution (High Token Savings)

```
@lead-strategist Run in parallel:
- @software-architect: Add rate limiting to /api/users
- @frontend-ui-ux: Optimize UserList component re-renders
- @devops-engineer: Clear build cache

After all complete: @qa-guardian review
```

**Tokens**: ~70 | **Use when**: Tasks are independent

### Agent Selection for Token Efficiency

| Task Type          | Token-Cost Agent | Token-Efficient Alternative | Savings |
| ------------------ | ---------------- | --------------------------- | ------- |
| Find a file        | `@core-factory`  | `@explore`                  | ~60%    |
| Research a library | `@core-factory`  | `@scout`                    | ~50%    |
| Review code        | `@core-factory`  | `@qa-guardian`              | ~40%    |
| Plan architecture  | `@core-factory`  | `@software-architect`       | ~50%    |
| Write docs         | `@core-factory`  | `@docs-curator`             | ~45%    |

### Context Injection Best Practices

**Bad**: Paste entire 500-line file

```json
{
  "file": "app/Http/Controllers/UserController.php",
  "content": "...500 lines..."
}
```

**Good**: Reference specific line range

```
Read app/Http/Controllers/UserController.php lines 40-60
The N+1 query is at line 45 in the index() method.
```

**Best**: Include only the relevant code snippet

```
File: UserController.php:45
Code: $users = User::all(); foreach ($users as $user) { $user->posts; }
Fix: Use User::with('posts')->get() instead.
```

### Skill Loading for Token Efficiency

**Bad**: Load multiple skills

```
skill:coding-agent skill:prompt-engineering skill:stack-context
```

**Good**: Load one skill at a time

```
skill:coding-agent
```

**Best**: Only load when needed

```
@core-factory Implement the feature.
After implementation: skill:testing-strategy to plan test coverage.
```

### MCP Tool Usage for Token Efficiency

**Bad**: Generic MCP call

```
Use MCP to research the best approach.
```

**Good**: Specific MCP tool

```
context7_query-docs({
  "libraryId": "react",
  "query": "useMemo performance optimization"
})
```

### Orchestration Depth Limits

| Depth     | Token Cost | Use When                              |
| --------- | ---------- | ------------------------------------- |
| 1 agent   | Low        | Simple, single-file changes           |
| 2 agents  | Medium     | Cross-cutting concerns (API + UI)     |
| 3 agents  | High       | Complex features requiring planning   |
| 4+ agents | Very High  | **Avoid** — use workflow YAML instead |

### Token Monitoring

Track token usage per session:

- Simple task: 100-500 tokens
- Medium task: 500-2000 tokens
- Complex task: 2000-5000 tokens
- **Red flag**: >10000 tokens for a single task

### Quick Token Checklist

Before sending a prompt, verify:

- [ ] Is the agent the cheapest option for this task?
- [ ] Am I injecting only the files the agent needs?
- [ ] Is my prompt under 200 tokens?
- [ ] Am I loading only the skill I need?
- [ ] Am I using specific MCP tools, not generic ones?
- [ ] Is the orchestration depth ≤ 3?

---

## Appendix A: Template Variables Reference

Use these `{{ placeholders }}` when adapting prompts for other projects:

| Variable                   | Description                  | Example                                           |
| -------------------------- | ---------------------------- | ------------------------------------------------- |
| `{{ project_name }}`       | Project name                 | opencode                                          |
| `{{ project_stack }}`      | Technology stack             | Tauri (Rust) + React (TypeScript) + Laravel (PHP) |
| `{{ project_example }}`    | Example project reference    | opencode                                          |
| `{{ feature_name }}`       | Feature being implemented    | User Authentication                               |
| `{{ component_name }}`     | UI component name            | UserSettingsPanel                                 |
| `{{ model_name }}`         | Data model name              | UserProfile                                       |
| `{{ controller_name }}`    | Controller name              | UserController                                    |
| `{{ rules_dir }}`          | Directory for project rules  | rules/                                            |
| `{{ docs_dir }}`           | Directory for documentation  | docs/                                             |
| `{{ frontend_stack }}`     | Frontend technology          | React 19 + TypeScript + Tailwind 4 + shadcn/ui    |
| `{{ backend_stack }}`      | Backend technology           | Laravel 13 + Livewire 4                           |
| `{{ android_stack }}`      | Android technology           | Jetpack Compose + Material 3 + Room               |
| `{{ skills_total_count }}` | Number of registered skills  | 46                                                |
| `{{ plugin_count }}`       | Number of active plugins     | 3                                                 |
| `{{ mcp_servers_total }}`  | Total MCP servers configured | 12                                                |
| `{{ default_model }}`      | Default LLM model            | lmstudio/gemma-4-e4b-it                           |

## Appendix B: Agent Quick Reference Card

| Agent              | Temperature | Model               | Provider | Best For                                      |
| ------------------ | ----------- | ------------------- | -------- | --------------------------------------------- |
| core-factory       | 0.3         | {{ default_model }} | lmstudio | Primary orchestrator + implementation         |
| plan               | 0.1         | {{ default_model }} | lmstudio | Read-only analysis                            |
| explore            | 0.0         | {{ default_model }} | lmstudio | Fast codebase search                          |
| scout              | 0.2         | {{ default_model }} | lmstudio | External research                             |
| lead-strategist    | 0.4         | qwen-3-235b-a22b    | lmstudio | Strategy & coordination                       |
| software-architect | 0.2         | qwen-3-235b-a22b    | lmstudio | System design, Node/Bun backend, code quality |
| frontend-ui-ux     | 0.4         | {{ default_model }} | lmstudio | UI components & design                        |
| backend-laravel    | 0.3         | {{ default_model }} | lmstudio | Laravel/PHP features                          |
| backend-tauri      | 0.2         | {{ default_model }} | lmstudio | Rust/Tauri commands                           |
| android-kotlin     | 0.3         | {{ default_model }} | lmstudio | Android/Kotlin native                         |
| qa-guardian        | 0.05        | {{ default_model }} | lmstudio | Testing & security                            |
| devops-engineer    | 0.1         | {{ default_model }} | lmstudio | Infrastructure & ops                          |
| docs-curator       | 0.2         | {{ default_model }} | lmstudio | Documentation                                 |
| code-reviewer      | —           | {{ default_model }} | lmstudio | Code quality analysis                         |
| docs-evolver       | —           | {{ default_model }} | lmstudio | Doc sync & ADRs                               |
| integration-test   | —           | {{ default_model }} | lmstudio | Test gen & execution                          |
| mobile-qa          | —           | {{ default_model }} | lmstudio | Mobile QA/testing                             |
| refactor-architect | —           | qwen-3-235b-a22b    | lmstudio | Refactoring coordination                      |
| research-analyst   | —           | qwen-3-235b-a22b    | lmstudio | Best practices & gaps                         |

> **Note**: Agents without explicit temperature in `opencode.json` inherit the default model temperature. Agents marked with `—` are loaded from `.opencode/agents/*.md` files and use their default configuration.

## Appendix C: Internal Directory Structure

Key directories and their purposes:

```
.opencode/
├── agents/          # Additional agent definitions (20 agents)
│   ├── core-factory.md, plan.md, explore.md, ...
│   ├── code-reviewer.md, docs-evolver.md, integration-test.md
│   ├── mobile-qa.md, refactor-architect.md, research-analyst.md
├── commands/        # Custom command definitions
│   ├── improve.md, upgrade-config.md
├── skills/          # Internal system skills
│   ├── plan-mode/       # Plan-first workflow
│   ├── skill-evolution/ # Skill improvement workflow
│   ├── skill-refiner/   # Evidence-driven skill patching
├── tools/           # Agent-accessible tools
├── models/          # Model provider configurations
├── scripts/         # Utility scripts
```

---

_End of Prompting Guide v3.1_
