import type { DecisionRecord, Diagnostic } from "../tree/engine";

export interface SessionMemory {
  recentFiles: string[];
  diagnostics: Diagnostic[];
  currentTodo?: string;
  lspSymbols?: any[];
  decisions: DecisionRecord[];
  successCount: number;
  failures: Array<{ reason: string; timestamp: number }>;
  pendingMutations: number;
  contextUsed: string[];
}

export class SessionMemoryManager {
  private memory: SessionMemory;

  constructor() {
    this.memory = this.createEmpty();
  }

  private createEmpty(): SessionMemory {
    return {
      recentFiles: [],
      diagnostics: [],
      decisions: [],
      successCount: 0,
      failures: [],
      pendingMutations: 0,
      contextUsed: [],
    };
  }

  reset(): void {
    this.memory = this.createEmpty();
  }

  recordDecision(decision: DecisionRecord): void {
    this.memory.decisions.push(decision);
  }

  markSuccess(): void {
    this.memory.successCount++;
  }

  markFailure(reason: string): void {
    this.memory.failures.push({ reason, timestamp: Date.now() });
  }

  markContextUsed(chunks: any[]): void {
    this.memory.contextUsed.push(...chunks.map((c) => `${c.path}:${c.startLine}`));
  }

  markFileDirty(path: string): void {
    if (!this.memory.recentFiles.includes(path)) {
      this.memory.recentFiles.push(path);
    }
    if (this.memory.recentFiles.length > 50) {
      this.memory.recentFiles = this.memory.recentFiles.slice(-50);
    }
  }

  setDiagnostics(diagnostics: Diagnostic[]): void {
    this.memory.diagnostics = diagnostics;
  }

  setTodo(todo: string): void {
    this.memory.currentTodo = todo;
  }

  setLspSymbols(symbols: any[]): void {
    this.memory.lspSymbols = symbols;
  }

  getMemory(): SessionMemory {
    return { ...this.memory };
  }

  getSummary(): string {
    return `## Brain Session Summary
- Decisions made: ${this.memory.decisions.length}
- Successful retrievals: ${this.memory.successCount}
- Failed paths: ${this.memory.failures.length > 0 ? this.memory.failures.map((f) => f.reason).join(", ") : "none"}
- Files touched: ${this.memory.recentFiles.length}
- Context chunks used: ${this.memory.contextUsed.length}`;
  }
}

export const sessionMemory = new SessionMemoryManager();
