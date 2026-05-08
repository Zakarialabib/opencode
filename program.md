# Research Program: Optimize OpenCode Core Test Execution

## Goal

Reduce vitest test execution time for OpenCode core components (plugins, tools). Current baseline: ~1.57 seconds.

Target metric: **test_execution_seconds** (lower is better)

## Target

- **Script**: `vitest.config.ts`
- **Test Command**: `npm test`
- **Metric**: Total execution time in seconds
- **Time Budget**: 5 minutes per experiment
- **Baseline**: 1.57 seconds

## Constraints

- Keep all 14 tests passing (no test removal)
- Maintain code coverage thresholds (70% statements/branches/functions/lines)
- Keep test environment as "node"
- Use only vitest-supported configuration options

## Exploration Areas

### 1. Vitest Configuration Optimization

- Pool size settings (`pool: "threads"` vs `pool: "forks"`)
- Max workers configuration (`maxWorkers`)
- Test timeout adjustments
- Disable unnecessary reporters during testing
- Include/exclude pattern optimization

### 2. Test Structure Optimization

- Evaluate if test files can be parallelized better
- Check for slow test patterns
- Optimize imports in test files

### 3. Coverage Configuration

- Try disabling coverage during optimization runs (re-enable for final)
- Adjust coverage provider settings
- Exclude unnecessary files from coverage

### 4. Plugin/Tools Code Optimization

- Identify slow plugin initialization
- Optimize config loading in plugins
- Reduce unnecessary imports

## Forbidden

- Removing or skipping tests
- Reducing coverage thresholds below 70%
- Changing test assertions or expectations
- Modifying `package.json` test script beyond vitest flags
- Any change that would cause tests to fail

## Experiment Loop

1. Read `vitest.config.ts` and understand current configuration
2. Propose one change to improve test speed
3. Run `npm test` and measure execution time
4. If time < 1.57s AND all tests pass: KEEP (git commit)
5. If time >= 1.57s OR tests fail: REVERT (git reset)
6. Repeat for up to 20 experiments or 2 hours

## Metric Extraction

Parse npm test output for:

```
Duration: X.XXXs (transform Yms, setup Zms, import AMS, tests Bms, environment Cms)
```

Extract the value after "Duration" as the metric.

## Notes

- Small improvements count (even 50ms reduction)
- Compound improvements across experiments are expected
- Focus on configuration changes before code changes
- Remember: the goal is faster feedback loops for developers
