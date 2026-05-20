import { 
  TokenBudgetMonitor, 
  ContextPruner, 
  TokenCounter 
} from "./token-budget.js";

console.log("=== Token Budget System Demo ===\n");

const budgetMonitor = TokenBudgetMonitor.getInstance(24000, 8192);
console.log("Initial budget status:");
console.log(budgetMonitor.getBudgetStatus());
console.log("");

budgetMonitor.startOperation("brain_search");
const searchContext = {
  chunks: [
    { text: "function example() { return 'Hello World'; }", path: "test.js", startLine: 1, endLine: 2, score: 0.9, mtime: Date.now() },
    { text: "const x = 42;", path: "config.js", startLine: 5, endLine: 5, score: 0.7, mtime: Date.now() - 86400000 },
  ],
  totalChunks: 2,
};

const counter = new TokenCounter();
const contextTokens = ContextPruner.estimateContextTokens(searchContext, "What does example do?");
console.log(`Context tokens estimate: ${contextTokens}`);

const pruned = ContextPruner.prune(searchContext, 100);
console.log(`\nPruned context:`);
console.log(`- Original chunks: ${pruned.originalChunks}`);
console.log(`- Remaining chunks: ${pruned.chunks.length}`);
console.log(`- Tokens used: ${pruned.tokens}`);
console.log(`- Was pruned: ${pruned.pruned}`);

budgetMonitor.endOperation("brain_search", pruned.tokens || 0);

budgetMonitor.startOperation("context_injection");
budgetMonitor.endOperation("context_injection", 150);
console.log("\nAfter operations:");
budgetMonitor.logStatus();

console.log("\n=== Usage Example ===");
console.log(`
const budget = TokenBudgetMonitor.getInstance();
budget.startOperation('brain_search');

const context = searchProjectContext(query, topK);
const pruned = ContextPruner.prune(context, 2000);

budget.endOperation('brain_search', pruned.tokens);

if (!budget.checkBudget(500)) {
  console.log('Budget low, triggering aggressive pruning');
  const aggressive = ContextPruner.aggressivePrune(context);
  context.chunks = aggressive.chunks;
}
`);
