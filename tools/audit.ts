import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const ROOT = process.cwd();
const configPath = path.join(ROOT, "opencode.json");

if (!fs.existsSync(configPath)) {
  console.error(`❌ opencode.json not found in ${ROOT}`);
  process.exit(1);
}

const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));

const issues: string[] = [];

// === PLUGIN CHECKS ===
console.log("=== PLUGIN AUDIT ===");
const registeredPlugins: string[] = [];
config.plugin.forEach((p: string, i: number) => {
  if (typeof p === "string" && !p.startsWith("@")) {
    const clean = p.replace("./", "").replace(".\\/", "");
    const fullPath = path.resolve(ROOT, clean);
    registeredPlugins.push(clean);
    if (!fs.existsSync(fullPath)) {
      issues.push(`MISSING plugin file: ${p} (${fullPath})`);
      console.log(`  [BROKEN] ${p}`);
    } else {
      console.log(`  [OK] ${p}`);
    }
  } else {
    console.log(`  [NPM] ${p}`);
  }
});

// Check unregistered plugin files
const pluginDir = path.join(ROOT, "plugins");
if (fs.existsSync(pluginDir)) {
  const allPluginFiles = fs
    .readdirSync(pluginDir)
    .filter((f) => f.endsWith(".ts") && !f.startsWith("_") && f !== "tests");
  allPluginFiles.forEach((f) => {
    if (!registeredPlugins.some((r) => r.includes(f))) {
      console.log(`  [UNREGISTERED] ${f}`);
      issues.push(`Unregistered plugin: plugins/${f}`);
    }
  });

  // Old test files check
  const oldTests = path.join(pluginDir, "tests");
  if (fs.existsSync(oldTests)) {
    const testFiles = fs.readdirSync(oldTests).filter((f) => f.endsWith(".js"));
    if (testFiles.length > 0) {
      console.log(`\n  [OLD TESTS not in vitest] ${testFiles.length} files in plugins/tests/`);
      testFiles.forEach((f) => {
        console.log(`    - plugins/tests/${f}`);
      });
      issues.push(`${testFiles.length} old test files in plugins/tests/ not wired into vitest`);
    }
  }
}

// === AGENT CHECKS ===
console.log("\n=== AGENT AUDIT ===");
const configuredAgents = new Set(Object.keys(config.agent || {}));
const agentDir = path.join(ROOT, "agents");
if (fs.existsSync(agentDir)) {
  const agentFiles = fs.readdirSync(agentDir).filter((f) => f.endsWith(".md") && f !== "archive");
  const agentNames = agentFiles.map((f) => f.replace(".md", ""));
  agentNames.forEach((name) => {
    if (!configuredAgents.has(name)) {
      console.log(`  [UNCONFIGURED] ${name}.md exists but not in opencode.json`);
      issues.push(`Agent file ${name}.md not configured in opencode.json`);
    } else {
      console.log(`  [OK] ${name}`);
    }
  });
  configuredAgents.forEach((name) => {
    if (!agentNames.includes(name)) {
      console.log(`  [NO DEF] ${name} configured in opencode.json but has no .md file`);
      issues.push(`Agent "${name}" in opencode.json has no definition file in agents/`);
    }
  });
}

// === MCP CHECKS ===
console.log("\n=== MCP AUDIT ===");
const mcpServers = config.mcp;
if (mcpServers) {
  Object.entries(mcpServers).forEach(([name, mcp]: [string, any]) => {
    if (!mcp.enabled) {
      console.log(`  [DISABLED] ${name}`);
      return;
    }
    const cmd = mcp.command[0];
    console.log(`  [OK] ${name} → ${cmd} (timeout: ${mcp.timeout}ms)`);
    if (mcp.command.some((arg: string) => arg.includes("${"))) {
      console.log(
        `    [ENV] uses env vars: ${mcp.command.filter((a: string) => a.includes("${")).join(" ")}`
      );
    }
  });
}

// === LSP CHECKS ===
console.log("\n=== LSP AUDIT ===");
if (config.lsp) {
  Object.entries(config.lsp).forEach(([name, lsp]: [string, any]) => {
    const cmd = lsp.command[0];
    console.log(`  ${name} → ${cmd} (extensions: ${lsp.extensions.join(", ")})`);
    if (lsp.initialization) {
      Object.entries(lsp.initialization).forEach(([k, v]) => {
        if (typeof v === "string" && v.includes("${")) {
          console.log(`    [ENV] ${k}: ${v}`);
        }
      });
    }
  });
}

// === WORKFLOW CHECKS ===
console.log("\n=== WORKFLOW AUDIT ===");
const workflowDir = path.join(ROOT, "workflows");
function scanWorkflows(dir: string, depth = 0) {
  if (!fs.existsSync(dir)) return;
  fs.readdirSync(dir, { withFileTypes: true }).forEach((entry) => {
    if (entry.isDirectory()) {
      scanWorkflows(path.join(dir, entry.name), depth + 1);
    } else if (entry.name.endsWith(".yaml") || entry.name.endsWith(".yml")) {
      const rel = path.relative(workflowDir, path.join(dir, entry.name));
      if (rel.startsWith("auto")) {
        console.log(`  [AUTO-GEN] ${rel}`);
      } else {
        console.log(`  [OK] ${rel}`);
      }
    } else if (entry.name.endsWith(".md")) {
      console.log(`  [DOC] ${path.relative(workflowDir, path.join(dir, entry.name))}`);
    }
  });
}
scanWorkflows(workflowDir);

// === SKILL INDEX vs DISK ===
console.log("\n=== SKILL AUDIT ===");
const skillIndexPath = path.join(ROOT, "skills", "index.json");
if (fs.existsSync(skillIndexPath)) {
  const index = JSON.parse(fs.readFileSync(skillIndexPath, "utf-8"));
  const indexNames = new Set(index.skills.map((s: any) => s.name));
  const skillDir = path.join(ROOT, "skills");
  if (fs.existsSync(skillDir)) {
    const diskDirs = fs
      .readdirSync(skillDir, { withFileTypes: true })
      .filter((d) => d.isDirectory() && !d.name.startsWith("_") && d.name !== "archive")
      .map((d) => d.name);
    const inIndex = diskDirs.filter((d) => indexNames.has(d));
    const notInIndex = diskDirs.filter((d) => !indexNames.has(d));
    const hasSkillMd = diskDirs.filter((d) => fs.existsSync(path.join(skillDir, d, "SKILL.md")));
    const missingSkillMd = diskDirs.filter(
      (d) => !fs.existsSync(path.join(skillDir, d, "SKILL.md"))
    );

    console.log(`  Total on disk: ${diskDirs.length}`);
    console.log(`  In index.json: ${inIndex.length}`);
    console.log(`  Missing from index: ${notInIndex.length}`);
    notInIndex.forEach((d) => {
      console.log(`    [MISSING] ${d}`);
      issues.push(`Skill '${d}' has directory but is not in skills/index.json`);
    });
    if (missingSkillMd.length > 0) {
      console.log(`  Missing SKILL.md:`);
      missingSkillMd.forEach((d) => {
        console.log(`    [NO SKILL.md] ${d}`);
        issues.push(`Skill '${d}' has no SKILL.md`);
      });
    }
  }
}

// === CONFIG VALIDATION ===
console.log("\n=== CONFIG VALIDATION ===");
const validatorPath = path.join(ROOT, "scripts", "config-validator.js"); // Moved to scripts
if (fs.existsSync(validatorPath)) {
  try {
    // Dynamic import for the validator if it's ESM, or require if it's CJS
    // For now, let's just note it's moved
    console.log("  Validator moved to scripts/config-validator.js. Run it via separate task.");
  } catch (e: any) {
    console.log(`  Schema validation: ERROR - ${e.message}`);
  }
}

// === SUMMARY ===
console.log("\n" + "=".repeat(60));
console.log("AUDIT SUMMARY");
console.log("=".repeat(60));
if (issues.length === 0) {
  console.log("  No issues found!");
} else {
  console.log(`  ${issues.length} issues found:`);
  issues.forEach((i, idx) => {
    console.log(`  ${idx + 1}. ${i}`);
  });
}
