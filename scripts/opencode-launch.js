#!/usr/bin/env node
/**
 * opencode-launch.js - Launch opencode with correct project root
 * Ensures opencode.json is always discovered
 */

const { spawn } = require("child_process");
const path = require("node:path");
const fs = require("node:fs");

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

// Kill any existing processes on port 4096
function killExistingServer(port = 4096) {
  if (process.platform !== "win32") return;

  try {
    const { execFileSync, execSync } = require("child_process");
    let pidsToKill = new Set();

    try {
      // Find process using the port
      const netstatOutput = execFileSync(`netstat.exe`, ["-ano", "-p", "TCP"], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      });

      const lines = netstatOutput.split(/\r?\n/);
      for (const line of lines) {
        if (line.includes(`:${port}`) && line.includes("LISTENING")) {
          const parts = line.trim().split(/\s+/);
          const pidIndex = parts.length - 1;
          const pid = parseInt(parts[pidIndex], 10);
          if (pid && !isNaN(pid)) {
            pidsToKill.add(pid);
          }
        }
      }
    } catch (e) { /* ignore */ }

    try {
      // Find any opencode processes
      const tasklistOutput = execFileSync(
        "tasklist.exe",
        ["/FI", "IMAGENAME eq opencode*", "/FO", "CSV", "/NH"],
        {
          encoding: "utf8",
          stdio: ["ignore", "pipe", "ignore"],
        }
      );

      const taskLines = tasklistOutput.split(/\r?\n/).filter(Boolean);
      for (const taskLine of taskLines) {
        const match = taskLine.match(/"([^"]+)","(\d+)"/);
        if (match) {
          pidsToKill.add(parseInt(match[2], 10));
        }
      }
    } catch (e) { /* ignore */ }

    try {
      // Find any node processes too
      const nodeTasklist = execFileSync(
        "tasklist.exe",
        ["/FI", "IMAGENAME eq node.exe", "/FO", "CSV", "/NH"],
        {
          encoding: "utf8",
          stdio: ["ignore", "pipe", "ignore"],
        }
      );

      const nodeLines = nodeTasklist.split(/\r?\n/).filter(Boolean);
      for (const line of nodeLines) {
        const match = line.match(/"([^"]+)","(\d+)"/);
        if (match) {
          pidsToKill.add(parseInt(match[2], 10));
        }
      }
    } catch (e) { /* ignore */ }

    // Kill all collected PIDs
    if (pidsToKill.size > 0) {
      console.log(`   Killing ${pidsToKill.size} process(es)...`);
      for (const pid of pidsToKill) {
        if (pid && !isNaN(pid)) {
          try {
            execFileSync("taskkill.exe", ["/F", "/PID", pid.toString()], {
              stdio: "ignore",
            });
            console.log(`   Killed PID ${pid}`);
          } catch (e) { /* ignore */ }
        }
      }
      // Wait for ports to be released
      try {
        execSync("timeout /t 2 /nobreak >nul 2>&1", { stdio: "ignore" });
      } catch (e) { /* ignore */ }
    } else {
      console.log(`   No processes found on port ${port}`);
    }
  } catch (e) {
    // Ignore errors
  }
}

// Kill existing server before launching
killExistingServer(4096);

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
    if (
      process.platform === "win32" &&
      (finalCommand === "opencode.cmd" ||
        finalCommand.endsWith(".cmd") ||
        finalCommand.endsWith(".bat") ||
        !path.isAbsolute(finalCommand))
    ) {
      useShell = true;
    }

    return spawn(finalCommand, finalArgs, {
      stdio: "inherit",
      shell: useShell,
      cwd: cwd, // Always run in original CWD
      env,
    });
  }

  let child;

  // Resolve the actual opencode binary to launch
  // Per docs (https://opencode.ai/docs#install):
  //   npm install -g opencode-ai  → installs global `opencode` binary
  // We MUST NOT use `npx opencode` because our package.json declares a local
  // "opencode" bin that would recurse into this same script.
  const installedOpencode = resolveInstalledOpencode(scriptDir);
  const rootExe = path.join(configRoot, "opencode.exe");

  if (installedOpencode) {
    console.log(`   Using installed CLI: ${installedOpencode}`);
    // If the installed binary is our own local launch script, refuse to recurse
    const normalized = path.normalize(installedOpencode).toLowerCase();
    const localBat = path.join(scriptDir, "opencode.bat").toLowerCase();
    const localCmd = path.join(scriptDir, "opencode.cmd").toLowerCase();
    const localJs = path.join(scriptDir, "opencode").toLowerCase();
    const thisScript = __filename.toLowerCase();
    if (
      normalized === localBat ||
      normalized === localCmd ||
      normalized === localJs ||
      normalized === thisScript
    ) {
      console.error(
        "❌ Resolved opencode points back to this launcher script — refusing to recurse."
      );
      console.error("   Install the official CLI globally: npm install -g opencode-ai");
      process.exit(1);
    }
    child = runCommand(installedOpencode);
  } else if (fs.existsSync(rootExe)) {
    console.log(`   Using project root executable: ${rootExe}`);
    child = runCommand(rootExe);
  } else {
    console.error("❌ Could not find the official opencode CLI.");
    console.error("   Install it globally per https://opencode.ai/docs#install:");
    console.error("     npm install -g opencode-ai");
    process.exit(1);
  }

  child.on("exit", (code) => {
    // After the child exits, clean up any straggler processes still bound to the port
    // (npx wrappers, helper node processes, etc.) so the next launch is clean.
    try {
      killExistingServer(4096);
    } catch {}
    process.exit(code || 0);
  });

  child.on("error", (err) => {
    console.error("❌ Failed to launch opencode:", err.message);
    console.error("   Make sure the official OpenCode CLI is installed and available on PATH.");
    console.error("   Install per https://opencode.ai/docs#install:  npm install -g opencode-ai");
    process.exit(1);
  });
}

launch();
