import { describe, it, expect } from "vitest";

describe("AgentRouterPlugin", () => {
  it("should load agent-router module without errors", async () => {
    const mod = await import("../agent-router");
    expect(mod.default).toBeDefined();
    expect(typeof mod.default).toBe("function");
  });

  it("should return plugin hooks when initialized with context", async () => {
    const mod = await import("../agent-router");
    const plugin = mod.default;
    const mockContext = {
      client: {} as any,
      project: { path: process.cwd() },
      directory: process.cwd(),
    };
    const instance = await plugin(mockContext);
    expect(instance).toBeDefined();
    expect(typeof instance).toBe("object");
  });

  it("should have chat.message hook when initialized", async () => {
    const mod = await import("../agent-router");
    const plugin = mod.default;
    const mockContext = {
      client: {} as any,
      project: { path: process.cwd() },
      directory: process.cwd(),
    };
    const instance = await plugin(mockContext);
    expect(instance["chat.message"]).toBeDefined();
    expect(typeof instance["chat.message"]).toBe("function");
  });

  it("should expose route_agent tool", async () => {
    const mod = await import("../agent-router");
    const plugin = mod.default;
    const mockContext = {
      client: {} as any,
      project: { path: process.cwd() },
      directory: process.cwd(),
    };
    const instance = await plugin(mockContext);
    expect(instance.tool).toBeDefined();
    expect(instance.tool.route_agent).toBeDefined();
  });

  it("should expose auto_route tool", async () => {
    const mod = await import("../agent-router");
    const plugin = mod.default;
    const mockContext = {
      client: {} as any,
      project: { path: process.cwd() },
      directory: process.cwd(),
    };
    const instance = await plugin(mockContext);
    expect(instance.tool).toBeDefined();
    expect(instance.tool.auto_route).toBeDefined();
  });
});
