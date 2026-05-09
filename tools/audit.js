const fs = require("fs");
const path = require("path");

const ROOT = "C:\\opencode";
const config = JSON.parse(fs.readFileSync(path.join(ROOT, "opencode.json"), "utf-8"));

let issues = [];

// === PLUGIN CHECKS ===
console.log("=== PLUGIN AUDIT ===");
const registeredPlugins = [];
config.plugin.forEach((p, i) => {
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
    testFiles.forEach((f) => console.log(`    - plugins/tests/${f}`));
    issues.push(`${testFiles.length} old test files in plugins/tests/ not wired into vitest`);
  }
}

// === AGENT CHECKS ===
console.log("\n=== AGENT AUDIT ===");
const configuredAgents = new Set(Object.keys(config.agent));
const agentDir = path.join(ROOT, "agents");
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

// === MCP CHECKS ===
console.log("\n=== MCP AUDIT ===");
const mcpServers = config.mcp;
if (mcpServers) {
  Object.entries(mcpServers).forEach(([name, mcp]) => {
    if (!mcp.enabled) {
      console.log(`  [DISABLED] ${name}`);
      return;
    }
    const cmd = mcp.command[0];
    console.log(`  [OK] ${name} → ${cmd} (timeout: ${mcp.timeout}ms)`);
    if (mcp.command.some((arg) => arg.includes("${"))) {
      console.log(
        `    [ENV] uses env vars: ${mcp.command.filter((a) => a.includes("${")).join(" ")}`
      );
    }
  });
}

// === LSP CHECKS ===
console.log("\n=== LSP AUDIT ===");
Object.entries(config.lsp).forEach(([name, lsp]) => {
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

// === WORKFLOW CHECKS ===
console.log("\n=== WORKFLOW AUDIT ===");
const workflowDir = path.join(ROOT, "workflows");
function scanWorkflows(dir, depth = 0) {
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
const index = JSON.parse(fs.readFileSync(path.join(ROOT, "skills", "index.json"), "utf-8"));
const indexNames = new Set(index.skills.map((s) => s.name));
const diskDirs = fs
  .readdirSync(path.join(ROOT, "skills"), { withFileTypes: true })
  .filter((d) => d.isDirectory() && !d.name.startsWith("_") && d.name !== "archive")
  .map((d) => d.name);
const inIndex = diskDirs.filter((d) => indexNames.has(d));
const notInIndex = diskDirs.filter((d) => !indexNames.has(d));
const hasSkillMd = diskDirs.filter((d) => fs.existsSync(path.join(ROOT, "skills", d, "SKILL.md")));
const missingSkillMd = diskDirs.filter(
  (d) => !fs.existsSync(path.join(ROOT, "skills", d, "SKILL.md"))
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

// === CONFIG VALIDATION ===
console.log("\n=== CONFIG VALIDATION ===");
try {
  const validator = require(path.join(ROOT, "config-validator.js"));
  const result = validator.validate
    ? validator.validate(config, require(path.join(ROOT, "config-schema.json")))
    : { valid: true };
  console.log(`  Schema validation: ${result.valid ? "PASS" : "FAIL"}`);
} catch (e) {
  console.log(`  Schema validation: ERROR - ${e.message}`);
}

// === SUMMARY ===
console.log("\n" + "=".repeat(60));
console.log("AUDIT SUMMARY");
console.log("=".repeat(60));
if (issues.length === 0) {
  console.log("  No issues found!");
} else {
  console.log(`  ${issues.length} issues found:`);
  issues.forEach((i, idx) => console.log(`  ${idx + 1}. ${i}`));
}
