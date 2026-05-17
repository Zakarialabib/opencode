export interface DocEntry {
  source: "npm" | "crates.io" | "packagist" | "context7";
  packageName: string;
  description: string;
  version?: string;
  docsUrl?: string;
  raw: string;
  fetchedAt: number;
  usedCount: number;
}

export class DocsStore {
  private entries: Map<string, DocEntry> = new Map();
  private maxEntries = 50;

  getKey(source: string, packageName: string): string {
    return `${source}:${packageName}`;
  }

  add(entry: DocEntry): void {
    const key = this.getKey(entry.source, entry.packageName);
    this.entries.set(key, entry);
    if (this.entries.size > this.maxEntries) {
      const oldest = this.entries.entries().next().value;
      if (oldest) this.entries.delete(oldest[0]);
    }
  }

  get(source: string, packageName: string): DocEntry | undefined {
    const key = this.getKey(source, packageName);
    const entry = this.entries.get(key);
    if (entry) {
      entry.usedCount++;
    }
    return entry;
  }

  has(source: string, packageName: string): boolean {
    return this.entries.has(this.getKey(source, packageName));
  }

  getAll(): DocEntry[] {
    return Array.from(this.entries.values());
  }

  getSummary(): string {
    if (this.entries.size === 0) return "No docs cached.";
    return [...this.entries.entries()]
      .map(([key, entry]) => `- ${key} (v${entry.version || "?"}, used ${entry.usedCount}x)`)
      .join("\n");
  }

  clear(): void {
    this.entries.clear();
  }
}

export const docsStore = new DocsStore();
