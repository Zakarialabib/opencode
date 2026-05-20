export interface TaskDecomposition {
  taskId: string;
  description: string;
  subTasks: string[];
  status: "pending" | "in_progress" | "completed";
  createdAt: number;
}

export interface SessionState {
  decisions: string[];
  constraints: string[];
  modifiedFiles: string[];
  taskDecompositions: TaskDecomposition[];
  recentFiles: string[];
  contextBudget: number;
  sessionId: string;
}

export class ContextSummaryGenerator {
  private state: SessionState;
  private readonly DEFAULT_MAX_TOKENS = 24000;

  constructor(state: SessionState) {
    this.state = state;
  }

  compress(state: SessionState, maxTokens?: number): string {
    const tokenLimit = maxTokens ?? this.DEFAULT_MAX_TOKENS;
    const sections: string[] = [];

    sections.push("## Session Context");

    if (state.decisions.length > 0) {
      sections.push(`- Decisions: ${state.decisions.join(", ")}`);
    } else {
      sections.push("- Decisions: none");
    }

    if (state.constraints.length > 0) {
      sections.push(`- Constraints: ${state.constraints.join(", ")}`);
    } else {
      sections.push("- Constraints: none");
    }

    if (state.modifiedFiles.length > 0) {
      const fileList = state.modifiedFiles.length > 10
        ? `${state.modifiedFiles.slice(0, 10).join(", ")}... (+${state.modifiedFiles.length - 10} more)`
        : state.modifiedFiles.join(", ");
      sections.push(`- Modified Files: ${fileList}`);
    } else {
      sections.push("- Modified Files: none");
    }

    sections.push(`- Remaining Token Budget: ${state.contextBudget}`);

    const summary = sections.join("\n");
    const estimatedTokens = this.estimateTokens(summary);

    if (estimatedTokens > tokenLimit) {
      return this.compressToLimit(sections, tokenLimit);
    }

    return summary;
  }

  appendDecision(state: SessionState, decision: string): void {
    if (!state.decisions.includes(decision)) {
      state.decisions.push(decision);
    }
  }

  appendConstraint(state: SessionState, constraint: string): void {
    if (!state.constraints.includes(constraint)) {
      state.constraints.push(constraint);
    }
  }

  trackFile(state: SessionState, filePath: string): void {
    if (!state.modifiedFiles.includes(filePath)) {
      state.modifiedFiles.push(filePath);
    }

    if (!state.recentFiles.includes(filePath)) {
      state.recentFiles.unshift(filePath);
      if (state.recentFiles.length > 50) {
        state.recentFiles = state.recentFiles.slice(0, 50);
      }
    }
  }

  decrementBudget(state: SessionState, tokens: number): void {
    state.contextBudget = Math.max(0, state.contextBudget - tokens);
  }

  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  private compressToLimit(sections: string[], tokenLimit: number): string {
    const compressed: string[] = [sections[0]];

    for (let i = 1; i < sections.length; i++) {
      const testLine = compressed.join("\n") + "\n" + sections[i];
      if (this.estimateTokens(testLine) <= tokenLimit) {
        compressed.push(sections[i]);
      } else {
        break;
      }
    }

    return compressed.join("\n");
  }
}

function generateSessionId(): string {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 9);
  return `session-${timestamp}-${randomPart}`;
}

function createInitialState(): SessionState {
  return {
    decisions: [],
    constraints: [],
    modifiedFiles: [],
    taskDecompositions: [],
    recentFiles: [],
    contextBudget: 24000,
    sessionId: generateSessionId(),
  };
}

class OrchestratorSessionManager {
  private state: SessionState;
  private generator: ContextSummaryGenerator;

  constructor() {
    this.state = createInitialState();
    this.generator = new ContextSummaryGenerator(this.state);
  }

  getState(): SessionState {
    return { ...this.state };
  }

  getSummary(maxTokens?: number): string {
    return this.generator.compress(this.state, maxTokens);
  }

  addDecision(decision: string): void {
    this.generator.appendDecision(this.state, decision);
  }

  addConstraint(constraint: string): void {
    this.generator.appendConstraint(this.state, constraint);
  }

  trackModifiedFile(filePath: string): void {
    this.generator.trackFile(this.state, filePath);
  }

  addTaskDecomposition(decomposition: TaskDecomposition): void {
    const existing = this.state.taskDecompositions.findIndex(
      (t) => t.taskId === decomposition.taskId
    );
    if (existing >= 0) {
      this.state.taskDecompositions[existing] = decomposition;
    } else {
      this.state.taskDecompositions.push(decomposition);
    }
  }

  consumeTokens(tokens: number): number {
    const previousBudget = this.state.contextBudget;
    this.generator.decrementBudget(this.state, tokens);
    return previousBudget - this.state.contextBudget;
  }

  reset(): void {
    this.state = createInitialState();
    this.generator = new ContextSummaryGenerator(this.state);
  }

  getRemainingBudget(): number {
    return this.state.contextBudget;
  }

  getSessionId(): string {
    return this.state.sessionId;
  }
}

export const orchestratorSession = new OrchestratorSessionManager();
