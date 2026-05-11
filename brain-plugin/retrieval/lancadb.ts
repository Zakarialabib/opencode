// DEPRECATED: LanceDB-based local indexing has been replaced by the Rust sidecar (brain-embed).
// All indexing and search now goes through the Rust sidecar's /index and /search endpoints.
// This file is kept for reference only and will be removed in a future cleanup.
// See: brain-plugin/rust/ for the active implementation.
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
    return null;
  }
}

class LanceDBClient {
  private db: any = null;
  private table: any = null;
  private isConnected = false;

  async connect(dbPath: string): Promise<boolean> {
    return false;
  }

  async initialize(dbPath: string): Promise<void> {}

  async addChunks(chunks: Chunk[]): Promise<void> {}

  async addChunksFromRecords(records: LanceDBRecord[]): Promise<void> {}

  async query(queryEmbedding: number[], limit: number): Promise<Chunk[]> {
    return [];
  }

  async getStats(): Promise<{ totalChunks: number; lastIndexed: number }> {
    return { totalChunks: 0, lastIndexed: 0 };
  }

  async isFresh(projectRoot: string): Promise<boolean> {
    return false;
  }

  isReady(): boolean {
    return false;
  }
}

export const lancadb = new LanceDBClient();
