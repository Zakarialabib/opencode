import { defaultProvider } from "../provider/lmstudio";
import type { DevIntent } from "../tree/engine";

export interface AgentBriefing {
  parentSessionId: string;
  recentFiles: string[];
  activeDecisions: string[];
  failedApproaches: string[];
  currentPlan: string;
  originalQuery: string;
}

export interface DelegationResult {
  delegateId: string;
  summaryResponse: string;
  success: boolean;
}

/**
 * Prompt-based delegation simulation (not real subagent spawning).
 * Calls the same LM Studio provider with a structured briefing prompt.
 *
 * ROADMAP: Phase 2 should replace this with proper task-tool routing:
 *   - Serialize PlanState into tool.task({ agent, briefing }) params
 *   - Spawn real subagents via OpenCode's agent system
 *   - Propagate session memory (PlanState) between parent and child
 *   - Collect results from real tool execution, not simulated chat response
 */
export async function delegateToAgent(
  agentName: "debugger" | "architect" | "tester",
  briefing: AgentBriefing
): Promise<DelegationResult> {
  const delegateId = `agent_${agentName}_${Date.now().toString().slice(-6)}`;
  console.log(
    `[Orchestrator/Delegation] Initializing handoff to specialized child agent: ${agentName} (${delegateId})`
  );

  // Serialize the parent's context and operational boundaries into a structured system briefing
  const briefingSystemPrompt = `
[COGNITIVE DELEGATION: Specialized Child Agent '${agentName.toUpperCase()}']
You have been programmatically spawned by the parent coordinator to resolve a high-complexity sub-task.
Operational Context Briefing:
- Parent Session Reference: ${briefing.parentSessionId}
- Original Target Query: ${briefing.originalQuery}
- Recent Files Touched: [${briefing.recentFiles.join(", ") || "none"}]
- Active Decisions History: [${briefing.activeDecisions.join(", ") || "none"}]
- Failed Approaches to Avoid: [${briefing.failedApproaches.join(", ") || "none"}]
- Active Plan of Action: ${briefing.currentPlan}

Your Core Directive:
Analyze the delegated context. Formulate a solution and return a highly detailed aggregated report summary of your actions and results to the parent coordinator.
`;

  const messages = [
    {
      role: "system",
      content: briefingSystemPrompt,
    },
    {
      role: "user",
      content: `Resolve the following task based on your briefing context: ${briefing.originalQuery}`,
    },
  ];

  try {
    // Run the specialized child agent execution frame
    const response = await defaultProvider.chat("", messages, {
      temperature: 0.2, // lower temperature for high constraint reasoning compliance
      maxTokens: 1024,
    });

    console.log(
      `[Orchestrator/Delegation] Handoff to ${agentName} completed successfully. Aggregating report back to parent.`
    );
    return {
      delegateId,
      summaryResponse: response,
      success: true,
    };
  } catch (error: any) {
    console.error(`[Orchestrator/Delegation] Child agent handoff failed: ${error.message}`);
    return {
      delegateId,
      summaryResponse: `[Delegation Error]: Specialized child agent failed to return a response: ${error.message}`,
      success: false,
    };
  }
}

/**
 * Primary Orchestrator Loop Mode Decision Router.
 * Decides whether to proceed with standard tools or programmatically trigger delegation.
 */
export function shouldDelegate(
  intent: DevIntent | string,
  complexityMetrics: {
    recentFilesCount: number;
    diagnosticsErrorsCount: number;
    failedHopsCount: number;
  }
): boolean {
  // ROUTER mode rule: Delegate if it is a debug intent under high complexity (errors/failures/files)
  if (intent === "debug") {
    if (
      complexityMetrics.diagnosticsErrorsCount >= 3 ||
      complexityMetrics.recentFilesCount >= 3 ||
      complexityMetrics.failedHopsCount >= 1
    ) {
      return true;
    }
  }
  return false;
}
