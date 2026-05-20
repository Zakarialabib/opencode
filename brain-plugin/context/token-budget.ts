export interface BudgetStatus {
  total: number;
  used: number;
  remaining: number;
  percent: number;
  reserved: number;
  availableForContext: number;
}

export interface OperationRecord {
  name: string;
  startTime: number;
  endTime?: number;
  tokens?: number;
}

export interface ChunkPriority {
  text: string;
  path: string;
  startLine: number;
  endLine: number;
  score: number;
  mtime?: number;
  isModified?: boolean;
  isDecisionCritical?: boolean;
}

export class TokenCounter {
  private totalTracked: number = 0;

  estimateTokens(text: string): number {
    if (!text || text.length === 0) return 0;
    const charCount = text.length;
    const estimated = Math.ceil(charCount / 4);
    return Math.max(1, estimated);
  }

  trackUsage(tokens: number): void {
    this.totalTracked += tokens;
  }

  getRemaining(budget: number): number {
    return Math.max(0, budget - this.totalTracked);
  }

  getUsagePercent(budget: number): number {
    if (budget === 0) return 0;
    return Math.min(100, (this.totalTracked / budget) * 100);
  }

  reset(): void {
    this.totalTracked = 0;
  }

  getTotalTracked(): number {
    return this.totalTracked;
  }
}

export class TokenBudgetMonitor {
  private static instance: TokenBudgetMonitor;
  
  private budget: number;
  private used: number;
  private reserved: number;
  private operations: Map<string, OperationRecord>;
  private counter: TokenCounter;
  
  private constructor(budget: number = 24000, reserved: number = 8192) {
    this.budget = budget;
    this.reserved = reserved;
    this.used = 0;
    this.operations = new Map();
    this.counter = new TokenCounter();
  }

  static getInstance(budget?: number, reserved?: number): TokenBudgetMonitor {
    if (!TokenBudgetMonitor.instance) {
      const defaultBudget = budget ?? 24000;
      const defaultReserved = reserved ?? 8192;
      TokenBudgetMonitor.instance = new TokenBudgetMonitor(defaultBudget, defaultReserved);
    }
    return TokenBudgetMonitor.instance;
  }

  static resetInstance(): void {
    if (TokenBudgetMonitor.instance) {
      TokenBudgetMonitor.instance.reset();
    }
    TokenBudgetMonitor.instance = new TokenBudgetMonitor();
  }

  setBudget(budget: number): void {
    this.budget = budget;
  }

  setReserved(reserved: number): void {
    this.reserved = reserved;
  }

  startOperation(opName: string): void {
    const operation: OperationRecord = {
      name: opName,
      startTime: Date.now(),
    };
    this.operations.set(opName, operation);
    console.log(`[TokenBudget] Started: ${opName}`);
  }

  endOperation(opName: string, tokens: number): void {
    const operation = this.operations.get(opName);
    if (operation) {
      operation.endTime = Date.now();
      operation.tokens = tokens;
      this.used += tokens;
      this.counter.trackUsage(tokens);
      const duration = operation.endTime - operation.startTime;
      console.log(
        `[TokenBudget] Completed: ${opName} (+${tokens} tokens, ${duration}ms)`
      );
      this.operations.delete(opName);
    }
  }

  checkBudget(required: number): boolean {
    const available = this.getAvailable();
    return available >= required;
  }

  getBudgetStatus(): BudgetStatus {
    const remaining = this.getRemaining();
    const percent = this.getUsagePercent();
    const availableForContext = this.getAvailable();
    
    return {
      total: this.budget,
      used: this.used,
      remaining,
      percent,
      reserved: this.reserved,
      availableForContext,
    };
  }

  getAvailable(): number {
    return Math.max(0, this.budget - this.used - this.reserved);
  }

  getRemaining(): number {
    return Math.max(0, this.budget - this.used);
  }

  getUsagePercent(): number {
    if (this.budget === 0) return 0;
    return Math.min(100, (this.used / this.budget) * 100);
  }

  reset(): void {
    this.used = 0;
    this.counter.reset();
    this.operations.clear();
    console.log("[TokenBudget] Monitor reset for new session");
  }

  getCounter(): TokenCounter {
    return this.counter;
  }

  logStatus(): void {
    const status = this.getBudgetStatus();
    console.log(
      `[TokenBudget] Status: ${status.used}/${status.total} tokens ` +
      `(${status.percent.toFixed(1)}%), ` +
      `available: ${status.availableForContext} tokens`
    );
  }
}

export class ContextPruner {
  private static readonly DEFAULT_MAX_TOKENS = 16000;

  static prioritizeChunks(chunks: ChunkPriority[]): ChunkPriority[] {
    return chunks.sort((a, b) => {
      let scoreA = 0;
      let scoreB = 0;

      if (a.mtime && b.mtime) {
        const now = Date.now();
        const ageA = now - a.mtime;
        const ageB = now - b.mtime;
        scoreA += Math.max(0, 100 - ageA / (1000 * 60 * 60 * 24));
        scoreB += Math.max(0, 100 - ageB / (1000 * 60 * 60 * 24));
      }

      if (a.isModified !== undefined && b.isModified !== undefined) {
        scoreA += a.isModified ? 50 : 0;
        scoreB += b.isModified ? 50 : 0;
      }

      if (a.isDecisionCritical !== undefined && b.isDecisionCritical !== undefined) {
        scoreA += a.isDecisionCritical ? 100 : 0;
        scoreB += b.isDecisionCritical ? 100 : 0;
      }

      scoreA += (a.score ?? 0) * 100;
      scoreB += (b.score ?? 0) * 100;

      return scoreB - scoreA;
    });
  }

  static prune(context: any, maxTokens?: number): any {
    const budget = maxTokens ?? ContextPruner.DEFAULT_MAX_TOKENS;
    const counter = new TokenCounter();
    
    if (!context.chunks || context.chunks.length === 0) {
      return {
        ...context,
        tokens: 0,
        pruned: false,
        originalChunks: 0,
      };
    }

    const chunksWithMeta: ChunkPriority[] = context.chunks.map((chunk: any) => ({
      text: chunk.content || chunk.text || "",
      path: chunk.filepath || chunk.path || "",
      startLine: chunk.start_line || chunk.startLine || 0,
      endLine: chunk.end_line || chunk.endLine || 0,
      score: chunk.score || 0.5,
      mtime: chunk.mtime,
      isModified: chunk.isModified,
      isDecisionCritical: chunk.isDecisionCritical,
    }));

    const prioritized = ContextPruner.prioritizeChunks(chunksWithMeta);
    
    const result: any[] = [];
    let currentTokens = 0;

    for (const chunk of prioritized) {
      const chunkTokens = counter.estimateTokens(chunk.text);
      
      if (currentTokens + chunkTokens <= budget) {
        result.push(chunk);
        currentTokens += chunkTokens;
      } else {
        break;
      }
    }

    return {
      ...context,
      chunks: result,
      tokens: currentTokens,
      pruned: result.length < context.chunks.length,
      originalChunks: context.chunks.length,
      removedChunks: context.chunks.length - result.length,
    };
  }

  static aggressivePrune(context: any, maxTokens?: number): any {
    const budget = (maxTokens ?? ContextPruner.DEFAULT_MAX_TOKENS) * 0.5;
    return ContextPruner.prune(context, budget);
  }

  static estimateContextTokens(context: any, userMessage: string): number {
    const counter = new TokenCounter();
    let total = counter.estimateTokens(userMessage);

    if (context.chunks) {
      for (const chunk of context.chunks) {
        const text = chunk.content || chunk.text || "";
        total += counter.estimateTokens(text);
      }
    }

    if (context.docContext) {
      total += counter.estimateTokens(context.docContext);
    }

    return total;
  }
}

export function createTokenBudgetMonitor(config?: { 
  budget?: number; 
  reserved?: number;
}): TokenBudgetMonitor {
  return TokenBudgetMonitor.getInstance(config?.budget, config?.reserved);
}

export function initializeFromConfig(config: any): TokenBudgetMonitor {
  const compaction = config?.compaction || {};
  const budget = compaction.budget || 24000;
  const reserved = compaction.reserved || 8192;
  
  return TokenBudgetMonitor.getInstance(budget, reserved);
}
