import {
  TokenBudgetMonitor,
  ContextPruner,
  TokenCounter,
  initializeFromConfig,
} from "./token-budget.js";

export interface Chunk {
  text: string;
  path: string;
  startLine: number;
  endLine: number;
  mtime: number;
  score?: number;
  filepath?: string;
  content?: string;
  start_line?: number;
  end_line?: number;
  isModified?: boolean;
  isDecisionCritical?: boolean;
}

export interface RetrievalResult {
  chunks: Chunk[];
  scores?: number[];
  totalChunks: number;
  docContext?: string;
  tokens?: number;
}

export interface InjectOptions {
  intent?: string;
  sessionSummary?: string;
  recentFiles?: string[];
  diagnostics?: string[];
  maxTokens?: number;
  enableBudgetCheck?: boolean;
}

export class ContextInjector {
  private budgetMonitor: TokenBudgetMonitor;
  private counter: TokenCounter;

  constructor() {
    this.budgetMonitor = TokenBudgetMonitor.getInstance();
    this.counter = new TokenCounter();
  }

  initializeFromConfig(config: Record<string, unknown>): void {
    this.budgetMonitor = initializeFromConfig(config);
    this.counter = this.budgetMonitor.getCounter();
    console.log("[ContextInjector] Token budget initialized from config");
  }

  inject(userMessage: string, context: RetrievalResult, opts?: InjectOptions): string {
    this.budgetMonitor.startOperation("context_injection");

    let totalTokens = this.counter.estimateTokens(userMessage);

    const availableForContext = this.budgetMonitor.getAvailable();
    const maxTokens = opts?.maxTokens ?? availableForContext;

    let workingContext = { ...context };
    let prunedInfo = { pruned: false, removedChunks: 0 };

    if (opts?.enableBudgetCheck !== false) {
      const contextTokens = ContextPruner.estimateContextTokens(context, userMessage);

      if (contextTokens > maxTokens) {
        console.log(
          `[ContextInjector] Context exceeds budget (${contextTokens} > ${maxTokens} tokens), pruning...`
        );
        const pruned = ContextPruner.prune(context, maxTokens - totalTokens);
        workingContext = { ...context, chunks: pruned.chunks };
        prunedInfo = { pruned: pruned.pruned, removedChunks: pruned.removedChunks || 0 };
        totalTokens += pruned.tokens || 0;
        console.log(
          `[ContextInjector] Pruned ${prunedInfo.removedChunks} chunks, ` +
            `reduced to ${pruned.tokens || 0} tokens`
        );
      }
    }

    if (workingContext.chunks.length === 0 && !opts?.sessionSummary) {
      this.budgetMonitor.endOperation("context_injection", totalTokens);
      return userMessage;
    }

    const parts: string[] = [];

    if (opts?.sessionSummary) {
      const summaryTokens = this.counter.estimateTokens(opts.sessionSummary);
      totalTokens += summaryTokens;
      parts.push(`## Session Context\n${opts.sessionSummary}\n`);
    }

    if (workingContext.chunks.length > 0) {
      const shownFiles = new Set<string>();
      const targetedChunks = workingContext.chunks.filter((c) => {
        const path = c.path || c.filepath || "";
        const startLine = c.startLine || c.start_line || 0;
        const key = `${path}:${startLine}`;
        if (shownFiles.has(key)) return false;
        shownFiles.add(key);
        return true;
      });

      const chunksText = targetedChunks
        .map((c, i) => {
          const path = c.path || c.filepath || "";
          const startLine = c.startLine || c.start_line || 0;
          const endLine = c.endLine || c.end_line || 0;
          const text = c.text || c.content || "";
          const pathDisplay = `${path}:${startLine}-${endLine}`;
          const tag = opts?.intent ? ` (relevant for: ${opts.intent})` : "";
          return `## Context ${i + 1}: \`${pathDisplay}\`${tag}\n\`\`\`\n${text}\n\`\`\``;
        })
        .join("\n\n");

      parts.push(`## Retrieved Code Context\n${chunksText}\n`);
    }

    if (opts?.intent === "debug" && opts?.diagnostics && opts.diagnostics.length > 0) {
      const diagTokens = this.counter.estimateTokens(opts.diagnostics.join("\n"));
      totalTokens += diagTokens;
      parts.push(`## Active Diagnostics\n${opts.diagnostics.join("\n")}\n`);
    }

    parts.push(`User request: ${userMessage}`);

    const result = `You are working on a software development task. Relevant context has been injected.\n\n${parts.join("\n---\n")}\n\nAnalyze the provided context carefully before responding. If the context is insufficient or irrelevant, say so.`;

    const resultTokens = this.counter.estimateTokens(result);
    totalTokens += resultTokens;
    this.budgetMonitor.endOperation("context_injection", resultTokens);

    if (opts?.enableBudgetCheck !== false) {
      this.budgetMonitor.logStatus();
    }

    return result;
  }

  injectIntoSystem(systemPrompt: string, context: RetrievalResult): string {
    this.budgetMonitor.startOperation("system_context_injection");

    if (context.chunks.length === 0) {
      this.budgetMonitor.endOperation(
        "system_context_injection",
        this.counter.estimateTokens(systemPrompt)
      );
      return systemPrompt;
    }

    const contextText = context.chunks
      .map((c, i) => {
        const path = c.path || c.filepath || "";
        const startLine = c.startLine || c.start_line || 0;
        const text = c.text || c.content || "";
        const pathDisplay = `${path}:${startLine}`;
        return `[${i + 1}] ${pathDisplay}: ${text.slice(0, 200)}${text.length > 200 ? "..." : ""}`;
      })
      .join("\n");

    const result = `${systemPrompt}

## Codebase Context
The following relevant code was retrieved from the codebase:
${contextText}

Use this context to inform your response.`;

    this.budgetMonitor.endOperation(
      "system_context_injection",
      this.counter.estimateTokens(result)
    );
    return result;
  }

  formatResults(context: RetrievalResult): string {
    if (context.chunks.length === 0) {
      return "No relevant context found.";
    }

    let output = `Found ${context.totalChunks} relevant context(s):\n\n`;

    context.chunks.forEach((c, i) => {
      const path = c.path || c.filepath || "";
      const startLine = c.startLine || c.start_line || 0;
      const text = c.text || c.content || "";
      output += `### ${i + 1}. ${path}:${startLine}\n`;
      output += `\`\`\`\n${text.slice(0, 300)}${text.length > 300 ? "\n..." : ""}\n\`\`\`\n\n`;
    });

    return output;
  }

  getBudgetStatus() {
    return this.budgetMonitor.getBudgetStatus();
  }

  checkBudget(required: number): boolean {
    return this.budgetMonitor.checkBudget(required);
  }

  resetBudget(): void {
    this.budgetMonitor.reset();
  }
}

export const contextInjector = new ContextInjector();
