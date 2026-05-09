#!/usr/bin/env node
/**
 * opencode-launch.js - Launch opencode with correct project root
 * Ensures opencode.json is always discovered
 */

const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");
const os = require("os");

function resolveInstalledOpencode(scriptDir) {
  if (process.platform !== "win32") return null;

  try {
    const { execFileSync } = require("child_process");
    const output = execFileSync("where.exe", ["opencode"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });

    const candidates = output
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .filter((candidate) => {
        const normalized = path.normalize(candidate).toLowerCase();
        const localBat = path.join(scriptDir, "opencode.bat").toLowerCase();
        const localCmd = path.join(scriptDir, "opencode.cmd").toLowerCase();
        const localJs = path.join(scriptDir, "opencode").toLowerCase();
        return normalized !== localBat && normalized !== localCmd && normalized !== localJs;
      });

    const priority = [".cmd", ".exe", ".bat", ".ps1", ""];
    candidates.sort((a, b) => {
      const extA = path.extname(a).toLowerCase();
      const extB = path.extname(b).toLowerCase();
      return priority.indexOf(extA) - priority.indexOf(extB);
    });

    return candidates[0] || null;
  } catch {
    return null;
  }
}

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

function parseProjectRootArg(argv) {
  const direct = argv.find((arg) => arg.startsWith("--project-root="));
  if (direct) {
    return path.resolve(direct.split("=")[1]);
  }
  const index = argv.indexOf("--project-root");
  if (index !== -1 && argv[index + 1]) {
    return path.resolve(argv[index + 1]);
  }
  return null;
}

// Main launch logic
function launch() {
  const cwd = process.cwd();
  const scriptDir = __dirname;
  const explicitRoot = parseProjectRootArg(process.argv.slice(2));

  console.log(`🔍 Searching for opencode.json...`);
  console.log(`   CWD: ${cwd}`);
  console.log(`   Script dir: ${scriptDir}`);
  if (explicitRoot) {
    console.log(`   Explicit project root requested: ${explicitRoot}`);
  }

  // Try explicit root first, then CWD, then script directory for config
  let configRoot = explicitRoot && findProjectRoot(explicitRoot);

  if (!configRoot) {
    configRoot = findProjectRoot(scriptDir);
  }

  if (!configRoot) {
    console.error("❌ Could not find opencode.json in CWD or config directory");
    console.error("   Searched from:", cwd);
    console.error("   And from:", scriptDir);
    console.error("\n   Please run from the project directory or specify --project-root");
    process.exit(1);
  }

  console.log(`✅ Found config root: ${configRoot}`);

  // Define config paths
  const configPath = path.join(configRoot, "opencode.json");
  const centralScriptsDir = path.join(configRoot, "scripts");

  // Read config to verify
  try {
    const configPath = path.join(configRoot, "opencode.json");
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
  const args = [...process.argv.slice(2)];

  // Ensure config exists in CWD for the actual CLI to find it if it doesn't respect environment variables
  const localConfigPath = path.join(cwd, "opencode.json");
  if (!fs.existsSync(localConfigPath)) {
    console.log(`   Copying central config to project root for CLI discovery...`);
    try {
      fs.copyFileSync(configPath, localConfigPath);
    } catch (e) {
      console.warn(`   ⚠️ Failed to copy config: ${e.message}`);
    }
  }

  const env = {
    ...process.env,
    OPENCODE_PROJECT_ROOT: cwd,
    OPENCODE_CONFIG: configPath,
    PATH: `${centralScriptsDir}${path.delimiter}${process.env.PATH}`,
  };

  function runCommand(command, commandArgs = []) {
    let finalCommand = command;
    const finalArgs = [...commandArgs, ...args];
    let useShell = false;

    // On Windows, if we are not using shell: true, we must point to the .cmd or .exe
    if (process.platform === "win32") {
      if (command === "npm") {
        finalCommand = "npm.cmd";
      } else if (
        command === "opencode" &&
        !command.endsWith(".exe") &&
        !command.endsWith(".cmd") &&
        !command.endsWith(".bat")
      ) {
        finalCommand = "opencode.cmd";
      }
    }

    // Use shell when command might need PATH resolution or is just a name
    if (process.platform === "win32" && (
      finalCommand === "opencode.cmd" ||
      finalCommand.endsWith(".cmd") ||
      finalCommand.endsWith(".bat") ||
      !path.isAbsolute(finalCommand)
    )) {
      useShell = true;
    }

    return spawn(finalCommand, finalArgs, {
      stdio: "inherit",
      shell: useShell,
      cwd: cwd, // Always run in original CWD
      env,
    });
  }

  function hasOpencodeOnPath() {
    try {
      const { spawnSync } = require("child_process");
      const check = spawnSync("opencode", ["--version"], {
        stdio: "ignore",
        shell: true, // Use shell to find it on path more reliably on Windows
      });
      return check.status === 0;
    } catch {
      return false;
    }
  }

  let child;
  const localBin = path.join(
    configRoot,
    "node_modules",
    ".bin",
    "opencode" + (process.platform === "win32" ? ".cmd" : "")
  );
  const bunLocal = path.join(
    os.homedir(),
    ".bun",
    "bin",
    "opencode" + (process.platform === "win32" ? ".exe" : "")
  );
  const installedOpencode = resolveInstalledOpencode(scriptDir);

  if (fs.existsSync(localBin)) {
    console.log(`   Using local bin: ${localBin}`);
    child = runCommand(localBin);
  } else if (fs.existsSync(bunLocal)) {
    console.log(`   Using bun bin: ${bunLocal}`);
    child = runCommand(bunLocal);
  } else if (installedOpencode) {
    console.log(`   Using installed CLI: ${installedOpencode}`);
    child = runCommand(installedOpencode);
  } else {
    console.log(`   Searching for opencode on PATH...`);
    child = runCommand("opencode");
  }

  child.on("exit", (code) => {
    process.exit(code || 0);
  });

  child.on("error", (err) => {
    console.error("❌ Failed to launch opencode:", err.message);
    console.error("   Make sure the official OpenCode CLI is installed and available on PATH.");
    console.error("   Recommended install: npm install -g opencode");
    process.exit(1);
  });
}

launch();
