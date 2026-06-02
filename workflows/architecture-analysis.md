# OpenCode Architecture Refactoring — Comprehensive Analysis

> **Date**: 2026-05-10
> **Scope**: Full workspace refactoring for Tauri + React + Laravel stack
> **Reference**: https://opencode.ai/docs

---

## 1. Current State Assessment

### 1.1 Configuration Issues (`opencode.json`)

| Issue                          | Severity | Details                                                                                                 |
| ------------------------------ | -------- | ------------------------------------------------------------------------------------------------------- |
| No `model` field               | HIGH     | Missing global default model — agents may inherit wrong model                                           |
| No `project` metadata          | MEDIUM   | No stack/language declaration for auto-detection                                                        |
| No `trae` config               | MEDIUM   | `.trae` directory exists but no integration configured                                                  |
| Kimi as default in opencode-go | MEDIUM   | `kimi-k2.6` listed last — depending on provider resolution order, it may be selected over better models |
| Missing `steps` on agents      | LOW      | No max iteration limits on any agent                                                                    |
| No `mode` on custom agents     | MEDIUM   | All agents default to `all` mode — subagents should be explicit                                         |
| Permissions too permissive     | HIGH     | `webfetch: ask`, `websearch: ask` should be `allow` for research agents                                 |
| Missing MCP servers            | MEDIUM   | No `puppeteer` for deep-research scraping                                                               |
| No fallback model routing      | HIGH     | If LM Studio is down, no automatic fallback to cloud provider                                           |

### 1.2 Agent Architecture Issues

**Current**: 7 agents in `agents/` directory with mixed quality

- `core-factory.md` — Good but missing self-evolution instructions
- `lead-strategist.md` — Good but missing model/provider binding
- `docs-curator.md` — Good but missing autoresearch integration
- `backend-laravel.md` — Feature list, not proper agent format
- `backend-tauri.md` — Same, needs proper agent structure
- `software-architect.md` — Same
- `frontend-ui-ux.md` — Same
- `qa-guardian.md` — Good but missing steps limit
- `devops-engineer.md` — Minimal instructions

**Missing Agents**:

- `refactor-architect` — System-level refactoring coordinator
- `code-reviewer` — Pure analysis, no modification capability
- `research-analyst` — External research and gap analysis
- `integration-test` — Test generation and execution
- `docs-evolver` — Documentation synchronization

### 1.3 Skill Issues

| Skill                     | Issue                                                  |
| ------------------------- | ------------------------------------------------------ |
| `autoresearch`            | No integration with `core-factory` auto-evolution loop |
| `self-improver`           | Triggers on `/improve` but no `/evolve` trigger        |
| `config-doctor`           | Only validates, doesn't auto-fix                       |
| `deep-research`           | References `puppeteer` MCP which isn't configured      |
| Missing `security-review` | No dedicated security scanning skill                   |
| Missing `qa-tester`       | No test strategy skill                                 |
| `skills/index.json`       | Missing — skills not indexed                           |

### 1.4 Naming Convention Violations (Estimated)

Based on common patterns in Tauri + React + Laravel projects:

| Stack      | Expected Convention                          | Likely Violations                |
| ---------- | -------------------------------------------- | -------------------------------- |
| Rust       | `snake_case` functions, `PascalCase` structs | Mixed casing in command handlers |
| TypeScript | `camelCase` vars, `PascalCase` components    | Possible `kebab-case` exports    |
| PHP        | `snake_case` methods, `PascalCase` classes   | `camelCase` method names         |
| Files      | `kebab-case` filenames                       | Possible `PascalCase` TS files   |

### 1.5 MCP Coverage Gaps

| Missing MCP             | Impact                                   |
| ----------------------- | ---------------------------------------- |
| `puppeteer`             | `deep-research` skill can't scrape pages |
| `playwright` (optional) | E2E testing from MCP                     |
| `postgres` (optional)   | If Postgres used instead of SQLite       |
| `docker` (optional)     | Container management                     |

---

## 2. Target Architecture

### 2.1 Agent Hierarchy

```
┌─────────────────────────────────────────────────────────┐
│                    USER SESSION                          │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  PRIMARY AGENTS (Tab-switchable)                        │
│  ┌─────────────┐  ┌─────────────┐                      │
│  │    build     │  │    plan      │                      │
│  │ (core-factory)│  │ (restricted)│                      │
│  └──────┬──────┘  └──────┬──────┘                      │
│         │                │                              │
│  ┌──────▼────────────────▼──────┐                      │
│  │     SUBAGENTS (invoked via @) │                      │
│  ├───────────────────────────────┤                      │
│  │ explore    │ scout            │                      │
│  │ code-reviewer │ refactor-architect │                 │
│  │ research-analyst │ integration-test │                │
│  │ docs-evolver │ lead-strategist  │                    │
│  │ software-architect │ frontend-ui-ux │                   │
│  │ software-architect │ backend-laravel │                      │
│  │ backend-tauri │ qa-guardian │                        │
│  │ devops-engineer │             │                      │
│  └───────────────────────────────┘                      │
│                                                         │
│  HIDDEN AGENTS (auto-invoked)                           │
│  ┌──────────────────────────────────┐                   │
│  │ compaction │ title │ summary     │                   │
│  └──────────────────────────────────┘                   │
└─────────────────────────────────────────────────────────┘
```

### 2.2 Model Routing Strategy

```
┌──────────────────────────────────────────────────────────┐
│                   MODEL ROUTING                          │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  FAST / CHEAP (local LM Studio)                          │
│  ├── qwen3.5-4b (plan, explore, scout)                   │
│  ├── gemma-4-e4b-it (frontend UI generation)             │
│  └── Default fallback for all subagents                  │
│                                                          │
│  POWERFUL / REASONING (OpenCode Go)           │
│  ├── qwen-3-235b-a22b (lead-strategist, software-architect)  │
│  ├── qwen-3-235b-a22b (docs-curator, refactor-architect) │
│  └── Complex reasoning, architecture decisions           │
│                                                          │
│  BALANCED (LM Studio Reasoning)                          │
│  ├── qwen3.5-4b-claude-4.6-opus-reasoning (build, QA)   │
│  ├── software-architect, backend-laravel, backend-tauri         │
│  └── qa-guardian, integration-test, devops-engineer      │
│                                                          │
│  CLOUD FALLBACK (OpenRouter)                             │
│  ├── Ring 2.6-1t (when local models unavailable)         │
│  └── Laguna M.1 (load balancing)                         │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### 2.3 Permission Matrix

```
                    read  edit  write  bash  skill  web  memory  mcp
build               ✅    ✅     ✅     ✅     ✅     ❌    ❌      ❌
plan                ✅    ❌     ❌     ❌     ❌     ❌    ❌      ❌
explore             ✅    ❌     ❌     ❌     ❌     ❌    ❌      ❌
scout               ✅    ❌     ❌     🔒    ❌     ✅    ❌      ❌
code-reviewer       ✅    ❌     ❌     ❌     ❌     ❌    ✅      ❌
refactor-architect  ✅    ❌     ❌     ❌     ✅     ❌    ✅      ❌
research-analyst    ✅    ❌     ❌     ❌     ❌     ✅    ✅      ❌
integration-test    ✅    🔒    ❌     ✅     ❌     ❌    ✅      ❌
docs-evolver        ✅    ✅     ✅     🔒    ✅     ✅    ✅      ❌
core-factory        ✅    ✅     ✅     ✅     ✅     ❌    ✅      ✅
lead-strategist     ✅    🔒    🔒     ✅     ✅     ❌    ✅      ✅
software-architect      ✅    ✅     ✅     ✅     ✅     ❌    ✅      ✅
frontend-ui-ux      ✅    ✅     ✅     ✅     ✅     ❌    ✅      ✅
software-architect         ✅    ✅     ✅     ✅     ✅     ❌    ✅      ❌
backend-laravel     ✅    ✅     ✅     ✅     ✅     ❌    ✅      ❌
backend-tauri       ✅    ✅     ✅     ✅     ✅     ❌    ✅      ❌
qa-guardian         ✅    ❌     ❌     ✅     ✅     ❌    ✅      ❌
devops-engineer     ✅    ✅     ✅     ✅     ✅     ❌    ✅      ❌

✅ = allow  ❌ = deny  🔒 = ask
```

### 2.4 Self-Evolution Loop

```
┌─────────────────────────────────────────────────────────┐
│              CORE-FACTORY SELF-EVOLUTION                 │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌──────────────┐                                       │
│  │ COMPLETE TASK │                                       │
│  └──────┬───────┘                                       │
│         │                                               │
│         ▼                                               │
│  ┌──────────────┐    ┌──────────────┐                   │
│  │ SELF-EVAL    │───▶│ IDENTIFY     │                   │
│  │ (audit)      │    │ IMPROVEMENTS │                   │
│  └──────────────┘    └──────┬───────┘                   │
│                            │                            │
│                            ▼                            │
│  ┌──────────────┐    ┌──────────────┐                   │
│  │ RESEARCH     │◀───│ PROPOSE      │                   │
│  │ (best        │    │ CHANGES      │                   │
│  │  practices)  │    └──────┬───────┘                   │
│  └──────────────┘           │                            │
│                            ▼                            │
│  ┌──────────────┐    ┌──────────────┐                   │
│  │ VALIDATE     │───▶│ IMPLEMENT    │                   │
│  │ (tests)      │    │ (with review)│                   │
│  └──────────────┘    └──────┬───────┘                   │
│                            │                            │
│                            ▼                            │
│  ┌──────────────┐                                       │
│  │ UPDATE       │──▶ Store in memory for next cycle    │
│  │ MEMORY       │                                      │
│  └──────────────┘                                       │
│                                                         │
│  Triggers: /evolve, /self-improve, after complex tasks │
│  Frequency: Every complex task, weekly auto-scan       │
└─────────────────────────────────────────────────────────┘
```

---

## 3. Refactoring Priorities

### Priority 1: CRITICAL — Architecture Violations

- Replace all `unwrap()` in Rust with `expect()` or proper error handling
- Replace all `any` types in TypeScript with proper types
- Fix deep relative imports (4+ levels) with path aliases
- Add missing error handling in async operations

### Priority 2: HIGH — Naming Conventions

- Standardize all file names to `kebab-case`
- Ensure React components use `PascalCase` exports
- Ensure Rust functions use `snake_case`
- Ensure PHP methods use `snake_case`
- Ensure constants use `SCREAMING_SNAKE_CASE`

### Priority 3: HIGH — Agent Restructuring

- Add `mode` field to all custom agents
- Add `model` + `provider` binding to all agents
- Add `steps` limits to all agents
- Create 5 new specialized agents
- Tighten permissions per agent role

### Priority 4: HIGH — Missing Global Model

- Add `"model"` field to `opencode.json`
- Set to best local reasoning model
- Enable automatic fallback to cloud providers

### Priority 5: MEDIUM — Import & Redundancy Cleanup

- Run `codebase-audit.js` to find unused imports
- Extract duplicate utilities into shared modules
- Create barrel export files
- Add path aliases for cleaner imports

### Priority 6: MEDIUM — MCP & Skill Gaps

- Add `puppeteer` MCP for deep-research
- Create `security-review` skill
- Create `qa-tester` skill
- Index all skills in `skills/index.json`

### Priority 7: LOW — Documentation

- Update all skill READMEs
- Add examples to agent files
- Create architecture decision records
- Generate comprehensive changelog

---

## 4. Implementation Commands

```bash
# 1. Run full codebase audit
node tools/codebase-audit.js C:\opencode

# 2. Review improved config
diff opencode.json opencode.json.improved

# 3. Apply config (after approval)
cp opencode.json.improved opencode.json

# 4. Run validation
node config-validator.js opencode.json config-schema.json
npm run config:validate

# 5. Run lint + format
npm run check-all

# 6. Run tests
npm test
```

---

## 5. Files Created/Modified

### New Files

```
agents/.opencode/agents/refactor-architect.md    ← System architect agent
agents/.opencode/agents/code-reviewer.md          ← Code quality reviewer
agents/.opencode/agents/research-analyst.md       ← Research & gap analysis
agents/.opencode/agents/integration-test.md       ← Test generation/execution
agents/.opencode/agents/docs-evolver.md           ← Documentation sync
skills/self-evolver/SKILL.md                      ← Self-evolution skill
workflows/refactor.yaml                           ← Refactoring workflow
workflows/refactoring-plan.md                     ← Detailed refactoring plan
tools/codebase-audit.js                           ← Automated audit tool
skills/index.json                                 ← Skill registry
opencode.json.improved                            ← Improved configuration
```

### Modified Files

```
opencode.json.improved    ← Full config with all fixes
```

---

## 6. Alignment with OpenCode Official Docs

| Area              | Our Config                     | Official Pattern       | Status |
| ----------------- | ------------------------------ | ---------------------- | ------ |
| Agent format      | Markdown with YAML frontmatter | ✅ Matches             | ✅     |
| Permission system | Pattern-based                  | ✅ Matches             | ✅     |
| Mode field        | primary/subagent               | ✅ Added to all agents | ✅     |
| Model routing     | Per-agent model + provider     | ✅ Added to all agents | ✅     |
| Steps field       | Max iterations per agent       | ✅ Added to all agents | ✅     |
| Skill format      | SKILL.md with frontmatter      | ✅ All skills valid    | ✅     |
| Built-in agents   | build, plan, explore, scout    | ✅ Aligned + extended  | ✅     |
| Hidden agents     | compaction, title, summary     | ✅ Preserved           | ✅     |

---

## 7. Next Steps

1. **Review** this analysis and `opencode.json.improved`
2. **Run** `node tools/codebase-audit.js` for detailed findings
3. **Approve** changes with `/approve-upgrade`
4. **Execute** Phase 1 (Discovery) using `refactor-architect` agent
5. **Iterate** through phases 2-6
6. **Monitor** via self-evolution loop

---

_This document serves as the architectural blueprint for the refactoring. All changes are staged in `opencode.json.improved` and new agent files — nothing is applied until explicit approval._
