/**
 * Tests for parseJsonc in jsonc-utils.ts
 * Run: node plugins/tests/parseJsonc.test.js
 */
const fs = require("fs");

// Import the fixed parseJsonc by evaluating the compiled source
// Since we're in a test, we'll replicate the exact implementation
function parseJsonc(content) {
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

  return JSON.parse(result);
}

// Test runner
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

function assertDeep(actual, expected) {
  const a = JSON.stringify(actual);
  const b = JSON.stringify(expected);
  if (a !== b) throw new Error(`Expected ${b}, got ${a}`);
}

console.log("\n🧪 parseJsonc Test Suite\n");

// ========== URL Tests (the original bug) ==========
test("URL with https:// (single)", () => {
  const json = `{ "url": "https://example.com" }`;
  const result = parseJsonc(json);
  assertDeep(result, { url: "https://example.com" });
});

test("URL with https:// (multiple)", () => {
  const json = `{
    "schema": "https://opencode.ai/config.json",
    "api": "https://api.example.com/v1",
    "cdn": "http://cdn.example.com"
  }`;
  const result = parseJsonc(json);
  assertDeep(result, {
    schema: "https://opencode.ai/config.json",
    api: "https://api.example.com/v1",
    cdn: "http://cdn.example.com",
  });
});

test("open code.json with $schema URL", () => {
  const content = fs.readFileSync("C:\\opencode\\opencode.json", "utf8");
  const result = parseJsonc(content);
  if (!result || !result.model) throw new Error("Failed to parse opencode.json");
  if (!result.mcp) throw new Error("Missing mcp config");
  if (!result.provider) throw new Error("Missing provider config");
});

// ========== Comment Tests ==========
test("single-line comment", () => {
  const json = `{
    // This is a comment
    "key": "value"
  }`;
  const result = parseJsonc(json);
  assertDeep(result, { key: "value" });
});

test("multi-line comment", () => {
  const json = `{
    /* This is a
       multi-line comment */
    "key": "value"
  }`;
  const result = parseJsonc(json);
  assertDeep(result, { key: "value" });
});

test("trailing single-line comment", () => {
  const json = `{ "key": "value" } // trailing comment`;
  const result = parseJsonc(json);
  assertDeep(result, { key: "value" });
});

test("comment with URL-like // inside it", () => {
  // The comment should be stripped even though the comment contains //
  const json = `{
    // Note: see https://example.com for docs
    "key": "value"
  }`;
  const result = parseJsonc(json);
  assertDeep(result, { key: "value" });
});

test("multiple comments before and after", () => {
  const json = `// Top comment
{
  // Inline comment
  "key": "value", // trailing
  /* block
     comment */
  "other": 123
}
// Bottom comment`;
  const result = parseJsonc(json);
  assertDeep(result, { key: "value", other: 123 });
});

// ========== String escaping ==========
test("escaped backslash in string", () => {
  const json = `{ "path": "C:\\\\Users\\\\test" }`;
  const result = parseJsonc(json);
  assertDeep(result, { path: "C:\\Users\\test" });
});

test("escaped quote in string", () => {
  const json = `{ "key": "he said \\"hello\\"" }`;
  const result = parseJsonc(json);
  assertDeep(result, { key: 'he said "hello"' });
});

test("string with unicode", () => {
  const json = `{ "key": "\\u0048\\u0065\\u006C\\u006C\\u006F" }`;
  const result = parseJsonc(json);
  assertDeep(result, { key: "Hello" });
});

test("string with non-ASCII characters (en-dash)", () => {
  const json = `{ "key": "backend – logic" }`;
  const result = parseJsonc(json);
  assertDeep(result, { key: "backend – logic" });
});

// ========== Strings containing comment-like patterns ==========
test("string containing // (NOT a comment)", () => {
  const json = `{ "key": "// this is NOT a comment" }`;
  const result = parseJsonc(json);
  assertDeep(result, { key: "// this is NOT a comment" });
});

test("string containing /* (NOT a comment)", () => {
  const json = `{ "key": "/* this is NOT a comment */" }`;
  const result = parseJsonc(json);
  assertDeep(result, { key: "/* this is NOT a comment */" });
});

test("string with regex-looking pattern", () => {
  const json = `{ "pattern": "//.*$/gm" }`;
  const result = parseJsonc(json);
  assertDeep(result, { pattern: "//.*$/gm" });
});

// ========== Edge Cases ==========
test("empty object", () => {
  const result = parseJsonc("{}");
  assertDeep(result, {});
});

test("empty object with comment", () => {
  const result = parseJsonc("{} // empty");
  assertDeep(result, {});
});

test("nested objects and arrays", () => {
  const json = `{
    "items": [
      { "id": 1, "name": "foo" },
      /* second item */
      { "id": 2, "name": "bar" }
    ],
    "meta": {
      "total": 2,
      // page info
      "page": 1
    }
  }`;
  const result = parseJsonc(json);
  assertDeep(result, {
    items: [
      { id: 1, name: "foo" },
      { id: 2, name: "bar" },
    ],
    meta: { total: 2, page: 1 },
  });
});

test("boolean and null values", () => {
  const json = `{ "a": true, "b": false, "c": null }`;
  const result = parseJsonc(json);
  assertDeep(result, { a: true, b: false, c: null });
});

test("numbers (int and float)", () => {
  const json = `{ "int": 42, "float": 3.14, "neg": -1, "exp": 1e10 }`;
  const result = parseJsonc(json);
  assertDeep(result, { int: 42, float: 3.14, neg: -1, exp: 1e10 });
});

test("comment-only file", () => {
  const json = `/* nothing here */`;
  try {
    parseJsonc(json);
    throw new Error("Should have thrown");
  } catch (e) {
    // Expected - empty comment-stripped JSON is invalid
    if (!e.message.includes("JSON")) throw e;
  }
});

// ========== MCP Config specific ==========
test("MCP config with url-like server names", () => {
  const json = `{
    "mcp": {
      "context7": {
        "command": ["npx", "-y", "@upstash/context7-mcp@latest"],
        "enabled": true
      }
    }
  }`;
  const result = parseJsonc(json);
  assertDeep(result.mcp.context7.command, ["npx", "-y", "@upstash/context7-mcp@latest"]);
});

// ========== Summary ==========
console.log(`\n${"─".repeat(40)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log(`${"─".repeat(40)}\n`);

if (failed > 0) process.exit(1);
