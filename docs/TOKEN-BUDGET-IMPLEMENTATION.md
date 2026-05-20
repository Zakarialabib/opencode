# Token Budget Monitoring Implementation

## Overview

Token budget monitoring and automatic pruning has been implemented in the Brain plugin to optimize token usage during context injection. This system helps prevent context overflow and ensures efficient use of the available token budget.

## Components

### 1. TokenCounter Class

Located in [token-budget.ts](brain-plugin/context/token-budget.ts)

**Methods:**
- `estimateTokens(text: string): number` - Estimates token count using approximation (chars/4)
- `trackUsage(tokens: number): void` - Track actual usage
- `getRemaining(budget: number): number` - Get remaining budget
- `getUsagePercent(budget: number): number` - Get usage percentage
- `reset(): void` - Reset counter

### 2. TokenBudgetMonitor Singleton

Located in [token-budget.ts](brain-plugin/context/token-budget.ts)

**Configuration:**
- `budget`: 24000 tokens (total budget)
- `reserved`: 8192 tokens (reserved from compaction config)
- `available`: budget - used - reserved

**Methods:**
- `startOperation(opName: string): void` - Log operation start
- `endOperation(opName: string, tokens: number): void` - Log end and update usage
- `checkBudget(required: number): boolean` - Check if budget allows operation
- `getBudgetStatus(): BudgetStatus` - Get current budget status
- `reset(): void` - Reset for new session
- `logStatus(): void` - Log current status

### 3. ContextPruner Class

Located in [token-budget.ts](brain-plugin/context/token-budget.ts)

**Priority Rules:**
1. Recent files > old files (based on mtime)
2. Modified files > read-only files
3. Decision-critical > general context

**Methods:**
- `prioritizeChunks(chunks: ChunkPriority[]): ChunkPriority[]` - Sort by relevance
- `prune(context: any, maxTokens: number): any` - Remove low-value chunks
- `aggressivePrune(context: any, maxTokens?: number): any` - 50% more aggressive pruning
- `estimateContextTokens(context: any, userMessage: string): number` - Estimate total tokens

## Integration

### ContextInjector Integration

Updated [injector.ts](brain-plugin/context/injector.ts) to:
- Track tokens for each injection operation
- Automatically prune context when it exceeds budget
- Log budget usage and status
- Support aggressive pruning when budget is low

**New Features:**
- `enableBudgetCheck` option (default: true)
- `maxTokens` option for custom token limits
- Automatic pruning when context exceeds available budget
- Budget status logging after each injection

### Brain Plugin Integration

Updated [brain.ts](brain-plugin/brain.ts) to:
- Initialize token budget from opencode.json compaction config
- Track brain_search operations
- Trigger aggressive pruning when budget is low (available < 500 tokens)
- Add budget status to brain_status tool
- Add brain_budget and brain_budget_reset tools

**New Tools:**
- `brain_budget` - Get current token budget status
- `brain_budget_reset` - Reset token budget counter

## Usage Examples

### Basic Usage

```typescript
import { TokenBudgetMonitor, ContextPruner } from './context/token-budget';

const budget = TokenBudgetMonitor.getInstance();

// Start tracking an operation
budget.startOperation('brain_search');

// Perform your operation
const context = searchProjectContext(query, topK);

// Check if we have enough budget
if (!budget.checkBudget(500)) {
  console.log('Budget low, pruning...');
  const pruned = ContextPruner.aggressivePrune(context);
  context.chunks = pruned.chunks;
}

// End operation and track usage
budget.endOperation('brain_search', pruned.tokens);

// Log current status
budget.logStatus();
```

### With ContextInjector

```typescript
const budget = TokenBudgetMonitor.getInstance();
budget.startOperation('brain_search');

const context = searchProjectContext(query, topK);

// Inject with automatic pruning
const augmentedMessage = contextInjector.inject(
  userMessage,
  context,
  {
    intent: 'debug',
    enableBudgetCheck: true,
  }
);

const contextTokens = contextInjector.getBudgetStatus().used;
budget.endOperation('brain_search', contextTokens);
```

### Configuration from opencode.json

The system automatically reads from the compaction config:

```json
{
  "compaction": {
    "auto": true,
    "prune": true,
    "reserved": 8192
  }
}
```

This sets:
- `budget`: 24000 (default)
- `reserved`: 8192 (from config)

## Budget Status Format

```typescript
{
  total: 24000,           // Total budget
  used: 3500,             // Currently used
  remaining: 20500,       // Remaining (total - used)
  percent: 14.58,          // Usage percentage
  reserved: 8192,         // Reserved tokens
  availableForContext: 12308  // Available for new context
}
```

## Logging

The system provides detailed logging:

```
[TokenBudget] Started: brain_search
[ContextInjector] Context exceeds budget (12500 > 8000 tokens), pruning...
[ContextInjector] Pruned 3 chunks, reduced to 7500 tokens
[TokenBudget] Completed: brain_search (+7500 tokens, 125ms)
[TokenBudget] Status: 11000/24000 tokens (45.8%), available: 4908 tokens
```

## Automatic Behavior

1. **Normal Operation**: Context is injected with automatic pruning if needed
2. **Low Budget**: Aggressive pruning is triggered when available < 500 tokens
3. **Budget Exhausted**: Operations continue but with minimal context
4. **Session Reset**: Budget resets on brain_reset or brain_budget_reset

## Benefits

- **Prevents Context Overflow**: Automatic pruning keeps context within limits
- **Optimizes Token Usage**: Prioritizes recent and relevant context
- **Transparent**: Automatic with optional manual control
- **Configurable**: Adjustable budget and reserved tokens
- **Observable**: Detailed logging for debugging

## Testing

Run the example:

```bash
npx tsx brain-plugin/context/token-budget-example.ts
```

Check budget status:

```bash
brain_budget
brain_status
```
