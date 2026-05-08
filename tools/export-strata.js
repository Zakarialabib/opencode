const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

/**
 * The Continuum Engine: Strata Exporter
 *
 * This tool acts as the Sneakernet synchronizer. It packages the current
 * cognitive state (git diffs, current phase, thermal map of recent files)
 * into a `.strata.json` file inside the `continuum/` directory.
 */

const WORKSPACE_DIR = process.env.OPENCODE_HOME || process.cwd();
const CONTINUUM_DIR = path.join(WORKSPACE_DIR, "continuum");

if (!fs.existsSync(CONTINUUM_DIR)) {
  fs.mkdirSync(CONTINUUM_DIR, { recursive: true });
}

// 1. Gather Thermal Map (recently changed files via Git)
let recentFiles = [];
try {
  const gitStatus = execSync("git status --short", { cwd: WORKSPACE_DIR }).toString();
  recentFiles = gitStatus.split("\n").filter((line) => line.trim().length > 0);
} catch (e) {
  console.log("Warning: Git not initialized or no recent changes.");
}

// 2. Gather active skills metadata
const skillsDir = path.join(WORKSPACE_DIR, ".opencode", "skills");
let activeSkills = [];
if (fs.existsSync(skillsDir)) {
  activeSkills = fs
    .readdirSync(skillsDir)
    .filter((file) => fs.statSync(path.join(skillsDir, file)).isDirectory());
}

// 3. Compile Strata
const strata = {
  timestamp: new Date().toISOString(),
  phase: process.env.STRATA_PHASE || "Unknown",
  thermalMap: recentFiles,
  activeSkills: activeSkills,
  memoryPointers: [
    path.join(WORKSPACE_DIR, "database.sqlite"),
    path.join(WORKSPACE_DIR, ".opencode", "memory.jsonl"),
  ],
};

const filename = `strata-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
const exportPath = path.join(CONTINUUM_DIR, filename);

fs.writeFileSync(exportPath, JSON.stringify(strata, null, 2));
console.log(`[Continuum Engine] Stratum successfully exported to: ${exportPath}`);
