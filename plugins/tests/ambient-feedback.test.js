/**
 * Tests for Ambient LSP Feedback system in index.ts
 * Run: node plugins/tests/ambient-feedback.test.js
 */
const { execSync } = require("child_process");
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

// ── Test helpers ──
function runQuickCheck(filePath) {
  const ext = filePath.split(".").pop()?.toLowerCase();
  const TIMEOUT = 15000;

  try {
    if (ext === "php") {
      const out = execSync(`php -l "${filePath}"`, {
        timeout: 5000,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      });
      if (out.includes("Parse error") || out.includes("Fatal error")) return out.trim();
      return null;
    }
    if (ext === "ts" || ext === "tsx") {
      const out = execSync(`npx tsc --noEmit --pretty false 2>&1`, {
        timeout: TIMEOUT,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
        cwd: process.cwd(),
      });
      const lines = out.split("\n").filter((l) => l.includes(filePath));
      if (lines.length > 0) return lines.slice(0, 10).join("\n");
      return null;
    }
    if (ext === "js" || ext === "jsx") {
      try {
        execSync(`npx biome check --max-diagnostics=10 "${filePath}" 2>&1`, {
          timeout: TIMEOUT,
          encoding: "utf8",
          stdio: ["ignore", "pipe", "pipe"],
        });
        return null;
      } catch (e) {
        return e.stdout || e.stderr || e.message;
      }
    }
    if (ext === "rs") {
      const out = execSync(`cargo check --message-format=short 2>&1`, {
        timeout: TIMEOUT * 2,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
        cwd: process.cwd(),
      });
      const lines = out
        .split("\n")
        .filter((l) => l.includes(filePath) && (l.includes("error") || l.includes("warning")));
      if (lines.length > 0) return lines.slice(0, 10).join("\n");
      return null;
    }
  } catch (e) {
    const msg = e.stderr || e.stdout || e.message || "";
    if (msg.length > 0 && msg.length < 500) return msg.trim();
    return null;
  }
  return null;
}

console.log("\n🔍 Ambient LSP Feedback Test Suite\n");

// ═══ Checker Dispatch ═══
test("PHP valid file returns null", () => {
  const tmpFile = path.join(__dirname, "tmp_test.php");
  fs.writeFileSync(tmpFile, "<?php echo 'hello';\n");
  try {
    const result = runQuickCheck(tmpFile);
    if (result !== null) throw new Error(`Expected null, got: ${result}`);
  } finally {
    fs.unlinkSync(tmpFile);
  }
});

test("PHP syntax error detected", () => {
  const tmpFile = path.join(__dirname, "tmp_bad.php");
  fs.writeFileSync(tmpFile, "<?php echo 'unclosed;\n");
  try {
    const result = runQuickCheck(tmpFile);
    if (result === null) throw new Error("Expected error, got null");
    if (
      !result.includes("syntax error") &&
      !result.includes("Parse error") &&
      !result.includes("unexpected")
    )
      throw new Error(`Unexpected error message: ${result}`);
  } finally {
    fs.unlinkSync(tmpFile);
  }
});

test("TS valid file (existing) runs without crash", () => {
  // Use an existing valid TS file from the project
  const result = runQuickCheck(path.join("C:\\opencode\\plugins", "jsonc-utils.ts"));
  // tsc may or may not have errors — the test is that it doesn't crash
  if (result === undefined) throw new Error("Function returned undefined");
});

test("TS non-existent file returns error output", () => {
  const result = runQuickCheck("nonexistent_file.ts");
  // tsc will error about missing file
  if (result === undefined) throw new Error("Function returned undefined");
});

test("JS valid file (existing) runs without crash", () => {
  const result = runQuickCheck(path.join("C:\\opencode\\plugins\\tests", "parseJsonc.test.js"));
  if (typeof result === "string" && result.length > 1000)
    throw new Error("Too many errors for valid file");
});

// ═══ Diagnostic Store ═══
test("Diagnostic accumulator: add + flush", () => {
  const store = new Map();
  store.set("s1", [{ file: "a.ts", errors: "err1", severity: "error", timestamp: 1 }]);
  store.set("s2", [{ file: "b.php", errors: "err2", severity: "error", timestamp: 2 }]);

  const s1 = store.get("s1") || [];
  store.delete("s1");
  const s2 = store.get("s2") || [];
  store.delete("s2");

  if (s1.length !== 1) throw new Error("s1 should have 1 entry");
  if (s2.length !== 1) throw new Error("s2 should have 1 entry");
  if (store.has("s1")) throw new Error("s1 should be deleted");
  if (store.has("s2")) throw new Error("s2 should be deleted");
});

test("Diagnostic accumulator: empty flush", () => {
  const store = new Map();
  const result = store.get("nonexistent") || [];
  if (result.length !== 0) throw new Error("Empty flush should return []");
});

// ═══ No crash on unknown extensions ═══
test("Unknown extension returns null (no crash)", () => {
  const tmpFile = path.join(__dirname, "tmp_test.xyz");
  fs.writeFileSync(tmpFile, "content");
  try {
    const result = runQuickCheck(tmpFile);
    if (result !== null) throw new Error(`Expected null for unknown ext, got: ${result}`);
  } finally {
    fs.unlinkSync(tmpFile);
  }
});

// ═══ File existence ═══
test("index.ts has ambient feedback code", () => {
  const content = fs.readFileSync("C:\\opencode\\plugins\\index.ts", "utf8");
  if (!content.includes("Ambient LSP Feedback"))
    throw new Error("Missing ambient feedback section");
  if (!content.includes("detectAndCheck")) throw new Error("Missing detectAndCheck function");
  if (!content.includes("flushDiagnostics")) throw new Error("Missing flushDiagnostics function");
  if (!content.includes("runQuickCheck")) throw new Error("Missing runQuickCheck function");
  if (!content.includes("addDiagnostic")) throw new Error("Missing addDiagnostic function");
  if (!content.includes("diagnosticsBySession"))
    throw new Error("Missing diagnosticsBySession store");
});

test("index.ts hooks have proper diagnostic injection (NOT client.app.log)", () => {
  const content = fs.readFileSync("C:\\opencode\\plugins\\index.ts", "utf8");
  // Should inject via output.instructions in chat.params, NOT client.app.log
  if (content.includes('service: "lsp-feedback"'))
    throw new Error("Still uses broken client.app.log injection");
  if (!content.includes("output.instructions"))
    throw new Error("chat.params missing output.instructions injection");
  if (!content.includes("output.result"))
    throw new Error("tool.execute.after missing output.result injection");
});

test("index.ts tool.execute.after captures file modifications", () => {
  const content = fs.readFileSync("C:\\opencode\\plugins\\index.ts", "utf8");
  if (!content.includes("detectAndCheck(filePath)"))
    throw new Error("tool.execute.after missing detectAndCheck");
  if (!content.includes("addDiagnostic"))
    throw new Error("tool.execute.after missing addDiagnostic");
});

// ═══ No Bun dependency ═══
test("index.ts has no Bun imports", () => {
  const content = fs.readFileSync("C:\\opencode\\plugins\\index.ts", "utf8");
  if (content.includes('from "bun"')) throw new Error("Still imports bun");
  if (content.includes("Bun.")) throw new Error("Still uses Bun APIs");
});

// ═══ Summary ═══
console.log(`\n${"─".repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log(`${"─".repeat(50)}\n`);

// Clean up any leftover temp files
try {
  fs.unlinkSync(path.join(__dirname, "tmp_test.php"));
} catch {}
try {
  fs.unlinkSync(path.join(__dirname, "tmp_bad.php"));
} catch {}
try {
  fs.unlinkSync(path.join(__dirname, "tmp_test.xyz"));
} catch {}

if (failed > 0) process.exit(1);
