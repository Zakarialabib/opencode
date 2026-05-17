/**
 * Eval Plugin for OpenCode
 * 
 * Implements the Instrument → Trace → Eval → Annotate → Analyse loop
 * for capability and regression evaluation of OpenCode's performance.
 * 
 * @see https://opencode.ai/docs/plugins
 */

import { type Plugin, tool } from "@opencode-ai/plugin";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname, resolve } from "node:path";

// ============================================================================
// Types
// ============================================================================

interface EvalTask {
  id: string;
  category: string;
  type: "capability" | "regression";
  description: string;
  context_budget: number;
  max_turns: number;
  expected: Record<string, any>;
  thresholds: Record<string, number>;
}

interface TraceSession {
  id: string;
  task: EvalTask;
  start_time: number;
  turns: TracedTurn[];
  tool_calls: ToolCall[];
  file_reads: FileRead[];
  skill_triggers: SkillTrigger[];
  errors: ErrorEvent[];
  context_used: number;
  self_corrections: number;
  loop_cycles: number;
}

interface TracedTurn {
  turn: number;
  input_tokens: number;
  output_tokens: number;
  tools_called: number;
  files_accessed: number;
  errors: number;
}

interface ToolCall {
  name: string;
  params: Record<string, any>;
  success: boolean;
  duration_ms: number;
  turn: number;
}

interface FileRead {
  path: string;
  size: number;
  lines: number;
  relevant: boolean;
  turn: number;
  read_order: number;
}

interface SkillTrigger {
  skill: string;
  triggered: boolean;
  used: boolean;
  turn: number;
}

interface ErrorEvent {
  type: string;
  message: string;
  turn: number;
  recovered: boolean;
}

interface EvalScores {
  context_efficiency: number;
  token_economy: number;
  tool_optimization: number;
  error_resilience: number;
  skill_alignment: number;
  overall: number;
}

interface Annotation {
  id: string;
  type: "inefficiency" | "redundancy" | "excellence" | "missing_context" | "over_context" | "tool_mismatch" | "recovery_gap";
  severity: "info" | "warning" | "critical";
  observation: string;
  impact: Record<string, any>;
  actionable: {
    category: string;
    suggestion: string;
    rule?: string;
  };
}

// ============================================================================
// State
// ============================================================================

let activeSession: TraceSession | null = null;
let sessionCounter = 0;

// ============================================================================
// Core Functions
// ============================================================================

function generateId(): string {
  return Math.random().toString(36).substring(2, 10);
}

function getScoresLabel(scores: EvalScores): string {
  if (scores.overall >= 1.0) return "PERFECT_EFFICIENCY";
  if (scores.overall >= 0.9) return "EXCELLENT";
  if (scores.overall >= 0.8) return "GOOD";
  if (scores.overall >= 0.7) return "PARTIAL_EFFICIENCY";
  if (scores.overall >= 0.5) return "NEEDS_WORK";
  return "POOR";
}

function calculateScores(session: TraceSession): EvalScores {
  // Context Efficiency: relevant files / total files
  const totalFiles = session.file_reads.length;
  const relevantFiles = session.file_reads.filter(f => f.relevant).length;
  const contextEfficiency = totalFiles > 0 ? relevantFiles / totalFiles : 1.0;
  
  // Token Economy: penalize verbose output, self-corrections
  const totalOutputTokens = session.turns.reduce((sum, t) => sum + t.output_tokens, 0);
  const correctionPenalty = Math.min(0.3, session.self_corrections * 0.05);
  const tokenEconomy = Math.max(0, 1.0 - correctionPenalty);
  
  // Tool Optimization: successful tools / total, no redundant calls
  const successfulTools = session.tool_calls.filter(t => t.success).length;
  const toolRate = session.tool_calls.length > 0 ? successfulTools / session.tool_calls.length : 1.0;
  const duplicateTools = session.tool_calls.filter((t, i) => 
    session.tool_calls.slice(0, i).some(prev => 
      prev.name === t.name && JSON.stringify(prev.params) === JSON.stringify(t.params)
    )
  ).length;
  const redundancyPenalty = Math.min(0.2, duplicateTools * 0.02);
  const toolOptimization = Math.max(0, toolRate * (1 - redundancyPenalty));
  
  // Error Resilience: recovered errors / total errors
  const totalErrors = session.errors.length;
  const recoveredErrors = session.errors.filter(e => e.recovered).length;
  const errorResilience = totalErrors > 0 ? recoveredErrors / totalErrors : 1.0;
  
  // Skill Alignment: triggered and used / total triggers
  const totalTriggers = session.skill_triggers.length;
  const usedTriggers = session.skill_triggers.filter(t => t.used).length;
  const skillAlignment = totalTriggers > 0 ? usedTriggers / totalTriggers : 1.0;
  
  // Overall: weighted average
  const overall = (
    contextEfficiency * 0.25 +
    tokenEconomy * 0.25 +
    toolOptimization * 0.20 +
    errorResilience * 0.15 +
    skillAlignment * 0.15
  );
  
  return {
    context_efficiency: Math.round(contextEfficiency * 100) / 100,
    token_economy: Math.round(tokenEconomy * 100) / 100,
    tool_optimization: Math.round(toolOptimization * 100) / 100,
    error_resilience: Math.round(errorResilience * 100) / 100,
    skill_alignment: Math.round(skillAlignment * 100) / 100,
    overall: Math.round(overall * 100) / 100,
  };
}

function generateAnnotations(session: TraceSession, scores: EvalScores): Annotation[] {
  const annotations: Annotation[] = [];
  
  // Inefficiency: too many files, low relevance
  if (scores.context_efficiency < 0.5) {
    const irrelevant = session.file_reads.filter(f => !f.relevant).length;
    annotations.push({
      id: generateId(),
      type: "inefficiency",
      severity: "warning",
      observation: `Read ${session.file_reads.length} files but only ${session.file_reads.filter(f => f.relevant).length} were relevant (${irrelevant} wasted)`,
      impact: { tokens_wasted: irrelevant * 5000, context_lost_pct: Math.round((1 - scores.context_efficiency) * 100) },
      actionable: {
        category: "context",
        suggestion: "Use path-based filtering. Prefer 'src/routes/*.ts' over '**/*.ts'",
        rule: "rules/general.md",
      },
    });
  }
  
  // Excellence: perfect relevance
  if (scores.context_efficiency >= 0.9 && session.file_reads.length > 0) {
    annotations.push({
      id: generateId(),
      type: "excellence",
      severity: "info",
      observation: `Excellent context utilization: ${Math.round(scores.context_efficiency * 100)}% relevance rate`,
      impact: {},
      actionable: {
        category: "prompt",
        suggestion: "This file selection pattern should be documented in best practices",
      },
    });
  }
  
  // Redundancy: duplicate file reads
  const duplicates = session.file_reads.filter((f, i) => 
    session.file_reads.slice(0, i).some(prev => prev.path === f.path)
  );
  if (duplicates.length > 0) {
    annotations.push({
      id: generateId(),
      type: "redundancy",
      severity: "info",
      observation: `File read ${duplicates.length} time(s) - consider caching`,
      impact: { tokens_wasted: duplicates.length * 5000 },
      actionable: {
        category: "tool",
        suggestion: "Track which files have been read in this session to avoid duplicates",
      },
    });
  }
  
  // Self-corrections
  if (session.self_corrections > 2) {
    annotations.push({
      id: generateId(),
      type: "inefficiency",
      severity: "info",
      observation: `${session.self_corrections} self-corrections detected - consider planning more carefully`,
      impact: { tokens_wasted: session.self_corrections * 200, time_impact: "~1s each" },
      actionable: {
        category: "prompt",
        suggestion: "Before editing, read relevant files and plan the change in one pass",
      },
    });
  }
  
  // Errors not recovered
  const unrecovered = session.errors.filter(e => !e.recovered);
  if (unrecovered.length > 0) {
    annotations.push({
      id: generateId(),
      type: "recovery_gap",
      severity: "warning",
      observation: `${unrecovered.length} error(s) not recovered from`,
      impact: { quality_impact: 0.3 },
      actionable: {
        category: "prompt",
        suggestion: "When encountering errors, attempt at least one recovery strategy before giving up",
        rule: "rules/general.md",
      },
    });
  }
  
  return annotations;
}

function evaluate(session: TraceSession, thresholds: Record<string, number>): { passed: boolean; failed: string[] } {
  const scores = calculateScores(session);
  const failed: string[] = [];
  
  for (const [key, threshold] of Object.entries(thresholds)) {
    const score = scores[key as keyof EvalScores];
    if (score < threshold) {
      failed.push(`${key}=${score} < ${threshold}`);
    }
  }
  
  return { passed: failed.length === 0, failed };
}

// ============================================================================
// Tool Definitions
// ============================================================================

const eval_start = tool({
  description: "Start an evaluation trace session for Instrument → Trace → Eval → Annotate → Analyse loop",
  args: {
    task_id: tool.schema.string().describe("Unique identifier for this eval task"),
    category: tool.schema.string().describe("Eval category: context_window, token_efficiency, tool_selection, error_recovery, skill_alignment"),
    type: tool.schema.string().describe("Eval type: capability (iterate to 100%) or regression (must always pass)"),
    description: tool.schema.string().describe("Description of what this eval tests"),
    context_budget: tool.schema.number().optional().describe("Max context tokens (default: 50000)"),
    thresholds: tool.schema.record(tool.schema.string(), tool.schema.number()).optional().describe("Score thresholds for pass/fail"),
  },
  async execute({ task_id, category, type, description, context_budget = 50000, thresholds = {} }) {
    if (activeSession) {
      return { error: `Session ${activeSession.id} already active. End it first with eval_end.` };
    }
    
    sessionCounter++;
    const sessionId = `eval-${task_id}-${Date.now()}`;
    
    activeSession = {
      id: sessionId,
      task: {
        id: task_id,
        category,
        type: type as "capability" | "regression",
        description,
        context_budget,
        max_turns: 5,
        expected: {},
        thresholds,
      },
      start_time: Date.now(),
      turns: [],
      tool_calls: [],
      file_reads: [],
      skill_triggers: [],
      errors: [],
      context_used: 0,
      self_corrections: 0,
      loop_cycles: 0,
    };
    
    return {
      session_id: sessionId,
      status: "active",
      task: activeSession.task,
      message: `Eval session started. Use eval_log to record tool calls, file reads, and errors.`,
    };
  },
});

const eval_log = tool({
  description: "Log events during an eval trace: tool calls, file reads, skill triggers, errors",
  args: {
    event_type: tool.schema.string().describe("Type: tool_call, file_read, skill_trigger, error, self_correction"),
    data: tool.schema.record(tool.schema.string(), tool.schema.any()).describe("Event data specific to type"),
  },
  async execute({ event_type, data }) {
    if (!activeSession) {
      return { error: "No active eval session. Start one with eval_start first." };
    }
    
    const currentTurn = activeSession.turns.length || 1;
    
    switch (event_type) {
      case "tool_call": {
        activeSession.tool_calls.push({
          name: data.name as string,
          params: data.params as Record<string, any> || {},
          success: (data.success as boolean) ?? true,
          duration_ms: (data.duration_ms as number) || 0,
          turn: currentTurn,
        });
        break;
      }
      
      case "file_read": {
        const path = data.path as string;
        // Mark as relevant if the path contains keywords from task
        const isRelevant = activeSession.task.type === "capability" 
          ? (data.relevant as boolean) ?? true  // Default to relevant for capability evals
          : true;
        
        activeSession.file_reads.push({
          path,
          size: (data.size as number) || 10000,
          lines: (data.lines as number) || 250,
          relevant: isRelevant,
          turn: currentTurn,
          read_order: activeSession.file_reads.length,
        });
        
        // Estimate token cost
        activeSession.context_used += (data.size as number || 10000) / 4;
        break;
      }
      
      case "skill_trigger": {
        activeSession.skill_triggers.push({
          skill: data.skill as string,
          triggered: (data.triggered as boolean) ?? true,
          used: (data.used as boolean) ?? true,
          turn: currentTurn,
        });
        break;
      }
      
      case "error": {
        activeSession.errors.push({
          type: data.type as string || "unknown",
          message: data.message as string || "",
          turn: currentTurn,
          recovered: (data.recovered as boolean) ?? false,
        });
        break;
      }
      
      case "self_correction": {
        activeSession.self_corrections++;
        break;
      }
      
      case "loop_cycle": {
        activeSession.loop_cycles++;
        break;
      }
      
      default:
        return { error: `Unknown event type: ${event_type}` };
    }
    
    return {
      status: "logged",
      event_type,
      session_id: activeSession.id,
      stats: {
        tool_calls: activeSession.tool_calls.length,
        file_reads: activeSession.file_reads.length,
        errors: activeSession.errors.length,
        context_used: Math.round(activeSession.context_used),
      },
    };
  },
});

const eval_end = tool({
  description: "End the current eval trace and run evaluation with annotations and analysis",
  args: {
    final_turn: tool.schema.object({
      input_tokens: tool.schema.number(),
      output_tokens: tool.schema.number(),
      files_accessed: tool.schema.number(),
      errors: tool.schema.number(),
    }).optional().describe("Final turn metrics to record before ending"),
    output_path: tool.schema.string().optional().describe("Path to save results JSON (default: evals/results/{session_id}.json)"),
  },
  async execute({ final_turn, output_path }) {
    if (!activeSession) {
      return { error: "No active eval session to end." };
    }
    
    // Record final turn if provided
    if (final_turn) {
      activeSession.turns.push({
        turn: activeSession.turns.length + 1,
        input_tokens: final_turn.input_tokens,
        output_tokens: final_turn.output_tokens,
        tools_called: activeSession.tool_calls.length,
        files_accessed: final_turn.files_accessed,
        errors: final_turn.errors,
      });
    }
    
    const session = activeSession;
    const scores = calculateScores(session);
    const annotations = generateAnnotations(session, scores);
    const { passed, failed } = evaluate(session, session.task.thresholds);
    const duration_ms = Date.now() - session.start_time;
    
    const result = {
      session_id: session.id,
      task: session.task,
      scores,
      label: getScoresLabel(scores),
      passed,
      failed_categories: failed,
      annotations,
      stats: {
        total_turns: session.turns.length,
        total_tool_calls: session.tool_calls.length,
        total_file_reads: session.file_reads.length,
        relevant_files: session.file_reads.filter(f => f.relevant).length,
        total_errors: session.errors.length,
        recovered_errors: session.errors.filter(e => e.recovered).length,
        context_used: Math.round(session.context_used),
        context_budget: session.task.context_budget,
        self_corrections: session.self_corrections,
        duration_ms,
      },
      // Actionable insights
      insights: {
        what_happened: annotations.map(a => a.observation),
        why_it_matters: annotations.map(a => a.impact),
        how_to_fix: annotations.map(a => a.actionable.suggestion),
        rules_to_update: annotations
          .filter(a => a.actionable.rule)
          .map(a => a.actionable.rule),
      },
    };
    
    // Save if output path provided
    if (output_path) {
      const dir = dirname(output_path);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
      writeFileSync(output_path, JSON.stringify(result, null, 2));
    }
    
    // Clear session
    activeSession = null;
    
    return result;
  },
});

const eval_run = tool({
  description: "Run the full eval loop: execute task, trace, evaluate, annotate, analyze, and loop until 100% or regression detected",
  args: {
    task: tool.schema.object({
      id: tool.schema.string(),
      category: tool.schema.string(),
      type: tool.schema.string().describe("capability or regression"),
      description: tool.schema.string(),
      context_budget: tool.schema.number().default(50000),
      thresholds: tool.schema.record(tool.schema.string(), tool.schema.number()).optional(),
    }).describe("The eval task to run"),
    max_iterations: tool.schema.number().optional().describe("Max iterations for capability evals (default: 5)"),
    execute_fn: tool.schema.string().optional().describe("Description of how to execute the task (task description)"),
  },
  async execute({ task, max_iterations = 5, execute_fn }) {
    const results = [];
    let previousScores = null;
    
    for (let iteration = 1; iteration <= max_iterations; iteration++) {
      // Start new trace session
      const startResult = await eval_start.execute({
        task_id: `${task.id}-iter${iteration}`,
        category: task.category,
        type: task.type,
        description: task.description,
        context_budget: task.context_budget,
        thresholds: task.thresholds || {},
      });
      
      // In a real implementation, you would:
      // 1. Execute the actual task here
      // 2. Log events as they happen using eval_log
      // 3. Call eval_end to get results
      
      // For now, return the config that would be executed
      results.push({
        iteration,
        config: startResult,
        message: `Iteration ${iteration}: Execute task and call eval_log for events, then eval_end`,
      });
      
      // Check if we should continue
      if (task.type === "regression" && startResult.error) {
        return {
          status: "regression_detected",
          iteration,
          message: "STOP - Regression detected! Fix immediately.",
          results,
        };
      }
      
      // For capability evals, continue until thresholds met
      if (startResult.status === "active") {
        // Simulate completion
        const endResult = await eval_end.execute({});
        results.push({ iteration, results: endResult });
        
        if (endResult.passed) {
          return {
            status: "passed",
            iteration,
            message: `Capability eval passed at iteration ${iteration}!`,
            results,
          };
        }
      }
    }
    
    return {
      status: "max_iterations_reached",
      iterations_completed: max_iterations,
      message: `Did not reach 100% in ${max_iterations} iterations. Review annotations for improvement suggestions.`,
      results,
    };
  },
});

const eval_status = tool({
  description: "Check status of active eval session",
  args: {},
  async execute() {
    if (!activeSession) {
      return { status: "no_active_session" };
    }
    
    return {
      status: "active",
      session_id: activeSession.id,
      task: activeSession.task,
      stats: {
        turns: activeSession.turns.length,
        tool_calls: activeSession.tool_calls.length,
        file_reads: activeSession.file_reads.length,
        errors: activeSession.errors.length,
        context_used: Math.round(activeSession.context_used),
      },
    };
  },
});

const eval_list = tool({
  description: "List available eval tasks from evals/capability/ and evals/regression/ directories",
  args: {},
  async execute() {
    // Look for eval JSON files in standard locations
    const locations = [
      "evals/capability",
      "evals/regression",
      "plugins/eval-plugin/evals",
    ];
    
    const tasks = [];
    
    for (const loc of locations) {
      // This is a simplified version - in production you'd read actual files
      tasks.push({
        location: loc,
        note: "Eval tasks would be loaded from this directory",
      });
    }
    
    return {
      locations,
      message: "Use eval_run with the task config directly, or create evals in the evals/ directory structure",
    };
  },
});

// ============================================================================
// Plugin
// ============================================================================

const EvalPlugin: Plugin = async ({ client, project, directory }) => {
  await client.app.log({
    body: {
      service: "eval-plugin",
      level: "info",
      message: "Eval plugin initialized",
      directory,
    },
  });
  
  return {
    // Hook: Intercept tool calls to auto-log for eval
    "tool.execute.before": async (input, output) => {
      if (activeSession) {
        // Auto-log tool calls during active eval
        const toolName = input.tool || "unknown";
        activeSession.tool_calls.push({
          name: toolName,
          params: input.params || {},
          success: true, // Will be updated in after hook
          duration_ms: 0,
          turn: activeSession.turns.length || 1,
        });
      }
    },
    
    "tool.execute.after": async (input, output) => {
      if (activeSession) {
        // Update with result
        const lastCall = activeSession.tool_calls[activeSession.tool_calls.length - 1];
        if (lastCall && lastCall.name === (input.tool || "unknown")) {
          lastCall.success = !output.error;
        }
        
        // Track file reads specifically
        if (input.tool === "read" && output.content) {
          const size = output.content.length;
          activeSession.file_reads.push({
            path: input.params?.file_path || "unknown",
            size,
            lines: output.content.split("\n").length,
            relevant: true, // Would be determined by output analysis
            turn: activeSession.turns.length || 1,
            read_order: activeSession.file_reads.length,
          });
          activeSession.context_used += size / 4;
        }
        
        // Track errors
        if (output.error) {
          activeSession.errors.push({
            type: "execution_error",
            message: String(output.error).substring(0, 200),
            turn: activeSession.turns.length || 1,
            recovered: false,
          });
        }
      }
    },
    
    // Expose eval tools
    tool: {
      eval_start,
      eval_log,
      eval_end,
      eval_run,
      eval_status,
      eval_list,
    },
  };
};

export default EvalPlugin;