import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

describe("Configuration Validation", () => {
  const configPath = join(process.cwd(), "opencode.json");
  const schemaPath = join(process.cwd(), "config-schema.json");

  it("opencode.json should exist", () => {
    expect(existsSync(configPath)).toBe(true);
  });

  it("config-schema.json should exist", () => {
    expect(existsSync(schemaPath)).toBe(true);
  });

  it("opencode.json should be valid JSON", () => {
    const content = readFileSync(configPath, "utf-8");
    expect(() => JSON.parse(content)).not.toThrow();
  });

  it("config-schema.json should be valid JSON", () => {
    const content = readFileSync(schemaPath, "utf-8");
    expect(() => JSON.parse(content)).not.toThrow();
  });

  it("opencode.json should have required top-level fields", () => {
    const content = JSON.parse(readFileSync(configPath, "utf-8"));
    expect(content).toHaveProperty("$schema");
    expect(content).toHaveProperty("model");
    expect(content).toHaveProperty("plugin");
    expect(content).toHaveProperty("agent");
    expect(content).toHaveProperty("mcp");
  });

  it("plugin array should use relative paths", () => {
    const content = JSON.parse(readFileSync(configPath, "utf-8"));
    for (const plugin of content.plugin) {
      if (typeof plugin === "string" && plugin.startsWith("plugins/")) {
        const pluginPath = join(process.cwd(), plugin);
        expect(existsSync(pluginPath)).toBe(true);
      }
    }
  });
});
