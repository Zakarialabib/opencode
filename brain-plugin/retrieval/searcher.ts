import { defaultProvider, type ModelHandle } from "../provider/lmstudio";

export interface Chunk {
  text: string;
  path: string;
  startLine: number;
  endLine: number;
  mtime: number;
}

export interface RetrievalResult {
  chunks: Chunk[];
  scores?: number[];
  totalChunks: number;
}

export interface RetrievalOptions {
  strategy: string;
  depth: "shallow" | "targeted" | "broad" | "diagnostic" | "precise" | "none";
  maxChunks: number;
  rerank: boolean;
}

const LM_STUDIO_URL = "http://192.168.1.12:1234/v1";

export class Searcher {
  private provider = defaultProvider;

  async search(
    query: string,
    opts: RetrievalOptions,
    projectRoot: string,
    lspSymbols?: any[]
  ): Promise<RetrievalResult> {
    if (opts.depth === "none" || opts.maxChunks === 0) {
      return { chunks: [], totalChunks: 0 };
    }

    const handle = await this.provider.load("text-embedding-nomic-embed-text-v1.5");

    try {
      const queryEmbedding = await this.provider.embed("text-embedding-nomic-embed-text-v1.5", [query]);

      let searchResults = await this.queryVectorDB(queryEmbedding[0], opts.maxChunks * 2);

      if (opts.depth === "diagnostic" && lspSymbols?.length) {
        const diagnosticFiles = [...new Set(lspSymbols.map((s) => s.file))];
        searchResults = searchResults.filter((r) =>
          diagnosticFiles.some((df) => r.path.includes(df))
        );
        searchResults = [...searchResults, ...this.getLspContext(lspSymbols)].slice(0, opts.maxChunks);
      }

      if (opts.depth === "precise") {
        const fileLineMatches = this.extractFileLines(query);
        if (fileLineMatches.length > 0) {
          const preciseChunks = await this.loadPreciseChunks(fileLineMatches);
          searchResults = [...preciseChunks, ...searchResults].slice(0, opts.maxChunks);
        }
      }

      let chunks = searchResults.slice(0, opts.maxChunks);

      if (opts.rerank && chunks.length > 5) {
        chunks = await this.rerankChunks(query, chunks);
        chunks = chunks.slice(0, opts.maxChunks);
      }

      return {
        chunks,
        totalChunks: chunks.length,
      };
    } finally {
      await this.provider.unload(handle);
    }
  }

  private async queryVectorDB(queryEmbedding: number[], limit: number): Promise<Chunk[]> {
    try {
      const { lancadb } = await import("./lancadb");
      const results = await lancadb.query(queryEmbedding, limit);
      return results;
    } catch {
      console.log("[Brain Searcher] LanceDB not available, using mock results");
      return this.getMockResults(queryEmbedding, limit);
    }
  }

  private getMockResults(embedding: number[], limit: number): Chunk[] {
    return Array.from({ length: Math.min(limit, 5) }, (_, i) => ({
      text: `Mock chunk ${i + 1} for search`,
      path: `src/file${i}.ts`,
      startLine: (i * 40) + 1,
      endLine: (i + 1) * 40,
      mtime: Date.now(),
    }));
  }

  private getLspContext(lspSymbols: any[]): Chunk[] {
    return lspSymbols.slice(0, 10).map((s) => ({
      text: `Symbol: ${s.name} (${s.kind})`,
      path: s.file,
      startLine: s.range?.start?.line || 0,
      endLine: s.range?.end?.line || 0,
      mtime: Date.now(),
    }));
  }

  private extractFileLines(query: string): Array<{ file: string; line: number }> {
    const matches: Array<{ file: string; line: number }> = [];
    const fileLineRegex = /(\S+\.\w+):(\d+)/g;
    let match;

    while ((match = fileLineRegex.exec(query)) !== null) {
      matches.push({ file: match[1], line: parseInt(match[2], 10) });
    }

    return matches;
  }

  private async loadPreciseChunks(fileLines: Array<{ file: string; line: number }>): Promise<Chunk[]> {
    const chunks: Chunk[] = [];

    for (const { file, line } of fileLines) {
      try {
        const fs = await import("fs");
        if (fs.existsSync(file)) {
          const content = fs.readFileSync(file, "utf-8");
          const lines = content.split("\n");
          const start = Math.max(0, line - 20);
          const end = Math.min(lines.length, line + 20);
          const chunkText = lines.slice(start, end).join("\n");

          chunks.push({
            text: chunkText,
            path: file,
            startLine: start + 1,
            endLine: end,
            mtime: fs.statSync(file).mtimeMs,
          });
        }
      } catch {
        // File read failed, skip
      }
    }

    return chunks;
  }

  private async rerankChunks(query: string, chunks: Chunk[]): Promise<Chunk[]> {
    try {
      const { defaultProvider } = await import("../provider/lmstudio");
      const handle = await defaultProvider.load("text-embedding-nomic-embed-text-v1.5");

      try {
        const embeddings = await defaultProvider.embed("text-embedding-nomic-embed-text-v1.5", [query, ...chunks.map((c) => c.text)]);
        const queryEmb = embeddings[0];
        const chunkEmbeddings = embeddings.slice(1);

        const scores = chunkEmbeddings.map((emb) => this.cosineSimilarity(queryEmb, emb));

        return chunks
          .map((chunk, i) => ({ chunk, score: scores[i] }))
          .sort((a, b) => b.score - a.score)
          .map((item) => item.chunk);
      } finally {
        await defaultProvider.unload(handle);
      }
    } catch {
      return chunks;
    }
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    let dot = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
  }
}

export const searcher = new Searcher();
