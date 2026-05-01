#!/usr/bin/env node
/**
 * opencode-launch.js - Launch opencode with correct project root
 * Ensures opencode.json is always discovered
 */

const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

// Find project root by looking for opencode.json
function findProjectRoot(startDir) {
  let current = startDir;
  const root = path.parse(current).root;

  while (current !== root) {
    try {
      fs.accessSync(path.join(current, "opencode.json"));
      return current;
    } catch {
      current = path.dirname(current);
    }
  }

  // Check root
  try {
    fs.accessSync(path.join(root, "opencode.json"));
    return root;
  } catch {
    return null;
  }
}

// Main launch logic
function launch() {
  const cwd = process.cwd();
  const scriptDir = __dirname;

  console.log(`🔍 Searching for opencode.json...`);
  console.log(`   CWD: ${cwd}`);
  console.log(`   Script dir: ${scriptDir}`);

  // Try CWD first, then script directory
  let projectRoot = findProjectRoot(cwd);

  if (!projectRoot) {
    projectRoot = findProjectRoot(scriptDir);
  }

  if (!projectRoot) {
    console.error("❌ Could not find opencode.json");
    console.error("   Searched from:", cwd);
    console.error("   And from:", scriptDir);
    console.error("\n   Please run from the project directory or specify --project-root");
    process.exit(1);
  }

  console.log(`✅ Found project root: ${projectRoot}`);

  // Read config to verify
  try {
    const configPath = path.join(projectRoot, "opencode.json");
    const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
    console.log(`   Config: ${config.model || "no model set"}`);
    console.log(`   Agents: ${Object.keys(config.agent || {}).length}`);
    console.log(
      `   MCP servers: ${Object.keys(config.mcp || {}).filter((k) => config.mcp[k].enabled).length} enabled`
    );
  } catch (e) {
    console.error("❌ Error reading config:", e.message);
    process.exit(1);
  }

  // Launch opencode with explicit project root
  console.log(`\n🚀 Launching opencode...\n`);

  // Pass projectRoot as the first positional argument if no other commands are specified,
  // or just append it to ensure the CLI knows where to start.
  // Actually, we can just change cwd.
  const args = [...process.argv.slice(2)];
  
  const globalBin = path.join(process.env.APPDATA || 'C:/laragon/bin/nodejs/node-v22', 'npm', 'node_modules', 'opencode-ai', 'bin', 'opencode');
  const laragonBin = 'C:/laragon/bin/nodejs/node-v22/node_modules/opencode-ai/bin/opencode';
  const targetBin = fs.existsSync(laragonBin) ? laragonBin : globalBin;

  const child = spawn("node", [targetBin, ...args], {
    stdio: "inherit",
    shell: false,
    cwd: projectRoot,
    env: {
      ...process.env,
      OPENCODE_PROJECT_ROOT: projectRoot,
    },
  });

  child.on("exit", (code) => {
    process.exit(code || 0);
  });

  child.on("error", (err) => {
    console.error("❌ Failed to launch opencode:", err.message);
    console.error("   Make sure opencode is installed and in your PATH");
    process.exit(1);
  });
}

launch();
