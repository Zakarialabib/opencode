/**
 * Debug launcher for opencode
 * Run with: DEBUG=opencode:* npm run start:debug
 * Or specific categories: DEBUG=skill:*,tool:* npm run start:debug
 */

const { spawn } = require("child_process");
const path = require("path");

// Parse debug categories from args
const debugArg = process.argv.find((arg) => arg.startsWith("--debug="));
const debugCategories = debugArg ? debugArg.split("=")[1] : process.env.DEBUG || "error";

const debugEnv = {
  ...process.env,
  DEBUG: debugCategories,
};

console.log("🔍 OpenCode Debug Launcher");
console.log("=".repeat(40));
console.log(`Debug categories: ${debugCategories}`);
console.log("");
console.log("Available debug categories:");
console.log("  skill:load    - Skill loading");
console.log("  skill:execute - Skill execution");
console.log("  skill:error   - Skill errors");
console.log("  tool:execute  - Tool execution");
console.log("  tool:load     - Tool loading");
console.log("  mcp:connect   - MCP connections");
console.log("  msp:error     - MCP errors");
console.log("  lsp:context   - LSP context");
console.log("  lsp:error     - LSP errors");
console.log("  hook:invoke   - Hook invocations");
console.log("");
console.log("Examples:");
console.log("  DEBUG=skill:* npm run start:debug");
console.log('  DEBUG="skill:*,tool:execute" npm run start:debug');
console.log("  DEBUG=* npm run start:debug");
console.log("");
console.log("=".repeat(40));

// Launch opencode with debug env
const child = spawn(
  "node",
  ["opencode-launch.js", ...process.argv.slice(2).filter((a) => !a.startsWith("--debug="))],
  {
    env: debugEnv,
    stdio: "inherit",
    shell: process.platform === "win32",
  }
);

child.on("exit", (code) => {
  process.exit(code || 0);
});

child.on("error", (err) => {
  console.error("❌ Failed to launch:", err.message);
  process.exit(1);
});
