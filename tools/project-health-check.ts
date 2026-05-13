import * as fs from "fs";
import * as path from "path";
// We use require or dynamic import for local JS files if they haven't been migrated yet
const ConfigValidator = require("../scripts/config-validator");
const { SkillRegistry } = require("../skills/registry");
const WorkflowEngine = require("../scripts/workflow-engine");

const root = process.cwd();
const configPath = path.join(root, "opencode.json");
const schemaPath = path.join(root, "config-schema.json");
const packagePath = path.join(root, "package.json");
const skillsDir = path.join(root, "skills");
const agentsDir = path.join(root, "agents");
const workflowsDir = path.join(root, "workflows");

function exists(p: string): boolean {
  try {
    return fs.existsSync(p);
  } catch {
    return false;
  }
}

function isLocalPlugin(pluginPath: string): boolean {
  if (path.isAbsolute(pluginPath)) {
    return true;
  }

  return (
    pluginPath.startsWith("./") ||
    pluginPath.startsWith("../") ||
    pluginPath.startsWith(".\\") ||
    pluginPath.startsWith("..\\")
  );
}

async function run() {
  const failures: string[] = [];
  const warnings: string[] = [];

  if (!exists(configPath)) {
    failures.push(`Missing config file: ${configPath}`);
  }

  let config: any;
  try {
    config = JSON.parse(fs.readFileSync(configPath, "utf8"));
  } catch (error: any) {
    failures.push(`Cannot parse opencode.json: ${error.message}`);
  }

  if (config) {
    if (exists(path.join(root, "scripts", "config-validator.js"))) {
      const validator = new ConfigValidator(schemaPath);
      const result = validator.validateConfig(config);
      if (!result.valid) {
        failures.push("opencode.json failed schema validation:");
        result.errors.forEach((error: any) => {
          failures.push(`  - [${error.path || "root"}] ${error.message}`);
        });
      } else {
        console.log("✅ opencode.json matches config-schema.json");
      }
    }

    if (Array.isArray(config.plugin)) {
      for (const plugin of config.plugin) {
        if (typeof plugin !== "string") {
          warnings.push(`Plugin entry is not a string: ${JSON.stringify(plugin)}`);
          continue;
        }

        if (isLocalPlugin(plugin)) {
          const resolved = path.isAbsolute(plugin) ? plugin : path.join(root, plugin);
          if (!exists(resolved)) {
            warnings.push(`Plugin path not found: ${plugin} => ${resolved}`);
          }
        }
      }
    }

    if (!exists(skillsDir)) {
      failures.push(`Missing skills directory: ${skillsDir}`);
    } else {
      const registry = new SkillRegistry(skillsDir);
      const loaded = await registry.loadIndex();
      if (!loaded) {
        failures.push("Failed to load skills/index.json or SKILL.md files.");
      } else {
        const indexSkills = registry.listSkills();
        console.log(`✅ Loaded ${indexSkills.length} skills from skills/index.json`);
      }
    }

    if (!exists(agentsDir)) {
      failures.push(`Missing agents directory: ${agentsDir}`);
    } else if (config && config.agent && typeof config.agent === "object") {
      const configAgents = Object.keys(config.agent);
      const agentFiles = fs
        .readdirSync(agentsDir)
        .filter((file) => file.endsWith(".md"))
        .map((file) => path.basename(file, ".md"));

      const missingDocs = configAgents.filter((agent) => !agentFiles.includes(agent));
      if (missingDocs.length) {
        warnings.push(`Agent definitions missing docs: ${missingDocs.join(", ")}`);
      }

      const orphanDocs = agentFiles.filter((agentFile) => !configAgents.includes(agentFile));
      if (orphanDocs.length) {
        warnings.push(`Agent docs not referenced by config.agent: ${orphanDocs.join(", ")}`);
      }
    }

    if (!exists(workflowsDir)) {
      failures.push(`Missing workflows directory: ${workflowsDir}`);
    } else {
      try {
        if (exists(path.join(root, "scripts", "workflow-engine.js"))) {
          const workflowEngine = new WorkflowEngine(workflowsDir);
          await workflowEngine.loadWorkflows();
          const workflowNames = workflowEngine.listWorkflows();
          console.log(`✅ Loaded ${workflowNames.length} workflows`);
        }
      } catch (error: any) {
        failures.push(`Workflow load failed: ${error.message}`);
      }
    }
  }

  if (exists(packagePath)) {
    const pkg = JSON.parse(fs.readFileSync(packagePath, "utf8"));
    const requiredScripts = ["start", "lint", "test"];
    for (const scriptName of requiredScripts) {
      if (!pkg.scripts || !pkg.scripts[scriptName]) {
        warnings.push(`package.json missing script: ${scriptName}`);
      }
    }
  }

  if (warnings.length) {
    console.log("\n⚠️  Warnings:");
    warnings.forEach((warning) => console.log(`  - ${warning}`));
  }

  if (failures.length) {
    console.log("\n❌ Health check failed:");
    failures.forEach((failure) => console.log(`  - ${failure}`));
    process.exit(1);
  }

  console.log("\n✅ Project health check passed.");
  process.exit(0);
}

run().catch((error) => {
  console.error("Unexpected error during health check:", error);
  process.exit(1);
});
