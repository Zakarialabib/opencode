import { describe, it, expect } from "vitest";

describe("plugin index", () => {
  it("should export SelfImprovePlugin", async () => {
    const mod = await import("../index");
    expect(mod.SelfImprovePlugin).toBeDefined();
    expect(typeof mod.SelfImprovePlugin).toBe("function");
  });
});
