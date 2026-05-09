#!/usr/bin/env node
/**
 * Dynamic Workflow Generator v2.1 - FIXED YAML
 * Uses yaml library for proper output
 */

const fs = require("fs");
const YAML = require("yaml");

// Keyword to Task Type mapping
const TASK_TYPE_MAP = {
  CREATE: {
    keywords: ["add", "create", "new feature", "build"],
    phases: ["Strategy", "Design", "Implementation", "QA", "Documentation"],
  },
  UPDATE: {
    keywords: ["modify", "update", "change"],
    phases: ["Strategy", "Implementation", "QA", "Documentation"],
  },
  DELETE: {
    keywords: ["delete", "remove", "cleanup"],
    phases: ["Strategy", "Verification", "QA", "Documentation"],
  },
  REFACTOR: {
    keywords: ["refactor", "rewrite", "restructure", "convert"],
    phases: ["Analysis", "Implementation", "QA"],
  },
  FIX: {
    keywords: ["fix", "bug", "error", "issue", "crash"],
    phases: ["Triage", "Fix", "Verification", "Documentation"],
  },
  AUDIT: {
    keywords: ["audit", "review", "scan", "check", "security"],
    phases: ["Analysis", "Audit", "Report"],
  },
  OPTIMIZE: {
    keywords: ["optimize", "improve", "performance", "speed"],
    phases: ["Analysis", "Implementation", "Benchmark", "QA"],
  },
  TEST: { keywords: ["test", "coverage", "spec"], phases: ["Setup", "Tests", "Coverage"] },
  MIGRATE: { keywords: ["migrate", "database"], phases: ["Analysis", "Migration", "Verification"] },
  DEPLOY: {
    keywords: ["deploy", "release", "publish"],
    phases: ["Build", "Test", "Deploy", "Verify"],
  },
};

// Phase Templates
const PHASE_TEMPLATES = {
  Strategy: {
    name: "Strategy & Analysis",
    agents: ["lead-strategist", "lead-architect"],
    use_router: true,
    mcp: ["context7", "memory"],
  },
  Analysis: {
    name: "Analysis",
    agents: ["lead-architect", "qa-guardian"],
    use_router: true,
    mcp: ["context7", "memory"],
  },
  Design: {
    name: "Design & Planning",
    agents: ["frontend-ui-ux", "backend-api"],
    use_router: true,
    mcp: ["context7", "sqlite"],
  },
  Implementation: {
    name: "Implementation",
    agents: ["core-factory", "backend-laravel"],
    use_router: true,
    mcp: ["context7", "git", "filesystem"],
  },
  Triage: {
    name: "Triage & Analysis",
    agents: ["qa-guardian", "lead-strategist"],
    use_router: true,
    mcp: ["context7", "fetch"],
  },
  Fix: {
    name: "Fix Implementation",
    agents: ["core-factory", "backend-laravel"],
    use_router: true,
    mcp: ["context7", "sqlite", "git"],
  },
  Verification: {
    name: "Verification & Testing",
    agents: ["qa-guardian"],
    mcp: ["git", "sequential-thinking"],
  },
  QA: { name: "Quality Assurance", agents: ["qa-guardian"], mcp: ["git", "context7"] },
  Audit: { name: "Security Audit", agents: ["qa-guardian"], mcp: ["git"] },
  Benchmark: {
    name: "Performance Benchmark",
    agents: ["qa-guardian"],
    mcp: ["sequential-thinking"],
  },
  Migration: {
    name: "Data Migration",
    agents: ["backend-laravel", "devops-engineer"],
    mcp: ["sqlite", "git"],
  },
  Build: { name: "Build", agents: ["core-factory"], mcp: ["git"] },
  Deploy: { name: "Deployment", agents: ["devops-engineer"], mcp: ["git"] },
  Setup: { name: "Test Setup", agents: ["qa-guardian"], mcp: ["sqlite"] },
  Tests: { name: "Tests", agents: ["qa-guardian"], mcp: ["sqlite", "git"] },
  Coverage: { name: "Coverage Report", agents: ["qa-guardian"], mcp: ["sqlite"] },
  Report: { name: "Report Generation", agents: ["docs-curator"], mcp: ["memory"] },
  Documentation: { name: "Documentation", agents: ["docs-curator"], mcp: ["memory", "git"] },
};

// Keyword→MCP mapping
const MCP_KEYWORDS = {
  sqlite: ["database", "db", "query", "table", "sql", "migration"],
  git: ["commit", "branch", "merge", "git", "push", "pull"],
  context7: ["docs", "documentation", "library", "reference"],
  memory: ["remember", "recall", "history"],
  sequential_thinking: ["analyze", "think", "reason"],
  fetch: ["http", "web", "api", "fetch", "url"],
};

function detectTaskType(task) {
  const t = task.toLowerCase();
  for (const [type, config] of Object.entries(TASK_TYPE_MAP)) {
    if (config.keywords.some((kw) => t.includes(kw))) return { type, phases: config.phases };
  }
  return { type: "CREATE", phases: TASK_TYPE_MAP.CREATE.phases };
}

function getMCPServers(task) {
  const t = task.toLowerCase();
  const servers = new Set(["context7", "filesystem"]);
  for (const [server, keywords] of Object.entries(MCP_KEYWORDS)) {
    if (keywords.some((kw) => t.includes(kw))) servers.add(server);
  }
  return Array.from(servers);
}

function validateAgents(agents) {
  try {
    const cfg = JSON.parse(fs.readFileSync("opencode.json", "utf8"));
    const valid = Object.keys(cfg.agent || {});
    const invalid = agents.filter((a) => !valid.includes(a));
    return { valid: invalid.length === 0, invalid };
  } catch (e) {
    return { valid: false, error: e.message };
  }
}

function generateSlug(task) {
  return task
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 2)
    .slice(0, 3)
    .join("-");
}

function generateWorkflow(taskDescription) {
  const { type, phases: phaseNames } = detectTaskType(taskDescription);
  const mcpServers = getMCPServers(taskDescription);

  // Build phases with proper YAML objects
  const phases = [];
  let prevName = null;

  for (const phaseName of phaseNames) {
    const tmpl = PHASE_TEMPLATES[phaseName];
    if (!tmpl) continue;

    const phase = { name: tmpl.name, agents: tmpl.agents };
    if (tmpl.use_router) phase.use_agent_router = true;
    if (prevName) phase.dependencies = [prevName];
    if (tmpl.mcp) phase.mcp_tools = tmpl.mcp;

    phases.push(phase);
    prevName = tmpl.name;
  }

  const allAgents = [...new Set(phases.flatMap((p) => p.agents))];
  const validation = validateAgents(allAgents);
  if (!validation.valid) return { error: true, validation };

  const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const slug = generateSlug(taskDescription);
  const filename = `workflows/auto/${slug}-${ts}.yaml`;

  // Build workflow object for YAML
  const workflow = {
    name: `${type}: ${taskDescription.slice(0, 50)}`,
    description: taskDescription,
    version: "2.0.0",
    trigger: "auto-generated",
    mcp_servers: mcpServers,
    phases: phases,
  };

  const yaml = YAML.stringify(workflow);
  fs.writeFileSync(
    filename,
    `# Auto-generated: ${ts}\n# Task: ${taskDescription}\n# Type: ${type}\n\n${yaml}`,
    "utf8"
  );

  return { success: true, filename, type, phases: phases.length, agents: allAgents };
}

// Run
const task = process.argv.slice(2).join(" ") || "Refactor auth to use JWT";
console.log(`\n🔧 Generating: "${task}"`);

const result = generateWorkflow(task);
if (result.error) {
  console.error("❌", result.validation);
  process.exit(1);
}
console.log(
  `\n��� ${result.filename}\n📊 ${result.type} | ${result.phases} phases\n👥 ${result.agents.join(", ")}`
);
