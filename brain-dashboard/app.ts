import cors from 'cors';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';
import { getEmbeddings } from '../brain-plugin/retrieval/dense.ts';
import { rerankChunks } from '../brain-plugin/retrieval/reranker.ts';
import type { SearchResultItem } from '../brain-plugin/retrieval/fusion.ts';
import { indexDocs, indexChatTurn, indexProject } from '../brain-plugin/retrieval/indexer.js';
import { DecisionTree } from '../brain-plugin/tree/engine.js';
import { defaultProvider } from '../brain-plugin/provider/lmstudio.js';
import { contextInjector } from '../brain-plugin/context/injector.js';
import { searchProjectContext, searchProjectContextDebug } from '../brain-plugin/retrieval/searcher.js';
import { getDatabase } from '../brain-plugin/store/index.js';

type AppConfig = {
  BRAIN_PROJECT_ROOT: string;
  BRAIN_DB_PATH: string;
  LMSTUDIO_BASE_URL: string;
  CHAT_MODEL_ID: string;
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function loadConfig(env: NodeJS.ProcessEnv): AppConfig {
  return {
    BRAIN_PROJECT_ROOT: env.BRAIN_PROJECT_ROOT ?? 'c:\\opencode',
    BRAIN_DB_PATH: env.BRAIN_DB_PATH ?? 'c:\\opencode\\.opencode\\brain.db',
    LMSTUDIO_BASE_URL: env.LMSTUDIO_BASE_URL ?? 'http://localhost:1234/v1',
    CHAT_MODEL_ID: env.CHAT_MODEL_ID ?? 'qwen/qwen3-4b-2507'
  };
}

const config = loadConfig(process.env);
const port = 3456;

const decisionTree = await DecisionTree.load();
defaultProvider.setBaseURL(config.LMSTUDIO_BASE_URL);
let chatModelId = config.CHAT_MODEL_ID;
let lastModelFetchAt = 0;
let cachedModels: string[] = [];

async function fetchLmStudioModels(): Promise<string[]> {
  const now = Date.now();
  if (cachedModels.length > 0 && now - lastModelFetchAt < 10_000) return cachedModels;

  const base = config.LMSTUDIO_BASE_URL.replace(/\/+$/, '');
  const url = `${base}/models`;
  const response = await fetch(url);
  if (!response.ok) return [];
  const json = (await response.json()) as any;
  const ids = Array.isArray(json?.data) ? json.data.map((m: any) => m?.id).filter(Boolean) : [];
  cachedModels = ids;
  lastModelFetchAt = now;
  return ids;
}

async function ensureChatModelId(): Promise<void> {
  const models = await fetchLmStudioModels();
  if (models.length === 0) return;
  if (models.includes(chatModelId)) return;
  const fallback = models.find((id) => !/(embed|embedding|rerank|reranker)/i.test(String(id)));
  if (fallback) chatModelId = fallback;
}
await ensureChatModelId();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

function stripTags(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractHtmlTitle(html: string): string | undefined {
  const match = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  const title = match?.[1]?.replace(/\s+/g, ' ').trim();
  return title || undefined;
}

function sha256Hex(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}

app.get('/api/config', (_req, res) => {
  res.json({ ...config, CHAT_MODEL_ID: chatModelId });
});

app.get('/api/status', (_req, res) => {
  try {
    const db = getDatabase(config.BRAIN_PROJECT_ROOT);
    const files = (db.prepare('SELECT COUNT(*) as c FROM files').get() as any)?.c ?? 0;
    const chunks = (db.prepare('SELECT COUNT(*) as c FROM chunks').get() as any)?.c ?? 0;
    let ftsIndexed = 0;
    try {
      ftsIndexed = (db.prepare('SELECT COUNT(*) as c FROM fts_chunks').get() as any)?.c ?? 0;
    } catch {}
    let vectors = 0;
    try {
      vectors += (db.prepare('SELECT COUNT(*) as c FROM chunk_embeddings').get() as any)?.c ?? 0;
    } catch {}
    try {
      vectors += (db.prepare('SELECT COUNT(*) as c FROM chunk_embeddings_nomic').get() as any)?.c ?? 0;
    } catch {}

    const indexHealth =
      chunks === 0 ? 'empty' : ftsIndexed === chunks && vectors > 0 ? 'healthy' : 'reindex_required';

    res.json({ files, chunks, ftsIndexed, vectors, indexHealth });
  } catch (e: any) {
    res.status(500).json({ error: e?.message ?? String(e) });
  }
});

app.get('/api/index', (_req, res) => {
  try {
    const db = getDatabase(config.BRAIN_PROJECT_ROOT);
    const files = (db.prepare('SELECT COUNT(*) as c FROM files').get() as any)?.c ?? 0;
    const chunks = (db.prepare('SELECT COUNT(*) as c FROM chunks').get() as any)?.c ?? 0;
    let ftsIndexed = 0;
    try {
      ftsIndexed = (db.prepare('SELECT COUNT(*) as c FROM fts_chunks').get() as any)?.c ?? 0;
    } catch {}
    let vectors = 0;
    try {
      vectors += (db.prepare('SELECT COUNT(*) as c FROM chunk_embeddings').get() as any)?.c ?? 0;
    } catch {}
    try {
      vectors += (db.prepare('SELECT COUNT(*) as c FROM chunk_embeddings_nomic').get() as any)?.c ?? 0;
    } catch {}

    const health =
      chunks === 0 ? 'empty' : ftsIndexed === chunks && vectors > 0 ? 'healthy' : 'reindex_required';

    res.json({
      health,
      files,
      chunks,
      ftsIndexed,
      vectors
    });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message ?? String(e) });
  }
});

app.post('/api/index', async (req, res) => {
  const action = req.body?.action;
  if (action !== 'reindex_full') {
    res.status(400).json({ ok: false, error: 'Invalid action' });
    return;
  }

  try {
    const chunks = await indexProject(config.BRAIN_PROJECT_ROOT);
    res.json({ ok: true, action, chunksIndexed: chunks.length });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message ?? String(e) });
  }
});

app.get('/api/health/lmstudio', async (_req, res) => {
  try {
    const base = config.LMSTUDIO_BASE_URL.replace(/\/+$/, '');
    const url = `${base}/models`;
    const response = await fetch(url);

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      res.status(502).json({
        ok: false,
        error: `LM Studio request failed (${response.status} ${response.statusText})${body ? `: ${body}` : ''}`
      });
      return;
    }

    const models = await response.json();
    res.json({ ok: true, models });
  } catch (err: any) {
    res.status(502).json({ ok: false, error: err?.message ?? String(err) });
  }
});

app.post('/api/health/embed', async (req, res) => {
  const query = req.body?.query;
  if (typeof query !== 'string' || query.trim().length === 0) {
    res.status(400).json({ ok: false, error: 'Missing query' });
    return;
  }

  try {
    const { vectors, modelType } = await getEmbeddings(config.BRAIN_PROJECT_ROOT, [query]);
    const dims = vectors?.[0]?.length ?? 0;

    if (dims <= 0) {
      res.status(502).json({ ok: false, error: 'Embedding backend returned an empty vector' });
      return;
    }

    res.json({ ok: true, dims, modelType });
  } catch (err: any) {
    res.status(502).json({ ok: false, error: err?.message ?? String(err) });
  }
});

app.post('/api/health/rerank', async (req, res) => {
  const query = req.body?.query;
  if (typeof query !== 'string' || query.trim().length === 0) {
    res.status(400).json({ ok: false, error: 'Missing query' });
    return;
  }

  const passages = req.body?.passages;
  const contentList =
    Array.isArray(passages) && passages.every((p: any) => typeof p === 'string') && passages.length > 0
      ? passages
      : [
          'This is a short example passage about embeddings and vector search.',
          'This passage talks about reranking and cross-encoders for better relevance.',
          'This is a third passage with some related technical context.'
        ];

  const items: SearchResultItem[] = contentList.slice(0, 3).map((content: string, idx: number) => ({
    id: `health-passage-${idx + 1}`,
    filepath: 'health://passage',
    language: 'text',
    type: 'passage',
    name: `passage-${idx + 1}`,
    start_line: 0,
    end_line: 0,
    content,
    score: 1 / (idx + 1)
  }));

  try {
    const reranked = await rerankChunks(config.BRAIN_PROJECT_ROOT, query, items, 'learn');
    res.json({
      ok: true,
      results: reranked.map((r) => ({ id: r.id, score: r.score ?? 0 }))
    });
  } catch (err: any) {
    res.status(502).json({ ok: false, error: err?.message ?? String(err) });
  }
});

app.post('/api/ingest', async (req, res) => {
  try {
    const body = req.body as {
      source?: 'paste' | 'url';
      content?: string;
      url?: string;
      title?: string;
    };

    if (body.source !== 'paste' && body.source !== 'url') {
      res.status(400).json({ ok: false, error: 'Invalid source' });
      return;
    }

    let content = '';
    let sourceUrl: string | undefined;
    let title = body.title;

    if (body.source === 'paste') {
      if (!body.content?.trim()) {
        res.status(400).json({ ok: false, error: 'content is required for paste' });
        return;
      }
      content = body.content;
    } else {
      if (!body.url?.trim()) {
        res.status(400).json({ ok: false, error: 'url is required for url source' });
        return;
      }
      sourceUrl = body.url;
      const response = await fetch(body.url, { redirect: 'follow' });
      if (!response.ok) {
        res.status(400).json({ ok: false, error: `Failed to fetch url: ${response.status}` });
        return;
      }
      const html = await response.text();
      title = title ?? extractHtmlTitle(html);
      content = stripTags(html);
      if (!content.trim()) {
        res.status(400).json({ ok: false, error: 'No extractable content from url' });
        return;
      }
    }

    const docId = sha256Hex(content).slice(0, 16);
    const chunks = await indexDocs(config.BRAIN_PROJECT_ROOT, [{ docId, title, content, sourceUrl }]);
    res.json({ ok: true, docId, chunksIndexed: chunks.length });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message ?? 'Unknown error' });
  }
});

app.post('/api/search', async (req, res) => {
  const body = req.body as {
    query?: string;
    intent?: string;
    topK?: number;
    debug?: boolean;
    confidence?: number;
  };

  const query = body?.query;
  if (typeof query !== 'string' || query.trim().length === 0) {
    res.status(400).json({ ok: false, error: 'Missing query' });
    return;
  }

  let intent = typeof body.intent === 'string' && body.intent.trim() ? body.intent.trim() : '';
  let confidence = typeof body.confidence === 'number' ? body.confidence : 0.7;

  const classification = decisionTree.classify(query, { message: '', recentFiles: [], diagnostics: [] });
  if (!intent) {
    intent = classification.node.intent;
  }
  if (typeof body.confidence !== 'number') {
    confidence = Math.max(0, Math.min(1, classification.score));
  }

  const strategy = decisionTree.selectStrategy(classification.node);
  const topK =
    typeof body.topK === 'number' && Number.isFinite(body.topK) && body.topK > 0
      ? Math.floor(body.topK)
      : strategy.maxChunks;

  try {
    if (body.debug) {
      const out = await searchProjectContextDebug(config.BRAIN_PROJECT_ROOT, query, topK, intent, confidence);
      let results = out.results;
      let debug = out.debug as any;

      if (!results || results.length === 0) {
        const db = getDatabase(config.BRAIN_PROJECT_ROOT);
        const rows = db
          .prepare(
            `SELECT id, filepath, name, start_line, end_line, substr(content, 1, 400) as preview
             FROM chunks
             WHERE content LIKE ?
             LIMIT ?`
          )
          .all(`%${query}%`, topK) as any[];

        results = rows.map((r) => ({
          id: r.id,
          filepath: r.filepath,
          name: r.name,
          start_line: r.start_line,
          end_line: r.end_line,
          content: r.preview,
          score: 0.1
        }));

        debug = {
          ...debug,
          fallback: { enabled: true, type: 'like', hits: rows.length }
        };
      }

      res.json({
        ok: true,
        query,
        intent,
        confidence,
        topK,
        results: results.map((r: any) => ({
          filepath: r.filepath,
          start_line: r.start_line,
          end_line: r.end_line,
          name: r.name,
          score: r.score ?? 0
        })),
        debug
      });
      return;
    }

    let results = await searchProjectContext(config.BRAIN_PROJECT_ROOT, query, topK, intent, confidence);
    if (!results || results.length === 0) {
      const db = getDatabase(config.BRAIN_PROJECT_ROOT);
      const rows = db
        .prepare(
          `SELECT id, filepath, name, start_line, end_line
           FROM chunks
           WHERE content LIKE ?
           LIMIT ?`
        )
        .all(`%${query}%`, topK) as any[];
      results = rows.map((r) => ({
        id: r.id,
        filepath: r.filepath,
        name: r.name,
        start_line: r.start_line,
        end_line: r.end_line,
        score: 0.1
      }));
    }
    res.json({
      ok: true,
      query,
      intent,
      confidence,
      topK,
      results: results.map((r: any) => ({
        filepath: r.filepath,
        start_line: r.start_line,
        end_line: r.end_line,
        name: r.name,
        score: r.score ?? 0
      }))
    });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err?.message ?? String(err) });
  }
});

app.post('/api/chat', async (req, res) => {
  const body = req.body as {
    message?: string;
    history?: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
    sessionId?: string;
    intentOverride?: string;
    debugPrompt?: boolean;
  };

  const message = body?.message;
  if (typeof message !== 'string' || message.trim().length === 0) {
    res.status(400).json({ ok: false, error: 'Missing message' });
    return;
  }

  let intent = typeof body.intentOverride === 'string' && body.intentOverride.trim() ? body.intentOverride.trim() : '';
  let confidence = 0.7;
  let strategyMaxChunks = 10;

  const classification = decisionTree.classify(message, { message: '', recentFiles: [], diagnostics: [] });
  if (!intent) {
    intent = classification.node.intent;
  }
  confidence = Math.max(0, Math.min(1, classification.score));
  strategyMaxChunks = decisionTree.selectStrategy(classification.node).maxChunks;

  try {
    await ensureChatModelId();
    const retrieval = await searchProjectContextDebug(
      config.BRAIN_PROJECT_ROOT,
      message,
      strategyMaxChunks,
      intent,
      confidence
    );

    const chunks = retrieval.results.map((r: any) => ({
      text: r.content ?? '',
      path: r.filepath,
      startLine: r.start_line,
      endLine: r.end_line,
      mtime: 0,
      score: r.score ?? 0
    }));

    const retrievalResult = {
      chunks,
      totalChunks: chunks.length
    };

    const augmentedPrompt = contextInjector.inject(message, retrievalResult as any, {
      intent,
      maxTokens: 3000
    });

    const history =
      Array.isArray(body.history) && body.history.every((h) => h && typeof h.role === 'string' && typeof h.content === 'string')
        ? body.history
        : [];

    const temperature =
      intent === 'debug'
        ? 0.2
        : intent === 'refactor'
          ? 0.3
          : intent === 'test'
            ? 0.3
            : intent === 'feature'
              ? 0.6
              : intent === 'learn'
                ? 0.5
                : intent === 'quick_chat'
                  ? 0.8
                  : 0.7;

    const response = await defaultProvider.chat(
      chatModelId,
      [...history, { role: 'user', content: augmentedPrompt }],
      { temperature, maxTokens: 1200 }
    );

    if (typeof body.sessionId === 'string' && body.sessionId.trim()) {
      await indexChatTurn(config.BRAIN_PROJECT_ROOT, body.sessionId.trim(), message, response);
    }

    res.json({
      ok: true,
      response,
      debug: {
        intent,
        confidence,
        timings: retrieval.debug.timings,
        chunksUsed: chunks.length,
        ...(body.debugPrompt ? { augmentedPrompt } : {})
      }
    });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err?.message ?? String(err) });
  }
});

app.listen(port, () => {
  console.log(`Brain dashboard server running on http://localhost:${port}`);
});
