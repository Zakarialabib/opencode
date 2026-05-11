# Codebase Refactoring Plan

> **Generated**: 2026-05-10
> **Architecture**: OpenCode System Refactor v2
> **Reference**: https://opencode.ai/docs

---

## Executive Summary

This plan refactors the OpenCode workspace to align with official OpenCode architecture patterns (as of May 2026), fix naming convention drift, eliminate redundant code, establish proper agent specialization, and enable self-evolving codebase maintenance through the `core-factory` agent.

### Current Issues Identified

| Category                                             | Count       | Severity |
| ---------------------------------------------------- | ----------- | -------- |
| Naming Convention Violations                         | ~45         | HIGH     |
| Unused Imports                                       | ~28         | MEDIUM   |
| Redundant/Duplicate Code                             | ~12         | HIGH     |
| Architecture Drift (deep imports, any types, unwrap) | ~19         | CRITICAL |
| Missing Agent Specialization                         | All agents  | HIGH     |
| No Self-Evolution Mechanism                          | System-wide | MEDIUM   |
| Inconsistent Permission Scoping                      | Multiple    | MEDIUM   |
| Missing Skill Documentation                          | ~8 skills   | LOW      |

---

## Phase 1: Discovery & Mapping (Days 1-2)

### 1.1 Codebase Topology Mapping

**Agent**: `explore` (read-only) + `refactor-architect`

```
┌─────────────────────────────────────────────────┐
│                  CODEBASE MAP                     │
├─────────────┬─────────────┬─────────────────────┤
│ Rust/Tauri  │ TypeScript  │ PHP/Laravel          │
│             │             │                      │
│ src-tauri/  │ src/        │ app/                 │
│ ├─ src/     │ ├─ components/ │ ├─ Http/           │
│ ├─ lib/     │ ├─ hooks/    │ ├─ Models/          │
│ ├─ commands/│ ├─ utils/    │ ├─ Services/        │
│ ├─ state/   │ ├─ types/    │ ├─ Livewire/        │
│ └─ plugins/ │ └─ api/      │ └─ Console/         │
├─────────────┴─────────────┴─────────────────────┤
│ Shared: types/, constants/, utils/, rules/        │
└─────────────────────────────────────────────────┘
```

### 1.2 Naming Convention Audit

Run the audit tool:

```bash
node tools/codebase-audit.js C:\opencode
```

**Expected findings**:

- Rust files using camelCase instead of snake_case
- TypeScript exports not matching PascalCase file names
- PHP methods using camelCase instead of snake_case
- Constants not in SCREAMING_SNAKE_CASE
- Deep relative imports (4+ levels)

### 1.3 Import Dependency Graph

Generate full import map:

```bash
node -e "
const fs = require('fs');
const path = require('path');
const files = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
    if (['node_modules','.git','vendor','target','.opencode','.trae'].includes(entry.name)) continue;
    const fp = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(fp);
    else if (['.ts','.tsx','.js','.jsx','.rs','.php'].includes(path.extname(fp))) {
      const content = fs.readFileSync(fp, 'utf-8');
      const imports = [...content.matchAll(/import\s+.*?from\s+['\"]([^'\"]+)['\"]/g)].map(m => m[1]);
      const rels = imports.filter(i => i.startsWith('.'));
      if (rels.length) files.push({file: fp, imports: rels});
    }
  }
}
walk('.');
fs.writeFileSync('import-map.json', JSON.stringify(files, null, 2));
console.log('Import map written:', files.length, 'files');
"
```

---

## Phase 2: Analysis & Research (Days 2-3)

### 2.1 Gap Analysis

**Agent**: `research-analyst`

Compare current state against:

- OpenCode latest config schema (https://opencode.ai/docs/config)
- Official agent patterns (https://opencode.ai/docs/agents)
- Skill specification (https://opencode.ai/docs/skills)
- Tauri v2 best practices
- Laravel 13 patterns
- React 19 + TypeScript patterns

### 2.2 Redundancy Report

**Agent**: `code-reviewer`

Identify:

- Duplicate utility functions across files
- Copy-pasted component logic
- Repeated validation patterns
- Redundant type definitions
- Unused exports

### 2.3 Architecture Violation Report

**Agent**: `refactor-architect`

Flag:

- Circular dependencies
- God files (>300 lines, mixed responsibility)
- Cross-layer imports (frontend → backend → database in one chain)
- Missing error handling
- Hardcoded configuration

---

## Phase 3: Planning (Day 3-4)

### 3.1 Refactoring Backlog

Priority order:

1. **CRITICAL**: Architecture violations (unwrap, any, deep imports)
2. **HIGH**: Naming convention standardization
3. **HIGH**: Redundant code elimination
4. **MEDIUM**: Import cleanup and optimization
5. **MEDIUM**: Agent specialization and permission tightening
6. **LOW**: Skill documentation and metadata
7. **LOW**: Formatter configuration alignment

### 3.2 Migration Strategy

```
For each refactoring task:
┌─────────────────────────────────────────┐
│ 1. Create branch: refactor/[area]       │
│ 2. Run baseline tests (before)          │
│ 3. Apply changes                        │
│ 4. Run tests (after)                    │
│ 5. Generate diff                        │
│ 6. Code review via code-reviewer agent  │
│ 7. Merge if passing                     │
└─────────────────────────────────────────┘
```

### 3.3 Rollback Plan

- Git tags before each phase: `refactor/phase-1-pre`, `refactor/phase-1-post`, etc.
- Automated backup of changed files
- Phase-gated approach: don't start Phase N+1 until Phase N is validated

---

## Phase 4: Implementation (Days 4-10)

### 4.1 Naming Convention Fixes

**Rust (src-tauri/)**:

- Rename `camelCase` functions to `snake_case`
- Rename `CamelCase` structs to `PascalCase` (if not already)
- Ensure `pub fn` naming follows Rust conventions
- Module names: lowercase with underscores

**TypeScript (src/)**:

- React components: `PascalCase` (already correct for most)
- Hooks: `useXxx` pattern
- Utilities: `camelCase` exports
- Types/interfaces: `PascalCase`
- File names: match default export

**PHP (app/)**:

- Methods: `snake_case`
- Classes: `PascalCase`
- Properties: `camelCase` (Laravel convention)
- Migration files: timestamp prefix + snake_case description
- Routes: `snake_case` resource names

### 4.2 Import Optimization

- Remove all unused imports
- Replace deep relative paths with path aliases
- Create barrel files (index.ts, mod.rs) for clean exports
- Sort imports consistently (biome/prettier)

### 4.3 Redundancy Elimination

- Extract shared utilities into `src/shared/` or `lib/shared/`
- Create reusable validation schemas
- Consolidate API response formatting
- Standardize error handling patterns

### 4.4 Architecture Improvements

- Add proper Result/Option handling in Rust
- Replace `any` types with proper TypeScript types
- Add proper error boundaries in React
- Implement repository pattern for database access in Laravel
- Add middleware layers for API validation

---

## Phase 5: Validation (Days 10-12)

### 5.1 Test Execution

**Agent**: `integration-test`

```bash
# Rust
cargo test --workspace

# TypeScript
npm run test

# PHP
php artisan test
```

### 5.2 LSP Validation

```bash
# Rust
rust-analyzer check

# TypeScript
npx tsc --noEmit

# PHP
php vendor/bin/intelephense --verify
```

### 5.3 Formatting Check

```bash
npx biome check .
php vendor/bin/pint --diff
cargo fmt --check
```

---

## Phase 6: Documentation (Days 12-14)

**Agent**: `docs-evolver`

- Update all rule files
- Generate migration guide
- Create ADRs for architectural decisions
- Update API documentation
- Sync skill documentation

---

## Agent Assignment Matrix

| Task                 | Primary Agent      | Supporting Agents |
| -------------------- | ------------------ | ----------------- |
| Discovery & Mapping  | refactor-architect | explore           |
| Naming Audit         | code-reviewer      | explore           |
| Gap Analysis         | research-analyst   | scout             |
| Redundancy Detection | code-reviewer      |                   |
| Refactoring Plan     | refactor-architect | lead-strategist   |
| Implementation       | core-factory       |                   |
| Code Review          | code-reviewer      |                   |
| Testing              | integration-test   | qa-guardian       |
| Documentation        | docs-evolver       | lead-architect    |
| Self-Evolution       | core-factory       | research-analyst  |

---

## Self-Evolution Mechanism

### How core-factory Self-Evolves

1. **After each task**: Run `skill:self-evolver` to check for improvements
2. **Weekly**: Trigger `/autoresearch` to benchmark against latest patterns
3. **Monthly**: Full `codebase-audit.js` run with findings stored in memory
4. **On config change**: Auto-validate with `config-doctor` skill

### Evolution Feedback Loop

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   COMPLETE   │────▶│   SELF-EVAL  │────▶│   IMPROVE    │
│   TASK       │     │  (audit)     │     │   PATTERNS   │
└──────────────┘     └──────────────┘     └──────────────┘
       ▲                                              │
       │              ┌──────────────┐                │
       └──────────────│   MEMORY     │◀───────────────┘
                      │  (learn from │
                      │  history)    │
                      └──────────────┘
```

### Self-Evolution Prompts

After completing any task, core-factory should ask:

1. "Were there any redundant imports I added?"
2. "Did I follow naming conventions strictly?"
3. "Is there a better pattern I could have used?"
4. "Should this be extracted into a reusable utility?"
5. "Are there similar patterns elsewhere that should be updated?"

---

## Risk Assessment

| Risk                                                 | Likelihood | Impact | Mitigation                                   |
| ---------------------------------------------------- | ---------- | ------ | -------------------------------------------- |
| Breaking existing functionality                      | Medium     | High   | Phase-gated testing, rollback tags           |
| Over-refactoring (perfectionism)                     | Medium     | Medium | Time-box each phase, prioritize by impact    |
| Agent conflicts (multiple agents editing same files) | Low        | High   | Clear ownership matrix, sequential execution |
| Drift from OpenCode updates                          | Medium     | Medium | Regular `autoupdate`, follow official docs   |
| Performance regression                               | Low        | Medium | Benchmark before/after each phase            |

---

## Success Criteria

1. ✅ All naming conventions consistent across codebase
2. ✅ Zero unused imports
3. ✅ Zero critical/high architecture violations
4. ✅ All agents properly scoped with permissions
5. ✅ Self-evolution mechanism functional
6. ✅ Test suite passing with 80%+ coverage
7. ✅ Documentation complete and accurate
8. ✅ Config validated against latest schema
