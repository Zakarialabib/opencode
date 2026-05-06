---
name: testing-strategy
description: >
  Plans test coverage, defines test matrices, and recommends testing approaches
  for features and modules. Use when asked to create a test plan, define test
  strategy, identify coverage gaps, build a test matrix, or decide what to test.
  Produces structured coverage matrices and prioritized test lists.
---

# Testing Strategy & Coverage Planning

## Test Pyramid

```
        ╱  E2E  ╲          Few, slow, expensive
       ╱─────────╲
      ╱Integration╲        Moderate count
     ╱─────────────╲
    ╱   Unit Tests   ╲     Many, fast, cheap
   ╱─────────────────╲
```

- **Unit**: Test individual functions/components in isolation
- **Integration**: Test module interactions (API + DB, Component + Hook)
- **E2E**: Test full user workflows (browser automation)

## Coverage Matrix Template

For each feature/module, fill in this matrix:

| Feature/Module  | Unit | Integration | E2E | Manual | Priority | Status  |
| --------------- | ---- | ----------- | --- | ------ | -------- | ------- |
| Auth login      | ✅   | ✅          | ✅  | —      | Critical | Covered |
| Media upload    | ✅   | 🟡 Partial  | ❌  | ✅     | High     | Gaps    |
| Schedule engine | ✅   | ✅          | ❌  | —      | Critical | Partial |
| Canvas editor   | 🟡   | ❌          | ❌  | ✅     | Medium   | Weak    |

**Legend**: ✅ Covered | 🟡 Partial | ❌ Missing | — Not Applicable

## Test Plan Template

```markdown
## Test Plan: [Feature/Module Name]

### Scope

What is being tested and what is NOT.

### Test Environment

- OS, browser, Node version, database

### Unit Tests

| Test Case   | Input | Expected Output | Priority |
| ----------- | ----- | --------------- | -------- |
| Valid input | ...   | ...             | Critical |
| Empty input | ...   | Error thrown    | High     |
| Edge case   | ...   | ...             | Medium   |

### Integration Tests

| Scenario | Components | Expected Behavior | Priority |
| -------- | ---------- | ----------------- | -------- |
| ...      | A + B      | ...               | High     |

### E2E Tests

| User Flow | Steps                  | Expected Result | Priority |
| --------- | ---------------------- | --------------- | -------- |
| ...       | 1. Click X, 2. Enter Y | Z appears       | Medium   |

### Edge Cases & Negative Tests

- What happens when network is offline?
- What if the database is empty?
- What if concurrent users modify the same data?
- What if file is corrupted/missing?

### Performance Tests

- Response time under X concurrent users
- Memory usage after Y hours of operation
- Database query time with Z records
```

## Framework-Specific Guidance

### React (Vitest + React Testing Library)

- Test components: render, user interaction, expected output
- Test hooks: `renderHook()` with act()
- Mock Tauri IPC: `vi.mock('@tauri-apps/api/core')`
- Snapshot tests: only for stable, presentational components

### Rust (cargo test)

- `#[test]` for unit tests in same module
- `tests/` directory for integration tests
- `#[should_panic]` for expected failures
- Property-based testing with `proptest`

### Laravel (Pest/PHPUnit)

- Feature tests: `$this->post('/api/route')->assertStatus(200)`
- Database testing: `RefreshDatabase` trait
- Mock external services: `Http::fake()`

## Prioritization Rules

1. **Critical path first**: Auth, payments, data integrity
2. **High churn code**: Frequently modified files need more tests
3. **Complex logic**: Scheduling, compilation, state machines
4. **User-facing flows**: Anything a user directly interacts with
5. **Known bugs**: Add regression tests for every bug fix

## When to Use

- "What should we test?"
- "Create a test plan for X"
- "Where are our coverage gaps?"
- "Test strategy for this feature"
- "Build a test matrix"
- "Which tests are most important?"
- "Prioritize our testing effort"
