/**
 * Dynamic SQLite driver resolver.
 *
 * Detects whether the current runtime is Bun or Node and loads the
 * appropriate SQLite driver:
 *   - Node  → better-sqlite3
 *   - Bun   → bun:sqlite (built-in) with a thin compatibility wrapper
 *
 * All downstream code should import the `BrainDatabase` / `BrainStatement`
 * types from this module instead of referencing `better-sqlite3` directly.
 */

// ---------------------------------------------------------------------------
// Public interface – the subset of better-sqlite3 that the brain plugin uses
// ---------------------------------------------------------------------------

export interface BrainStatement {
  get(...params: any[]): any;
  run(...params: any[]): any;
  all(...params: any[]): any[];
}

export interface BrainDatabase {
  prepare(sql: string): BrainStatement;
  exec(sql: string): void;
  transaction<T>(fn: (...args: any[]) => T): (...args: any[]) => T;
  pragma(pragma: string, options?: { simple?: boolean }): any;
  loadExtension(path: string): void;
  close(): void;
}

// ---------------------------------------------------------------------------
// Runtime detection
// ---------------------------------------------------------------------------

import { createRequire } from "node:module";

const isBun = typeof globalThis.Bun !== "undefined";
const requireFn = createRequire(import.meta.url);

// ---------------------------------------------------------------------------
// Bun compatibility wrapper
// ---------------------------------------------------------------------------

/**
 * Wraps a `bun:sqlite` Database instance so it satisfies `BrainDatabase`.
 * The main gap is the missing `.pragma()` method which better-sqlite3
 * provides as a convenience.  We shim it with `.exec()` / `.prepare()`.
 */
function wrapBunDatabase(BunDatabaseClass: any, filePath: string): BrainDatabase {
  const raw = new BunDatabaseClass(filePath);

  const wrapped: BrainDatabase = {
    prepare(sql: string): BrainStatement {
      return raw.prepare(sql);
    },

    exec(sql: string): void {
      raw.exec(sql);
    },

    transaction<T>(fn: (...args: any[]) => T): (...args: any[]) => T {
      return raw.transaction(fn);
    },

    pragma(pragmaStr: string, _options?: { simple?: boolean }): any {
      // better-sqlite3 accepts "journal_mode = WAL" and returns the result.
      // bun:sqlite has no .pragma(); we emulate it via prepare().
      try {
        const stmt = raw.prepare(`PRAGMA ${pragmaStr}`);
        // Some PRAGMAs return rows (e.g. journal_mode), some don't.
        try {
          return stmt.get();
        } catch {
          stmt.run();
          return undefined;
        }
      } catch {
        // Fallback: exec for PRAGMAs that cannot be prepared
        raw.exec(`PRAGMA ${pragmaStr}`);
        return undefined;
      }
    },

    loadExtension(extPath: string): void {
      raw.loadExtension(extPath);
    },

    close(): void {
      raw.close();
    },
  };

  return wrapped;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Creates a BrainDatabase instance backed by the appropriate driver.
 *
 * @param filePath  Absolute path to the SQLite database file.
 * @returns         A unified BrainDatabase handle.
 */
export function createDatabase(filePath: string): BrainDatabase {
  if (isBun) {
    // Dynamic import is not needed here — Bun resolves "bun:sqlite"
    // synchronously.  We use require() so the call stays sync.
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { Database: BunDB } = requireFn("bun:sqlite");
      console.log("[Brain/Driver] Using Bun built-in SQLite driver");
      return wrapBunDatabase(BunDB, filePath);
    } catch (err: any) {
      console.error("[Brain/Driver] Failed to load bun:sqlite:", err.message);
      throw new Error("SQLite driver unavailable in Bun runtime");
    }
  }

  // Node path — use better-sqlite3
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const BetterSqlite3 = requireFn("better-sqlite3");
    console.log("[Brain/Driver] Using better-sqlite3 driver (Node)");
    return new BetterSqlite3(filePath) as BrainDatabase;
  } catch (err: any) {
    console.error("[Brain/Driver] Failed to load better-sqlite3:", err.message);
    throw new Error(
      "SQLite driver unavailable. Install better-sqlite3 (`npm i better-sqlite3`) " +
        "or run under Bun which has built-in SQLite support."
    );
  }
}
