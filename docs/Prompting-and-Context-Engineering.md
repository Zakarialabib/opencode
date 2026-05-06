# 🧠 Prompting & Context Engineering

Master the art of high-performance agentic development by understanding how to provide context and structure your requests.

---

## 🏛️ Core Philosophy: MVI (Minimal Viable Information)

The most common cause of agent failure is **context bloat**. Loading too much irrelevant information confuses the agent and wastes tokens.

- **Load only what you need**: Before starting a task, identify the 3-5 critical files or rules required.
- **Use ContextScout**: Let the specialized subagent find the relevant standards for you.
- **Use ExternalScout**: Always fetch current documentation for external libraries instead of relying on the model's training data.

---

## 🧭 Plan-First Workflow

All high-level tasks should follow the **Analyze → Plan → Approve → Execute** cycle.

1. **Analyze**: Describe your goal clearly.
2. **Discover**: The agent will search for relevant patterns and documentation.
3. **Plan**: The agent will propose a step-by-step implementation strategy.
4. **Approve**: You review the plan. **Execution only starts after your confirmation.**

---

## 👥 Effective SubAgent Delegation

Don't ask the `lead-orchestrator` to write code. Ask it to **orchestrate**.

- **Bad Prompt**: "Write a login page in React."
- **Good Prompt**: "Orchestrate the creation of a login page. Analyze our existing React patterns first, then delegate the implementation to `opencoder` and the security review to `qa-security`."

### When to Delegate
- **Complexity**: Tasks affecting more than 3 files.
- **Expertise**: Specific logic like Laravel, Tauri, or Security.
- **Verification**: Always delegate reviews to a "fresh" subagent to avoid bias.

---

## 🛠️ Tools for Context Engineering

- **LSP Integration**: Mention specific symbols or functions to trigger deep analysis.
- **MCP Servers**: Use `context7` for documentation and `memory` for cross-session context.
- **Self-Reflection**: Use `/reflect` to ask the agents to audit and improve their own configuration.

---

> [!TIP]
> Use the **Thinking Mode** (`hy3-review-free` model) for the planning phase to ensure the most robust architectural decisions.
