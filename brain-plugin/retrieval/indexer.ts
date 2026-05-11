const BRAIN_EMBED_URL = "http://127.0.0.1:7878";

export interface IndexProgress {
  status: "indexed" | "error";
  files_indexed: number;
  chunks: number;
  duration_ms: number;
  message?: string;
}

function toWslPath(windowsPath: string): string {
  return windowsPath.replace(/^([A-Z]):\\/i, (_: string, d: string) => `/mnt/${d.toLowerCase()}/`).replace(/\\/g, '/');
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

export async function indexProject(
  projectRoot: string,
  opts: { force?: boolean } = {}
): Promise<IndexProgress> {
  const wslPath = toWslPath(projectRoot);
  const projectId = projectIdFromPath(projectRoot);

  const res = await fetch(`${BRAIN_EMBED_URL}/index`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      project_root: wslPath,
      force: opts.force ?? false,
      project_id: projectId,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Index failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  return {
    status: "indexed",
    files_indexed: data.files_indexed,
    chunks: data.chunks,
    duration_ms: data.duration_ms,
  };
}
