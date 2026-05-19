# Orchestration Patterns & Best Practices

## Overview

This document defines best practices for multi-agent orchestration in OpenCode, ensuring continuity, efficiency, and quality across complex development workflows.

## Orchestration Architecture

### Agent Hierarchy

```
User Request
    ↓
[Build Agent] - Primary Orchestrator
    ↓
├── [Lead Strategist] - Strategic Planning
├── [Core Factory] - Core Implementation
├── [Frontend UI/UX] - UI Development
├── [Backend API] - API Development
├── [Backend Laravel] - Laravel Features
├── [Backend Tauri] - Rust/Tauri Development
├── [QA Guardian] - Testing & Review
└── [DevOps Engineer] - Infrastructure
```

### Orchestration Principles

1. **Single Responsibility**: Each agent has a clear, focused role
2. **Context Continuity**: Session state preserved across delegations
3. **Token Efficiency**: Context compression for optimal token usage
4. **Quality Gates**: Validation at each stage
5. **Fail-Safe**: Graceful error handling and recovery

## Delegation Protocol

### When to Delegate

**Delegate to Specialized Agent When**:
- Task requires specific domain expertise (UI, API, Rust, etc.)
- Task complexity exceeds single-agent capacity
- Parallel execution opportunities exist
- Context requires specialized tools

**Implement Directly When**:
- Task is straightforward and well-defined
- Complexity is low (single file, simple change)
- Specialized tools not required
- Token budget is constrained

### Delegation Decision Tree

```
User Request
    ↓
Is this a complex, multi-faceted task?
    ↓ YES → Delegate to Lead Strategist for decomposition
    ↓ NO ↓
Is this a domain-specific task?
    ↓ YES → Delegate to specialized agent (UI/API/Rust/etc.)
    ↓ NO ↓
Can this be implemented in < 50 tokens of context?
    ↓ YES → Implement directly with core-factory
    ↓ NO ↓
Delegate to core-factory with minimal briefing
```

## Session State Management

### Tracking Decisions

The orchestrator maintains session state through `orchestratorSession`:

```typescript
// Every significant decision gets tracked
orchestratorSession.appendDecision(
  "Using PostgreSQL for user data, Redis for caching"
);

// Constraints get recorded
orchestratorSession.appendConstraint(
  "Must support offline-first for mobile clients"
);

// Files modified are tracked
orchestratorSession.trackFile("src/auth/login.ts");
```

### Context Summary Injection

Before delegating to any agent:

```typescript
// Generate compressed context summary
const summary = orchestratorSession.getSummary();

// This produces:
/*
## Session Context
- Decisions: [Using PostgreSQL, Redis caching]
- Constraints: [Offline-first mobile]
- Modified Files: [src/auth/login.ts]
- Remaining Token Budget: 18000
*/
```

### Token Budget Allocation

**Orchestrator Budget**: 8192 tokens reserved (from compaction config)

**Distribution**:
- Session context: ~500 tokens
- Delegation briefing: ~1000 tokens  
- Agent task: ~2000 tokens
- Response buffer: ~3000 tokens
- Emergency reserve: ~1692 tokens

**Monitoring**:
```typescript
// Check budget before delegation
if (orchestratorSession.getRemainingBudget() < 1000) {
  // Trigger context pruning
  await pruneLowValueContext();
}
```

## Multi-Agent Workflows

### Parallel Delegation

**Independent Tasks Can Execute in Parallel**:

```typescript
// These can run simultaneously
await Promise.all([
  delegate("frontend-ui-ux", "Implement login form UI"),
  delegate("backend-laravel", "Create login API endpoint"),
  delegate("qa-guardian", "Design login test suite")
]);
```

**Dependent Tasks Must Sequence**:

```typescript
// Backend must complete before frontend integration
await delegate("backend-laravel", "Create login API");
await delegate("frontend-ui-ux", "Integrate with login API");
```

### Result Synthesis

After multi-agent execution:

```typescript
// Collect all results
const uiResult = await frontendAgent.execute();
const apiResult = await backendAgent.execute();
const testResult = await qaAgent.execute();

// Synthesize with quality checks
if (validateConsistency(uiResult, apiResult) && 
    testResult.passed()) {
  return synthesizeResults([uiResult, apiResult, testResult]);
} else {
  // Trigger correction workflow
  await handleInconsistencies(uiResult, apiResult, testResult);
}
```

## Quality Gates

### Pre-Delegation Checks

- [ ] Task is clearly defined
- [ ] Context summary generated
- [ ] Token budget sufficient
- [ ] Agent has required tools
- [ ] Dependencies resolved

### Post-Delegation Validation

- [ ] Task completed successfully
- [ ] Output consistent with session constraints
- [ ] No conflicts with other agent outputs
- [ ] Quality standards met
- [ ] Documentation updated if needed

### Integration Validation

Before finalizing multi-agent results:

1. **Consistency Check**: All parts work together
2. **Compilation Check**: Code builds successfully
3. **Test Coverage**: New code has tests
4. **Style Compliance**: Format/lint passes
5. **Security Scan**: No obvious vulnerabilities

## Error Handling & Recovery

### Agent Failure Modes

**Compilation Failure**:
```typescript
// Provide specific error context
const context = {
  error: compilationError.message,
  file: compilationError.file,
  line: compilationError.line,
  recentChanges: orchestratorSession.modifiedFiles
};
// Retry with error context
```

**Logic Failure**:
```typescript
// Log failed approach
orchestratorSession.appendDecision(
  `Failed approach: ${approach}. Reason: ${error.message}`
);
// Try alternative approach
```

**Permission Failure**:
```typescript
// Escalate to user with context
await clarify("Permission denied. Should I request elevated access?");
```

### Recovery Strategies

1. **Retry with Context**: Same agent, better briefing
2. **Alternative Agent**: Different agent, same task
3. **Simplification**: Break task into smaller pieces
4. **Escalation**: Request user clarification
5. **Rollback**: Use checkpoint to revert changes

## Context Optimization

### Compression Techniques

**Hierarchical Summarization**:
```typescript
// Don't include all details
// Good: "Auth module: 5 files, 3 endpoints"
// Bad: "auth/login.ts, auth/logout.ts, auth/refresh.ts, ..."
```

**Relevance Filtering**:
```typescript
// Only include context relevant to current task
const relevantContext = filterByRelevance(
  fullContext, 
  currentTask
);
```

**Temporal Pruning**:
```typescript
// Older decisions less relevant
const recentDecisions = decisions.filter(
  d => d.timestamp > Date.now() - 3600000 // Last hour
);
```

### Freshness Validation

**Auto-Reindexing**:
```typescript
// If files modified recently
if (dirtyFiles.size > 0) {
  await brain_index_project();
}

// Verify freshness
const isStale = checkStaleness(brainIndex);
if (isStale) {
  await brain_index_project();
}
```

## Performance Optimization

### Lazy Tool Loading

Agents only load tools relevant to current task:

```typescript
// Based on conversation keywords
const activeTools = filterToolsByKeywords(
  allTools, 
  conversation
);
```

### Caching Strategies

**Decision Caching**:
```typescript
// Cache common decision patterns
const cachedPattern = decisionCache.get(
  `${taskType}:${stack}`
);
if (cachedPattern) {
  return cachedPattern;
}
```

**Context Reuse**:
```typescript
// Reuse context across similar tasks
const sharedContext = getSharedContext(taskCluster);
```

## Monitoring & Observability

### Session Metrics

Track per session:
- Total tokens consumed
- Number of delegations
- Success rate per agent
- Context compression ratio
- Time per delegation

### Health Checks

```typescript
// At session start
await brain_diagnostic();

// Periodic checks
if (sessionTokens > tokenThreshold) {
  await brain_status();
}
```

## Anti-Patterns to Avoid

### ❌ Don't Do

1. **Deep nesting**: Don't delegate from agent to agent to agent
2. **Full context dumps**: Don't send entire conversation history
3. **Ignoring budget**: Don't delegate without checking token budget
4. **No validation**: Don't skip quality gates
5. **Forgetting state**: Don't lose track of decisions

### ✅ Do Instead

1. **Flat hierarchy**: Max 2 levels of delegation
2. **Summarized context**: Compress, don't dump
3. **Budget-aware**: Check before delegating
4. **Validate everything**: Quality gates at each stage
5. **Maintain state**: Use orchestratorSession

## Examples

### Example 1: Feature Development

**User Request**: "Add user authentication to the app"

**Orchestrator Flow**:
1. Analyze → Complex, multi-component task
2. Delegate to lead-strategist for decomposition
3. Create subtasks: database, API, UI, testing
4. Parallel delegation to backend-laravel, backend-api, frontend-ui-ux
5. Sequential delegation to qa-guardian for testing
6. Synthesize results and validate integration

### Example 2: Bug Fix

**User Request**: "Login button doesn't work on mobile"

**Orchestrator Flow**:
1. Analyze → Specific UI issue
2. Delegate to frontend-ui-ux with minimal context
3. If fails, check backend-laravel for API issues
4. If persists, involve qa-guardian for testing
5. Validate fix with test suite

### Example 3: Refactoring

**User Request**: "Modernize the authentication system"

**Orchestrator Flow**:
1. Analyze → High-risk refactoring
2. Create checkpoint before changes
3. Delegate to core-factory with:
   - Current auth implementation
   - Target architecture
   - Constraints (backward compatibility)
4. QA validation after each major change
5. Integration testing before completing

## References

- [Agent Delegation Templates](../rules/agent-delegation-templates.md)
- [Brain Plugin Usage](../rules/brain.md)
- [Session State Implementation](../../brain-plugin/state/orchestrator-session.ts)
