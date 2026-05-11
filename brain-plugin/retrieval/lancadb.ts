import { defaultProvider } from "../provider/lmstudio";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export interface Chunk {
  text: string;
  path: string;
  startLine: number;
  endLine: number;
  mtime: number;
  vector?: number[];
}

interface LanceDBRecord {
  id: string;
  text: string;
  path: string;
  startLine: number;
  endLine: number;
  mtime: number;
  vector: number[];
}

let lancedb: any = null;

async function loadLanceDB() {
  if (lancedb) return lancedb;
  try {
    lancedb = await import("@lancedb/lancedb");
    return lancedb;
  } catch (err) {
    console.log("[Brain LanceDB] Package not found, attempting auto-install...");
    try {
      const { exec: execSync } = await import("child_process");
      execSync("bun add @lancedb/lancedb", { stdio: "inherit" });
      lancedb = await import("@lancedb/lancedb");
      console.log("[Brain LanceDB] Auto-install successful!");
      return lancedb;
    } catch (installErr) {
      console.log("[Brain LanceDB] Auto-install failed:", installErr);
      return null;
    }
  }
}

class LanceDBClient {
  private db: any = null;
  private table: any = null;
  private isConnected = false;

  async connect(dbPath: string): Promise<boolean> {
    try {
      const lib = await loadLanceDB();
      if (!lib) {
        console.log("[Brain LanceDB] LanceDB not available");
        return false;
      }
      this.db = await lib.connect(dbPath);
      this.isConnected = true;
      console.log(`[Brain LanceDB] Connected to ${dbPath}`);
      return true;
    } catch (error: any) {
      console.log("[Brain LanceDB] Connect failed:", error.message);
      this.isConnected = false;
      return false;
    }
  }

  async initialize(dbPath: string): Promise<void> {
    const connected = await this.connect(dbPath);
    if (!connected) return;

    try {
      const tableNames = await this.db.tableNames();
      if (tableNames.includes("codebase")) {
        this.table = await this.db.openTable("codebase");
        console.log("[Brain LanceDB] Opened existing 'codebase' table");
      }
    } catch (error: any) {
      console.log("[Brain LanceDB] Table init:", error.message);
    }
  }

  async addChunks(chunks: Chunk[]): Promise<void> {
    if (!chunks.length) return;
    if (!this.isConnected || !this.db) {
      console.log("[Brain LanceDB] Not connected, skipping chunk add");
      return;
    }

    try {
      const handle = await defaultProvider.load("text-embedding-nomic-embed-text-v1.5");
      try {
        const texts = chunks.map((c) => c.text);
        const embeddings = await defaultProvider.embed("text-embedding-nomic-embed-text-v1.5", texts);

        const records: LanceDBRecord[] = chunks.map((chunk, i) => ({
          id: `${chunk.path}:${chunk.startLine}-${Date.now()}-${i}`,
          text: chunk.text,
          path: chunk.path,
          startLine: chunk.startLine,
          endLine: chunk.endLine,
          mtime: chunk.mtime,
          vector: embeddings[i] || new Array(768).fill(0),
        }));

        await this.addChunksFromRecords(records);
      } finally {
        await defaultProvider.unload(handle);
      }
    } catch (error: any) {
      console.error("[Brain LanceDB] addChunks failed:", error.message);
    }
  }

  async addChunksFromRecords(records: LanceDBRecord[]): Promise<void> {
    if (!this.isConnected || !this.db) {
      console.log("[Brain LanceDB] Not connected, skipping addChunksFromRecords");
      return;
    }

    try {
      if (this.table) {
        await this.db.dropTable("codebase");
        console.log("[Brain LanceDB] Dropped existing table");
      }

      this.table = await this.db.createTable("codebase", records);
      console.log(`[Brain LanceDB] Created table with ${records.length} records`);

      try {
        await this.table.createIndex("vector", { metric: "cosine" });
        console.log("[Brain LanceDB] Created vector index");
      } catch (indexErr) {
        console.log("[Brain LanceDB] Index creation skipped (may already exist):", indexErr);
      }
    } catch (error: any) {
      console.error("[Brain LanceDB] addChunksFromRecords failed:", error.message);
    }
  }

  async query(queryEmbedding: number[], limit: number): Promise<Chunk[]> {
    if (!this.isConnected || !this.table) {
      console.log("[Brain LanceDB] Not connected or no table, returning empty");
      return [];
    }

    try {
      const results = await this.table
        .vectorSearch(queryEmbedding)
        .limit(limit)
        .toArray();

      return results.map((r: any) => ({
        text: r.text,
        path: r.path,
        startLine: r.startLine,
        endLine: r.endLine,
        mtime: r.mtime,
      }));
    } catch (error: any) {
      console.error("[Brain LanceDB] Query failed:", error.message);
      return [];
    }
  }

  async getStats(): Promise<{ totalChunks: number; lastIndexed: number }> {
    if (!this.isConnected || !this.table) {
      return { totalChunks: 0, lastIndexed: 0 };
    }

    try {
      const count = await this.table.count();
      return { totalChunks: count, lastIndexed: Date.now() };
    } catch {
      return { totalChunks: 0, lastIndexed: 0 };
    }
  }

  async isFresh(projectRoot: string): Promise<boolean> {
    return false;
  }

  isReady(): boolean {
    return this.isConnected && this.table !== null;
  }
}

export const lancadb = new LanceDBClient();
