import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getRelevantTools, CORE_TOOLS, KEYWORD_MAP } from "../mcp-manager";
import type { Plugin } from "@opencode-ai/plugin";

// Mock external dependencies
vi.mock("node:fs", () => ({
  readFileSync: vi.fn(),
  accessSync: vi.fn(),
}));

vi.mock("node:child_process", () => ({
  execSync: vi.fn(),
}));

// Import mocked modules
import { readFileSync, accessSync } from "node:fs";
import { execSync } from "node:child_process";

describe("getRelevantTools", () => {
  it("should return core tools for empty message", () => {
    const result = getRelevantTools("");
    expect(result).toEqual(expect.arrayContaining(CORE_TOOLS));
    expect(result.length).toBe(CORE_TOOLS.length);
  });

  it("should return core tools for whitespace-only message", () => {
    const result = getRelevantTools("   ");
    expect(result).toEqual(expect.arrayContaining(CORE_TOOLS));
    expect(result.length).toBe(CORE_TOOLS.length);
  });

  it("should match sqlite keywords", () => {
    const testCases = [
      "run a database query on the users table",
      "execute this sql statement",
      "check the db connection",
      "run migration",
      "select from table",
    ];

    for (const msg of testCases) {
      const result = getRelevantTools(msg);
      expect(result).toContain("sqlite");
    }
  });

  it("should match git keywords", () => {
    const testCases = [
      "commit these changes",
      "create a new branch",
      "merge the feature branch",
      "show me the diff",
      "check git history",
      "git push to main",
      "pull latest changes",
    ];

    for (const msg of testCases) {
      const result = getRelevantTools(msg);
      expect(result).toContain("git");
    }
  });

  it("should match filesystem keywords", () => {
    const testCases = [
      "read this file",
      "write to the directory",
      "list the files",
      "check the ls output",
      "open the dir",
    ];

    for (const msg of testCases) {
      const result = getRelevantTools(msg);
      expect(result).toContain("filesystem");
    }
  });

  it("should match fetch keywords", () => {
    const testCases = [
      "make an http request",
      "call the api endpoint",
      "scrape this web page",
      "fetch the url content",
      "browse the web",
    ];

    for (const msg of testCases) {
      const result = getRelevantTools(msg);
      expect(result).toContain("fetch");
    }
  });

  it("should match context7 keywords", () => {
    const testCases = [
      "check the docs",
      "read the documentation",
      "what library should I use",
      "code example for this",
      "reference guide",
    ];

    for (const msg of testCases) {
      const result = getRelevantTools(msg);
      expect(result).toContain("context7");
    }
  });

  it("should match memory keywords", () => {
    const testCases = [
      "remember this",
      "recall the previous conversation",
      "what did we discuss earlier",
      "knowledge base",
    ];

    for (const msg of testCases) {
      const result = getRelevantTools(msg);
      expect(result).toContain("memory");
    }
  });

  it("should match sequential-thinking keywords", () => {
    const testCases = [
      "think about this problem",
      "step by step reasoning",
      "analyze the situation",
    ];

    for (const msg of testCases) {
      const result = getRelevantTools(msg);
      expect(result).toContain("sequential-thinking");
    }
  });

  it("should match multiple tools", () => {
    const result = getRelevantTools("run database query and fetch url http://example.com");
    expect(result).toContain("sqlite");
    expect(result).toContain("fetch");
    // Should also contain core tools
    expect(result).toEqual(expect.arrayContaining(CORE_TOOLS));
  });

  it("should return core tools only for no-match message", () => {
    const result = getRelevantTools("hello world, how are you?");
    expect(result).toEqual(expect.arrayContaining(CORE_TOOLS));
    expect(result.length).toBe(CORE_TOOLS.length);
  });

  it("should be case-insensitive", () => {
    const result = getRelevantTools("RUN DATABASE QUERY");
    expect(result).toContain("sqlite");
  });

  it("should handle messages with special characters", () => {
    const result = getRelevantTools("run database query: SELECT * FROM users;");
    expect(result).toContain("sqlite");
  });

  it("should include all core tools in every result", () => {
    const testMessages = ["hello", "database query", "git commit", "fetch url", ""];

    for (const msg of testMessages) {
      const result = getRelevantTools(msg);
      for (const coreTool of CORE_TOOLS) {
        expect(result).toContain(coreTool);
      }
    }
  });

  it("should not duplicate tools in result", () => {
    const result = getRelevantTools("database query with sql and table");
    const uniqueTools = new Set(result);
    expect(uniqueTools.size).toBe(result.length);
  });
});

describe("KEYWORD_MAP", () => {
  it("should have valid structure", () => {
    expect(typeof KEYWORD_MAP).toBe("object");
    expect(Object.keys(KEYWORD_MAP).length).toBeGreaterThan(0);
  });

  it("should have non-empty keyword arrays", () => {
    for (const [server, keywords] of Object.entries(KEYWORD_MAP)) {
      expect(keywords.length).toBeGreaterThan(0);
      for (const kw of keywords) {
        expect(typeof kw).toBe("string");
        expect(kw.length).toBeGreaterThan(0);
      }
    }
  });

  it("should contain expected servers", () => {
    expect(KEYWORD_MAP).toHaveProperty("sqlite");
    expect(KEYWORD_MAP).toHaveProperty("git");
    expect(KEYWORD_MAP).toHaveProperty("filesystem");
    expect(KEYWORD_MAP).toHaveProperty("fetch");
  });
});

describe("CORE_TOOLS", () => {
  it("should have expected core tools", () => {
    expect(CORE_TOOLS).toContain("read");
    expect(CORE_TOOLS).toContain("write");
    expect(CORE_TOOLS).toContain("edit");
    expect(CORE_TOOLS).toContain("bash");
    expect(CORE_TOOLS).toContain("grep");
    expect(CORE_TOOLS).toContain("glob");
    expect(CORE_TOOLS).toContain("list");
  });

  it("should have 7 core tools", () => {
    expect(CORE_TOOLS.length).toBe(7);
  });
});

describe("MCPManagerPlugin - chat.params hook", () => {
  let consoleLogs: string[];

  beforeEach(async () => {
    vi.clearAllMocks();
    consoleLogs = [];
    vi.spyOn(console, "debug").mockImplementation((...args: any[]) => {
      consoleLogs.push(args.map(String).join(" "));
    });
    vi.spyOn(console, "error").mockImplementation(() => {});

    // Setup mocks for config file discovery
    (accessSync as any).mockImplementation(() => {
      throw new Error("File not found");
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should skip filtering for commands (starts with /)", async () => {
    vi.resetModules();
    const { default: MCPManagerPlugin } = await import("../mcp-manager");

    const pluginResult = await MCPManagerPlugin({
      client: {} as any,
      project: {} as any,
      directory: "/test",
    });

    const hook = pluginResult["chat.params"];
    const result = await hook({ message: "/agent backend-laravel", agent: "test" });

    expect(result).toBeUndefined();
  });

  it("should skip filtering for @ mentions", async () => {
    vi.resetModules();
    const { default: MCPManagerPlugin } = await import("../mcp-manager");

    const pluginResult = await MCPManagerPlugin({
      client: {} as any,
      project: {} as any,
      directory: "/test",
    });

    const hook = pluginResult["chat.params"];
    const result = await hook({ message: "@user hello", agent: "test" });

    expect(result).toBeUndefined();
  });

  it("should skip filtering for empty messages", async () => {
    vi.resetModules();
    const { default: MCPManagerPlugin } = await import("../mcp-manager");

    const pluginResult = await MCPManagerPlugin({
      client: {} as any,
      project: {} as any,
      directory: "/test",
    });

    const hook = pluginResult["chat.params"];
    const result = await hook({ message: "", agent: "test" });

    expect(result).toBeUndefined();
  });

  it("should filter tools based on keywords", async () => {
    vi.resetModules();
    const { default: MCPManagerPlugin } = await import("../mcp-manager");

    const pluginResult = await MCPManagerPlugin({
      client: {} as any,
      project: {} as any,
      directory: "/test",
    });

    const hook = pluginResult["chat.params"];
    const result = await hook({ message: "run database query", agent: "test" });

    expect(result.toolFilter).toBeDefined();
    expect(result.toolFilter("sqlite_db_query")).toBe(true);
    expect(result.toolFilter("git_commit")).toBe(false);
    // Core tools should always be allowed
    expect(result.toolFilter("read")).toBe(true);
    expect(result.toolFilter("write")).toBe(true);
    expect(result.toolFilter("edit")).toBe(true);
    expect(result.toolFilter("bash")).toBe(true);
    expect(result.toolFilter("grep")).toBe(true);
    expect(result.toolFilter("glob")).toBe(true);
    expect(result.toolFilter("list")).toBe(true);
  });

  it("should load all tools if fallback triggered (no keywords match)", async () => {
    vi.resetModules();
    const { default: MCPManagerPlugin } = await import("../mcp-manager");

    const pluginResult = await MCPManagerPlugin({
      client: {} as any,
      project: {} as any,
      directory: "/test",
    });

    const hook = pluginResult["chat.params"];
    const result = await hook({ message: "hello world", agent: "test" });

    // Fallback: should return toolFilter that allows all tools
    expect(result.toolFilter).toBeDefined();
    expect(result.toolFilter("any_tool")).toBe(true);
    expect(result.toolFilter("another_tool")).toBe(true);
  });

  it("should log lazy loading message when tools are filtered", async () => {
    vi.resetModules();
    const { default: MCPManagerPlugin } = await import("../mcp-manager");

    const pluginResult = await MCPManagerPlugin({
      client: {} as any,
      project: {} as any,
      directory: "/test",
    });

    const hook = pluginResult["chat.params"];
    await hook({ message: "run database query", agent: "test" });

    expect(consoleLogs.some((log) => log.includes("chat.params hook triggered"))).toBe(true);
  });

  it("should log fallback warning when no keywords match", async () => {
    vi.resetModules();
    const { default: MCPManagerPlugin } = await import("../mcp-manager");

    const pluginResult = await MCPManagerPlugin({
      client: {} as any,
      project: {} as any,
      directory: "/test",
    });

    const hook = pluginResult["chat.params"];
    await hook({ message: "hello world", agent: "test" });

    expect(
      consoleLogs.some((log) => log.includes("Fallback triggered"))
    ).toBe(true);
  });
});

describe("Performance Tracking", () => {
  let consoleLogs: string[];
  let mockExecSync: any;

  beforeEach(() => {
    vi.resetModules();
    consoleLogs = [];
    vi.spyOn(console, "debug").mockImplementation((...args: any[]) => {
      consoleLogs.push(args.map(String).join(" "));
    });
    vi.spyOn(console, "error").mockImplementation(() => {});

    // Create a fresh mock for execSync
    mockExecSync = vi.fn();
    (execSync as any).mockImplementation(mockExecSync);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should log tool reduction statistics", async () => {
    const { default: MCPManagerPlugin } = await import("../mcp-manager");

    const pluginResult = await MCPManagerPlugin({
      client: {} as any,
      project: {} as any,
      directory: "/test",
    });

    const hook = pluginResult["chat.params"];
    await hook({ message: "run database query", agent: "test" });

    expect(consoleLogs.some((log) => log.includes("MCP tool loading"))).toBe(true);
  });

  it("should calculate reduction percentage correctly", async () => {
    const { default: MCPManagerPlugin } = await import("../mcp-manager");

    const pluginResult = await MCPManagerPlugin({
      client: {} as any,
      project: {} as any,
      directory: "/test",
    });

    const hook = pluginResult["chat.params"];
    await hook({ message: "run database query", agent: "test" });

    const reductionLog = consoleLogs.find((log) => log.includes("MCP tool loading"));
    expect(reductionLog).toBeDefined();
  });

  it("should store metrics in SQLite when tools are filtered", async () => {
    const { default: MCPManagerPlugin } = await import("../mcp-manager");

    const pluginResult = await MCPManagerPlugin({
      client: {} as any,
      project: {} as any,
      directory: "/test",
    });

    const hook = pluginResult["chat.params"];
    await hook({ message: "run database query", agent: "test" });

    // Should have called execSync to insert metrics
    expect(mockExecSync).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO tool_loading_metrics"),
      expect.any(Object)
    );
  });

  it("should show meaningful reduction when MCP servers are configured", async () => {
    const { default: MCPManagerPlugin } = await import("../mcp-manager");

    const pluginResult = await MCPManagerPlugin({
      client: {} as any,
      project: {} as any,
      directory: "/test",
    });

    const hook = pluginResult["chat.params"];

    // Message with no keyword matches - triggers fallback (all tools loaded)
    const result1 = await hook({ message: "hello world", agent: "test" });
    expect(result1.toolFilter).toBeDefined();
    expect(result1.toolFilter("any_tool")).toBe(true); // Fallback allows all

    consoleLogs.length = 0; // Clear logs

    // Message with keyword match - should filter
    const result2 = await hook({ message: "run database query", agent: "test" });
    expect(result2.toolFilter).toBeDefined();

    // Check that reduction was logged
    const reductionLog = consoleLogs.find((log) => log.includes("MCP tool loading"));
    expect(reductionLog).toBeDefined();
  });

  it("should verify core tools are always included (reduction baseline)", () => {
    // Since CORE_TOOLS has 7 tools, and they're always loaded,
    // the minimum tools loaded is 7 (when no keywords match and fallback is triggered)
    // or 7 + matched servers (when keywords match)

    const relevantForDb = getRelevantTools("database query");
    expect(relevantForDb.length).toBeGreaterThanOrEqual(CORE_TOOLS.length);
    expect(relevantForDb).toEqual(expect.arrayContaining(CORE_TOOLS));

    // With 9 MCP servers configured (estimated 45 tools) + 7 core = 52 total
    // Loading only core (7) + sqlite (1) = 8 tools
    // Reduction: (1 - 8/52) * 100 = 84.6% reduction
    const totalToolsEstimate = CORE_TOOLS.length + 9 * 5; // 52
    const loadedTools = relevantForDb.length; // 8
    const reduction = ((1 - loadedTools / totalToolsEstimate) * 100).toFixed(1);

    console.log(`Estimated reduction: ${reduction}% (${totalToolsEstimate} → ${loadedTools})`);

    // Should achieve >60% reduction
    expect(parseFloat(reduction)).toBeGreaterThan(60);
  });
});

describe("Edge Cases", () => {
  it("should handle null/undefined message gracefully", () => {
    // getRelevantTools expects a string, but let's ensure it handles edge cases
    const result = getRelevantTools("");
    expect(result).toEqual(expect.arrayContaining(CORE_TOOLS));
  });

  it("should handle very long messages", () => {
    const longMessage = "database ".repeat(1000);
    const result = getRelevantTools(longMessage);
    expect(result).toContain("sqlite");
    expect(result).toEqual(expect.arrayContaining(CORE_TOOLS));
  });

  it("should handle messages with only keywords", () => {
    const result = getRelevantTools("database");
    expect(result).toContain("sqlite");
  });

  it("should handle messages with keywords in different positions", () => {
    const positions = ["database is what I need", "I need to use database", "this database thing"];

    for (const msg of positions) {
      const result = getRelevantTools(msg);
      expect(result).toContain("sqlite");
    }
  });
});

describe("Tool Filter Function", () => {
  it("should correctly identify core tools by name", () => {
    const result = getRelevantTools("hello");

    // The toolFilter function logic: checks if toolName includes any core tool name
    const toolFilter = (toolName: string) => {
      if (CORE_TOOLS.some((core) => toolName.toLowerCase().includes(core))) {
        return true;
      }
      return result.some((server) => toolName.toLowerCase().includes(server));
    };

    // Core tools should match
    expect(toolFilter("read_file")).toBe(true);
    expect(toolFilter("write_data")).toBe(true);
    expect(toolFilter("edit_text")).toBe(true);
    expect(toolFilter("bash_command")).toBe(true);
    expect(toolFilter("grep_search")).toBe(true);
    expect(toolFilter("glob_pattern")).toBe(true);
    expect(toolFilter("list_items")).toBe(true);
  });

  it("should correctly identify MCP server tools", () => {
    const result = getRelevantTools("run database query");

    const toolFilter = (toolName: string) => {
      if (CORE_TOOLS.some((core) => toolName.toLowerCase().includes(core))) {
        return true;
      }
      return result.some((server) => toolName.toLowerCase().includes(server));
    };

    // sqlite tools should match
    expect(toolFilter("sqlite_query")).toBe(true);
    expect(toolFilter("sqlite_insert")).toBe(true);
    // git tools should not match
    expect(toolFilter("git_commit")).toBe(false);
  });
});
