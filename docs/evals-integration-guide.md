# OpenCode Evals System & Brain Integration Guide

This guide details how the OpenCode **Evaluation (Evals) Plugin** works under the hood and provides a strategic integration map to bring continuous performance tracing, regression safety, and self-tuning diagnostics directly into the **Brain v2 Cognitive Layer**.

---

## 1. How the OpenCode Evals System Works

The OpenCode Evals system (implemented in `plugins/eval-plugin.ts`) enforces the **Instrument ➔ Trace ➔ Eval ➔ Annotate ➔ Analyse** engineering loop. It evaluates LLM and agentic execution efficiency, ensuring capability improvements reach 100% success while acting as a regression gate for existing features.

### Core Architecture & State Machine

```
   ┌────────────────────────────────────────────────────────┐
   │                       eval_start                       │
   │   - Initializes active TraceSession                    │
   │   - Defines Category & Performance Pass Thresholds     │
   └───────────────────────────┬────────────────────────────┘
                               │
                               ▼
   ┌────────────────────────────────────────────────────────┐
   │               Instrumented Event Logging               │
   │   - Tool executions logged via client hooks            │
   │   - File reads tracked (relevance, size, tokens)       │
   │   - Error events & recovery actions captured           │
   └───────────────────────────┬────────────────────────────┘
                               │
                               ▼
   ┌────────────────────────────────────────────────────────┐
   │                        eval_end                        │
   │   - Calculates Metrics & Scores (Average Weighted)      │
   │   - Synthesizes Inefficiency & Recovery Annotations    │
   │   - Emits Actionable Fix Suggestions                   │
   └────────────────────────────────────────────────────────┘
```

---

## 2. Standard Scoring Metrics

The system calculates scores across five distinct axes to produce an overall efficiency score:

| Score Metric | Formula / Logic | Brain Translation |
| :--- | :--- | :--- |
| **Context Efficiency (25%)** | $\frac{\text{Relevant File Reads}}{\text{Total File Reads}}$ | Did RRF retrieve chunks that the model actually read and utilized in the session? |
| **Token Economy (25%)** | $1.0 - \min(0.3, \text{Corrections} \cdot 0.05)$ | Measures token usage overhead. High redundancy decreases the score. |
| **Tool Optimization (20%)** | $\frac{\text{Successful Tool Calls}}{\text{Total Tool Calls}} \cdot (1 - \text{Redundancy Penalty})$ | Penalty for repeated search requests or failing database operations. |
| **Error Resilience (15%)** | $\frac{\text{Recovered Errors}}{\text{Total Errors}}$ | How cleanly did local CPU ONNX errors recover and degrade to remote LM Studio embeddings? |
| **Skill Alignment (15%)** | $\frac{\text{Used Triggers}}{\text{Total Triggers}}$ | Were the injected context blocks aligned with developer intent, or was context wasted? |

### Scoring & Annotations Synthesis
- **Overall Score**: Weighted sum of the 5 metrics. An overall score $\ge 0.9$ qualifies as `EXCELLENT`.
- **Annotations**: Actionable diagnostic objects containing an **Observation**, **Impact** (e.g. token waste estimate), and **Actionable Suggestion**.

---

## 3. Integrating Evals into the Brain Plugin

To supercharge the **Brain Plugin** with Evals, we can hook directly into the trace logging lifecycle:

```
                  OpenCode Tracing Lifecycle
                              │
            ┌─────────────────┴─────────────────┐
            ▼                                   ▼
   Database Operations                    Search Relevance
 ┌──────────────────────┐              ┌──────────────────────┐
 │ Log `tool_call` on   │              │ Log `file_read` on   │
 │ FTS5, Vector, and    │              │ each retrieved chunk.│
 │ Blame Tuning.        │              │ Mark `relevant: true`│
 └──────────────────────┘              │ if model references  │
                                       │ details in output.   │
                                       └──────────────────────┘
```

### Strategic Integration Roadmap

1. **Search Relevance Tracing (`file_read`)**:
   - Every code chunk returned by `searchProjectContext` is registered as a virtual `file_read` in the active eval session.
   - When a session concludes, we check if the model's output references paths/variables matching the chunk.
   - Unreferenced chunks reduce **Context Efficiency** scores, signaling RRF density should be adjusted.

2. **Degradation & Recovery Tracing (`error`)**:
   - When loading local CPU embeddings fails, log an `error` event:
     ```typescript
     await client.eval.log({
       event_type: "error",
       data: { type: "ONNX_OOM", message: "CPU memory limit, degrading to LM Studio", recovered: true }
     });
     ```
   - This records the exact failover efficiency, grading the **Error Resilience** of the plugin.

3. **Weight Calibration Logging (`self_correction`)**:
   - When the developer gives negative ratings and triggers a blame-attribution weight adjust, log a `self_correction` event.
   - This registers search tuning actions inside the trace and helps benchmark self-learning speed.

---

## 4. Setting Up an Automated Brain Eval Task

Here is a concrete schema definition for a Brain-specific evaluation task file (`evals/regression/brain-retrieval.json`):

```json
{
  "id": "brain-retrieval-regression",
  "category": "context_window",
  "type": "regression",
  "description": "Verify hybrid RRF retrieves target method when queried with mixed lexical-semantic prompts under severe CPU bounds",
  "context_budget": 30000,
  "thresholds": {
    "context_efficiency": 0.80,
    "tool_optimization": 0.90,
    "error_resilience": 1.00
  }
}
```

### Running the Evaluation Task

Execute the task programmatically using the OpenCode CLI or within test scripts:

```typescript
import { tool } from "@opencode-ai/plugin";

// Execute full trace iteration
const evalResult = await eval_run.execute({
  task: {
    id: "brain-retrieval-regression",
    category: "context_window",
    type: "regression",
    description: "Verify hybrid search efficiency",
    context_budget: 30000,
    thresholds: { context_efficiency: 0.80, tool_optimization: 0.90, error_resilience: 1.00 }
  },
  max_iterations: 3
});

console.log(`Eval status: ${evalResult.status}. Overall score: ${evalResult.results[0].results.scores.overall}`);
```

Integrating this loop keeps the Brain Plugin completely regression-safe, robust against CPU/ONNX degradations, and optimized for maximum retrieval precision!
