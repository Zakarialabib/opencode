---
name: prompt-engineering
description: Write, rewrite, evaluate, and self-improve agent prompts dynamically. Each agent can call this skill to optimize its own context, role, constraints, and output quality over time.
trigger: Agent calls `/prompt-improve` or the Context-Manager plugin invokes it during self-improvement cycles
allowed_tools: Memory(create_entities, search_nodes, add_observations), Sequential-Thinking(sequentialthinking), Write
---

# Prompt Engineering Skill — Self-Improving Agent Prompts

## Purpose

This skill enables any agent to **dynamically rewrite its own system prompt** based on execution quality feedback. It turns prompt engineering from a one-time setup task into a continuous, automated optimization loop.

## Core Capabilities

### 1. Prompt Generation (`generate`)
Generate an initial prompt template for a given agent role and objective.

```
Usage: prompt-engineering generate <agent-role> [objective]

Example:
  prompt-engineering generate "code-reviewer" "Review Python code for security vulnerabilities and suggest improvements"
```

Generates a structured prompt with:
- **Identity** — Clear agent persona (e.g., "You are an expert Python security code reviewer...")
- **Objective** — What "done well" looks like (measurable, specific)
- **Context Window** — What background info to include (files, docs, prior results)
- **Examples** — 2–3 few-shot examples of good outputs
- **Constraints** — Hard limits (format, scope, safety)
- **Output Spec** — Expected deliverable structure (e.g., JSON, markdown, diff)

### 2. Prompt Rewriting (`rewrite`)
Rewrite an existing prompt based on quality feedback or failure analysis.

```
Usage: prompt-engineering rewrite <current-prompt> [--reason "<why it underperformed>"] [--strategy "more-examples|tighter-constraints|different-role|split-task"]

Example:
  prompt-engineering rewrite "review this code" --reason "agent missed 3 SQLi vulnerabilities" --strategy "tighter-constraints"
```

**Rewrite Strategies**:
| Strategy | Action |
|----------|--------|
| `more-examples` | Add targeted few-shot examples that demonstrate the missed pattern |
| `tighter-constraints` | Strengthen guardrails (e.g., "ALWAYS check for: X, Y, Z") |
| `different-role` | Reframe the agent's identity (e.g., "You are a penetration tester" → "You are a security auditor") |
| `split-task` | Break one complex prompt into multiple specialized sub-prompts |
| **expand-context** | Add more background (docs, prior results, related code) |
| `simplify` | Remove noise, make instruction more direct and unambiguous |

### 3. Self-Evaluation (`evaluate`)
After a task completes, evaluate the quality of the prompt that produced it.

```
Usage: prompt-engineering evaluate <output> [--expected <expected-output>] [--criteria relevance,completeness,accuracy] [--confidence 0.0-1.0]
```

**Evaluation Criteria** (scored 0.0–1.0 each):
- **Relevance** — Did the agent stay on topic?
- **Completeness** — Did it address all aspects of the task?
- **Accuracy** — Are the outputs factually and technically correct?
- **Format Compliance** — Did it follow the specified output format?
- **Actionability** — Can the output be directly used or does it need rework?
- **Efficiency** — Did it waste tokens on unnecessary content?

Produces a composite **quality score** and identifies **specific weaknesses**.

### 4. Prompt Versioning & History (`history`)
Track prompt versions alongside quality metrics to build a training signal.

```
Usage: prompt-engineering history <agent-role> [--limit 10]
```

Tracks:
- Prompt text (full)
- Quality score at time of generation
- Feedback/reason for changes
- Strategy used for each rewrite
- Timestamp and agent that generated it

### 5. Meta-Audit (`audit`)
A privileged operation where one agent audits another agent's prompt and suggests improvements.

```
Usage: prompt-engineering audit <agent-name> [--target-task "description of recent task"]
```

This runs a **mini autoresearch loop**:
1. Fetches the target agent's current prompt from memory
2. Finds recent outputs produced with that prompt
3. Evaluates outputs against quality criteria
4. Identifies patterns of failure
5. Proposes 2–3 alternative prompt rewrites
6. Recommends the best alternative with expected improvement

## Integration with Autoresearch Loop

### Phase 1: Setup (before research begins)
```
1. Agent loads current prompt from memory MCP
2. Agent runs /prompt-improve evaluate on last 3 task outputs
3. If average score < 0.75 → /prompt-improve rewrite with [strategy]
4. New prompt deployed for this session
```

### Phase 2: During Research
```
Every N iterations:
  - Evaluate current output quality
  - If quality degrading → /prompt-improve rewrite (real-time)
  - If quality stable → continue with current prompt
```

### Phase 3: After Research
```
1. Final evaluation of all outputs produced
2. Store quality metrics + prompt version in memory MCP
3. Identify top-performing prompt patterns
4. Update prompt version history
```

## Memory MCP Integration

All prompt versions and quality scores are stored in memory MCP:

```json
{
  "entityType": "prompt-version",
  "name": "agent:qa-guardian:prompt:v3",
  "observations": [
    {
      "text": "Prompt template for QA agent v3 — improved SQLi detection",
      "confidence": 0.88,
      "quality_score": 0.82,
      "strategy": "tighter-constraints",
      "compared_to": "v2",
      "improvement": "+0.15",
      "date": "2026-05-08"
    }
  ]
}
```

## Self-Improving Context Engine

The core improvement loop runs in the Context-Manager plugin:

```typescript
// On task completion (hook in context-manager.ts)
async onTaskComplete(result) {
  const quality = await this.evaluate(result.output, result.expected);
  await this.storeObservation(result.agent, result.prompt, quality);

  if (quality.score < this.config.qualityThreshold) {
    const rewrite = await this.promptEngineering.rewrite(
      result.prompt,
      { reason: quality.weakness, strategy: autoSelectStrategy(quality) }
    );
    this.updateAgentPrompt(result.agent, rewrite);
    console.log(`🎯 Prompt auto-rewritten: ${quality.score} → ${rewrite.expectedImprovement}`);
  }
}

function autoSelectStrategy(quality) {
  // Analyze which dimension failed most → pick best strategy
  const weakest = Object.entries(quality.dimensions)
    .sort((a, b) => a[1] - b[1])[0][0];

  const strategyMap = {
    "relevance": "simplify",
    "completeness": "expand-context",
    "accuracy": "more-examples",
    "formatCompliance": "tighter-constraints",
    "actionability": "split-task",
    "efficiency": "simplify"
  };

  return strategyMap[weakest] || "more-examples";
}
```

## Example Workflow

**Before** (Static prompt):
```
User asks: "How do I fix memory leak in my Node.js app?"
Agent prompt: "You are a Node.js developer. Help with debugging."
Result: Generic debugging tips, misses memory-specific analysis.
```

**After** (Self-improved prompt):
```
User asks: "How do I fix memory leak in my Node.js app?"
Agent prompt: "You are an expert Node.js performance engineer specializing in memory diagnostics.
  - ALWAYS check: heap snapshots, V8 flags (--trace-gc, --inspect), event loop lag
  - Use heapdump, memwatch-next, node-inspect
  - Analyze: retained objects, circular refs, event listener leaks
  - Format: provide exact code fixes with line numbers"
Result: Targeted, actionable fix with specific tools and code patterns.
```

## Best Practices

1. **Start with good baselines** — Prompt-engineering improves incrementally; a terrible base prompt won't self-fix
2. **Quality thresholds** — Only rewrite when score < 0.75 to avoid unnecessary churn
3. **Human approval** — For critical agents (security, production), require human sign-off before prompt changes
4. **Version everything** — Never overwrite; append version history
5. **A/B test** — Run old and new prompts on same task type, measure quality delta
6. **Kill switch** — If quality drops below 0.5 after rewrite, revert immediately

## Metrics to Track

| Metric | Description | Target |
|--------|-------------|--------|
| `prompt_quality_score` | Composite of all evaluation criteria | > 0.80 |
| `rewrite_improvement_delta` | Score change after rewrite | +0.15 or more |
| `self_correct_rate` | % of rewrites that improve quality | > 70% |
| `iterations_to_convergence` | Rewrites before quality stabilizes | < 5 |
| `token_efficiency` | Output quality per token spent | Improving trend |
| `failure_pattern_catch_rate` | % of known failure patterns caught by evaluator | > 85% |