import { type Plugin, tool } from "@opencode-ai/plugin";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import YAML from "yaml";

interface WorkflowSummary {
  id: string;
  name: string;
  description: string;
  path: string;
  phases: string[];
}

function loadWorkflows(directory: string): WorkflowSummary[] {
  const workflowsDir = join(directory, "workflows");
  if (!existsSync(workflowsDir)) return [];

  return readdirSync(workflowsDir)
    .filter((file) => file.endsWith(".yaml") || file.endsWith(".yml"))
    .map((file) => {
      const workflowPath = join(workflowsDir, file);
      const workflow = YAML.parse(readFileSync(workflowPath, "utf8"));
      return {
        id: workflow.id || file.replace(/\.ya?ml$/, ""),
        name: workflow.name || workflow.id || file,
        description: workflow.description || "",
        path: workflowPath,
        phases: Array.isArray(workflow.phases)
          ? workflow.phases.map((phase: any) => phase.name).filter(Boolean)
          : [],
      };
    });
}

function classifyTask(task: string): string {
  const text = task.toLowerCase();
  if (/(incident|outage|alert|p0|p1|production down|hotfix)/.test(text)) {
    return "Incident Response";
  }
  if (/(release|deploy|staging|production|changelog|smoke)/.test(text)) {
    return "Lifecycle Release";
  }
  if (/(implement|build|fix|test|review|e2e|coverage|frontend|backend)/.test(text)) {
    return "Lifecycle Build";
  }
  if (/(discover|plan|prd|scope|architecture|adr|feasibility|sprint)/.test(text)) {
    return "Lifecycle Discovery";
  }
  return "Lifecycle Discovery";
}

const WorkflowRouterPlugin: Plugin = async ({ directory }) => {
  return {
    tool: {
      route_workflow: tool({
        description: "Recommend the agency lifecycle workflow for a task",
        args: {
          task: tool.schema.string().describe("Task, project request, incident, or release intent"),
          verbose: tool.schema.boolean().default(false).describe("Include phases and workflow path"),
        },
        async execute({ task, verbose }) {
          const workflows = loadWorkflows(directory);
          const recommendation = classifyTask(task);
          const workflow = workflows.find((item) => item.name === recommendation);

          if (!workflow) {
            return `Recommended workflow: ${recommendation}\nWorkflow file was not found in workflows/.`;
          }

          let result = `Recommended workflow: ${workflow.name}\n`;
          result += `Description: ${workflow.description}\n`;
          if (verbose) {
            result += `Path: ${workflow.path}\n`;
            result += `Phases: ${workflow.phases.join(" -> ") || "none declared"}\n`;
          }
          return result;
        },
      }),

      list_lifecycle_workflows: tool({
        description: "List available agency lifecycle workflows",
        args: {},
        async execute() {
          const workflows = loadWorkflows(directory).filter((workflow) =>
            /Lifecycle|Incident Response|Sprint Ceremony/.test(workflow.name)
          );
          if (workflows.length === 0) return "No lifecycle workflows found.";

          return workflows
            .map(
              (workflow) =>
                `- ${workflow.name}: ${workflow.description || "No description"} (${workflow.phases.length} phases)`
            )
            .join("\n");
        },
      }),
    },
  };
};

export default WorkflowRouterPlugin;
