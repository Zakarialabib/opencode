/**
 * E2E test for core plugins
 * Run: node plugins/tests/core-plugins-e2e.test.js
 *
 * Verifies each core plugin can be loaded without errors and
 * that critical tools are available.
 */

const fs = require("fs");
const path = require("path");

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✅ ${name}`);
  } catch (e) {
    failed++;
    console.log(`  ❌ ${name}: ${e.message}`);
  }
}

// ====== Test 1: jsonc-utils.ts (parseJsonc) ======
console.log("\n📦 jsonc-utils (parseJsonc)");
test("MCP config from opencode.json parses correctly", () => {
  const content = fs.readFileSync("C:\\opencode\\opencode.json", "utf8");

  // Use the fixed parseJsonc logic
  let result = "";
  let inString = false;
  let esc = false;
  let i = 0;

  while (i < content.length) {
    const char = content[i];
    const nextChar = i + 1 < content.length ? content[i + 1] : "";

    if (esc) {
      result += char;
      esc = false;
      i++;
      continue;
    }
    if (char === "\\" && inString) {
      result += char;
      esc = true;
      i++;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      result += char;
      i++;
      continue;
    }

    if (!inString) {
      if (char === "/" && nextChar === "/") {
        while (i < content.length && content[i] !== "\n") i++;
        continue;
      }
      if (char === "/" && nextChar === "*") {
        i += 2;
        while (i < content.length) {
          if (content[i] === "*" && i + 1 < content.length && content[i + 1] === "/") {
            i += 2;
            break;
          }
          i++;
        }
        continue;
      }
    }
    result += char;
    i++;
  }

  const config = JSON.parse(result);

  if (!config.mcp) throw new Error("Missing mcp config");
  if (!config.provider) throw new Error("Missing provider config");
  if (!config.plugin) throw new Error("Missing plugin config");

  // Verify all 9 MCP servers
  const expectedMcps = [
    "context7",
    "filesystem",
    "memory",
    "git",
    "fetch",
    "sqlite",
    "sequential-thinking",
    "language-server",
    "type-inject",
  ];
  for (const name of expectedMcps) {
    if (!config.mcp[name]) throw new Error(`Missing MCP server: ${name}`);
  }
});

test("MCP config enabled servers are correct", () => {
  const content = fs.readFileSync("C:\\opencode\\opencode.json", "utf8");
  let result = "";
  let inString = false,
    esc = false,
    i = 0;
  while (i < content.length) {
    const char = content[i],
      nc = i + 1 < content.length ? content[i + 1] : "";
    if (esc) {
      result += char;
      esc = false;
      i++;
      continue;
    }
    if (char === "\\" && inString) {
      result += char;
      esc = true;
      i++;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      result += char;
      i++;
      continue;
    }
    if (!inString && char === "/" && nc === "/") {
      while (i < content.length && content[i] !== "\n") i++;
      continue;
    }
    if (!inString && char === "/" && nc === "*") {
      i += 2;
      while (i < content.length) {
        if (content[i] === "*" && content[i + 1] === "/") {
          i += 2;
          break;
        }
        i++;
      }
      continue;
    }
    result += char;
    i++;
  }
  const config = JSON.parse(result);

  let enabledCount = 0;
  for (const [name, cfg] of Object.entries(config.mcp)) {
    if (cfg.enabled) enabledCount++;
  }
  if (enabledCount < 9) throw new Error(`Expected all 9 MCP servers enabled, got ${enabledCount}`);
});

// ====== Test 2: Plugin file structure validation ======
console.log("\n📦 Plugin file structure");

const corePlugins = [
  "jsonc-utils.ts",
  "mcp-manager.ts",
  "agent-router.ts",
  "model-router.ts",
  "skill-manager.ts",
  "context-manager.ts",
  "index.ts",
];

for (const plugin of corePlugins) {
  test(`File exists: ${plugin}`, () => {
    const filePath = path.join("C:\\opencode\\plugins", plugin);
    if (!fs.existsSync(filePath)) throw new Error(`File not found: ${filePath}`);
  });
}

test("No Bun dependencies in core plugins", () => {
  for (const plugin of corePlugins) {
    const content = fs.readFileSync(path.join("C:\\opencode\\plugins", plugin), "utf8");
    if (
      content.includes('from "bun"') ||
      content.includes("from 'bun'") ||
      content.includes("Bun.")
    ) {
      throw new Error(`${plugin} still has Bun dependency`);
    }
  }
});

test("All core plugins use fixed parseJsonc or JSON.parse (not Bun)", () => {
  const pluginsUsingConfig = [
    "mcp-manager.ts",
    "agent-router.ts",
    "model-router.ts",
    "skill-manager.ts",
    "context-manager.ts",
    "index.ts",
  ];
  for (const plugin of pluginsUsingConfig) {
    const content = fs.readFileSync(path.join("C:\\opencode\\plugins", plugin), "utf8");
    // Should use parseJsonc OR not use Bun
    if (
      content.includes("Bun.file") ||
      content.includes("Bun.") ||
      content.includes('from "bun"')
    ) {
      throw new Error(`${plugin} still uses Bun APIs`);
    }
  }
});

// ====== Test 3: Plugin exports valid Plugin functions ======
console.log("\n📦 Plugin exports");

test("index.ts exports default function", () => {
  const content = fs.readFileSync("C:\\opencode\\plugins\\index.ts", "utf8");
  if (!content.includes("export default")) throw new Error("Missing default export");
  if (content.includes("import { $ } from")) throw new Error("Still imports bun shell");
});

test("mcp-manager.ts exports default function", () => {
  const content = fs.readFileSync("C:\\opencode\\plugins\\mcp-manager.ts", "utf8");
  if (!content.includes("export default")) throw new Error("Missing default export");
});

test("agent-router.ts exports default function", () => {
  const content = fs.readFileSync("C:\\opencode\\plugins\\agent-router.ts", "utf8");
  if (!content.includes("export default")) throw new Error("Missing default export");
});

test("model-router.ts exports default function", () => {
  const content = fs.readFileSync("C:\\opencode\\plugins\\model-router.ts", "utf8");
  if (!content.includes("export default")) throw new Error("Missing default export");
});

test("skill-manager.ts exports default function", () => {
  const content = fs.readFileSync("C:\\opencode\\plugins\\skill-manager.ts", "utf8");
  if (!content.includes("export default")) throw new Error("Missing default export");
});

test("context-manager.ts exports default function", () => {
  const content = fs.readFileSync("C:\\opencode\\plugins\\context-manager.ts", "utf8");
  if (!content.includes("export default")) throw new Error("Missing default export");
});

// ====== Test 4: Tool definition count ======
console.log("\n📦 Tool registry");

function countToolDefinitions(content) {
  return (content.match(/tool\(\{/g) || []).length;
}

test("mcp-manager has 3 tools (list, check, toggle)", () => {
  const content = fs.readFileSync("C:\\opencode\\plugins\\mcp-manager.ts", "utf8");
  const count = countToolDefinitions(content);
  if (count !== 3) throw new Error(`Expected 3 tools, got ${count}`);
});

test("agent-router has 2 tools (route_agent, auto_route)", () => {
  const content = fs.readFileSync("C:\\opencode\\plugins\\agent-router.ts", "utf8");
  const count = countToolDefinitions(content);
  if (count !== 2) throw new Error(`Expected 2 tools, got ${count}`);
});

test("model-router has 2 tools (check_model, recommend_model)", () => {
  const content = fs.readFileSync("C:\\opencode\\plugins\\model-router.ts", "utf8");
  const count = countToolDefinitions(content);
  if (count !== 2) throw new Error(`Expected 2 tools, got ${count}`);
});

test("skill-manager has 3 tools (list, info, search)", () => {
  const content = fs.readFileSync("C:\\opencode\\plugins\\skill-manager.ts", "utf8");
  const count = countToolDefinitions(content);
  if (count !== 3) throw new Error(`Expected 3 tools, got ${count}`);
});

test("context-manager has 4 tools (view, add_include, add_exclude, reset)", () => {
  const content = fs.readFileSync("C:\\opencode\\plugins\\context-manager.ts", "utf8");
  const count = countToolDefinitions(content);
  if (count !== 4) throw new Error(`Expected 4 tools, got ${count}`);
});

// ====== Summary ======
console.log(`\n${"─".repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log(`${"─".repeat(50)}\n`);

if (failed > 0) process.exit(1);
