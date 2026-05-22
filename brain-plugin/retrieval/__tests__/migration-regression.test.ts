import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import BrainPlugin from "../../brain.js";
import {
  forceLMStudioFallback,
  getDenseModelStatus,
  resetDenseFailedFlag,
  unloadDensePipeline,
} from "../dense.js";
import {
  forceRerankerOff,
  getRerankerStatus,
  unloadReranker,
} from "../reranker.js";
import { chunkFile } from "../indexer.js";
import { searchProjectContext } from "../searcher.js";
import { getDatabase, closeDatabase } from "../../store/index.js";

describe("migration regression coverage", () => {
  let projectRoot: string;

  beforeEach(() => {
    projectRoot = mkdtempSync(join(tmpdir(), "opencode-brain-migration-"));
    writeFileSync(join(projectRoot, "opencode.json"), JSON.stringify({}));
  });

  afterEach(() => {
    closeDatabase();
    vi.restoreAllMocks();
    rmSync(projectRoot, { recursive: true, force: true });
  });

  it("keeps dense and reranker state transitions stable", () => {
    resetDenseFailedFlag();
    unloadDensePipeline();
    let dense = getDenseModelStatus();
    expect(dense.pipelineLoaded).toBe(false);

    forceLMStudioFallback();
    dense = getDenseModelStatus();
    expect(dense.importFailed).toBe(true);
    expect(dense.cooldownActive).toBe(true);
    expect(dense.activeModel).toContain("LM Studio fallback");

    resetDenseFailedFlag();
    dense = getDenseModelStatus();
    expect(dense.importFailed).toBe(false);
    expect(dense.cooldownActive).toBe(false);

    unloadReranker();
    let reranker = getRerankerStatus();
    expect(reranker.pipelineLoaded).toBe(false);
    expect(reranker.downloadOnly).toBe(true);

    forceRerankerOff();
    reranker = getRerankerStatus();
    expect(reranker.importFailed).toBe(true);
  });

  it("keeps dense and reranker status reported consistently after reset and unload", () => {
    resetDenseFailedFlag();
    unloadDensePipeline();
    const denseStatus = getDenseModelStatus();
    expect(denseStatus.pipelineLoaded).toBe(false);
    expect(denseStatus.importFailed).toBe(false);

    unloadReranker();
    const rerankerStatus = getRerankerStatus();
    expect(rerankerStatus.pipelineLoaded).toBe(false);
    expect(rerankerStatus.downloadOnly).toBe(true);
  });

  it("keeps indexer/searcher defensive behavior for empty content/query", async () => {
    expect(chunkFile("src/a.ts", "")).toEqual([]);
    await expect(searchProjectContext(projectRoot, "", 5, "learn")).resolves.toEqual([]);
  });

  it("writes db-backed plugin status and consumes dashboard flags without changing key contracts", async () => {
    const db = getDatabase(projectRoot);
    db.prepare("INSERT OR REPLACE INTO config (key, value, updated_at) VALUES (?, ?, ?)")
      .run("brain_reindex_request", "true", Date.now());
    db.prepare("INSERT OR REPLACE INTO config (key, value, updated_at) VALUES (?, ?, ?)")
      .run("brain_reset_request", "true", Date.now());
    db.prepare("INSERT OR REPLACE INTO config (key, value, updated_at) VALUES (?, ?, ?)")
      .run("selected_chat_model", JSON.stringify("qwen-test"), Date.now());
    db.prepare("INSERT OR REPLACE INTO config (key, value, updated_at) VALUES (?, ?, ?)")
      .run("selected_embedding_model", JSON.stringify("nomic-test"), Date.now());
    db.prepare("INSERT OR REPLACE INTO config (key, value, updated_at) VALUES (?, ?, ?)")
      .run("selected_reranker_model", JSON.stringify("rerank-test"), Date.now());
    db.prepare("INSERT OR REPLACE INTO config (key, value, updated_at) VALUES (?, ?, ?)")
      .run("provider_mode", JSON.stringify("lmstudio"), Date.now());

    const intervalFns: Array<() => void> = [];
    vi.spyOn(globalThis, "setInterval").mockImplementation(((fn: TimerHandler) => {
      if (typeof fn === "function") intervalFns.push(fn as () => void);
      return 0 as unknown as NodeJS.Timeout;
    }) as typeof setInterval);

    const plugin = await BrainPlugin({ directory: projectRoot });
    await plugin["server.start"]?.();

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(intervalFns.length).toBeGreaterThan(0);

    intervalFns[0]?.();
    await new Promise((resolve) => setTimeout(resolve, 50));

    const statusRow = db
      .prepare("SELECT value FROM config WHERE key = 'brain_plugin_status'")
      .get() as { value?: string } | undefined;
    expect(typeof statusRow?.value).toBe("string");

    const reindexRow = db
      .prepare("SELECT value FROM config WHERE key = 'brain_reindex_request'")
      .get() as { value?: string } | undefined;
    const resetRow = db
      .prepare("SELECT value FROM config WHERE key = 'brain_reset_request'")
      .get() as { value?: string } | undefined;
    expect(reindexRow?.value).toBe("false");
    expect(resetRow?.value).toBe("false");
  });
});
