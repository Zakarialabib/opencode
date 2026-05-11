const BRAIN_EMBED_URL = "http://127.0.0.1:7878";

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

export async function searchContext(
  query: string,
  opts: RetrievalOptions
): Promise<RetrievalResult> {
  if (opts.depth === "none" || opts.maxChunks === 0) {
    return { chunks: [], totalChunks: 0 };
  }

  const res = await fetch(`${BRAIN_EMBED_URL}/search`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query,
      top_k: opts.maxChunks,
      project_id: opts.strategy, // or something
    }),
  });

  if (!res.ok) {
    console.error("Search failed:", await res.text());
    return { chunks: [], totalChunks: 0 };
  }

  const results = await res.json();
  // Assume results is array of { path, start_line, text, score }
  const chunks: Chunk[] = results.map((r: any) => ({
    text: r.text,
    path: r.path,
    startLine: r.start_line,
    endLine: r.start_line + r.text.split('\n').length - 1,
    mtime: 0, // not provided
  }));

  return {
    chunks,
    scores: results.map((r: any) => r.score),
    totalChunks: chunks.length,
  };
}