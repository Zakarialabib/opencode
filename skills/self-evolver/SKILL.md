---
name: "self-evolver"
description: "Enable core-factory to self-evolve by analyzing code quality, running research, and adapting patterns autonomously"
---

# Self-Evolver Skill

## Description

Enables the `core-factory` agent to autonomously improve its own implementation patterns by:

1. Analyzing current code quality via LSP diagnostics
2. Researching best practices via web and Context7
3. Benchmarking current patterns against alternatives
4. Proposing and validating improvements iteratively

## Triggers

- User types: `/evolve` or `/self-improve`
- Agent detects: code quality degradation, deprecated patterns, redundant imports
- System detects: new dependency versions, breaking changes in upstream
- After completion of complex refactoring tasks (auto-triggered)

## Workflow

### Phase 1: Codebase Health Scan

1. **LSP Diagnostics**: Run rust-analyzer, typescript-language-server, intelephense
2. **Static Analysis**: grep for anti-patterns (unwrap without expect, any types, missing error handling)
3. **Import Audit**: Detect unused, duplicate, and redundant imports across all modules
4. **Naming Audit**: Check all identifiers against project naming conventions

### Phase 2: Research & Benchmark

1. **Context7 Query**: Search for current best practices for detected issues
2. **Web Research**: Fetch latest docs for frameworks in use
3. **Benchmark Current**: Measure current build times, bundle sizes, test execution times
4. **Compare Alternatives**: Research alternative patterns and their trade-offs

### Phase 3: Improvement Proposal

1. **Generate Report**: Structured analysis of findings with priorities
2. **Propose Changes**: Specific code changes with before/after examples
3. **Risk Assessment**: Impact analysis for each proposed change
4. **Validation Plan**: How to verify each improvement works

### Phase 4: Iterative Implementation

1. **Apply Changes**: Use core-factory to implement improvements
2. **Run Tests**: Verify no regressions
3. **Measure Impact**: Compare metrics before/after
4. **Document**: Update docs and ADRs

## Assets

- `assets/health-check-template.md`: Template for codebase health reports
- `assets/improvement-log.md`: Running log of all improvements made

## Best Practices

- Always measure before and after metrics
- Never apply changes without a rollback plan
- Prioritize security and correctness over aesthetics
- Keep improvement log for cross-session learning
- Use `sequential-thinking` for complex multi-file refactoring decisions
