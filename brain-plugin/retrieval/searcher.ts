const BRAIN_EMBED_URL = process.env.BRAIN_EMBED_URL || "http://127.0.0.1:7878";
const LM_STUDIO_URL = process.env.BRAIN_LMSTUDIO_URL || "http://192.168.1.12:1234/v1";

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

function projectIdFromPath(projectRoot: string): string {
  let hash = 0;
  for (let i = 0; i < projectRoot.length; i++) {
    const char = projectRoot.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return `proj_${Math.abs(hash).toString(36)}`;
}

export async function searchContext(
  query: string,
  opts: RetrievalOptions,
  projectRoot?: string
): Promise<RetrievalResult> {
  if (opts.depth === "none" || opts.maxChunks === 0) {
    return { chunks: [], totalChunks: 0 };
  }

  const projectId = projectRoot ? projectIdFromPath(projectRoot) : undefined;

  const res = await fetch(`${BRAIN_EMBED_URL}/search`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query,
      top_k: opts.maxChunks,
      project_id: projectId,
    }),
  });

  if (!res.ok) {
    console.error("Search failed:", await res.text());
    return { chunks: [], totalChunks: 0 };
  }

  const results = await res.json();
  const chunks: Chunk[] = results.map((r: any) => ({
    text: r.text,
    path: r.path,
    startLine: r.start_line,
    endLine: r.start_line + r.text.split('\n').length - 1,
    mtime: 0,
  }));

  return {
    chunks,
    scores: results.map((r: any) => r.score),
    totalChunks: chunks.length,
  };
}

interface LMStudioProvider {
  embed(modelId: string, texts: string[]): Promise<number[][]>;
  defaultEmbedModel: string;
}

async function embedViaLMStudio(provider: LMStudioProvider, texts: string[]): Promise<number[][]> {
  return provider.embed(provider.defaultEmbedModel, texts);
}

async function chunkProjectFiles(projectRoot: string): Promise<Chunk[]> {
  const fs = await import("fs");
  const path = await import("path");
  const chunks: Chunk[] = [];
  const extensions = new Set([".ts", ".tsx", ".js", ".jsx", ".rs", ".php", ".css", ".json", ".md"]);

  function walkDir(dir: string) {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!entry.name.startsWith(".") && entry.name !== "node_modules" && entry.name !== "vendor" && entry.name !== "target") {
          walkDir(fullPath);
        }
      } else if (extensions.has(path.extname(entry.name))) {
        try {
          const content = fs.readFileSync(fullPath, "utf-8");
          const lines = content.split("\n");
          const chunkSize = 50;
          const overlap = 10;
          for (let i = 0; i < lines.length; i += chunkSize - overlap) {
            const end = Math.min(i + chunkSize, lines.length);
            const text = lines.slice(i, end).join("\n");
            if (text.trim().length > 20) {
              chunks.push({
                text,
                path: fullPath,
                startLine: i + 1,
                endLine: end,
                mtime: 0,
              });
            }
          }
        } catch {}
      }
    }
  }

  walkDir(projectRoot);
  return chunks;
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
}

export async function searchContextLMStudio(
  query: string,
  opts: RetrievalOptions,
  projectRoot: string,
  provider: LMStudioProvider
): Promise<RetrievalResult> {
  if (opts.depth === "none" || opts.maxChunks === 0) {
    return { chunks: [], totalChunks: 0 };
  }

  console.log(`[Brain/LMStudio] Loading chunks for ${projectRoot}...`);
  const chunks = await chunkProjectFiles(projectRoot);
  if (chunks.length === 0) {
    return { chunks: [], totalChunks: 0 };
  }

  const nChunks = Math.min(chunks.length, 100);
  const sampled = chunks.slice(0, nChunks);

  console.log(`[Brain/LMStudio] Embedding ${sampled.length} chunks via LM Studio...`);
  const chunkTexts = sampled.map((c) => c.text.slice(0, 500));
  const queryTexts = [query.replace(/\n/g, " ")];

  const [chunkVectors, queryVectors] = await Promise.all([
    embedViaLMStudio(provider, chunkTexts),
    embedViaLMStudio(provider, queryTexts),
  ]);

  const queryVec = queryVectors[0];
  const scored = chunkVectors.map((vec, i) => ({
    chunk: sampled[i],
    score: cosineSimilarity(queryVec, vec),
  }));

  scored.sort((a, b) => b.score - a.score);
  const topK = scored.slice(0, opts.maxChunks);

  console.log(`[Brain/LMStudio] Found ${topK.length} results (top score: ${topK[0]?.score.toFixed(3) || 0})`);

  return {
    chunks: topK.map((s) => s.chunk),
    scores: topK.map((s) => s.score),
    totalChunks: topK.length,
  };
}
