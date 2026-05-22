import { createDatabase, type BrainDatabase } from "./driver.js";
import { getLoadablePath } from "sqlite-vec";
import * as path from "path";
import * as fs from "fs";
import { initializeVectorTables } from "./vec.js";
import { initializeFTSTables } from "./fts.js";

let dbInstance: BrainDatabase | null = null;
let dbPathResolve = "";

/**
 * Gets or initializes the isolated SQLite database for the brain plugin.
 * Located at projectRoot/.opencode/brain.db.
 */
export function getDatabase(projectRoot: string): BrainDatabase {
  if (dbInstance) return dbInstance;

  const opencodeDir = path.join(projectRoot, ".opencode");
  if (!fs.existsSync(opencodeDir)) {
    fs.mkdirSync(opencodeDir, { recursive: true });
  }

  dbPathResolve = path.join(opencodeDir, "brain.db");
  console.log(`[Brain/Store] Opening database at: ${dbPathResolve}`);

  const db = createDatabase(dbPathResolve);

  // Load the sqlite-vec extension for vector queries
  try {
    const loadablePath = getLoadablePath();
    db.loadExtension(loadablePath);
    console.log("[Brain/Store] Loaded sqlite-vec extension successfully");
  } catch (error: any) {
    console.error("[Brain/Store] Failed to load sqlite-vec extension:", error.message);
    console.warn("[Brain/Store] Continuing in DEGRADED MODE (FTS5 keyword search only)");
  }

  // Optimize SQLite performance for RAG operations
  db.pragma("journal_mode = WAL");
  db.pragma("synchronous = NORMAL");
  db.pragma("temp_store = MEMORY");
  db.pragma("foreign_keys = ON");

  dbInstance = db;
  initializeTables(db);
  runMigrations(db);
  initializeVectorTables(db);
  initializeFTSTables(db);

  return db;
}

/**
 * Automatically executes database schema migrations.
 * Prevents schema blocks and manages non-blocking background re-indexing flags.
 */
function runMigrations(db: BrainDatabase): void {
  // Create schema_version table if not exists
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER PRIMARY KEY,
      applied_at INTEGER NOT NULL
    )
  `);

  // Get current schema version
  let currentVersion = 0;
  try {
    const row = db.prepare("SELECT MAX(version) as version FROM schema_version").get() as {
      version: number | null;
    };
    if (row && row.version !== null) {
      currentVersion = row.version;
    }
  } catch {}

  const now = Date.now();

  // Migration 1: Deactivate legacy Porter Stemmer in favor of exact unicode61 tokenization
  if (currentVersion < 1) {
    console.log(
      `[Brain/Store] Executing database Migration 1 (porter -> unicode61 tokenization)...`
    );

    db.transaction(() => {
      // Drop virtual table if it exists to clean up porter schema
      db.exec("DROP TABLE IF EXISTS fts_chunks");

      // Recreate FTS5 table with exact unicode61 tokenization
      db.exec(`
        CREATE VIRTUAL TABLE IF NOT EXISTS fts_chunks USING fts5(
          chunk_id UNINDEXED,
          filepath UNINDEXED,
          content,
          tokenize="unicode61"
        )
      `);

      // Set non-blocking reindex trigger flag inside config
      db.prepare(`
        INSERT OR REPLACE INTO config (key, value, updated_at) 
        VALUES ('needs_reindex', 'true', ?)
      `).run(now);

      // Record applied migration version
      db.prepare("INSERT INTO schema_version (version, applied_at) VALUES (1, ?)").run(now);
    })();

    console.log("[Brain/Store] Migration 1 successfully applied!");
  }

  if (currentVersion < 2) {
    console.log("[Brain/Store] Executing database Migration 2 (telemetry tables)...");

    db.transaction(() => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS telemetry_runs (
          id TEXT PRIMARY KEY,
          started_at INTEGER NOT NULL,
          ended_at INTEGER,
          duration_ms INTEGER,
          kind TEXT NOT NULL,
          name TEXT NOT NULL,
          session_id TEXT,
          trace_id TEXT,
          status TEXT NOT NULL,
          meta_json TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_telemetry_runs_started_at ON telemetry_runs(started_at);
        CREATE INDEX IF NOT EXISTS idx_telemetry_runs_session_id ON telemetry_runs(session_id);
        CREATE INDEX IF NOT EXISTS idx_telemetry_runs_trace_id ON telemetry_runs(trace_id);
        CREATE INDEX IF NOT EXISTS idx_telemetry_runs_kind ON telemetry_runs(kind);
      `);

      db.exec(`
        CREATE TABLE IF NOT EXISTS telemetry_events (
          id TEXT PRIMARY KEY,
          ts INTEGER NOT NULL,
          trace_id TEXT,
          session_id TEXT,
          level TEXT NOT NULL,
          category TEXT NOT NULL,
          message TEXT NOT NULL,
          extra_json TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_telemetry_events_ts ON telemetry_events(ts);
        CREATE INDEX IF NOT EXISTS idx_telemetry_events_trace_id ON telemetry_events(trace_id);
        CREATE INDEX IF NOT EXISTS idx_telemetry_events_session_id ON telemetry_events(session_id);
        CREATE INDEX IF NOT EXISTS idx_telemetry_events_level ON telemetry_events(level);
      `);

      db.prepare("INSERT INTO schema_version (version, applied_at) VALUES (2, ?)").run(now);
    })();

    console.log("[Brain/Store] Migration 2 successfully applied!");
  }

  if (currentVersion < 3) {
    console.log("[Brain/Store] Executing database Migration 3 (learning loop tables)...");

    db.transaction(() => {
      // Agent outcomes: captures tool execution results and LSP diagnostics
      db.exec(`
        CREATE TABLE IF NOT EXISTS agent_outcomes (
          id TEXT PRIMARY KEY,
          timestamp INTEGER NOT NULL,
          agent_name TEXT NOT NULL,
          task_desc TEXT NOT NULL,
          tool_name TEXT,
          file_path TEXT,
          outcome TEXT NOT NULL CHECK(outcome IN ('success', 'failure', 'partial')),
          details TEXT,
          pattern_type TEXT,
          meta_json TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_agent_outcomes_ts ON agent_outcomes(timestamp);
        CREATE INDEX IF NOT EXISTS idx_agent_outcomes_agent ON agent_outcomes(agent_name);
        CREATE INDEX IF NOT EXISTS idx_agent_outcomes_pattern ON agent_outcomes(pattern_type);
      `);

      // Agent patterns: recurring issues detected from outcomes
      db.exec(`
        CREATE TABLE IF NOT EXISTS agent_patterns (
          id TEXT PRIMARY KEY,
          agent_name TEXT NOT NULL,
          pattern_type TEXT NOT NULL,
          confidence REAL NOT NULL DEFAULT 0.0,
          suggestion TEXT NOT NULL,
          occurrence_count INTEGER NOT NULL DEFAULT 1,
          first_seen INTEGER NOT NULL,
          last_seen INTEGER NOT NULL,
          active INTEGER NOT NULL DEFAULT 1,
          suppression_count INTEGER NOT NULL DEFAULT 0,
          meta_json TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_agent_patterns_agent ON agent_patterns(agent_name);
        CREATE INDEX IF NOT EXISTS idx_agent_patterns_type ON agent_patterns(pattern_type);
        CREATE INDEX IF NOT EXISTS idx_agent_patterns_active ON agent_patterns(active);
      `);

      // Prompt overrides: applied modifications to agent prompts
      db.exec(`
        CREATE TABLE IF NOT EXISTS prompt_overrides (
          id TEXT PRIMARY KEY,
          agent_name TEXT NOT NULL,
          instruction TEXT NOT NULL,
          source_pattern_id TEXT NOT NULL,
          source_pattern_type TEXT NOT NULL,
          enabled INTEGER NOT NULL DEFAULT 1,
          created_at INTEGER NOT NULL,
          applied_at INTEGER,
          last_verified_at INTEGER
        );
        CREATE INDEX IF NOT EXISTS idx_prompt_overrides_agent ON prompt_overrides(agent_name);
        CREATE INDEX IF NOT EXISTS idx_prompt_overrides_enabled ON prompt_overrides(enabled);
      `);

      db.prepare("INSERT INTO schema_version (version, applied_at) VALUES (3, ?)").run(now);
    })();

    console.log("[Brain/Store] Migration 3 successfully applied!");
  }
}

/**
 * Creates the standard relational schema for chunks, files, concepts, sessions, and config.
 */
function initializeTables(db: BrainDatabase): void {
  // 1. Files table for incremental file modification tracking
  db.exec(`
    CREATE TABLE IF NOT EXISTS files (
      path TEXT PRIMARY KEY,
      mtime INTEGER NOT NULL,
      size INTEGER NOT NULL,
      hash TEXT NOT NULL,
      indexed_at INTEGER NOT NULL,
      chunk_count INTEGER NOT NULL
    )
  `);

  // 2. Chunks table - Content-addressable chunks (Blake3/sha256 hash as primary key)
  db.exec(`
    CREATE TABLE IF NOT EXISTS chunks (
      id TEXT PRIMARY KEY,
      filepath TEXT NOT NULL,
      language TEXT,
      type TEXT,
      name TEXT,
      start_line INTEGER NOT NULL,
      end_line INTEGER NOT NULL,
      parent_id TEXT,
      content TEXT NOT NULL,
      content_hash TEXT NOT NULL,
      indexed_at INTEGER NOT NULL,
      access_count INTEGER DEFAULT 0,
      last_accessed INTEGER,
      FOREIGN KEY (filepath) REFERENCES files(path) ON DELETE CASCADE,
      FOREIGN KEY (parent_id) REFERENCES chunks(id) ON DELETE SET NULL
    );
    CREATE INDEX IF NOT EXISTS idx_chunks_filepath ON chunks(filepath);
    CREATE INDEX IF NOT EXISTS idx_chunks_parent ON chunks(parent_id);
  `);

  // 3. Concepts table for relational cross-session concepts memory
  db.exec(`
    CREATE TABLE IF NOT EXISTS concepts (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      first_seen INTEGER NOT NULL,
      last_seen INTEGER NOT NULL,
      session_count INTEGER DEFAULT 1
    )
  `);

  // 4. Concept chunks mapping (Many-to-Many with strength)
  db.exec(`
    CREATE TABLE IF NOT EXISTS concept_chunks (
      concept_id TEXT,
      chunk_id TEXT,
      strength REAL DEFAULT 1.0,
      PRIMARY KEY (concept_id, chunk_id),
      FOREIGN KEY (concept_id) REFERENCES concepts(id) ON DELETE CASCADE,
      FOREIGN KEY (chunk_id) REFERENCES chunks(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_concept_chunks_chunk ON concept_chunks(chunk_id);
  `);

  // 5. Sessions table to hold metrics and attribution data for the learning loop
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      started_at INTEGER NOT NULL,
      intent TEXT,
      query TEXT NOT NULL,
      retrieved_chunks TEXT NOT NULL, -- JSON string array
      used_chunks TEXT, -- JSON string array
      user_rating INTEGER, -- +1 (good), -1 (bad)
      latency_ms INTEGER NOT NULL
    )
  `);

  // 6. Config table to store dynamically tuned RRF weights and parameters
  db.exec(`
    CREATE TABLE IF NOT EXISTS config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `);

  // Pre-seed default configuration values if empty
  const hasConfig = db.prepare("SELECT COUNT(*) as count FROM config").get() as { count: number };
  if (hasConfig.count === 0) {
    const insertConfig = db.prepare("INSERT INTO config (key, value, updated_at) VALUES (?, ?, ?)");
    const defaults = [
      ["rrf_k", "60"],
      ["rrf_dense_weight", "0.5"],
      ["rrf_sparse_weight", "0.3"],
      ["rrf_keyword_weight", "0.2"],
      ["rerank_top_k", "20"],
      ["relevance_threshold", "0.6"],
      ["max_context_tokens", "3000"],
    ];

    db.transaction(() => {
      const now = Date.now();
      for (const [k, v] of defaults) {
        insertConfig.run(k, v, now);
      }
    })();
  }

  console.log("[Brain/Store] Database tables initialized successfully");
}

/**
 * Cleanly closes the database instance when OpenCode session is archived.
 */
export function closeDatabase(): void {
  if (dbInstance) {
    console.log(`[Brain/Store] Closing database at: ${dbPathResolve}`);
    dbInstance.close();
    dbInstance = null;
  }
}
