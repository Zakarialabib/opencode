import { type Plugin, tool } from "@opencode-ai/plugin";
import { existsSync, readFileSync } from "node:fs";
import YAML from "yaml";

interface GateValidation {
  gateId: string;
  passed: boolean;
  missingApprovals: string[];
  missingEvidence: string[];
}

function validateGate(gate: any, approvals: string[], evidence: string[]): GateValidation {
  const requiredApprovals = Array.isArray(gate?.requires) ? gate.requires : [];
  const requiredEvidence = Array.isArray(gate?.evidence) ? gate.evidence : [];

  const missingApprovals = requiredApprovals.filter((name: string) => !approvals.includes(name));
  const missingEvidence = requiredEvidence.filter((name: string) => !evidence.includes(name));

  return {
    gateId: gate?.id || "unnamed-gate",
    passed: missingApprovals.length === 0 && missingEvidence.length === 0,
    missingApprovals,
    missingEvidence,
  };
}

const GateValidatorPlugin: Plugin = async () => {
  return {
    tool: {
      validate_gate: tool({
        description: "Validate a workflow phase gate against RACI approvals and evidence",
        args: {
          workflowPath: tool.schema.string().describe("Path to a workflow YAML file"),
          phase: tool.schema.string().describe("Phase name containing the gate"),
          approvals: tool.schema
            .array(tool.schema.string())
            .default([])
            .describe("Agent names that have approved"),
          evidence: tool.schema
            .array(tool.schema.string())
            .default([])
            .describe("Evidence artifact names available for the gate"),
        },
        async execute({ workflowPath, phase, approvals, evidence }) {
          if (!existsSync(workflowPath)) return `Workflow not found: ${workflowPath}`;

          const workflow = YAML.parse(readFileSync(workflowPath, "utf8"));
          const targetPhase = workflow.phases?.find((item: any) => item.name === phase);
          if (!targetPhase) return `Phase not found: ${phase}`;
          if (!targetPhase.gate) return `Phase '${phase}' has no gate.`;

          const validation = validateGate(targetPhase.gate, approvals, evidence);
          if (validation.passed) {
            return `Gate '${validation.gateId}' passed.`;
          }

          const lines = [`Gate '${validation.gateId}' blocked.`];
          if (validation.missingApprovals.length > 0) {
            lines.push(`Missing approvals: ${validation.missingApprovals.join(", ")}`);
          }
          if (validation.missingEvidence.length > 0) {
            lines.push(`Missing evidence: ${validation.missingEvidence.join(", ")}`);
          }
          return lines.join("\n");
        },
      }),
    },
  };
};

export default GateValidatorPlugin;
