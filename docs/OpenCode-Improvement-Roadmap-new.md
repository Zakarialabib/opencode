# OpenCode Project — Improvement Roadmap (Remaining Work)

> **Repository**: [https://github.com/Zakarialabib/opencode](https://github.com/Zakarialabib/opencode)  
> **Updated**: May 2026  
> **Note**: This roadmap has been updated to remove completed items (like critical fixes, portability, basic CI/CD, basic tests, and initial documentation setup). The remaining items are focused on architecture, testing coverage, security, and advanced features.

---

## Table of Contents

1. [Completed Cleanup](#completed-cleanup)
2. [Testing & Quality Assurance](#1-testing--quality-assurance)
3. [Security Hardening](#2-security-hardening)
4. [Architecture & Code Quality](#3-architecture--code-quality)
5. [Agent System Improvements](#4-agent-system-improvements)
6. [Plugin System Improvements](#5-plugin-system-improvements)
7. [Skill System Improvements](#6-skill-system-improvements)
8. [Workflow Engine Improvements](#7-workflow-engine-improvements)
9. [Documentation Improvements](#8-documentation-improvements)
10. [Configuration Management](#9-configuration-management)
11. [Community & Open Source Readiness](#10-community--open-source-readiness)
12. [Performance & Optimization](#11-performance--optimization)
13. [Feature Additions & Enhancements](#12-feature-additions--enhancements)
14. [Implementation Timeline Suggestion](#13-implementation-timeline-suggestion)

---

## Completed Cleanup (May 2026)

### Agents Cleanup

- **Archived stale agent systems** (44 orphaned `.md` files) to `agents/archive/`:
  - `agents/agentic/` (6 read-only research subagents — not wired in opencode.json)
  - `agents/merged/` (2 next-gen agent definitions — not registered)
  - `agents/oac/` (36 markdown + 5 JSON files, ~350KB — fully disconnected internal framework)
- All 10 top-level agents remain active and fully wired in opencode.json

### Docs Cleanup

- **Deleted** `docs/minimax/MODULAR_CMS_EXTRACTION_GUIDE.md` (modular concept, not user's coding style)
- **Deleted** `docs/minimax/LIVEWIRE_V4_UPGRADE_GUIDE.md` (no Livewire migration now)
- **Deleted** `docs/minimax/ARTISAN_AUTOMATION_GUIDE.md` (Laravel-specific)
- **Deleted** `docs/minimax/IMPROVEMENTS_PLAN.md` (CMS/Laravel focused)
- **Deleted** `docs/minimax/AGENTS_OPTIMIZATION.md`, `SKILLS_DEVELOPMENT_GUIDE.md`, `OPENCODE_WORKFLOWS_ENHANCEMENT.md` (all CMS/Laravel-focused)
- **Removed** entire `docs/minimax/` directory

### Skills Index Fixed

- Updated 6 stale agent references in `skills/index.json`:
  - `lead-orchestrator` → `core-factory`
  - `devops-ops` → `devops-engineer`
  - `docs-writer` → `docs-curator`
  - `marketing-mode` → `docs-curator`
  - `core-builder` → `core-factory`
  - `qa-tester` → `qa-guardian`

### Docs Updated

- **Agents-Guide.md**: Verified 10-agent count (consistent with opencode.json)
- **Skills-Guide.md**: Expanded skills table from 16 to 32 entries, added 63 total note
- **Prompting-Guide.md**: Fixed "12 agents" → "10 agents"
- **Workflows-Guide.md**: Fixed "19-agent setup" → "10-agent setup"
- **Prompting-and-Context-Engineering.md**: Fixed encoding (removed BOM), fixed `lead-orchestrator` → `lead-strategist`, fixed `qa-security` → `qa-guardian`, removed duplicate content

### New Workflows Added

- `workflows/code-review.yaml` — Automated code review with quality checks, security scanning
- `workflows/documentation.yaml` — Documentation generation & audit with gap discovery

### Tests

- All 14 tests pass (3 test suites)
- Pre-existing TypeScript issues in `plugins/__tests__/agent-router.test.ts` and `tools/db-query.ts` (unrelated to cleanup)

---

## 1. Testing & Quality Assurance

### 1.1 Write Tests for Existing Plugins

While some tests have been added (`agent-router`, `config-validation`), the majority of plugins lack coverage. Each plugin needs comprehensive tests.

**Priority test targets:**
| Plugin | Risk Level | Test Priority |
|--------|-----------|---------------|
| `model-router.ts` | High — selects AI models | P0 |
| `mcp-manager.ts` | High — manages MCP servers | P0 |
| `skill-manager.ts` | Medium — discovers skills | P1 |
| `context-manager.ts` | Medium — manages context | P1 |
| `process-monitor.ts` | Medium — monitors health | P1 |
| `index.ts` | High — main plugin, file ops | P0 |
| `jsonc-utils.ts` | Low — utility parser | P2 |

### 1.2 Write Tests for the Workflow Engine

The `workflow-engine.js` is a critical orchestration component with zero tests.

**Action items:**

- [ ] Test YAML workflow parsing and validation
- [ ] Test phase execution order (sequential and parallel)
- [ ] Test retry policies and failure handling
- [ ] Test exit criteria evaluation
- [ ] Test MCP integration within workflow phases
- [ ] Test workflow state persistence and recovery

### 1.3 Write Integration Tests

**Action items:**

- [ ] Test the full agent lifecycle: load → route → execute → validate output
- [ ] Test MCP server startup and shutdown
- [ ] Test skill discovery and invocation
- [ ] Test the complete feature-development workflow end-to-end
- [ ] Test the complete bug-fix workflow end-to-end

### 1.4 Add Pre-Commit Hooks

Use Husky or lint-staged to enforce quality before commits land.

**Action items:**

- [ ] Install Husky: `bun add -d husky lint-staged` or `npm install -D husky lint-staged`
- [ ] Configure pre-commit hook to run linters and related tests
- [ ] Configure pre-push hook to run full test suite
- [ ] Configure commit-msg hook for conventional commits

---

## 2. Security Hardening

### 2.1 Audit API Key Handling

API keys are referenced via environment variables in `opencode.json`, but:

- No validation that keys are set before use
- No clear error message if keys are missing
- Keys could leak through logs, error messages, or the database

**Action items:**

- [ ] Create a startup validation step that checks all required environment variables
- [ ] Provide clear, actionable error messages when keys are missing
- [ ] Never log or store API keys in plaintext
- [ ] Add a `config:check` command that validates all required secrets are available

### 2.2 Sanitize MCP Server Arguments

MCP server commands and arguments in `opencode.json` are executed directly. If any user input flows into these commands, it could be a command injection vector.

**Action items:**

- [ ] Audit all MCP server command constructions for injection risks
- [ ] Validate and sanitize any user-provided arguments before passing to MCP servers
- [ ] Use `execFile` instead of `exec` where possible (avoids shell injection)
- [ ] Add allowlist validation for MCP server commands

### 2.3 Plugin Permission Model

The `opencode.json` defines permissions for agents and tools, but plugins have no permission model. A malicious or buggy plugin could access the filesystem, make network requests, or execute arbitrary commands.

**Action items:**

- [ ] Define a plugin permission system (filesystem, network, subprocess, etc.)
- [ ] Require plugins to declare required permissions in a manifest
- [ ] Enforce permissions at runtime with sandboxing or capability checks
- [ ] Add a `skill-vetter` step for third-party plugins before installation

### 2.4 Secure the Database

The `database.sqlite` file stores persistent state but has limited security measures in place.

**Action items:**

- [ ] Consider encrypting sensitive data in the database
- [ ] Add database migration system for schema changes
- [ ] Implement database backup/restore as a documented command

---

## 3. Architecture & Code Quality

### 3.1 Module Boundaries and Imports

The current codebase has loose coupling but no clear module boundaries. Plugins import from each other, and there are circular dependency risks.

**Action items:**

- [ ] Define a clear module dependency graph (plugins → core → utils)
- [ ] Enforce unidirectional imports (no circular dependencies)
- [ ] Create a shared `types/` directory for common TypeScript interfaces
- [ ] Use `import type` for type-only imports to reduce bundle size
- [ ] Consider a barrel export pattern (`plugins/index.ts`) for clean public API

### 3.2 Error Handling Standards

Current error handling is inconsistent — some plugins use try/catch, others let errors propagate silently.

**Action items:**

- [ ] Define a standard error hierarchy (`OpenCodeError`, `PluginError`, `AgentError`, etc.)
- [ ] Create a centralized error handler with structured logging
- [ ] Implement error recovery strategies for each component
- [ ] Add error telemetry (opt-in) to understand failure patterns
- [ ] Ensure no errors are silently swallowed

### 3.3 Logging and Observability

There's no structured logging system. Debugging issues in production is difficult without visibility.

**Action items:**

- [ ] Implement a structured logger with log levels (debug, info, warn, error)
- [ ] Support log output to file, console, and optionally remote
- [ ] Add request/response logging for MCP server interactions
- [ ] Add performance logging for agent execution times
- [ ] Consider adding OpenTelemetry for distributed tracing

### 3.4 Code Documentation

Many TypeScript files lack JSDoc comments, and complex logic is unexplained.

**Action items:**

- [ ] Add JSDoc comments to all exported functions and classes
- [ ] Add inline comments for complex logic (especially in `workflow-engine.js`)
- [ ] Add `@example` tags to JSDoc for public API functions

---

## 4. Agent System Improvements

### 4.1 Resolve Agent Definition vs. Config Mismatch

There were many agent definition files in `agents/` (inside `oac/`, `agentic/`, `merged/`) but only 10 agents configured in `opencode.json`. **Resolved: 44 orphaned agent files archived to `agents/archive/`.**

**Completed actions:**

- [x] Audit all remaining agent definition files — 44 orphaned files found
- [x] Classify each as active (10), draft (0), or deprecated (44)
- [x] Move inactive/draft agents to `agents/archive/`
- [x] Ensure every agent in `opencode.json` has a corresponding definition file

**Remaining:**

- [ ] Add a `status` field to agent definitions (active/draft/deprecated)
- [ ] Create an `agents/README.md` explaining the agent hierarchy

### 4.2 Agent Definition Size Optimization

Some agent directories (like `oac/`) contain massive markdown prompts that consume tokens and may exceed context windows.

**Action items:**

- [ ] Audit each agent definition for bloat and redundancy
- [ ] Extract shared instructions into a common base prompt (DRY principle)
- [ ] Compress verbose instructions into concise, actionable directives
- [ ] Add token count estimates to each agent definition header
- [ ] Consider a tiered loading system
- [ ] Target: each agent definition should be under 5KB for routine use

### 4.3 Agent Evaluation Framework

There's no way to measure whether agents are performing well or degrading over time.

**Action items:**

- [ ] Create an evaluation framework (`agents/eval/`)
- [ ] Define benchmark tasks for each agent
- [ ] Measure: accuracy, relevance, token efficiency, response time
- [ ] Create a scoring system and track scores over time
- [ ] Add regression tests that catch agent quality degradation

### 4.4 Agent Communication Protocol

Agents currently operate independently. There's no standardized way for agents to communicate, share context, or hand off tasks.

**Action items:**

- [ ] Define a message format for inter-agent communication
- [ ] Implement a shared context bus that agents can read/write
- [ ] Add agent handoff protocols (with context transfer)
- [ ] Support agent chaining (output of one → input of another)
- [ ] Add agent collaboration patterns (parallel, sequential, hierarchical)

### 4.5 Dynamic Agent Loading

All agents are loaded at startup, consuming memory even if not used.

**Action items:**

- [ ] Implement lazy loading — load agent definitions only when needed
- [ ] Add agent lifecycle management (initialize → active → idle → shutdown)
- [ ] Support hot-reloading of agent definitions without restart
- [ ] Add agent health checks and automatic recovery

---

## 5. Plugin System Improvements

### 5.1 Plugin Interface Standardization

Each plugin currently has a slightly different structure. Standardize the plugin interface.

**Action items:**

- [ ] Define a formal `OpenCodePlugin` interface in `types/`
- [ ] Refactor all plugins to implement this interface
- [ ] Add plugin versioning and compatibility checks
- [ ] Add plugin dependency declaration and resolution

### 5.2 Plugin Configuration

Plugins have no way to accept user configuration. All behavior is hardcoded.

**Action items:**

- [ ] Add a `pluginConfig` section to `opencode.json`
- [ ] Each plugin declares its config schema
- [ ] Validate plugin config against schema at startup
- [ ] Support runtime config changes without restart

### 5.3 Plugin Error Isolation

A crash in one plugin should not bring down the entire system.

**Action items:**

- [ ] Wrap each plugin call in try/catch with structured error reporting
- [ ] Add circuit breaker pattern for failing plugins
- [ ] Implement plugin health scoring — temporarily disable consistently failing plugins
- [ ] Add plugin crash recovery with automatic restart

---

## 6. Skill System Improvements

### 6.1 Skill Quality Standards

Skill quality varies widely. Some are enormous while others have minimal instructions.

**Completed actions:**

- [x] Fixed 6 stale agent references in `skills/index.json` (orphaned agent names → active agents)
- [x] All 63 skills verified to have SKILL.md files

**Action items:**

- [ ] Define a minimum skill quality standard (structure, completeness, examples)
- [ ] Create a skill template (`skills/_template/SKILL.md`)
- [ ] Add a `skill-vetter` automation that checks quality before merging
- [ ] Add skill testing framework — each skill should have test cases

### 6.2 Skill Size Optimization

Some skill definitions are extremely large, consuming significant tokens when loaded.

**Action items:**

- [ ] Audit all skill definitions for size
- [ ] Split oversized skills into core + optional sections
- [ ] Implement tiered loading — load summary first, full details on demand
- [ ] Add token count estimates to skill metadata

### 6.3 Skill Dependency Management

Skills may depend on other skills, external tools, or MCP servers, but these dependencies aren't explicitly declared.

**Action items:**

- [ ] Add a `requires` field to `SKILL.md` frontmatter
- [ ] Validate skill dependencies at load time
- [ ] Provide clear error messages when dependencies are missing
- [ ] Support optional dependencies with graceful degradation

### 6.4 Skill Output Standards

Skills produce different output formats with no standardization.

**Action items:**

- [ ] Define standard skill output formats (text, file, structured data)
- [ ] Add output schema declarations to skill metadata
- [ ] Validate skill outputs against declared schemas
- [ ] Support skill output chaining (output of one skill feeds into another)

---

## 7. Workflow Engine Improvements

### 7.1 Workflow Schema Validation

Workflows are YAML files but there's no schema validation. Invalid YAML will fail at runtime.

**Action items:**

- [ ] Create a JSON Schema for workflow YAML files (`workflows/workflow-schema.json`)
- [ ] Add workflow validation to the CI pipeline
- [ ] Validate workflows at load time, not just at execution time
- [ ] Provide clear error messages for invalid workflow definitions

### 7.2 Workflow State Persistence

If a workflow fails mid-execution, there's no way to resume from where it left off.

**Action items:**

- [ ] Implement workflow state checkpointing after each phase
- [ ] Support workflow resume from last completed phase
- [ ] Add workflow execution history with full audit trail
- [ ] Support workflow rollback to a previous phase

### 7.3 Workflow Visualization

Complex workflows are hard to understand from YAML alone.

**Action items:**

- [ ] Generate visual workflow diagrams from YAML definitions
- [ ] Add a `workflow:visualize` command that renders a flowchart
- [ ] Show workflow execution progress in real-time
- [ ] Add a TUI workflow monitor

### 7.4 Workflow Error Handling

Current error handling in workflows is basic — retry policies exist but recovery is limited.

**Action items:**

- [ ] Add conditional branching (if/else) in workflow phases
- [ ] Support error handling workflows (on-failure triggers)
- [ ] Add timeout enforcement for each phase
- [ ] Support manual approval gates between phases
- [ ] Add workflow-level cancellation support

### 7.5 More Workflow Templates

Only two workflows exist: `feature-development.yaml` and `bug-fix.yaml`.

**Completed additions:**

- [x] `code-review.yaml` — Automated code review workflow with quality checks, security scanning, and actionable recommendations
- [x] `documentation.yaml` — Documentation generation & audit with gap discovery, quality audit, and knowledge base updates

**Suggested additions:**

- [ ] `refactoring.yaml` — Safe refactoring with test verification
- [ ] `release.yaml` — Release preparation and validation
- [ ] `onboarding.yaml` — New developer onboarding with project setup
- [ ] `security-audit.yaml` — Security scanning and remediation
- [ ] `performance.yaml` — Performance profiling and optimization
- [ ] `migration.yaml` — Technology migration (e.g., JS → TS)

---

## 8. Documentation Improvements

### 8.1 API Documentation

Generate API documentation for the plugin system and workflow engine.

**Action items:**

- [ ] Add `TypeDoc` configuration
- [ ] Generate API docs from JSDoc comments
- [ ] Host docs on GitHub Pages or similar
- [ ] Add doc generation to CI pipeline

### 8.2 Architecture Decision Records

Major architectural decisions should be documented.

**Action items:**

- [ ] Create `docs/adr/` directory
- [ ] Write ADRs for:
  - ADR-001: Why YAML for workflows instead of JSON or JS
  - ADR-002: Why Biome + Prettier dual formatting
  - ADR-003: Why SQLite for persistent state
  - ADR-004: Why MCP as the tool integration layer
  - ADR-005: Why agent hierarchy with lead strategist pattern
  - ADR-006: Why plugin-based extensibility over monolithic design
- [ ] Add ADR template for future decisions

### 8.3 Improve Existing Documentation

The `docs/` directory has several files, but they could be more actionable.

**Action items:**

- [ ] Add code examples to every guide
- [ ] Add troubleshooting sections for common issues
- [ ] Add "Expected Output" sections so users know what success looks like
- [ ] Create a FAQ document
- [ ] Add a glossary of terms (agent, skill, plugin, MCP, workflow, etc.)
- [ ] Ensure all documentation is version-synced with the codebase

---

## 9. Configuration Management

### 9.1 Config Profile System

Different use cases need different configurations (personal dev, team, CI/CD, demo).

**Action items:**

- [ ] Support multiple config profiles: `opencode.json`, `opencode.local.json`, `opencode.ci.json`
- [ ] Add profile switching: `--profile=ci`
- [ ] Support config merging (base + overlay)
- [ ] Add config diff command to compare profiles

### 9.2 Config Migration System

When `opencode.json` schema changes, existing configs may break.

**Action items:**

- [ ] Add config version field: `"configVersion": "1.0.0"`
- [ ] Create migration scripts for each version bump
- [ ] Auto-migrate configs on startup with user confirmation
- [ ] Backup configs before migration

### 9.3 Config Documentation

The `config-schema.json` is 20KB but not user-friendly.

**Action items:**

- [ ] Generate a human-readable config reference from the JSON Schema
- [ ] Add examples for every config field
- [ ] Add a `config:explain` command that describes each field
- [ ] Create a config wizard for first-time setup

### 9.4 Reduce Config Size

The `opencode.json` is still quite large and complex.

**Action items:**

- [ ] Split into multiple files: `agents.json`, `mcp.json`, `plugins.json`, `models.json`
- [ ] Support imports/references between config files
- [ ] Move agent prompts to external files (already done for some) and reference them
- [ ] Add config minification for production

---

## 10. Community & Open Source Readiness

### 10.1 Good First Issues

Make it easy for new contributors to get started.

**Action items:**

- [ ] Label approachable issues as `good first issue`
- [ ] Create a `CONTRIBUTING.md` with step-by-step guide (enhance the current one)
- [ ] Add a `docs/contributing/` directory with guides for each type of contribution
- [ ] Mentor first-time contributors actively

---

## 11. Performance & Optimization

### 11.1 Startup Performance

Loading 63 skills, agent definitions, 11 plugins, and 9 MCP servers at startup can be slow.

**Action items:**

- [ ] Measure and benchmark startup time
- [ ] Implement lazy loading for skills (load index only, full skill on demand)
- [ ] Implement lazy loading for agents (load active agents only, others on demand)
- [ ] Cache compiled/parsed configurations
- [ ] Parallelize MCP server startup
- [ ] Add startup progress indicator

### 11.2 Token Optimization

Agent prompts and skill definitions consume significant tokens. Every token costs money and adds latency.

**Action items:**

- [ ] Audit all agent definitions for token efficiency
- [ ] Create compressed versions of verbose prompts
- [ ] Implement dynamic context window management
- [ ] Add token counting and budget tracking per session
- [ ] Implement intelligent context pruning (keep relevant, discard stale)

### 11.3 MCP Server Performance

Running multiple MCP servers simultaneously may cause resource contention.

**Action items:**

- [ ] Profile MCP server resource usage
- [ ] Implement MCP server pooling (start on demand, shut down after idle)
- [ ] Add MCP server health monitoring with automatic restart
- [ ] Implement MCP request queuing and throttling
- [ ] Add MCP response caching where appropriate

### 11.4 Database Performance

SQLite is fine for single-user but may become a bottleneck.

**Action items:**

- [ ] Add database connection pooling
- [ ] Implement WAL mode for better concurrent read/write performance
- [ ] Add database indexes for common queries
- [ ] Implement periodic database cleanup (VACUUM, prune old data)
- [ ] Add database performance monitoring

---

## 12. Feature Additions & Enhancements

### 12.1 Agent Memory and Learning

Agents should improve over time based on user feedback.

**Action items:**

- [ ] Implement user feedback collection (thumbs up/down on agent responses)
- [ ] Store feedback in the database for analysis
- [ ] Use feedback to adjust agent behavior (prompt refinement)
- [ ] Add few-shot learning from successful interactions
- [ ] Implement agent personalization (adapt to user's coding style)

### 12.2 Streaming and Real-Time Feedback

Agent operations can be slow. Users need real-time progress updates.

**Action items:**

- [ ] Implement streaming output for all agent operations
- [ ] Add progress indicators for long-running operations
- [ ] Support partial result display (show what's done while more is generated)
- [ ] Add cancellation support for in-progress operations

### 12.3 Automated Dependency Updates

Keep dependencies current without manual effort.

**Action items:**

- [ ] Add Dependabot or Renovate configuration
- [ ] Automate security patch updates
- [ ] Add dependency compatibility testing
- [ ] Schedule weekly dependency update PRs

---

## 13. Implementation Timeline Suggestion

### Phase 1: Test Coverage & Hardening

- Complete test suites for all plugins and workflow engine
- Resolve remaining API key/MCP security audits
- Add Pre-Commit hooks and solidify architecture boundaries

### Phase 2: System Optimization

- Optimize agent and skill size definitions
- Implement plugin standardization and lazy loading
- Reduce config file size and setup configuration profiles

### Phase 3: Advanced Capabilities

- Implement workflow state persistence and visualization
- Roll out Agent Memory and Real-Time Feedback
- Implement Database and Startup Performance improvements
