import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

vi.mock("../dense.js", () => {
  return {
    getEmbeddings: vi.fn(async () => {
      const v = new Array(1024).fill(0);
      v[0] = 1;
      return { vectors: [v], modelType: "qwen" as const };
    }),
  };
});

vi.mock("../reranking-trigger.js", () => {
  const cache = new Map<string, any[]>();
  return {
    getRerankingTrigger: () => ({
      getCacheKey: (q: string, intent: string) => `${intent}:${q}`,
      getCachedReranked: (k: string) => cache.get(k),
      cacheReranked: (k: string, v: any[]) => cache.set(k, v),
      shouldRerank: () => false,
      getRerankLimit: () => 0,
      getConfig: () => ({ confidenceThreshold: 0.85 }),
    }),
    RerankingTrigger: class {},
  };
});

describe("searchProjectContext dense path uses sqlite-vec", () => {
  let projectRoot: string;

  beforeEach(async () => {
    projectRoot = mkdtempSync(join(tmpdir(), "opencode-brain-test-"));
    const { closeDatabase, getDatabase } = await import("../../store/index.js");
    closeDatabase();
    const db = getDatabase(projectRoot) as any;
    db.exec(
      `INSERT OR REPLACE INTO files (path, mtime, size, hash, indexed_at, chunk_count)
       VALUES ('src/a.ts', 0, 1, 'h', 0, 2)`
    );
    db.exec(
      `INSERT OR REPLACE INTO chunks (id, filepath, language, type, name, start_line, end_line, parent_id, content, content_hash, indexed_at)
       VALUES
       ('c1', 'src/a.ts', 'ts', 'fn', 'a', 1, 2, NULL, 'alpha', 'h1', 0),
       ('c2', 'src/a.ts', 'ts', 'fn', 'b', 3, 4, NULL, 'beta', 'h2', 0)`
    );

    const { upsertChunkEmbedding } = await import("../../store/vec.js");
    const v1 = new Array(1024).fill(0);
    v1[0] = 1;
    const v2 = new Array(1024).fill(0);
    v2[0] = 0;
    v2[1] = 1;
    upsertChunkEmbedding(db, "c1", v1, "qwen");
    upsertChunkEmbedding(db, "c2", v2, "qwen");
  });

  afterEach(async () => {
    const { closeDatabase } = await import("../../store/index.js");
    closeDatabase();
    rmSync(projectRoot, { recursive: true, force: true });
  });

  it("executes vec_distance_cosine query and returns nearest chunk first", async () => {
    const { getDatabase } = await import("../../store/index.js");
    const db = getDatabase(projectRoot) as any;
    const prepareSpy = vi.spyOn(db, "prepare");

    const { searchProjectContext } = await import("../searcher.js");
    const results = await searchProjectContext(projectRoot, "alpha", 2, "learn", 0.7);

    const sqlCalls = prepareSpy.mock.calls.map((c) => String(c[0]));
    expect(sqlCalls.some((sql) => sql.includes("vec_distance_cosine"))).toBe(true);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]?.id).toBe("c1");
  });
});

