# Agentic Capability Evaluation Framework

## Philosophy

**Evaluations are diagnostics, not grades.** Every eval should produce actionable insights that drive concrete improvements to OpenCode's prompting, context handling, and token utilization.

The framework distinguishes between:
- **Capability Evals**: Push boundaries - we want these to pass and iterate until they do at 100%
- **Regression Evals**: Guardrails - these should ALWAYS pass; failure means STOP and fix

---

## Core Loop: Instrument → Trace → Eval → Annotate → Analyse

```
┌─────────────────────────────────────────────────────────────────────┐
│                         EVALUATION LOOP                             │
│                                                                     │
│   ┌──────────────┐    ┌──────────────┐    ┌──────────────┐        │
│   │  INSTRUMENT  │───▶│    TRACE     │───▶│     EVAL     │        │
│   │  (setup)     │    │  (capture)   │    │   (score)    │        │
│   └──────────────┘    └──────────────┘    └──────────────┘        │
│          ▲                                       │                  │
│          │                                       ▼                  │
│   ┌──────────────┐    ┌──────────────┐    ┌──────────────┐        │
│   │   ANALYSE   │◀───│  ANNOTATE    │    │   DECIDE    │        │
│   │  (insights)  │    │  (explain)   │    │  (pass/fail) │        │
│   └──────────────┘    └──────────────┘    └──────────────┘        │
│          │                                                           │
│          │           ┌─────────────────────────┐                    │
│          └───────────│ REFINEMENT CANDIDATES   │                    │
│                      │   (improvements)        │                    │
│                      └─────────────────────────┘                    │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Eval Types

### 1. Capability Eval (Green Path - Iterate to 100%)

**Purpose**: Validate and improve new capabilities

**Rules**:
- Target: 100% pass rate
- Loop until passing OR max iterations reached
- Each failure generates specific improvement hints
- Track token efficiency improvements across iterations

**Eval Categories**:

| Category | What it measures | Success Criteria |
|----------|------------------|------------------|
| `context_window` | Effective use of context budget | Relevant context used, irrelevant excluded |
| `token_efficiency` | Output token economy | Concise yet complete responses |
| `context_loading` | When/what to load | Correct files loaded, correct depth |
| `prompt_adherence` | Follows skill instructions | Output matches expected format |
| `tool_selection` | Chooses right tools | Minimal, correct tool calls |
| `error_recovery` | Handles failures gracefully | Recovers without loops |

### 2. Regression Eval (Red Path - Must Always Pass)

**Purpose**: Guard existing capabilities

**Rules**:
- Target: 100% pass rate (non-negotiable)
- Any failure = STOP, fix immediately
- Run before and after capability improvements
- Acts as canary in the coal mine

**Regression Categories**:

| Category | Guard against | Threshold |
|-----------|----------------|-----------|
| `skill_triggering` | Skills don't stop triggering | 100% |
| `basic_functionality` | Read/write/edit still work | 100% |
| `agent_routing` | Correct agent selection | 100% |
| `context_preservation` | State not lost mid-task | 100% |
| `output_format` | Structured output maintained | 100% |

---

## Eval Output Format (Actionable Labels)

Each eval produces:

```json
{
  "eval_id": "cap-001",
  "category": "context_window",
  "type": "capability",
  "task": {
    "description": "Analyze large codebase structure",
    "files": ["src/**/*.ts"],
    "context_budget": 32000
  },
  "trace": {
    "tokens_in": 28450,
    "tokens_out": 1820,
    "files_read": 47,
    "relevant_files": 12,
    "tools_called": 5,
    "tool_sequence": ["glob", "read", "read", "glob", "read"]
  },
  "evaluation": {
    "score": 0.73,
    "label": "PARTIAL_EFFICIENCY",
    "passed": false,
    "breakdown": {
      "context_utilization": 0.81,
      "redundancy_penalty": 0.15,
      "relevance_score": 0.88
    }
  },
  "annotations": [
    {
      "type": "inefficiency",
      "location": "trace:step-3",
      "description": "Read 35 files but only 12 were relevant",
      "impact": "14.5KB wasted context",
      "suggestion": "Use more specific glob patterns or tree-walk selectively"
    },
    {
      "type": "excellence",
      "location": "trace:step-5",
      "description": "Excellent use of incremental file reading - depth-2 then depth-3",
      "impact": "Saved ~8KB context budget"
    }
  ],
  "explanation": {
    "summary": "The eval partially succeeded. OpenCode read too many files upfront before filtering.",
    "why_failed": "Glob pattern was too broad (*.ts) without size/location pruning",
    "why_mattered": "Wasted 47% of context budget on irrelevant files",
    "actionable": [
      "Add 'max_depth' parameter to glob guidance",
      "Prefer specific paths over wildcards when context is limited",
      "Consider file modification time to prioritize recent changes"
    ]
  },
  "iteration": 2,
  "improvement_candidates": [
    "Add context-budget-aware glob guidance in rules/general.md",
    "Prefer targeted reads over blanket glob + filter pattern"
  ]
}
```

### Score Labels (Human-Readable)

| Score Range | Label | Meaning |
|-------------|-------|---------|
| 1.0 | `PERFECT_EFFICIENCY` | Optimal - textbook example |
| 0.9-0.99 | `EXCELLENT` | Minor optimization possible |
| 0.8-0.89 | `GOOD` | Solid performance, small gains |
| 0.7-0.79 | `PARTIAL_EFFICIENCY` | Noticeable waste, actionable improvement |
| 0.5-0.69 | `NEEDS_WORK` | Significant room for improvement |
| 0.0-0.49 | `POOR` | Major inefficiency, critical fix needed |

### Annotation Types

| Type | Purpose | Auto-fixable? |
|------|---------|---------------|
| `inefficiency` | Context wasted | Yes, with guidance |
| `redundancy` | Repeated work | Yes, with better planning |
| `excellence` | Example to follow | Keep as is |
| `missing_context` | Should have loaded more | Yes, with better context hints |
| `over_context` | Loaded too much | Yes, with budget awareness |
| `tool_mismatch` | Wrong tool chosen | Yes, with better routing |
| `recovery_gap` | Didn't handle failure | Yes, with error guidance |

---

## Instrument Phase

### What Gets Instrumented

1. **Token Tracking**
   - Input tokens per turn
   - Output tokens per turn
   - Cumulative context usage
   - Available context headroom

2. **File Access Patterns**
   - Files read (path, size, lines)
   - Read order (sequential, parallel, depth)
   - Relevance score (did the file contribute to output?)

3. **Tool Usage**
   - Which tools called
   - Call sequence
   - Parameters used
   - Call outcomes (success/fail/retry)

4. **Skill Interaction**
   - Which skills triggered
   - Trigger timing (early, late, never)
   - Skill output utilization

5. **Error Patterns**
   - Error types encountered
   - Recovery attempts
   - Recovery success rate

### Instrumentation API

```typescript
interface Instrumentation {
  // Start tracking a task
  startTrace(taskId: string, config: EvalConfig): TraceSession;
  
  // Log events during execution
  logEvent(session: TraceSession, event: TraceEvent): void;
  
  // Capture turn output
  logTurn(session: TraceSession, turn: TurnData): void;
  
  // Finalize trace
  finalize(session: TraceSession): TraceResult;
}

interface TraceEvent {
  type: 'tool_call' | 'file_read' | 'skill_trigger' | 'error' | 'recovery' | 'context_update';
  timestamp: number;
  data: Record<string, unknown>;
}

interface TurnData {
  turn_number: number;
  input_tokens: number;
  output_tokens: number;
  context_used: number;
  context_headroom: number;
  tools_called: number;
  files_read: number;
  errors: number;
}
```

---

## Trace Phase

### What Gets Captured

```typescript
interface TracedExecution {
  eval_id: string;
  task: EvalTask;
  
  // Timeline
  turns: TracedTurn[];
  
  // Aggregates
  total_tokens_in: number;
  total_tokens_out: number;
  total_files_read: number;
  relevant_files: number;
  tool_calls: ToolCall[];
  skill_triggers: SkillTrigger[];
  errors: ErrorEvent[];
  
  // Quality indicators
  self_corrections: number;
  loop_cycles: number;
  timeout_cycles: number;
}

interface TracedTurn {
  turn: number;
  model_input: {
    tokens: number;
    context_items: ContextItem[];
  };
  model_output: {
    tokens: number;
    tool_calls: string[];
    text_length: number;
  };
  execution: {
    tools_executed: ExecutedTool[];
    files_accessed: string[];
    context_budget_at_start: number;
    context_budget_at_end: number;
  };
}
```

---

## Eval Phase

### Scoring Engine

```typescript
interface ScoringEngine {
  // Calculate scores for all eval categories
  scoreExecution(trace: TracedExecution, config: EvalConfig): EvalScores;
  
  // Determine pass/fail with reasoning
  evaluate(scores: EvalScores, thresholds: Thresholds): EvalResult;
}

interface EvalScores {
  // Primary scores (0-1)
  context_efficiency: number;      // How well context was utilized
  token_economy: number;          // Output token efficiency
  tool_optimization: number;        // Minimal, correct tool usage
  error_resilience: number;         // Recovery from failures
  skill_alignment: number;         // Correct skill triggering
  
  // Composite
  overall_score: number;
  
  // Efficiency metrics (absolute)
  tokens_per_relevant_file: number;
  context_waste_percentage: number;
  tool_calls_per_useful_action: number;
}

interface Thresholds {
  capability: {
    context_efficiency: 0.75,
    token_economy: 0.80,
    tool_optimization: 0.85,
    error_resilience: 0.90,
    skill_alignment: 0.95,
  };
  regression: {
    // All must be 1.0 (100%)
    [key: string]: 1.0,
  };
}
```

### Eval Categories Detailed

#### 1. Context Efficiency Score

Measures how well the context window is used.

```python
def calculate_context_efficiency(trace: TracedExecution) -> float:
    """
    Ideal: Read only relevant files, in optimal order
    Penalty factors:
    - Reading irrelevant files (files read but never referenced in output)
    - Reading too deeply before needed
    - Not using context budget when available for complex tasks
    - Exceeding context budget unnecessarily
    """
    total_bytes_read = sum(f.size for f in trace.files_read)
    relevant_bytes = sum(f.size for f in trace.files_read if f.relevant)
    
    # Baseline: if all files relevant, perfect score
    if total_bytes_read == 0:
        return 1.0
    
    relevance_ratio = relevant_bytes / total_bytes_read
    size_penalty = calculate_size_penalty(trace)
    order_bonus = calculate_order_bonus(trace)
    
    return relevance_ratio * (1 - size_penalty) * (1 + order_bonus)
```

#### 2. Token Economy Score

Measures output conciseness and completeness.

```python
def calculate_token_economy(trace: TracedExecution) -> float:
    """
    Ideal: Minimal tokens that fully answer the task
    Penalize:
    - Verbose explanations of obvious things
    - Repeating information
    - Excessive formatting when not needed
    - Including "working on it" or "let me check" filler
    
    Reward:
    - Direct answers
    - Efficient formatting
    - Complete without being verbose
    """
    output_tokens = trace.total_tokens_out
    
    # Compare against estimated optimal for this task type
    estimated_optimal = estimate_optimal_output(trace.task)
    
    if output_tokens <= estimated_optimal:
        return 1.0
    
    # Penalize exponential waste
    waste_ratio = output_tokens / estimated_optimal
    if waste_ratio > 2.0:
        return max(0.1, 1.0 - (waste_ratio - 2.0) * 0.3)
    
    return 1.0 / waste_ratio
```

#### 3. Tool Optimization Score

Measures correct and minimal tool usage.

```python
def calculate_tool_optimization(trace: TracedExecution) -> float:
    """
    Ideal: Exact tools needed, in optimal order
    Penalize:
    - Wrong tool for task
    - Redundant tool calls (read same file twice)
    - Missing tools that would have helped
    - Excessive tool calls for simple tasks
    
    Reward:
    - Correct tool selection
    - Efficient sequences
    - Parallel opportunities taken
    """
    tool_calls = trace.tool_calls
    task_complexity = estimate_task_complexity(trace.task)
    
    # Expected tool count for task complexity
    expected_tools = get_expected_tools(task_complexity)
    
    if len(tool_calls) == 0:
        return task_complexity == 0 ? 1.0 : 0.0  # OK for trivial, bad for complex
    
    # Tool selection quality
    correct_tools = sum(1 for t in tool_calls if t.correct)
    selection_score = correct_tools / len(tool_calls)
    
    # Tool count efficiency
    count_ratio = expected_tools / len(tool_calls)
    count_score = min(1.0, count_ratio)  # More tools than needed = penalty
    
    # Redundancy check
    redundancy_penalty = calculate_redundancy_penalty(tool_calls)
    
    return selection_score * count_score * (1 - redundancy_penalty)
```

---

## Annotate Phase

### What Gets Annotated

Each eval produces annotations that explain WHAT happened and WHY it matters.

```typescript
interface Annotation {
  id: string;
  type: AnnotationType;
  severity: 'info' | 'warning' | 'critical';
  
  // Location in trace
  location: {
    turn?: number;
    step?: number;
    phase?: 'plan' | 'execute' | 'reflect';
  };
  
  // What
  observation: string;
  
  // Why it matters
  impact: {
    tokens_wasted?: number;
    time_impact?: string;
    context_budget_lost?: number;
    quality_degradation?: number;
  };
  
  // How to fix
  actionable: {
    category: 'prompt' | 'context' | 'tool' | 'skill' | 'routing';
    suggestion: string;
    code_change?: string;
    rule_addition?: string;
  };
  
  // Links
  related_rules?: string[];
  related_skills?: string[];
}

type AnnotationType = 
  | 'inefficiency'
  | 'redundancy'
  | 'excellence'
  | 'missing_context'
  | 'over_context'
  | 'tool_mismatch'
  | 'recovery_gap'
  | 'skill_misalignment';
```

### Annotation Examples

```json
{
  "id": "ann-001",
  "type": "inefficiency",
  "severity": "warning",
  "location": { "turn": 2, "step": 3 },
  "observation": "Glob pattern matched 127 TypeScript files, but only 8 were relevant to the task (API routes)",
  "impact": {
    "tokens_wasted": 45600,
    "context_budget_lost": "23%"
  },
  "actionable": {
    "category": "context",
    "suggestion": "Use path-based filtering: 'src/**/routes/*.ts' instead of '**/*.ts' when targeting specific modules",
    "rule_addition": "When context budget < 30%, prefer narrow glob patterns over broad ones"
  },
  "related_rules": ["rules/general.md"]
}
```

```json
{
  "id": "ann-002",
  "type": "excellence",
  "severity": "info",
  "location": { "turn": 1, "phase": "plan" },
  "observation": "Excellent prioritization: started with small files (config, types) before larger implementation files",
  "impact": {
    "tokens_wasted": -8200  # Negative = saved!
  },
  "actionable": {
    "category": "prompt",
    "suggestion": "This ordering pattern should be documented in the general rules"
  },
  "related_rules": []
}
```

---

## Analyse Phase

### What Analysis Produces

```typescript
interface AnalysisResult {
  eval_id: string;
  loop_iteration: number;
  
  // Overall verdict
  verdict: 'pass' | 'fail' | 'regression_detected';
  
  // Root cause analysis
  root_causes: RootCause[];
  
  // Improvement recommendations (prioritized)
  recommendations: Recommendation[];
  
  // Efficiency trends
  efficiency_delta: {
    tokens_saved: number;
    context_improvement: number;
    time_improvement: number;
  };
  
  // Risk assessment
  risks: Risk[];
}

interface RootCause {
  category: 'prompt' | 'context' | 'tool' | 'skill' | 'routing';
  description: string;
  frequency: number;  // How many evals triggered this
  severity: 'low' | 'medium' | 'high' | 'critical';
}

interface Recommendation {
  priority: 1 | 2 | 3;
  action: 'add_rule' | 'update_skill' | 'adjust_prompt' | 'fix_routing';
  target: string;  // File or skill to change
  change: string;
  expected_impact: string;
  effort: 'low' | 'medium' | 'high';
}
```

### Analysis Triggers

| Pattern | Analysis Trigger | Likely Root Cause |
|---------|------------------|-------------------|
| `context_waste > 30%` | Repeatedly reading irrelevant files | Glob pattern too broad, no relevance filter |
| `token_ratio < 0.5` | Output 2x longer than needed | Verbose prompting, no conciseness guidance |
| `tool_calls > 2x expected` | Excessive tool usage | Poor planning, missing context, no tool guidance |
| `skill_mismatch > 20%` | Wrong skills triggering | Description too broad or too narrow |
| `no_recovery_attempts` | Errors not handled | Missing error handling in prompts/rules |

---

## Loop Flow Control

### Capability Eval Loop

```
START: Capability Eval
│
├─▶ INSTRUMENT: Setup eval task and context budget
│
├─▶ TRACE: Execute task, capture all events
│
├─▶ EVAL: Score against capability thresholds
│
├─▶ ANNOTATE: Generate explanations for each finding
│
├─▶ ANALYSE: Determine root causes
│
├─▶ IF score < 100% AND iterations < max:
│   │  Generate improvement candidates
│   │  Apply top candidate
│   └─▶ LOOP BACK to INSTRUMENT (new iteration)
│
├─▶ IF score = 100%:
│   └─▶ PASS: Log success, move to next eval
│
└─▶ IF iterations = max AND score < 100%:
    └─▶ DEGRADE_GRACEFULLY: Document gap, suggest manual review
```

### Regression Eval Loop

```
START: Regression Eval
│
├─▶ INSTRUMENT: Setup baseline-preserving eval
│
├─▶ TRACE: Execute same task as capability eval, plus regression checks
│
├─▶ EVAL: Score against regression thresholds (all must be 1.0)
│
├─▶ IF ANY regression score < 1.0:
│   │  ⚠️ STOP IMMEDIATELY
│   │  Identify what capability change caused regression
│   │  Flag for human review
│   └─▶ REGRESSION_DETECTED: Do not proceed
│
└─▶ IF ALL regression scores = 1.0:
    └─▶ PASS: Safe to deploy capability improvements
```

---

## Implementation Structure

```
evals/
├── README.md                    # This file
├── framework/
│   ├── __init__.py
│   ├── instrument.py           # Instrumentation API
│   ├── tracer.py               # Trace capture
│   ├── scorer.py               # Scoring engine
│   ├── annotator.py            # Annotation generator
│   ├── analyzer.py             # Root cause analysis
│   └── types.py                # Type definitions
├── capability/
│   ├── context_window/
│   │   ├── eval.json           # Eval tasks
│   │   └── thresholds.json     # Category thresholds
│   ├── token_efficiency/
│   ├── tool_selection/
│   └── error_recovery/
├── regression/
│   ├── skill_triggering/
│   ├── basic_functionality/
│   ├── agent_routing/
│   └── context_preservation/
├── results/
│   ├── iteration-1/
│   ├── iteration-2/
│   └── ...
└── reports/
    ├── delta-report.md
    └── regression-alert.md
```

---

## Example Eval Task Format

```json
{
  "id": "cap-ctx-001",
  "category": "context_window",
  "type": "capability",
  
  "task": {
    "description": "Find all API route handlers in a large monorepo and list their HTTP methods and paths",
    "context_budget": 50000,
    "max_turns": 5,
    "workspace": "test-data/monorepo/"
  },
  
  "expected": {
    "all_routes_found": true,
    "correct_methods": true,
    "context_used_max": 35000,
    "files_read_max": 15
  },
  
  "thresholds": {
    "context_efficiency": 0.75,
    "token_economy": 0.80,
    "overall_minimum": 0.70
  },
  
  "improvement_triggers": [
    {
      "condition": "files_read > 20",
      "suggestion": "Add depth/path filtering to glob patterns"
    },
    {
      "condition": "context_used > 40000",
      "suggestion": "Use early-exit pattern: find routes first, then read implementation"
    }
  ]
}
```

---

## Success Metrics

### Per Eval Iteration

| Metric | Target | Measurement |
|--------|--------|-------------|
| Pass Rate | 100% | `passed / total` |
| Token Efficiency | Improve | `tokens_saved / baseline` |
| Context Utilization | 80%+ | `relevant_bytes / total_bytes` |
| Iteration Count | Minimize | Count of instrument→analyze loops |

### Per Eval Category (Rolling)

| Category | Target | Alert If |
|----------|--------|----------|
| Capability Evals | ≥95% passing | Drops below 80% |
| Regression Evals | 100% passing | Any failure |

### Trend Analysis

```
Iteration | Context Eff | Token Econ | Tool Opt | Overall
----------|-------------|------------|----------|---------
    1     |    0.62     |   0.71     |   0.68   |   0.67
    2     |    0.71     |   0.75     |   0.74   |   0.73  (+0.06)
    3     |    0.79     |   0.81     |   0.82   |   0.81  (+0.08)
    4     |    0.85     |   0.87     |   0.88   |   0.87  (+0.06)
    5     |    0.91     |   0.89     |   0.92   |   0.91  (+0.04)
```

---

## Anti-Patterns to Detect

| Pattern | Detection | Action |
|---------|-----------|--------|
| **Glob Spam** | >50 files matched, <20% relevant | Suggest path filtering |
| **Read Everything** | Read all matched files before filtering | Teach incremental filtering |
| **Verbose Filler** | Output >2x estimated optimal | Add conciseness guidance |
| **Tool Scatter** | >10 tool calls for simple task | Add tool selection guidance |
| **Skill Hoarding** | Triggered skill, ignored its advice | Improve skill trigger descriptions |
| **Context Tunneling** | Read one big file instead of focused reads | Teach file size awareness |
| **No Recovery** | Error → gave up | Add error handling guidance |

---

## Integration Points

### With OpenCode Core

The framework should integrate via:

1. **MCP for Instrumentation**: `opencode_eval` MCP that OpenCode calls during eval tasks
2. **Config Flags**: `--eval-mode` to enable detailed tracing without affecting production
3. **Result Output**: JSON output compatible with existing tools

### With CI/CD

```yaml
# Example: Evals as gate before release
evals:
  pre-merge:
    - capability_evals: [context_window, token_efficiency]
    regression_evals: [skill_triggering, basic_functionality]
    pass_threshold: 0.90  # Allow some capability evals to fail
    regression_required: 1.0  # Regression MUST pass
    
  pre-release:
    - all_capability_evals
    - all_regression_evals
    pass_threshold: 1.0
    regression_required: 1.0
```

---

## Continuous Improvement

### Weekly Analysis

1. Aggregate all eval results from the week
2. Identify top 3 recurring issues
3. Generate improvement candidates
4. Update rules/skills based on evidence
5. Re-run regression evals to confirm no harm

### Monthly Review

1. Trend analysis across all categories
2. Identify eval categories that are "too easy" (always pass) → increase difficulty
3. Identify eval categories that are "too hard" (always fail) → investigate root cause
4. Archive evals that are no longer discriminative

### Quarterly Deep Dive

1. Full benchmark against previous quarter
2. Publish efficiency metrics
3. Update thresholds based on growth
4. Design new eval categories for emerging capabilities