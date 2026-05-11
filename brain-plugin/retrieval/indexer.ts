import { defaultProvider } from "../provider/lmstudio";
import { lancadb } from "./lancadb";

export interface Chunk {
  text: string;
  path: string;
  startLine: number;
  endLine: number;
  mtime: number;
}

export interface IndexResult {
  status: "indexed" | "fresh" | "error";
  chunks: number;
  message?: string;
}

const CHUNK_SIZE = 40;
const CHUNK_OVERLAP = 10;
const IGNORE_PATTERNS = [
  "node_modules/**",
  "target/**",
  "vendor/**",
  ".git/**",
  "dist/**",
  "build/**",
  "*.lock",
  ".next/**",
];

export class Indexer {
  async run(projectRoot: string, opts: { force?: boolean } = {}): Promise<IndexResult> {
    const fs = await import("fs");
    const path = await import("path");
    const dbPath = `${projectRoot}/.opencode/brain.lance`;

    await lancadb.initialize(dbPath);

    if (!opts.force) {
      const stats = await lancadb.getStats();
      if (stats.totalChunks > 0) {
        return { status: "fresh", chunks: stats.totalChunks };
      }
    }

    try {
      const files = await this.discoverFiles(projectRoot);
      console.log(`[Brain Indexer] Discovered ${files.length} files`);

      const allChunks: Chunk[] = [];

      for (const file of files) {
        const chunks = await this.chunkFile(file);
        allChunks.push(...chunks);
      }

      console.log(`[Brain Indexer] Generated ${allChunks.length} chunks`);

      if (allChunks.length > 0) {
        await lancadb.addChunks(allChunks);
      }

      return { status: "indexed", chunks: allChunks.length };
    } catch (error: any) {
      console.error(`[Brain Indexer] Error:`, error);
      return { status: "error", chunks: 0, message: error.message };
    }
  }

  private async discoverFiles(projectRoot: string): Promise<string[]> {
    const files: string[] = [];
    const extensions = [".ts", ".tsx", ".js", ".jsx", ".py", ".rs", ".go", ".java", ".php", ".vue", ".svelte"];

    const walkDir = async (dir: string) => {
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);

          if (entry.isDirectory()) {
            if (
              !entry.name.startsWith(".") &&
              !IGNORE_PATTERNS.some((p) => {
                if (p.endsWith("/**")) {
                  return fullPath.includes(p.replace("/**", ""));
                }
                return entry.name === p.replace("**/", "");
              })
            ) {
              await walkDir(fullPath);
            }
          } else if (entry.isFile()) {
            const ext = path.extname(entry.name).toLowerCase();
            if (extensions.includes(ext)) {
              files.push(fullPath);
            }
          }
        }
      } catch {
        // Skip directories we can't read
      }
    };

    await walkDir(projectRoot);
    return files;
  }

  private async chunkFile(filePath: string): Promise<Chunk[]> {
    try {
      const fs = await import("fs");
      const content = fs.readFileSync(filePath, "utf-8");
      const lines = content.split("\n");
      const chunks: Chunk[] = [];
      const mtime = fs.statSync(filePath).mtimeMs;

      for (let i = 0; i < lines.length; i += CHUNK_SIZE - CHUNK_OVERLAP) {
        const chunkLines = lines.slice(i, i + CHUNK_SIZE);
        const chunkText = chunkLines.join("\n").trim();

        if (chunkText.length > 20) {
          chunks.push({
            text: chunkText,
            path: filePath,
            startLine: i + 1,
            endLine: Math.min(i + CHUNK_SIZE, lines.length),
            mtime,
          });
        }
      }

      return chunks;
    } catch {
      return [];
    }
  }
}

export const indexer = new Indexer();
