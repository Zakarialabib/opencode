import { readFileSync, readdirSync, statSync } from "fs";
import { join, extname, relative } from "path";
import { createHash } from "crypto";
import { getDatabase } from "../store/index.js";
import { getEmbeddings } from "./dense.js";
import { isVectorActive } from "../store/vec.js";

const IGNORE_DIRS = new Set([
  "node_modules",
  ".git",
  "target",
  "vendor",
  ".next",
  "dist",
  "build",
  ".opencode",
  "cache",
  "__pycache__",
  ".venv",
  "venv",
  "out",
  ".cache",
]);

const ALLOWED_EXTS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".rs",
  ".py",
  ".php",
  ".css",
  ".scss",
  ".json",
  ".md",
  ".html",
  ".vue",
  ".svelte",
  ".go",
  ".java",
  ".kt",
  ".swift",
  ".yaml",
  ".yml",
  ".toml",
  ".prisma",
  ".sql",
]);

interface FileInfo {
  path: string;
  mtime: number;
  size: number;
  hash: string;
}

interface ChunkResult {
  id: string;
  filepath: string;
  language: string;
  type: string;
  name: string;
  start_line: number;
  end_line: number;
  content: string;
}

function computeHash(content: string): string {
  return createHash("sha256").update(content).digest("hex").slice(0, 16);
}

function detectLanguage(filePath: string): string {
  const ext = extname(filePath).toLowerCase();
  const langMap: Record<string, string> = {
    ".ts": "typescript",
    ".tsx": "typescriptreact",
    ".js": "javascript",
    ".jsx": "javascriptreact",
    ".rs": "rust",
    ".py": "python",
    ".php": "php",
    ".css": "css",
    ".scss": "scss",
    ".json": "json",
    ".md": "markdown",
    ".html": "html",
    ".vue": "vue",
    ".svelte": "svelte",
    ".go": "go",
    ".java": "java",
    ".kt": "kotlin",
    ".swift": "swift",
    ".yaml": "yaml",
    ".yml": "yaml",
    ".toml": "toml",
    ".prisma": "prisma",
    ".sql": "sql",
  };
  return langMap[ext] || "text";
}

function walkFiles(rootDir: string): string[] {
  const files: string[] = [];

  function walk(dir: string) {
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.startsWith(".")) continue;
      const fullPath = join(dir, entry);
      try {
        const stat = statSync(fullPath);
        if (stat.isDirectory()) {
          if (!IGNORE_DIRS.has(entry)) walk(fullPath);
        } else if (stat.isFile() && ALLOWED_EXTS.has(extname(entry))) {
          files.push(fullPath);
        }
      } catch {}
    }
  }

  walk(rootDir);
  return files;
}

function getStaleFiles(rootDir: string, db: ReturnType<typeof getDatabase>): string[] {
  const allFiles = walkFiles(rootDir);
  const stale: string[] = [];

  for (const filePath of allFiles) {
    const relPath = relative(rootDir, filePath);
    try {
      const stat = statSync(filePath);
      const existing = db.prepare("SELECT mtime, hash FROM files WHERE path = ?").get(relPath) as
        | { mtime: number; hash: string }
        | undefined;

      if (!existing) {
        stale.push(filePath);
      } else {
        const mtime = stat.mtimeMs;
        if (mtime > existing.mtime) {
          stale.push(filePath);
        }
      }
    } catch {
      stale.push(filePath);
    }
  }

  return stale;
}

function semanticChunkFile(filePath: string, content: string): ChunkResult[] {
  const lang = detectLanguage(filePath);
  const lines = content.split("\n");

  const blockStartPatterns = [
    /^(export\s+)?(async\s+)?function\s/,
    /^(export\s+)?(async\s+)?const\s+\w+\s*[=(]/,
    /^(export\s+)?class\s/,
    /^(export\s+)?interface\s/,
    /^(export\s+)?type\s/,
    /^(export\s+)?enum\s/,
    /^(pub\s+)?fn\s/,
    /^(pub\s+)?async\s+fn\s/,
    /^def\s/,
    /^class\s/,
    /^async\s+def\s/,
    /^pub\s+def\s/,
  ];

  const boundaries: number[] = [0];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === "" && i + 1 < lines.length && lines[i + 1].trim() !== "") {
      const nextTrimmed = lines[i + 1].trimStart();
      if (blockStartPatterns.some((p) => p.test(nextTrimmed))) {
        boundaries.push(i + 1);
        continue;
      }
    }
    const trimmed = line.trimStart();
    if (blockStartPatterns.some((p) => p.test(trimmed))) {
      boundaries.push(i);
    }
  }

  if (boundaries.length < 2) {
    return chunkFile(filePath, content);
  }

  const chunks: ChunkResult[] = [];
  const maxChunkSize = 50;
  const fileName = filePath.split(/[/\\]/).pop() || filePath;

  let i = 0;
  while (i < boundaries.length) {
    const startLine = boundaries[i];
    let endLine = startLine + maxChunkSize;
    if (i + 1 < boundaries.length) {
      endLine = Math.min(boundaries[i + 1], startLine + maxChunkSize * 2);
    }
    endLine = Math.min(endLine, lines.length);

    const chunkContent = lines.slice(startLine, endLine).join("\n");
    if (chunkContent.trim().length >= 10) {
      const id = computeHash(`${filePath}:${startLine}:${endLine}:${chunkContent.slice(0, 100)}`);
      chunks.push({
        id,
        filepath: filePath,
        language: lang,
        type: "semantic_chunk",
        name: lines[startLine].trim().slice(0, 60) || `${fileName}:${startLine + 1}`,
        start_line: startLine + 1,
        end_line: endLine,
        content: chunkContent,
      });
    }

    const currentLen = endLine - startLine;
    i++;
    while (i < boundaries.length && boundaries[i] - startLine < maxChunkSize) {
      i++;
    }
  }

  return chunks.length > 0 ? chunks : chunkFile(filePath, content);
}

function chunkFile(filePath: string, content: string): ChunkResult[] {
  const lines = content.split("\n");
  const chunks: ChunkResult[] = [];
  const lang = detectLanguage(filePath);
  const chunkSize = 50;
  const overlap = 10;
  const fileName = filePath.split(/[/\\]/).pop() || filePath;

  for (let i = 0; i < lines.length; i += chunkSize - overlap) {
    const end = Math.min(i + chunkSize, lines.length);
    const chunkContent = lines.slice(i, end).join("\n");
    if (chunkContent.trim().length < 10) continue;

    const id = computeHash(`${filePath}:${i}:${end}:${chunkContent.slice(0, 100)}`);

    chunks.push({
      id,
      filepath: filePath,
      language: lang,
      type: "code",
      name: `${fileName}:${i + 1}`,
      start_line: i + 1,
      end_line: end,
      content: chunkContent,
    });
  }

  return chunks;
}

function updateFileRecord(
  relPath: string,
  mtime: number,
  size: number,
  hash: string,
  chunkCount: number,
  db: ReturnType<typeof getDatabase>
) {
  db.prepare(`
    INSERT OR REPLACE INTO files (path, mtime, size, hash, indexed_at, chunk_count)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(relPath, mtime, size, hash, Date.now(), chunkCount);
}

function deleteFileRecord(relPath: string, db: ReturnType<typeof getDatabase>) {
  db.transaction(() => {
    const chunks = db.prepare("SELECT id FROM chunks WHERE filepath = ?").all(relPath) as Array<{
      id: string;
    }>;
    for (const chunk of chunks) {
      try {
        db.prepare(
          "DELETE FROM chunk_embeddings WHERE rowid IN (SELECT rowid FROM chunks WHERE id = ?)"
        ).run(chunk.id);
      } catch {}
      try {
        db.prepare(
          "DELETE FROM chunk_embeddings_nomic WHERE rowid IN (SELECT rowid FROM chunks WHERE id = ?)"
        ).run(chunk.id);
      } catch {}
      db.prepare("DELETE FROM concept_chunks WHERE chunk_id = ?").run(chunk.id);
      db.prepare(
        "DELETE FROM fts_chunks WHERE rowid IN (SELECT rowid FROM chunks WHERE id = ?)"
      ).run(chunk.id);
    }
    db.prepare("DELETE FROM chunks WHERE filepath = ?").run(relPath);
    db.prepare("DELETE FROM files WHERE path = ?").run(relPath);
  })();
}

export async function indexProject(rootDir: string): Promise<ChunkResult[]> {
  const db = getDatabase(rootDir);
  const allNewChunks: ChunkResult[] = [];

  const staleFiles = getStaleFiles(rootDir, db);

  for (const filePath of staleFiles) {
    try {
      const content = readFileSync(filePath, "utf-8");
      const relPath = relative(rootDir, filePath);
      const stat = statSync(filePath);
      const contentHash = computeHash(content);

      deleteFileRecord(relPath, db);

      const chunks = semanticChunkFile(filePath, content);
      const textChunks = chunks.map((c) => c.content);

      let embeddings: number[][] = [];
      let modelType: "qwen" | "nomic" = "qwen";
      try {
        const result = await awaitEmbeddings(rootDir, textChunks);
        embeddings = result.vectors;
        modelType = result.modelType;
      } catch (e: any) {
        console.warn(
          `[Brain/Indexer] Embedding failed for ${relPath}, indexing without vectors: ${e.message}`
        );
      }

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        db.prepare(`
          INSERT OR REPLACE INTO chunks (id, filepath, language, type, name, start_line, end_line, content, content_hash, indexed_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          chunk.id,
          relPath,
          chunk.language,
          chunk.type,
          chunk.name,
          chunk.start_line,
          chunk.end_line,
          chunk.content,
          contentHash,
          Date.now()
        );

        db.prepare(`
          INSERT OR REPLACE INTO fts_chunks (rowid, filepath, content)
          VALUES ((SELECT rowid FROM chunks WHERE id = ?), ?, ?)
        `).run(chunk.id, relPath, chunk.content);

        if (embeddings[i]) {
          const tableName = modelType === "qwen" ? "chunk_embeddings" : "chunk_embeddings_nomic";
          if (isVectorActive(db)) {
            try {
              db.prepare(
                `INSERT OR REPLACE INTO ${tableName}(rowid, embedding) VALUES ((SELECT rowid FROM chunks WHERE id = ?), ?)`
              ).run(chunk.id, new Float32Array(embeddings[i]));
            } catch (e: any) {
              console.warn(
                `[Brain/Indexer] Vector insert failed for chunk ${chunk.id}: ${e.message}`
              );
            }
          }
        }
      }

      updateFileRecord(relPath, stat.mtimeMs, stat.size, contentHash, chunks.length, db);
      allNewChunks.push(...chunks);
    } catch (e: any) {
      console.warn(`[Brain/Indexer] Failed to index ${filePath}: ${e.message}`);
    }
  }

  return allNewChunks;
}

function awaitEmbeddings(
  projectRoot: string,
  texts: string[]
): Promise<{ vectors: number[][]; modelType: "qwen" | "nomic" }> {
  return getEmbeddings(projectRoot, texts);
}
