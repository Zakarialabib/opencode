import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { DocsStore } from "../../docs-store.js";
import type { DocEntry } from "../../docs-store.js";

describe("DocsStore LRU Eviction", () => {
  let store: DocsStore;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    store = new DocsStore(3);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function makeEntry(id: string, time: number): DocEntry {
    return {
      source: "npm",
      packageName: id,
      description: `Package ${id}`,
      raw: `content-${id}`,
      fetchedAt: time,
      usedCount: 0,
      lastAccessed: time, // overwritten by add() -> Date.now()
    };
  }

  function addAt(id: string, time: number): void {
    vi.setSystemTime(time);
    store.add(makeEntry(id, time));
  }

  describe("capacity enforcement", () => {
    it("should evict the oldest entry when adding a 4th entry (maxEntries=3)", () => {
      addAt("a", 1000);
      addAt("b", 2000);
      addAt("c", 3000);

      // Still within capacity
      expect(store.getAll()).toHaveLength(3);

      // Adding a 4th triggers eviction
      addAt("d", 4000);

      expect(store.getAll()).toHaveLength(3);
      // "a" (added at 1000) is the LRU and should be evicted
      expect(store.has("npm", "a")).toBe(false);
      expect(store.has("npm", "b")).toBe(true);
      expect(store.has("npm", "c")).toBe(true);
      expect(store.has("npm", "d")).toBe(true);
    });
  });

  describe("get() updates lastAccessed and prevents eviction", () => {
    it("should keep a recently accessed entry alive instead of an untouched one", () => {
      addAt("a", 1000);
      addAt("b", 2000);
      addAt("c", 3000);
      // Now: a=1000, b=2000, c=3000

      // Access "a" at a later time, making it recently used
      vi.setSystemTime(3500);
      const entryA = store.get("npm", "a");
      expect(entryA).toBeDefined();
      expect(entryA!.lastAccessed).toBe(3500);
      expect(entryA!.usedCount).toBe(1);
      // Now: a=3500, b=2000, c=3000

      // Add "d" — should evict "b" (2000 = LRU), not "a" (3500) or "c" (3000)
      addAt("d", 4000);

      expect(store.has("npm", "a")).toBe(true);  // accessed via get() -> 3500
      expect(store.has("npm", "b")).toBe(false); // LRU: lastAccessed=2000
      expect(store.has("npm", "c")).toBe(true);  // lastAccessed=3000, newer than b
      expect(store.has("npm", "d")).toBe(true);  // just added at 4000
    });

    it("should keep entries alive when accessed before batch additions", () => {
      addAt("a", 1000);
      addAt("b", 2000);
      addAt("c", 3000);

      // Access "b" then "c" at later times
      vi.setSystemTime(3500);
      store.get("npm", "b");
      vi.setSystemTime(3600);
      store.get("npm", "c");
      // Now: a=1000, b=3500, c=3600

      // Add "d" — evicts "a" (1000 = LRU)
      addAt("d", 4000);
      expect(store.has("npm", "a")).toBe(false);
      expect(store.has("npm", "b")).toBe(true);
      expect(store.has("npm", "c")).toBe(true);
      expect(store.has("npm", "d")).toBe(true);

      // Add "e" — evicts "b" (3500 = oldest remaining)
      addAt("e", 5000);
      expect(store.has("npm", "b")).toBe(false);
      expect(store.has("npm", "c")).toBe(true);
      expect(store.has("npm", "d")).toBe(true);
      expect(store.has("npm", "e")).toBe(true);
    });
  });

  describe("get() updates timestamps and counts", () => {
    it("should update lastAccessed and increment usedCount on each access", () => {
      vi.setSystemTime(1000);
      store.add(makeEntry("x", 1000)); // add() sets lastAccessed = Date.now() = 1000

      // First access — get() uses Date.now() which is still 1000
      const entry1 = store.get("npm", "x")!;
      expect(entry1.usedCount).toBe(1);
      expect(entry1.lastAccessed).toBe(1000);

      // Advance time and access again
      vi.setSystemTime(1500);
      const entry2 = store.get("npm", "x")!;
      expect(entry2.usedCount).toBe(2);
      expect(entry2.lastAccessed).toBe(1500);
    });
  });

  describe("add() sets lastAccessed on new entries", () => {
    it("should set lastAccessed when adding and update via get()", () => {
      vi.setSystemTime(5000);
      store.add(makeEntry("z", 9999)); // add() overwrites with Date.now() = 5000

      // Advance time so get() produces a distinct timestamp
      vi.setSystemTime(7000);
      const entry = store.get("npm", "z")!;

      expect(entry.lastAccessed).toBe(7000); // set by get(), not add()
      expect(entry.usedCount).toBe(1);
    });
  });
});
