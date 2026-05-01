const yaml = require("yaml");
const fs = require("fs").promises;
const path = require("path");

class WorkflowEngine {
  constructor(workflowsDir) {
    this.workflowsDir = workflowsDir;
    this.workflows = new Map();
    this.executions = new Map();
  }

  async loadWorkflows() {
    try {
      const files = await fs.readdir(this.workflowsDir);
      for (const file of files) {
        if (file.endsWith(".yaml") || file.endsWith(".yml")) {
          const workflowPath = path.join(this.workflowsDir, file);
          const workflowContent = await fs.readFile(workflowPath, "utf8");
          const workflow = yaml.parse(workflowContent);
          this.workflows.set(workflow.name, {
            ...workflow,
            path: workflowPath,
          });
        }
      }
      return true;
    } catch (error) {
      console.error("Failed to load workflows:", error);
      return false;
    }
  }

  getWorkflow(name) {
    return this.workflows.get(name) || null;
  }

  listWorkflows() {
    return Array.from(this.workflows.keys());
  }

  async executeWorkflow(workflowName, context = {}) {
    const workflow = this.getWorkflow(workflowName);
    if (!workflow) {
      throw new Error(`Workflow '${workflowName}' not found`);
    }

    const executionId = `${workflowName}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const execution = {
      id: executionId,
      workflow: workflow.name,
      status: "running",
      startTime: new Date(),
      context: { ...(workflow.context || {}), ...context },
      phases: {},
      currentPhase: null,
      completedPhases: [],
      failedPhases: [],
      artifacts: [],
    };

    this.executions.set(executionId, execution);

    try {
      // Execute each phase in order
      for (const phase of workflow.phases) {
        execution.currentPhase = phase.name;
        execution.phases[phase.name] = {
          status: "running",
          startTime: new Date(),
          tasks: {},
        };

        console.log(`Starting phase: ${phase.name}`);

        // Execute tasks in the phase
        for (const task of phase.tasks) {
          try {
            console.log(`Executing task: ${task}`);
            const result = await this.executeTask(task, phase.agents, execution.context);
            execution.phases[phase.name].tasks[task] = {
              status: "completed",
              result: result,
              endTime: new Date(),
            };
          } catch (taskError) {
            console.error(`Task ${task} failed:`, taskError);
            execution.phases[phase.name].tasks[task] = {
              status: "failed",
              error: taskError.message,
              endTime: new Date(),
            };

            // Mark phase as failed
            execution.phases[phase.name].status = "failed";
            execution.phases[phase.name].endTime = new Date();
            execution.failedPhases.push(phase.name);
            execution.status = "failed";
            execution.endTime = new Date();

            throw new Error(
              `Workflow failed at phase ${phase.name}, task ${task}: ${taskError.message}`
            );
          }
        }

        // Mark phase as completed
        execution.phases[phase.name].status = "completed";
        execution.phases[phase.name].endTime = new Date();
        execution.completedPhases.push(phase.name);

        // Collect artifacts if specified
        if (phase.artifacts) {
          for (const artifact of phase.artifacts) {
            execution.artifacts.push({
              phase: phase.name,
              artifact: artifact,
              timestamp: new Date(),
            });
          }
        }

        console.log(`Completed phase: ${phase.name}`);
      }

      execution.status = "completed";
      execution.endTime = new Date();
      console.log(`Workflow '${workflowName}' completed successfully`);
    } catch (error) {
      execution.status = "failed";
      execution.endTime = new Date();
      console.error(`Workflow '${workflowName}' failed:`, error);
      throw error;
    }

    return execution;
  }

  async executeTask(taskName, agents, context) {
    // In a real implementation, this would delegate to the appropriate agent
    // For now, we'll simulate task execution
    console.log(`Executing task '${taskName}' with agents: ${agents.join(", ")}`);

    // Simulate some work
    await new Promise((resolve) => setTimeout(resolve, 1000));

    return {
      task: taskName,
      agents: agents,
      context: context,
      timestamp: new Date(),
      result: `Task ${taskName} completed successfully`,
    };
  }

  getExecution(executionId) {
    return this.executions.get(executionId) || null;
  }

  listExecutions() {
    return Array.from(this.executions.keys());
  }

  cancelExecution(executionId) {
    const execution = this.getExecution(executionId);
    if (!execution) return false;

    if (execution.status === "running") {
      execution.status = "cancelled";
      execution.endTime = new Date();
      return true;
    }
    return false;
  }
}

module.exports = WorkflowEngine;
