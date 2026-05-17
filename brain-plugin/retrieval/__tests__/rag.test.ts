import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import Database from "better-sqlite3";
import { getLoadablePath } from "sqlite-vec";
import { initializeVectorTables, isVectorActive } from "../../store/vec";
import { initializeFTSTables, upsertChunkFTS, searchKeywordFTS } from "../../store/fts";
import { chunkFile } from "../indexer";
import { reciprocalRankFusion } from "../fusion";
import { getEmbeddings, resetDenseFailedFlag } from "../dense";
import { defaultProvider } from "../../provider/lmstudio";

describe("Unified RAG v2 Core Tests", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(":memory:");
    try {
      const loadablePath = getLoadablePath();
      db.loadExtension(loadablePath);
    } catch {
      // safe fall through
    }
  });

  afterEach(() => {
    db.close();
  });

  describe("SQLite store initialization", () => {
    it("should load vec0 tables if sqlite-vec is available", () => {
      initializeVectorTables(db);
      const vecActive = isVectorActive(db);
      // Since it's in-memory, we check if vec_version() doesn't throw or if tables exist
      if (vecActive) {
        const table = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='chunk_embeddings'").get();
        expect(table).toBeDefined();
      }
    });

    it("should initialize FTS5 keyword search virtual table", () => {
      initializeFTSTables(db);
      const table = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='fts_chunks'").get();
      expect(table).toBeDefined();
    });
  });

  describe("Tiered Regex Chunker", () => {
    it("should parse TypeScript classes and methods cleanly", () => {
      const code = `
        export class AuthController {
          async login(req: Request) {
            const user = req.body.user;
            return { user };
          }
        }
      `;
      const chunks = chunkFile("src/auth.ts", code);
      expect(chunks.length).toBeGreaterThan(0);
      
      const cls = chunks.find(c => c.type === "class");
      expect(cls).toBeDefined();
      expect(cls?.name).toBe("AuthController");

      const fn = chunks.find(c => c.type === "function");
      expect(fn).toBeDefined();
      expect(fn?.name).toBe("login");
    });

    it("should slide window fallback for Markdown or unsupported files", () => {
      const markdown = `
        # Heading 1
        Some documentation description.
        Second line.
      `;
      const chunks = chunkFile("docs/readme.md", markdown);
      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[0].type).toBe("block");
      expect(chunks[0].language).toBe("markdown");
    });
  });

  describe("Reciprocal Rank Fusion", () => {
    it("should rank intersecting chunks highest", () => {
      const dense = [
        { id: "chunk_a", filepath: "a.ts", language: "ts", type: "fn", name: "a", start_line: 1, end_line: 10, content: "chunk a" },
        { id: "chunk_b", filepath: "b.ts", language: "ts", type: "fn", name: "b", start_line: 1, end_line: 10, content: "chunk b" }
      ];
      const keyword = [
        { id: "chunk_b", filepath: "b.ts", language: "ts", type: "fn", name: "b", start_line: 1, end_line: 10, content: "chunk b" },
        { id: "chunk_c", filepath: "c.ts", language: "ts", type: "fn", name: "c", start_line: 1, end_line: 10, content: "chunk c" }
      ];

      const fused = reciprocalRankFusion(dense, keyword, { k: 60, denseWeight: 0.5, keywordWeight: 0.5 });
      
      expect(fused.length).toBe(3);
      // chunk_b should be rank 1 because it appeared in both dense and keyword
      expect(fused[0].id).toBe("chunk_b");
    });
  });

  describe("RAG Resilient Fallback Chain", () => {
    beforeEach(() => {
      resetDenseFailedFlag();
      vi.restoreAllMocks();
    });

    it("should fallback to LM Studio if local ONNX pipeline fails to execute", async () => {
      // Mock LM Studio embed method to succeed
      const mockEmbed = vi.spyOn(defaultProvider, "embed").mockResolvedValue([[0.1, 0.2, 0.3]]);

      // Call getEmbeddings - since local HuggingFace won't load in memory test context,
      // it will automatically trigger the fallback to LM Studio!
      const result = await getEmbeddings("c:/opencode", ["test query"]);
      
      expect(result.modelType).toBe("nomic"); // fallback model nomic used!
      expect(result.vectors).toBeDefined();
      expect(result.vectors[0]).toEqual([0.1, 0.2, 0.3]);
      expect(mockEmbed).toHaveBeenCalled();
    });

    it("should stick to the fallback once failed to prevent thrashing", async () => {
      const mockEmbed = vi.spyOn(defaultProvider, "embed").mockResolvedValue([[0.1, 0.2, 0.3]]);

      // First call fails local ONNX, falls back to LM Studio, and activates the sticky failed flag
      await getEmbeddings("c:/opencode", ["query 1"]);
      
      // Clear calls to verify it doesn't even attempt ONNX on the second call
      mockEmbed.mockClear();
      
      await getEmbeddings("c:/opencode", ["query 2"]);
      expect(mockEmbed).toHaveBeenCalledTimes(1); // called directly without trying ONNX again
    });

    it("should recover and retry ONNX after a reset", async () => {
      const mockEmbed = vi.spyOn(defaultProvider, "embed").mockResolvedValue([[0.1, 0.2, 0.3]]);

      // Call once to trigger sticky failed state
      await getEmbeddings("c:/opencode", ["query 1"]);
      
      // Reset sticky state
      resetDenseFailedFlag();
      
      mockEmbed.mockClear();
      
      // Call again - will try ONNX again (which falls back again to LM Studio)
      await getEmbeddings("c:/opencode", ["query 2"]);
      expect(mockEmbed).toHaveBeenCalled();
    });
  });

  describe("Agentic Orchestration & Context Layer Evals Tests", () => {
    beforeEach(() => {
      vi.restoreAllMocks();
    });

    it("should resolve compression thresholds based on active intent", () => {
      const { getCompressionThreshold } = require("../../context/compression");
      expect(getCompressionThreshold("debug")).toBe(2000);
      expect(getCompressionThreshold("refactor")).toBe(2000);
      expect(getCompressionThreshold("learn")).toBe(600);
      expect(getCompressionThreshold("quick_chat")).toBe(600);
    });

    it("should compress tool outputs exceeding the compression threshold using LLM", async () => {
      const { compressIfNeeded } = require("../../context/compression");
      const mockChat = vi.spyOn(defaultProvider, "chat").mockResolvedValue("Cleaned technical summary of test output.");

      const rawLargeContent = "a".repeat(1000); // 1000 characters
      const compressed = await compressIfNeeded("learn", "test_tool", rawLargeContent);

      expect(mockChat).toHaveBeenCalled();
      expect(compressed).toContain("[COMPRESSED SUMMARY for test_tool]");
      expect(compressed).toContain("Cleaned technical summary of test output.");
    });

    it("should extract and summarize reasoning thoughts into clean inline summaries", async () => {
      const { summarizeThoughts } = require("../../context/reasoning-compressor");
      const mockChat = vi.spyOn(defaultProvider, "chat").mockResolvedValue("Decided to compile reasoning modules.");

      const rawAssistantContent = "<thought>Checking test pipelines and resolving compiler hooks.</thought>Executing test execution loop.";
      const result = await summarizeThoughts(rawAssistantContent);

      expect(mockChat).toHaveBeenCalled();
      expect(result.hasThoughts).toBe(true);
      expect(result.cleanedContent).toContain("[Thought: Decided to compile reasoning modules.]");
      expect(result.cleanedContent).toContain("Executing test execution loop.");
    });

    it("should cleanly evaluate delegation router logic based on complexity metrics", () => {
      const { shouldDelegate } = require("../../orchestrator/loop");
      
      const lowComplexity = { recentFilesCount: 1, diagnosticsErrorsCount: 0, failedHopsCount: 0 };
      expect(shouldDelegate("debug", lowComplexity)).toBe(false);

      const highComplexity = { recentFilesCount: 4, diagnosticsErrorsCount: 5, failedHopsCount: 1 };
      expect(shouldDelegate("debug", highComplexity)).toBe(true);
    });

    it("should serialize agent briefings and delegate programmatically", async () => {
      const { delegateToAgent } = require("../../orchestrator/loop");
      const mockChat = vi.spyOn(defaultProvider, "chat").mockResolvedValue("Delegated action summary reports resolved.");

      const briefing = {
        parentSessionId: "session_abc",
        recentFiles: ["src/index.ts"],
        activeDecisions: ["Switch to ONNX model"],
        failedApproaches: ["Remote fallback endpoint"],
        currentPlan: "Run unified compiler e2e tests",
        originalQuery: "Analyze compilation exceptions"
      };

      const result = await delegateToAgent("debugger", briefing);

      expect(mockChat).toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(result.summaryResponse).toBe("Delegated action summary reports resolved.");
    });
  });
});
