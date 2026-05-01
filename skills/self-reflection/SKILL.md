---
name: "self-reflection"
description: "Enable OpenCode to analyze its own configuration effectiveness and propose stratigraphic improvements. Invoke when user types /reflect or /upgrade-config."
---

# Self-Reflection Protocol

## Purpose
Enable OpenCode to analyze its own configuration effectiveness and propose stratigraphic improvements.

## Trigger
When user types: `/reflect` or `/upgrade-config`

## Workflow

### Phase 1: Introspection (The Scribe)
1. Query knowledge-graph MCP for recent session patterns
2. Read current `opencode.json`
3. Analyze tool usage frequency per agent
4. Identify bottlenecks (timeout issues, permission denials, model failures)

### Phase 2: Evaluation (The Architect)
1. Compare current config against best practices:
   - Are timeouts appropriate for LM Studio local models?
   - Are agents properly permission-scoped?
   - Is the MCP toolset optimized for Laravel/Rust workflows?
   - Are fallback models configured?

2. Score current configuration:
   - Efficiency: Token usage vs. task completion
   - Reliability: Error rates per MCP server
   - Security: Permission scope appropriateness

### Phase 3: Proposal (The Maestro)
Generate `opencode.json.improved` with:
- Adjusted timeouts based on actual LM Studio performance
- Optimized model routing (nano for scribe, qwen for maestro, etc.)
- Recommended MCP additions/removals based on usage
- Permission tightening suggestions

### Phase 4: Review Gate
Present diff to user. Do NOT apply without explicit `/approve-upgrade` command.

## Output Format
```json
{
  "current_score": 0.72,
  "proposed_score": 0.89,
  "changes": [
    {"type": "timeout", "target": "lmstudio.models.nemotron", "from": 600000, "to": 300000, "reason": "Average response 45s, buffer 5x"},
    {"type": "mcp", "action": "disable", "target": "chrome-devtools", "reason": "Zero usage in 20 sessions"},
    {"type": "agent", "target": "research", "change": "add_fallback_model", "value": "qwen2.5-0.5b-instruct"}
  ],
  "risks": ["Reducing timeout may cause failures on complex Laravel migrations"]
}
```