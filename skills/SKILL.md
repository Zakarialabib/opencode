---
name: continuity-management
description: Continuity management — preserves context, maintains thermal maps, and serializes states across sessions
license: MIT
compatibility: opencode
metadata:
  audience: all-agents
  workflow: continuity
---

# Continuity Management Skill

## Description

This skill converts the concept of "Continuity" from a static file into an active cognitive process. It dictates how the Scribe and Documentarian agents preserve context, maintain thermal maps of code, and serialize states for the Continuum Engine.

## Triggers

- **Session End:** When the current block of work is complete or the 2-week memory cycle approaches its limit.
- **Phase Transition:** When moving from one architectural phase (e.g., Phase 5) to the next (e.g., Phase 6).
- **Manual Invocation:** When the user requests a "Continuity Check" or "Strata Export".

## Workflow

1. **Episodic Compilation**: Use the `git` MCP to pull the diff of all uncommitted and recently committed changes. Summarize _why_ these changes were made.
2. **Semantic Knowledge Extraction**: Extract any new protocols, libraries, or architectural decisions (e.g., "Switched to `produce` for state mutation").
3. **Graph Injection**: Send the extracted entities and relations to the Knowledge Graph using `@itseasy21/mcp-knowledge-graph`.
4. **State Serialization**: Execute the local `tools/export-strata.js` tool to dump the current mental context, open files, and episodic summary into `./continuum/[date]-strata.json`.

## Best Practices

- **Do not write to a root CONTINUITY.md.** The state is living. Store it in the Knowledge Graph and JSON strata files.
- Always include the **Thermal Map**: List the top 3 most modified files in the current phase so the system knows what is "hot" upon resurrection.
