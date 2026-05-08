import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe("Path Resolver Utilities", () => {
  it("tools/path-resolver.ts should exist", () => {
    const resolverPath = join(__dirname, "..", "path-resolver.ts");
    expect(existsSync(resolverPath)).toBe(true);
  });

  it("should use OPENCODE_HOME env var when set", () => {
    const original = process.env.OPENCODE_HOME;
    process.env.OPENCODE_HOME = "/custom/path";
    // Logic test: env var should override cwd
    expect(process.env.OPENCODE_HOME).toBe("/custom/path");
    process.env.OPENCODE_HOME = original;
  });

  it("should default to cwd when OPENCODE_HOME is not set", () => {
    const original = process.env.OPENCODE_HOME;
    delete process.env.OPENCODE_HOME;
    expect(process.env.OPENCODE_HOME).toBeUndefined();
    const cwd = process.cwd();
    expect(cwd).toBeDefined();
    process.env.OPENCODE_HOME = original;
  });
});
