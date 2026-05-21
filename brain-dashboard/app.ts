import cors from "cors";
import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createHash, randomUUID } from "crypto";
import type { AddressInfo } from "net";
import {
  getEmbeddingConfig,
  getEmbeddings,
  getEmbeddingStatus,
  setEmbeddingConfig,
} from "../brain-plugin/retrieval/dense.ts";
import { isVectorActive } from "../brain-plugin/store/vec.ts";
import {
  getRerankerStatus,
  prewarmReranker,
  rerankChunks,
  setRerankerEnabled,
  setRerankerModelId,
} from "../brain-plugin/retrieval/reranker.ts";
import { getFusionWeights, setFusionWeights, setRrfK } from "../brain-plugin/retrieval/fusion.ts";
import type { SearchResultItem } from "../brain-plugin/retrieval/fusion.ts";
import {
  indexDocs,
  indexChatTurn,
  indexProject,
  reindexProjectFull,
} from "../brain-plugin/retrieval/indexer.js";
import { DecisionTree } from "../brain-plugin/tree/engine.js";
import { defaultProvider } from "../brain-plugin/provider/lmstudio.js";
import { contextInjector } from "../brain-plugin/context/injector.js";
import {
  searchProjectContext,
  searchProjectContextDebug,
} from "../brain-plugin/retrieval/searcher.js";
import { recordSessionFeedback } from "../brain-plugin/learn/feedback.ts";
import { getTraceData, getTraceMetrics } from "../brain-plugin/learn/tracer.ts";
import { pruneOldTelemetry, recordRunEnd, recordRunStart } from "../brain-plugin/store/telemetry.ts";
import {
  addConcept,
  dampenConceptChunkLink,
  getConceptRelatedChunks,
  linkConceptToChunk,
} from "../brain-plugin/memory/graph.ts";
import { sessionMemory } from "../brain-plugin/state/session.js";
import { getDatabase } from "../brain-plugin/store/index.js";

type AppConfig = {
  BRAIN_PROJECT_ROOT: string;
  BRAIN_DB_PATH: string;
  LMSTUDIO_BASE_URL: string;
  CHAT_MODEL_ID: string;
  OPENCODE_SERVER_BASE_URL: string;
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function loadConfig(env: NodeJS.ProcessEnv): AppConfig {
  return {
    BRAIN_PROJECT_ROOT: env.BRAIN_PROJECT_ROOT ?? "c:\\opencode",
    BRAIN_DB_PATH: env.BRAIN_DB_PATH ?? "c:\\opencode\\.opencode\\brain.db",
    LMSTUDIO_BASE_URL: env.LMSTUDIO_BASE_URL ?? "http://localhost:1234/v1",
    CHAT_MODEL_ID: env.CHAT_MODEL_ID ?? "qwen/qwen3-4b-2507",
    OPENCODE_SERVER_BASE_URL: env.OPENCODE_SERVER_BASE_URL ?? "http://127.0.0.1:4096",
  };
}

const config = loadConfig(process.env);
const portRaw = process.env.BRAIN_DASHBOARD_PORT ?? process.env.PORT ?? "3456";
const portParsed = Number.parseInt(portRaw, 10);
const port = Number.isFinite(portParsed) && portParsed > 0 ? portParsed : 3456;
const portExplicit = !!(process.env.BRAIN_DASHBOARD_PORT || process.env.PORT);
const telemetryKeepMs = 7 * 24 * 60 * 60 * 1000;

defaultProvider.setBaseURL(config.LMSTUDIO_BASE_URL);
let chatModelId = config.CHAT_MODEL_ID;
let lastModelFetchAt = 0;
let cachedModels: string[] = [];
let decisionTreePromise: Promise<DecisionTree> | undefined;
let ensureChatModelPromise: Promise<void> | undefined;

type IndexJob = {
  id: string;
  status: "running" | "success" | "error";
  action: "reindex_full" | "reindex_dirty";
  startedAt: number;
  endedAt?: number;
  chunksIndexed?: number;
  error?: string;
};

type ModelJob = {
  id: string;
  status: "running" | "success" | "error";
  kind: "embed" | "rerank";
  modelId: string;
  startedAt: number;
  endedAt?: number;
  error?: string;
};

let indexJob: IndexJob | null = null;
let modelJob: ModelJob | null = null;

async function getDecisionTree(): Promise<DecisionTree> {
  if (decisionTreePromise) return decisionTreePromise;
  decisionTreePromise = DecisionTree.load().catch((err) => {
    decisionTreePromise = undefined;
    throw err;
  });
  return decisionTreePromise;
}

function getDb() {
  return getDatabase(config.BRAIN_PROJECT_ROOT);
}

function dbGet(key: string): string | undefined {
  try {
    const db = getDb();
    const row = db.prepare("SELECT value FROM config WHERE key = ?").get(key) as any;
    const val = row?.value;
    return typeof val === "string" ? val : undefined;
  } catch {
    return undefined;
  }
}

function dbSet(key: string, value: string): void {
  const db = getDb();
  db.prepare("INSERT OR REPLACE INTO config (key, value, updated_at) VALUES (?, ?, ?)").run(
    key,
    value,
    Date.now()
  );
}

function loadRuntimeConfigFromDb(): void {
  const persistedChat = dbGet("chat_model_id");
  if (persistedChat) chatModelId = persistedChat;

  const embedBackend = dbGet("embed_backend");
  const embedModelId = dbGet("embed_model_id");
  if (embedBackend === "local" || embedBackend === "lmstudio" || embedBackend === "auto") {
    if (embedBackend === "lmstudio") {
      setEmbeddingConfig({ backend: embedBackend, lmstudioModelId: embedModelId });
    } else {
      setEmbeddingConfig({ backend: embedBackend, localModelId: embedModelId });
    }
  } else if (embedModelId) {
    setEmbeddingConfig({ lmstudioModelId: embedModelId });
  }

  const rerankEnabledRaw = dbGet("rerank_enabled");
  if (rerankEnabledRaw === "true" || rerankEnabledRaw === "false") {
    setRerankerEnabled(rerankEnabledRaw === "true");
  }
  const rerankModelId = dbGet("rerank_model_id");
  if (rerankModelId) setRerankerModelId(rerankModelId);

  const rrfK = Number(dbGet("rrf_k"));
  if (Number.isFinite(rrfK) && rrfK > 0) setRrfK(rrfK);

  const wDense = Number(dbGet("rrf_dense_weight"));
  const wKeyword = Number(dbGet("rrf_keyword_weight"));
  const wSparse = Number(dbGet("rrf_sparse_weight"));
  if (
    Number.isFinite(wDense) &&
    Number.isFinite(wKeyword) &&
    Number.isFinite(wSparse) &&
    wDense >= 0 &&
    wKeyword >= 0 &&
    wSparse >= 0
  ) {
    setFusionWeights(wKeyword, wDense, wSparse);
  }
}

loadRuntimeConfigFromDb();
try {
  pruneOldTelemetry(config.BRAIN_PROJECT_ROOT, { keepMs: telemetryKeepMs });
} catch {}

async function fetchLmStudioModels(): Promise<string[]> {
  const now = Date.now();
  if (cachedModels.length > 0 && now - lastModelFetchAt < 10_000) return cachedModels;

  const base = config.LMSTUDIO_BASE_URL.replace(/\/+$/, "");
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

async function ensureChatModelIdOnce(): Promise<void> {
  if (ensureChatModelPromise) return ensureChatModelPromise;
  ensureChatModelPromise = ensureChatModelId().finally(() => {
    ensureChatModelPromise = undefined;
  });
  return ensureChatModelPromise;
}

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

function stripTags(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractHtmlTitle(html: string): string | undefined {
  const match = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  const title = match?.[1]?.replace(/\s+/g, " ").trim();
  return title || undefined;
}

function sha256Hex(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

async function applyModelSelection(body: {
  chat?: string;
  embed?: string;
  rerank?: string;
}): Promise<void> {
  if (typeof body.chat === "string" && body.chat.trim()) {
    chatModelId = body.chat.trim();
    dbSet("chat_model_id", chatModelId);
  }

  if (typeof body.embed === "string" && body.embed.trim()) {
    const raw = body.embed.trim();
    if (raw.startsWith("local:")) {
      const modelId = raw.slice("local:".length).trim();
      setEmbeddingConfig({ backend: "local", localModelId: modelId });
      dbSet("embed_backend", "local");
      dbSet("embed_model_id", modelId);
    } else {
      const modelId = raw.startsWith("lmstudio:") ? raw.slice("lmstudio:".length).trim() : raw;
      setEmbeddingConfig({ backend: "lmstudio", lmstudioModelId: modelId });
      dbSet("embed_backend", "lmstudio");
      dbSet("embed_model_id", modelId);
    }
  }

  if (typeof body.rerank === "string" && body.rerank.trim()) {
    const raw = body.rerank.trim();
    if (raw === "off") {
      setRerankerEnabled(false);
      dbSet("rerank_enabled", "false");
    } else if (raw.startsWith("local:")) {
      const modelId = raw.slice("local:".length).trim();
      setRerankerEnabled(true);
      setRerankerModelId(modelId);
      dbSet("rerank_enabled", "true");
      dbSet("rerank_model_id", modelId);
    } else {
      const modelId = raw.startsWith("lmstudio:") ? raw.slice("lmstudio:".length).trim() : raw;
      setRerankerEnabled(true);
      setRerankerModelId(modelId);
      dbSet("rerank_enabled", "true");
      dbSet("rerank_model_id", modelId);
    }
  }

  await ensureChatModelIdOnce();
}

function readJsonSafe(filePath: string): any | null {
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, "utf-8"));
    }
  } catch {}
  return null;
}

function getModelsCacheDir(projectRoot: string): string {
  return path.join(projectRoot, ".opencode", "models");
}

function scanLocalModels(projectRoot: string): Array<{ id: string; ready: boolean }> {
  const base = getModelsCacheDir(projectRoot);
  if (!fs.existsSync(base)) return [];
  let vendors: fs.Dirent[] = [];
  try {
    vendors = fs.readdirSync(base, { withFileTypes: true }).filter((d) => d.isDirectory());
  } catch {
    return [];
  }
  const out: Array<{ id: string; ready: boolean }> = [];
  for (const vendor of vendors) {
    const vendorPath = path.join(base, vendor.name);
    let models: fs.Dirent[] = [];
    try {
      models = fs.readdirSync(vendorPath, { withFileTypes: true }).filter((d) => d.isDirectory());
    } catch {
      continue;
    }
    for (const model of models) {
      const modelPath = path.join(vendorPath, model.name);
      let ready = false;
      try {
        ready = fs.readdirSync(modelPath).length > 0;
      } catch {}
      out.push({ id: `${vendor.name}/${model.name}`.replace(/\\/g, "/"), ready });
    }
  }
  return out.sort((a, b) => a.id.localeCompare(b.id));
}

function looksLikeEmbedModelId(id: string): boolean {
  return /(embed|embedding)/i.test(id);
}

function looksLikeRerankModelId(id: string): boolean {
  return /(rerank|reranker)/i.test(id) || /bge-reranker/i.test(id);
}

async function buildModelsPayload(): Promise<{
  ok: true;
  available: { chat: string[]; embed: string[]; rerank: string[] };
  selected: { chat: string; embed: string; rerank: string };
  local: {
    cacheDir: string;
    models: Array<{ id: string; ready: boolean }>;
    required: {
      embed: { id: string; ready: boolean };
      rerank: { id: string; ready: boolean };
    };
  };
}> {
  const ids = await fetchLmStudioModels();
  const chat = ids.filter((id) => !/(embed|embedding|rerank|reranker)/i.test(String(id)));
  const embed = ids.filter((id) => /(embed|embedding)/i.test(String(id)));

  const embedCfg = getEmbeddingConfig();
  const embedSelected =
    embedCfg.backend === "lmstudio"
      ? `lmstudio:${embedCfg.lmstudioModelId}`
      : `local:${embedCfg.localModelId}`;
  const rerankStatus = getRerankerStatus();
  const rerankSelected = rerankStatus.enabled ? `local:${rerankStatus.modelId}` : "off";

  const localModels = scanLocalModels(config.BRAIN_PROJECT_ROOT);
  const readyLocalModels = localModels.filter((m) => m.ready);
  const localEmbedIds = readyLocalModels.map((m) => m.id).filter(looksLikeEmbedModelId);
  const localRerankIds = readyLocalModels.map((m) => m.id).filter(looksLikeRerankModelId);

  const embedOptions: string[] = [];
  if (embedCfg.backend !== "lmstudio") {
    embedOptions.push(`local:${embedCfg.localModelId}`);
  }
  for (const id of localEmbedIds) {
    const option = `local:${id}`;
    if (!embedOptions.includes(option)) embedOptions.push(option);
  }
  for (const id of embed) {
    const option = `lmstudio:${id}`;
    if (!embedOptions.includes(option)) embedOptions.push(option);
  }

  const rerankOptions: string[] = ["off"];
  if (rerankStatus.enabled) {
    rerankOptions.push(`local:${rerankStatus.modelId}`);
  }
  for (const id of localRerankIds) {
    const option = `local:${id}`;
    if (!rerankOptions.includes(option)) rerankOptions.push(option);
  }

  const requiredEmbedId = "Xenova/nomic-embed-text-v1.5";
  const requiredRerankId = "Xenova/bge-reranker-base";
  const requiredEmbedReady = localModels.some((m) => m.id === requiredEmbedId && m.ready);
  const requiredRerankReady = localModels.some((m) => m.id === requiredRerankId && m.ready);

  return {
    ok: true,
    available: {
      chat,
      embed: embedOptions,
      rerank: rerankOptions,
    },
    selected: {
      chat: chatModelId,
      embed: embedSelected,
      rerank: rerankSelected,
    },
    local: {
      cacheDir: getModelsCacheDir(config.BRAIN_PROJECT_ROOT).replace(/\\/g, "/"),
      models: localModels,
      required: {
        embed: { id: requiredEmbedId, ready: requiredEmbedReady },
        rerank: { id: requiredRerankId, ready: requiredRerankReady },
      },
    },
  };
}

app.get("/api/config", (_req, res) => {
  const maxContextTokens = Number(dbGet("max_context_tokens") ?? "3000");
  res.json({
    ...config,
    CHAT_MODEL_ID: chatModelId,
    embedding: getEmbeddingConfig(),
    reranker: getRerankerStatus(),
    fusion: getFusionWeights(),
    max_context_tokens: Number.isFinite(maxContextTokens) ? maxContextTokens : 3000,
  });
});

app.get("/api/settings", (_req, res) => {
  const maxContextTokens = Number(dbGet("max_context_tokens") ?? "3000");

  // Config sync info
  const mainConfig = readJsonSafe(path.join(config.BRAIN_PROJECT_ROOT, "opencode.json"));
  const brainConfig = readJsonSafe(
    path.join(config.BRAIN_PROJECT_ROOT, "brain-plugin", "opencode.json")
  );
  let configSync: any = { synced: true, main_exists: !!mainConfig, brain_exists: !!brainConfig };
  if (mainConfig && brainConfig) {
    const mainMcp = mainConfig.mcp || {};
    const brainMcp = brainConfig.mcp || {};
    const mcpDiffs: string[] = [];
    for (const [key, val] of Object.entries(mainMcp)) {
      const mainEnabled = (val as any)?.enabled;
      const brainEnabled = (brainMcp as any)[key]?.enabled;
      if (mainEnabled !== brainEnabled && brainEnabled !== undefined) {
        mcpDiffs.push(`${key}: main=${mainEnabled} brain=${brainEnabled}`);
      }
    }
    const mainModels = mainConfig.provider || {};
    const brainModels = brainConfig.provider || {};
    const modelDiffs: string[] = [];
    for (const [provider, cfg] of Object.entries(mainModels)) {
      const mainProviderModels = (cfg as any)?.models || {};
      const brainProviderModels = (brainModels as any)[provider]?.models || {};
      const mainCount = Object.keys(mainProviderModels).length;
      const brainCount = Object.keys(brainProviderModels).length;
      if (mainCount !== brainCount) {
        modelDiffs.push(`${provider}: main=${mainCount} models, brain=${brainCount} models`);
      }
    }
    configSync = {
      synced: mcpDiffs.length === 0 && modelDiffs.length === 0,
      main_exists: true,
      brain_exists: true,
      mcp: { match: mcpDiffs.length === 0, diffs: mcpDiffs },
      models: { match: modelDiffs.length === 0, diffs: modelDiffs },
    };
  }

  res.json({
    ok: true,
    env: config,
    runtime: {
      chat_model_id: chatModelId,
      embedding: getEmbeddingConfig(),
      reranker: getRerankerStatus(),
      fusion: getFusionWeights(),
      max_context_tokens: Number.isFinite(maxContextTokens) ? maxContextTokens : 3000,
    },
    config_sync: configSync,
  });
});

app.get("/api/settings/models", async (_req, res) => {
  try {
    res.json(await buildModelsPayload());
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message ?? String(e) });
  }
});

app.post("/api/settings/models", async (req, res) => {
  try {
    await applyModelSelection(req.body ?? {});
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message ?? String(e) });
  }
});

app.get("/api/models", async (_req, res) => {
  try {
    res.json(await buildModelsPayload());
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message ?? String(e) });
  }
});

app.get("/api/models/local", (_req, res) => {
  res.json({
    ok: true,
    cacheDir: getModelsCacheDir(config.BRAIN_PROJECT_ROOT).replace(/\\/g, "/"),
    models: scanLocalModels(config.BRAIN_PROJECT_ROOT),
  });
});

app.get("/api/models/download/job", (_req, res) => {
  res.json({ ok: true, job: modelJob });
});

app.post("/api/models/download", async (req, res) => {
  const kind = req.body?.kind;
  const modelIdRaw = req.body?.modelId;
  const modelId = typeof modelIdRaw === "string" ? modelIdRaw.trim() : "";
  if (kind !== "embed" && kind !== "rerank") {
    res.status(400).json({ ok: false, error: "Invalid kind" });
    return;
  }
  if (!modelId) {
    res.status(400).json({ ok: false, error: "Missing modelId" });
    return;
  }
  if (modelJob?.status === "running") {
    res.status(409).json({ ok: false, error: "Model job already running", job: modelJob });
    return;
  }

  const job: ModelJob = { id: randomUUID(), status: "running", kind, modelId, startedAt: Date.now() };
  modelJob = job;

  void (async () => {
    try {
      if (kind === "embed") {
        const prev = getEmbeddingConfig();
        setEmbeddingConfig({ backend: "local", localModelId: modelId });
        try {
          await getEmbeddings(config.BRAIN_PROJECT_ROOT, ["warmup"]);
        } finally {
          setEmbeddingConfig({
            backend: prev.backend,
            localModelId: prev.localModelId,
            lmstudioModelId: prev.lmstudioModelId,
          });
        }
      } else {
        const prev = getRerankerStatus();
        setRerankerEnabled(true);
        setRerankerModelId(modelId);
        try {
          await prewarmReranker(config.BRAIN_PROJECT_ROOT);
        } finally {
          setRerankerEnabled(prev.enabled);
          setRerankerModelId(prev.modelId);
        }
      }

      job.status = "success";
      job.endedAt = Date.now();
    } catch (e: any) {
      job.status = "error";
      job.error = e?.message ?? String(e);
      job.endedAt = Date.now();
    }
  })();

  res.status(202).json({ ok: true, job });
});

app.post("/api/models", async (req, res) => {
  try {
    await applyModelSelection(req.body ?? {});
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message ?? String(e) });
  }
});

// === Config file reader for Settings tab ===
app.get("/api/settings/config-file", (req, res) => {
  const relativePath = typeof req.query?.path === "string" ? req.query.path : "";
  if (!relativePath) {
    res.status(400).json({ ok: false, error: "Missing path query param" });
    return;
  }
  const fullPath = path.join(config.BRAIN_PROJECT_ROOT, relativePath);
  // Security: ensure it resolves under BRAIN_PROJECT_ROOT
  const resolved = path.resolve(fullPath);
  if (!resolved.startsWith(path.resolve(config.BRAIN_PROJECT_ROOT))) {
    res.status(403).json({ ok: false, error: "Path outside allowed root" });
    return;
  }
  const data = readJsonSafe(resolved);
  if (!data) {
    res.status(404).json({ ok: false, error: "Config file not found or invalid JSON" });
    return;
  }
  res.json(data);
});

// === Smart input detection ===
app.post("/api/smart/detect", (req, res) => {
  const text = req.body?.text ?? "";
  if (typeof text !== "string" || !text.trim()) {
    res.json({ ok: true, type: "unknown", label: "Enter text to analyze" });
    return;
  }
  const trimmed = text.trim();

  // URL detection
  if (/^https?:\/\//i.test(trimmed)) {
    res.json({ ok: true, type: "url", label: "Web URL — will fetch and ingest" });
    return;
  }

  // Local path detection (Windows or Unix)
  if (/^[a-zA-Z]:[/\\]/.test(trimmed) || /^\/[\w\/]/i.test(trimmed)) {
    const exists = fs.existsSync(trimmed);
    if (exists) {
      const stat = fs.statSync(trimmed);
      if (stat.isDirectory()) {
        res.json({
          ok: true,
          type: "folder",
          label: `Local folder — ${stat.size > 0 ? `${stat.size} items` : "empty"}`,
        });
        return;
      }
      res.json({
        ok: true,
        type: "file",
        label: `Local file — ${(stat.size / 1024).toFixed(1)} KB`,
      });
      return;
    }
    res.json({ ok: true, type: "path_unresolved", label: "Path not found" });
    return;
  }

  // Code detection (multi-line with common keywords)
  const lines = trimmed.split("\n");
  if (lines.length > 1) {
    const codeIndicators = [
      "import ",
      "export ",
      "function ",
      "const ",
      "let ",
      "class ",
      "#include",
      "package ",
      "def ",
      "pub fn",
    ];
    const codeScore = codeIndicators.filter((kw) => trimmed.includes(kw)).length;
    if (codeScore >= 2 || lines.length > 15) {
      res.json({
        ok: true,
        type: "code",
        label: `Source code (${lines.length} lines, ${trimmed.length} chars)`,
      });
      return;
    }
    res.json({ ok: true, type: "text", label: `Multi-line text (${lines.length} lines)` });
    return;
  }

  // Short text — likely a query
  res.json({ ok: true, type: "query", label: `Query (${trimmed.length} chars)` });
});

// === RAG pipeline status ===
app.get("/api/rag/pipeline", async (_req, res) => {
  try {
    const db = getDb();
    const files = (db.prepare("SELECT COUNT(*) as c FROM files").get() as any)?.c ?? 0;
    const chunks = (db.prepare("SELECT COUNT(*) as c FROM chunks").get() as any)?.c ?? 0;
    let ftsIndexed = 0;
    try {
      ftsIndexed = (db.prepare("SELECT COUNT(*) as c FROM fts_chunks").get() as any)?.c ?? 0;
    } catch {}
    let vectors = 0;
    try {
      vectors += (db.prepare("SELECT COUNT(*) as c FROM chunk_embeddings").get() as any)?.c ?? 0;
    } catch {}
    try {
      vectors +=
        (db.prepare("SELECT COUNT(*) as c FROM chunk_embeddings_nomic").get() as any)?.c ?? 0;
    } catch {}

    const embeddingCfg = getEmbeddingConfig();
    const rerankerStatus = getRerankerStatus();
    const fusion = getFusionWeights();

    // Check which pipeline stages are ready
    const stages = {
      extraction: {
        status: files > 0 ? "ready" : "empty",
        files,
      },
      chunking: {
        status: chunks > 0 ? "ready" : "empty",
        chunks,
      },
      fts: {
        status: ftsIndexed === chunks && chunks > 0 ? "ready" : chunks === 0 ? "empty" : "partial",
        indexed: ftsIndexed,
        total: chunks,
      },
      embedding: {
        status: embeddingCfg.backend === "lmstudio" ? "ready" : "local",
        model:
          embeddingCfg.backend === "lmstudio"
            ? embeddingCfg.lmstudioModelId
            : embeddingCfg.localModelId,
        backend: embeddingCfg.backend,
        vectors,
      },
      fusion: {
        status: "ready",
        weights: fusion,
      },
      reranking: {
        status: rerankerStatus.enabled ? (rerankerStatus.loaded ? "ready" : "loading") : "disabled",
        model: rerankerStatus.enabled ? rerankerStatus.modelId : null,
        loaded: rerankerStatus.loaded ?? false,
      },
    };

    // Overall pipeline health
    const stageOrder = ["extraction", "chunking", "fts", "embedding", "fusion", "reranking"];
    const stageStatuses = stageOrder.map((s) => stages[s as keyof typeof stages].status);
    const allReady = stageStatuses.every((s) => s === "ready");
    const anyEmpty = stageStatuses.includes("empty");
    const pipelineStatus = allReady ? "ready" : anyEmpty ? "incomplete" : "degraded";

    res.json({
      ok: true,
      status: pipelineStatus,
      stages,
      metrics: {
        total_chunks: chunks,
        total_files: files,
        total_vectors: vectors,
        total_fts: ftsIndexed,
      },
      timestamp: Date.now(),
    });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message ?? String(e) });
  }
});

app.get("/api/config/sync", (_req, res) => {
  const mainConfig = readJsonSafe(path.join(config.BRAIN_PROJECT_ROOT, "opencode.json"));
  const brainConfig = readJsonSafe(
    path.join(config.BRAIN_PROJECT_ROOT, "brain-plugin", "opencode.json")
  );

  if (!mainConfig || !brainConfig) {
    res.json({
      ok: true,
      synced: false,
      error: !mainConfig ? "Main config not found" : "Brain config not found",
    });
    return;
  }

  // Compare key fields: MCP enabled states, model providers, instructions
  const mainMcp = mainConfig.mcp || {};
  const brainMcp = brainConfig.mcp || {};

  const mcpDiffs: string[] = [];
  for (const [key, val] of Object.entries(mainMcp)) {
    const mainEnabled = (val as any)?.enabled;
    const brainEnabled = (brainMcp as any)[key]?.enabled;
    if (mainEnabled !== brainEnabled && brainEnabled !== undefined) {
      mcpDiffs.push(`${key}: main=${mainEnabled} brain=${brainEnabled}`);
    }
  }

  const mainModels = mainConfig.provider || {};
  const brainModels = brainConfig.provider || {};
  const modelDiffs: string[] = [];
  for (const [provider, cfg] of Object.entries(mainModels)) {
    const mainProviderModels = (cfg as any)?.models || {};
    const brainProviderModels = (brainModels as any)[provider]?.models || {};
    const mainCount = Object.keys(mainProviderModels).length;
    const brainCount = Object.keys(brainProviderModels).length;
    if (mainCount !== brainCount) {
      modelDiffs.push(`${provider}: main=${mainCount} models, brain=${brainCount} models`);
    }
  }

  const synced = mcpDiffs.length === 0 && modelDiffs.length === 0;

  res.json({
    ok: true,
    synced,
    mcp: { match: mcpDiffs.length === 0, diffs: mcpDiffs },
    models: { match: modelDiffs.length === 0, diffs: modelDiffs },
    main_path: path.join(config.BRAIN_PROJECT_ROOT, "opencode.json"),
    brain_path: path.join(config.BRAIN_PROJECT_ROOT, "brain-plugin", "opencode.json"),
  });
});

app.post("/api/config/sync", async (req, res) => {
  try {
    const direction = req.body?.direction || "brain_to_main";
    const mainPath = path.join(config.BRAIN_PROJECT_ROOT, "opencode.json");
    const brainPath = path.join(config.BRAIN_PROJECT_ROOT, "brain-plugin", "opencode.json");

    const mainConfig = readJsonSafe(mainPath);
    const brainConfig = readJsonSafe(brainPath);

    if (!mainConfig || !brainConfig) {
      res.status(400).json({ ok: false, error: "Config files not readable" });
      return;
    }

    if (direction === "brain_to_main") {
      // Copy MCP settings from brain to main
      if (brainConfig.mcp && mainConfig.mcp) {
        for (const [key, val] of Object.entries(brainConfig.mcp)) {
          if ((val as any)?.enabled !== undefined) {
            if (mainConfig.mcp[key]) {
              mainConfig.mcp[key].enabled = (val as any).enabled;
            }
          }
        }
      }
      // Copy provider models from brain to main
      if (brainConfig.provider && mainConfig.provider) {
        for (const [provider, cfg] of Object.entries(brainConfig.provider)) {
          if ((cfg as any)?.models && mainConfig.provider[provider]) {
            mainConfig.provider[provider].models = { ...(cfg as any).models };
          }
        }
      }
      fs.writeFileSync(mainPath, JSON.stringify(mainConfig, null, 2), "utf-8");
      res.json({ ok: true, synced: true, direction: "brain_to_main" });
    } else {
      // Copy from main to brain
      if (mainConfig.mcp && brainConfig.mcp) {
        for (const [key, val] of Object.entries(mainConfig.mcp)) {
          if ((val as any)?.enabled !== undefined) {
            if (brainConfig.mcp[key]) {
              brainConfig.mcp[key].enabled = (val as any).enabled;
            }
          }
        }
      }
      if (mainConfig.provider && brainConfig.provider) {
        for (const [provider, cfg] of Object.entries(mainConfig.provider)) {
          if ((cfg as any)?.models && brainConfig.provider[provider]) {
            brainConfig.provider[provider].models = { ...(cfg as any).models };
          }
        }
      }
      fs.writeFileSync(brainPath, JSON.stringify(brainConfig, null, 2), "utf-8");
      res.json({ ok: true, synced: true, direction: "main_to_brain" });
    }
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});

app.get("/api/intent", async (req, res) => {
  const query =
    typeof req.query?.q === "string"
      ? req.query.q
      : typeof req.query?.query === "string"
        ? req.query.query
        : "";
  if (!query.trim()) {
    res.status(400).json({ ok: false, error: "Missing q" });
    return;
  }
  try {
    const decisionTree = await getDecisionTree();
    const classification = decisionTree.classify(query, {
      message: "",
      recentFiles: [],
      diagnostics: [],
    });
    const strategy = decisionTree.selectStrategy(classification.node);
    res.json({
      ok: true,
      intent: classification.node.intent,
      confidence: Math.max(0, Math.min(1, classification.score)),
      strategy: strategy.name,
      maxChunks: strategy.maxChunks,
    });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message ?? String(e) });
  }
});

app.get("/api/budget", (_req, res) => {
  const val = Number(dbGet("max_context_tokens") ?? "3000");
  const token_budget = Number.isFinite(val) ? val : 3000;
  res.json({
    ok: true,
    token_budget,
    system_tokens: 0,
    chunk_tokens: 0,
    history_tokens: 0,
    available_tokens: token_budget,
    recent_adjustments: [],
  });
});

app.post("/api/budget", (req, res) => {
  const tokenBudget = Number(req.body?.token_budget);
  if (!Number.isFinite(tokenBudget) || tokenBudget <= 0) {
    res.status(400).json({ ok: false, error: "Invalid token_budget" });
    return;
  }
  dbSet("max_context_tokens", String(Math.floor(tokenBudget)));
  res.json({ ok: true });
});

app.get("/api/budget/presets", (_req, res) => {
  res.json({
    ok: true,
    presets: [
      { label: "Small", tokens: 2048, description: "Minimal context, fast responses" },
      { label: "Medium", tokens: 4096, description: "Balanced context and speed" },
      { label: "Large", tokens: 8192, description: "Generous context for complex tasks" },
      { label: "XLarge", tokens: 16384, description: "Maximum context for deep analysis" },
    ],
  });
});

app.get("/api/intent/presets", async (_req, res) => {
  try {
    await getDecisionTree();
  } catch {
    // Decision tree may not be available, serve presets regardless
  }
  res.json({
    ok: true,
    presets: [
      { intent: "auto", label: "Auto-detect", threshold: 0, chunks: 0 },
      { intent: "learn", label: "Learn", threshold: 0.5, chunks: 25 },
      { intent: "refactor", label: "Refactor", threshold: 0.6, chunks: 20 },
      { intent: "feature", label: "Feature", threshold: 0.6, chunks: 15 },
      { intent: "debug", label: "Debug", threshold: 0.7, chunks: 10 },
      { intent: "test", label: "Test", threshold: 0.65, chunks: 12 },
      { intent: "quick_chat", label: "Quick Chat", threshold: 0.3, chunks: 0 },
    ],
  });
});

app.get("/api/tuning", (_req, res) => {
  const fusion = getFusionWeights();
  const reranker = getRerankerStatus();
  res.json({
    ok: true,
    alpha: fusion.alpha,
    beta: fusion.beta,
    gamma: fusion.gamma,
    fusion,
    reranker,
    embedding: getEmbeddingStatus(),
  });
});

app.post("/api/tuning", (req, res) => {
  const body = req.body as any;
  try {
    const alpha = typeof body?.alpha === "number" ? body.alpha : undefined;
    const beta = typeof body?.beta === "number" ? body.beta : undefined;
    const gamma = typeof body?.gamma === "number" ? body.gamma : undefined;
    const rrfK = typeof body?.rrfK === "number" ? body.rrfK : undefined;
    if (alpha !== undefined && beta !== undefined && gamma !== undefined) {
      setFusionWeights(alpha, beta, gamma);
      dbSet("rrf_keyword_weight", String(alpha));
      dbSet("rrf_dense_weight", String(beta));
      dbSet("rrf_sparse_weight", String(gamma));
    }
    if (rrfK !== undefined) {
      setRrfK(rrfK);
      dbSet("rrf_k", String(rrfK));
    }
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message ?? String(e) });
  }
});

app.get("/api/memory", (_req, res) => {
  try {
    const db = getDb();
    const concepts = db
      .prepare(
        "SELECT id, name, session_count as visits FROM concepts ORDER BY session_count DESC LIMIT 20"
      )
      .all() as any[];
    res.json({
      ok: true,
      clusters: concepts.map((c) => ({ id: c.id, name: c.name, visits: c.visits })),
      top_concepts: concepts.slice(0, 10).map((c) => ({ name: c.name, count: c.visits })),
    });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message ?? String(e) });
  }
});

app.get("/api/memory/:conceptId", (req, res) => {
  const conceptId = req.params.conceptId;
  if (!conceptId) {
    res.status(400).json({ ok: false, error: "Missing conceptId" });
    return;
  }
  try {
    const db = getDb();
    const concept = db.prepare("SELECT id, name FROM concepts WHERE id = ?").get(conceptId) as any;
    const related = getConceptRelatedChunks(config.BRAIN_PROJECT_ROOT, conceptId, 10);
    res.json({
      ok: true,
      id: conceptId,
      name: concept?.name ?? conceptId,
      related_concepts: [],
      recent_accesses: related.map((c) => `${c.filepath} (${c.strength.toFixed(2)})`),
    });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message ?? String(e) });
  }
});

app.get("/api/tracer", (_req, res) => {
  try {
    const metrics = getTraceMetrics();
    const traces = getTraceData();
    const total = metrics.totalDecisions || 0;
    const successRate = total > 0 ? (metrics.successful || 0) / total : 0;
    res.json({
      ok: true,
      total_decisions: total,
      success_rate: successRate,
      avg_latency: null,
      intent_distribution: metrics.intents,
      recent_decisions: traces
        .slice(-20)
        .reverse()
        .map((d) => ({
          intent: d.intent,
          query: d.query,
          strategy: d.strategy,
          latency: null,
          timestamp: new Date(d.timestamp).toLocaleString(),
        })),
    });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message ?? String(e) });
  }
});

app.post("/api/feedback", async (req, res) => {
  try {
    const body = req.body as any;

    if (typeof body?.chunk_id === "string" && typeof body?.helpful === "boolean") {
      const conceptId = addConcept(config.BRAIN_PROJECT_ROOT, "ui_feedback");
      if (body.helpful) {
        linkConceptToChunk(config.BRAIN_PROJECT_ROOT, conceptId, body.chunk_id, 0.3);
      } else {
        dampenConceptChunkLink(config.BRAIN_PROJECT_ROOT, conceptId, body.chunk_id, 0.2);
      }
      res.json({ ok: true });
      return;
    }

    const sessionId = body?.sessionId;
    const rating = body?.rating;
    if (typeof sessionId !== "string" || !sessionId.trim()) {
      res.status(400).json({ ok: false, error: "Missing sessionId" });
      return;
    }
    if (rating !== 1 && rating !== -1) {
      res.status(400).json({ ok: false, error: "rating must be 1 or -1" });
      return;
    }

    const usedChunkIds =
      Array.isArray(body.usedChunkIds) && body.usedChunkIds.every((c: any) => typeof c === "string")
        ? body.usedChunkIds
        : undefined;

    await recordSessionFeedback(config.BRAIN_PROJECT_ROOT, {
      sessionId,
      rating,
      usedChunkIds,
    });
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message ?? String(e) });
  }
});

app.get("/api/status", (_req, res) => {
  try {
    const db = getDb();
    const files = (db.prepare("SELECT COUNT(*) as c FROM files").get() as any)?.c ?? 0;
    const chunks = (db.prepare("SELECT COUNT(*) as c FROM chunks").get() as any)?.c ?? 0;
    const concepts = (db.prepare("SELECT COUNT(*) as c FROM concepts").get() as any)?.c ?? 0;

    let ftsIndexed = 0;
    try {
      ftsIndexed = (db.prepare("SELECT COUNT(*) as c FROM fts_chunks").get() as any)?.c ?? 0;
    } catch {}
    let vectors = 0;
    try {
      vectors += (db.prepare("SELECT COUNT(*) as c FROM chunk_embeddings").get() as any)?.c ?? 0;
    } catch {}
    try {
      vectors +=
        (db.prepare("SELECT COUNT(*) as c FROM chunk_embeddings_nomic").get() as any)?.c ?? 0;
    } catch {}

    const indexHealth =
      chunks === 0
        ? "empty"
        : ftsIndexed === chunks && vectors > 0
          ? "healthy"
          : "reindex_required";
    const idx_status =
      indexHealth === "healthy" ? "online" : indexHealth === "empty" ? "offline" : "warning";

    res.json({
      lm_status: cachedModels.length > 0 ? "online" : "warning",
      db_status: "online",
      idx_status,
      mem_status: concepts > 0 ? "online" : "warning",
      metrics: {
        files,
        chunks,
        fts_index: ftsIndexed,
        vec_index: vectors,
        cache_hits: "--",
      },
      needs_reindex: indexHealth === "reindex_required",
      reindex_reason: indexHealth === "reindex_required" ? "fts/vectors not fully populated" : "",
      message:
        indexHealth === "healthy"
          ? "Index healthy"
          : indexHealth === "empty"
            ? "Index empty"
            : "Reindex required",
      raw: { files, chunks, ftsIndexed, vectors, indexHealth },
    });
  } catch (e: any) {
    res.status(500).json({ error: e?.message ?? String(e) });
  }
});

app.get("/api/index", (_req, res) => {
  try {
    const db = getDatabase(config.BRAIN_PROJECT_ROOT);
    const files = (db.prepare("SELECT COUNT(*) as c FROM files").get() as any)?.c ?? 0;
    const chunks = (db.prepare("SELECT COUNT(*) as c FROM chunks").get() as any)?.c ?? 0;
    let ftsIndexed = 0;
    try {
      ftsIndexed = (db.prepare("SELECT COUNT(*) as c FROM fts_chunks").get() as any)?.c ?? 0;
    } catch {}
    let vectors = 0;
    try {
      vectors += (db.prepare("SELECT COUNT(*) as c FROM chunk_embeddings").get() as any)?.c ?? 0;
    } catch {}
    try {
      vectors +=
        (db.prepare("SELECT COUNT(*) as c FROM chunk_embeddings_nomic").get() as any)?.c ?? 0;
    } catch {}

    const health =
      chunks === 0
        ? "empty"
        : ftsIndexed === chunks && vectors > 0
          ? "healthy"
          : "reindex_required";

    res.json({
      health,
      files,
      chunks,
      ftsIndexed,
      vectors,
    });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message ?? String(e) });
  }
});

app.get("/api/index/job", (_req, res) => {
  res.json({ ok: true, job: indexJob });
});

app.post("/api/index", async (req, res) => {
  const action = req.body?.action;
  const normalized =
    action === "reindex_full" || action === "full"
      ? "reindex_full"
      : action === "reindex_dirty" || action === "dirty"
        ? "reindex_dirty"
        : action === "clear_queue" || action === "clear"
          ? "clear_queue"
          : "";
  if (!normalized) {
    res.status(400).json({ ok: false, error: "Invalid action" });
    return;
  }

  if (normalized === "clear_queue") {
    res.json({ ok: true, action: normalized, chunksIndexed: 0 });
    return;
  }

  if (indexJob?.status === "running") {
    res.status(409).json({ ok: false, error: "Index job already running", job: indexJob });
    return;
  }

  const job: IndexJob = { id: randomUUID(), status: "running", action: normalized as any, startedAt: Date.now() };
  indexJob = job;

  void (async () => {
    try {
      const chunks =
        normalized === "reindex_full"
          ? await reindexProjectFull(config.BRAIN_PROJECT_ROOT)
          : await indexProject(config.BRAIN_PROJECT_ROOT);
      job.chunksIndexed = chunks.length;
      job.status = "success";
      job.endedAt = Date.now();
    } catch (e: any) {
      job.status = "error";
      job.error = e?.message ?? String(e);
      job.endedAt = Date.now();
    }
  })();

  res.status(202).json({ ok: true, action: normalized, job });
});

app.get("/api/health/lmstudio", async (_req, res) => {
  try {
    const base = config.LMSTUDIO_BASE_URL.replace(/\/+$/, "");
    const url = `${base}/models`;

    let response: Response;
    try {
      // Abort after 3 seconds — if LM Studio is not running, don't hang
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);
      response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);
    } catch (fetchErr: any) {
      // Connection refused or timeout — LM Studio is not running
      const isTimeout = fetchErr?.name === "AbortError" || fetchErr?.code === "UND_ERR_SOCKET";
      res.status(503).json({
        ok: false,
        reason: isTimeout ? "timeout" : "unreachable",
        error: isTimeout
          ? "LM Studio did not respond within 3s"
          : `Cannot connect to LM Studio at ${base}. Is it running?`,
        base_url: base,
        hint: "Start LM Studio and load a model first",
      });
      return;
    }

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      res.status(502).json({
        ok: false,
        reason: "http_error",
        error: `LM Studio request failed (${response.status} ${response.statusText})${body ? `: ${body}` : ""}`,
        hint:
          response.status === 404
            ? "LM Studio is running but /models endpoint not found"
            : "Check LM Studio server logs",
      });
      return;
    }

    const models = (await response.json()) as any;
    const modelIds = Array.isArray(models?.data)
      ? models.data.map((m: any) => m?.id).filter(Boolean)
      : [];
    const loadedModels = await defaultProvider.getLoadedModels().catch(() => []);

    res.json({
      ok: true,
      model_ids: modelIds,
      loaded_models: loadedModels,
      model_count: modelIds.length,
      has_chat: modelIds.some((id: string) => !/(embed|embedding|rerank|reranker)/i.test(id)),
      has_embed: modelIds.some((id: string) => /(embed|embedding)/i.test(id)),
      has_rerank: modelIds.some((id: string) => /(rerank|reranker)/i.test(id)),
    });
  } catch (err: any) {
    res.status(502).json({ ok: false, error: err?.message ?? String(err) });
  }
});

app.post("/api/health/embed", async (req, res) => {
  const query = req.body?.query;
  if (typeof query !== "string" || query.trim().length === 0) {
    res.status(400).json({ ok: false, error: "Missing query" });
    return;
  }

  try {
    const { vectors, modelType } = await getEmbeddings(config.BRAIN_PROJECT_ROOT, [query]);
    const dims = vectors?.[0]?.length ?? 0;

    if (dims <= 0) {
      res.status(502).json({ ok: false, error: "Embedding backend returned an empty vector" });
      return;
    }

    res.json({ ok: true, dims, modelType, status: getEmbeddingStatus() });
  } catch (err: any) {
    res.status(502).json({ ok: false, error: err?.message ?? String(err) });
  }
});

app.post("/api/health/rerank", async (req, res) => {
  const query = req.body?.query;
  if (typeof query !== "string" || query.trim().length === 0) {
    res.status(400).json({ ok: false, error: "Missing query" });
    return;
  }

  const initialStatus = getRerankerStatus();
  if (!initialStatus.enabled) {
    res.status(503).json({
      ok: false,
      reason: "disabled",
      error: "Reranker is disabled",
      status: initialStatus,
    });
    return;
  }

  const passages = req.body?.passages;
  const contentList =
    Array.isArray(passages) &&
    passages.every((p: any) => typeof p === "string") &&
    passages.length > 0
      ? passages
      : [
          "This is a short example passage about embeddings and vector search.",
          "This passage talks about reranking and cross-encoders for better relevance.",
          "This is a third passage with some related technical context.",
        ];

  const items: SearchResultItem[] = contentList
    .slice(0, 12)
    .map((content: string, idx: number) => ({
      id: `health-passage-${idx + 1}`,
      filepath: "health://passage",
      language: "text",
      type: "passage",
      name: `passage-${idx + 1}`,
      start_line: 0,
      end_line: 0,
      content,
      score: 1 / (idx + 1),
    }));

  try {
    const status = await prewarmReranker(config.BRAIN_PROJECT_ROOT);
    if (!status.loaded) {
      res.status(503).json({
        ok: false,
        reason: status.importFailed ? "import_failed" : "not_loaded",
        error: status.lastError || "Reranker is enabled but not loaded",
        status,
      });
      return;
    }
    const reranked = await rerankChunks(config.BRAIN_PROJECT_ROOT, query, items, "learn");
    res.json({
      ok: true,
      status,
      results: reranked.map((r) => ({ id: r.id, score: r.score ?? 0 })),
    });
  } catch (err: any) {
    res
      .status(502)
      .json({ ok: false, reason: "execution_failed", error: err?.message ?? String(err) });
  }
});

app.get("/api/health/brain", async (_req, res) => {
  try {
    const db = getDatabase(config.BRAIN_PROJECT_ROOT);
    const dbStats = {
      fileCount: 0,
      chunkCount: 0,
      vectorCount: 0,
      conceptCount: 0,
      sessionCount: 0,
      ftsCount: 0,
      dbSize: 0,
      vectorActive: false,
    };

    try {
      dbStats.fileCount = (db.prepare("SELECT COUNT(*) as c FROM files").get() as any)?.c ?? 0;
      dbStats.chunkCount = (db.prepare("SELECT COUNT(*) as c FROM chunks").get() as any)?.c ?? 0;
      dbStats.vectorCount = (db.prepare("SELECT COUNT(*) as c FROM chunk_embeddings").get() as any)?.c ?? 0;
      dbStats.conceptCount = (db.prepare("SELECT COUNT(*) as c FROM concepts").get() as any)?.c ?? 0;
      dbStats.sessionCount = (db.prepare("SELECT COUNT(*) as c FROM sessions").get() as any)?.c ?? 0;
      dbStats.ftsCount = (db.prepare("SELECT COUNT(*) as c FROM fts_chunks").get() as any)?.c ?? 0;
      dbStats.vectorActive = isVectorActive(db);
    } catch (err: any) {
      dbStats.error = err?.message ?? String(err);
    }

    try {
      const stats = fs.statSync(path.join(config.BRAIN_PROJECT_ROOT, ".opencode", "brain.db"));
      dbStats.dbSize = stats.size;
    } catch {
      // ignore missing/locked file size
    }

    const brainHealth: any = {
      ok: true,
      database: dbStats,
      lmstudio: {
        ok: false,
        connected: false,
        modelCount: 0,
        loadedModels: [],
        error: undefined,
      },
      embed: {
        ok: false,
        dims: 0,
        modelType: "",
        error: undefined,
      },
      rerank: {
        ok: false,
        enabled: false,
        modelId: "",
        loaded: false,
        importFailed: false,
        lastError: undefined,
      },
      retrieval: {
        ok: false,
        resultCount: 0,
        error: undefined,
      },
    };

    try {
      const loadedModels = await defaultProvider.getLoadedModels();
      brainHealth.lmstudio.connected = true;
      brainHealth.lmstudio.ok = true;
      brainHealth.lmstudio.loadedModels = loadedModels;
      brainHealth.lmstudio.modelCount = loadedModels.length;
    } catch (err: any) {
      brainHealth.lmstudio.error = err?.message ?? String(err);
    }

    try {
      const { vectors, modelType } = await getEmbeddings(config.BRAIN_PROJECT_ROOT, ["health-check"]);
      brainHealth.embed.ok = Array.isArray(vectors) && vectors[0]?.length > 0;
      brainHealth.embed.dims = vectors?.[0]?.length ?? 0;
      brainHealth.embed.modelType = modelType;
    } catch (err: any) {
      brainHealth.embed.error = err?.message ?? String(err);
    }

    try {
      const rerankStatus = await prewarmReranker(config.BRAIN_PROJECT_ROOT);
      brainHealth.rerank.enabled = rerankStatus.enabled;
      brainHealth.rerank.modelId = rerankStatus.modelId;
      brainHealth.rerank.loaded = rerankStatus.loaded;
      brainHealth.rerank.importFailed = rerankStatus.importFailed;
      brainHealth.rerank.lastError = rerankStatus.lastError;
      brainHealth.rerank.ok = rerankStatus.loaded;
    } catch (err: any) {
      brainHealth.rerank.error = err?.message ?? String(err);
    }

    try {
      const results = await searchProjectContext(config.BRAIN_PROJECT_ROOT, "health check", 5, "learn");
      brainHealth.retrieval.ok = true;
      brainHealth.retrieval.resultCount = Array.isArray(results) ? results.length : 0;
    } catch (err: any) {
      brainHealth.retrieval.error = err?.message ?? String(err);
    }

    res.json(brainHealth);
  } catch (err: any) {
    res.status(502).json({ ok: false, error: err?.message ?? String(err) });
  }
});

app.post("/api/ingest", async (req, res) => {
  try {
    const body = req.body as {
      source?: "paste" | "url";
      content?: string;
      url?: string;
      title?: string;
    };

    if (body.source !== "paste" && body.source !== "url") {
      res.status(400).json({ ok: false, error: "Invalid source" });
      return;
    }

    let content = "";
    let sourceUrl: string | undefined;
    let title = body.title;

    if (body.source === "paste") {
      if (!body.content?.trim()) {
        res.status(400).json({ ok: false, error: "content is required for paste" });
        return;
      }
      content = body.content;
    } else {
      if (!body.url?.trim()) {
        res.status(400).json({ ok: false, error: "url is required for url source" });
        return;
      }
      sourceUrl = body.url;
      const response = await fetch(body.url, { redirect: "follow" });
      if (!response.ok) {
        res.status(400).json({ ok: false, error: `Failed to fetch url: ${response.status}` });
        return;
      }
      const html = await response.text();
      title = title ?? extractHtmlTitle(html);
      content = stripTags(html);
      if (!content.trim()) {
        res.status(400).json({ ok: false, error: "No extractable content from url" });
        return;
      }
    }

    const docId = sha256Hex(content).slice(0, 16);
    const chunks = await indexDocs(config.BRAIN_PROJECT_ROOT, [
      { docId, title, content, sourceUrl },
    ]);
    res.json({ ok: true, docId, chunksIndexed: chunks.length });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message ?? "Unknown error" });
  }
});

async function handleSearch(
  body: {
    query?: string;
    intent?: string;
    topK?: number;
    debug?: boolean;
    confidence?: number;
  },
  res: express.Response
): Promise<void> {
  const query = body?.query;
  if (typeof query !== "string" || query.trim().length === 0) {
    res.status(400).json({ ok: false, error: "Missing query" });
    return;
  }

  let ragRunId: string | undefined;
  try {
    try {
      ragRunId = recordRunStart(config.BRAIN_PROJECT_ROOT, {
        kind: "rag",
        name: "search",
        traceId: "dashboard",
        meta: { query },
      });
    } catch {}

    let intent = typeof body.intent === "string" && body.intent.trim() ? body.intent.trim() : "";
    let confidence = typeof body.confidence === "number" ? body.confidence : 0.7;

    const decisionTree = await getDecisionTree();
    const classification = decisionTree.classify(query, {
      message: "",
      recentFiles: [],
      diagnostics: [],
    });
    if (!intent) {
      intent = classification.node.intent;
    }
    if (typeof body.confidence !== "number") {
      confidence = Math.max(0, Math.min(1, classification.score));
    }

    const strategy = decisionTree.selectStrategy(classification.node);
    const topK =
      typeof body.topK === "number" && Number.isFinite(body.topK) && body.topK > 0
        ? Math.floor(body.topK)
        : Math.max(8, strategy.maxChunks);

    const out = await searchProjectContextDebug(
      config.BRAIN_PROJECT_ROOT,
      query,
      topK,
      intent,
      confidence
    );
    let results = out.results;
    let debug = out.debug as any;

    if (!results || results.length === 0) {
      const db = getDb();
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
        score: 0.1,
      }));

      debug = {
        ...debug,
        fallback: { enabled: true, type: "like", hits: rows.length },
      };
    }

    const fusion = getFusionWeights();
    const topFiles = Array.from(
      new Set((debug?.stage1_fts ?? []).map((r: any) => r.filepath).filter(Boolean))
    ).slice(0, 10);

    const pipeline = {
      fts: {
        timing: debug?.timings?.ftsMs ?? 0,
        hits: (debug?.stage1_fts ?? []).length,
        top_files: topFiles,
      },
      dense: {
        timing: debug?.timings?.denseMs ?? 0,
        model:
          getEmbeddingConfig().backend === "lmstudio"
            ? getEmbeddingConfig().lmstudioModelId
            : getEmbeddingConfig().localModelId,
        scores: (debug?.stage2_dense ?? [])
          .slice(0, 10)
          .map((r: any) => ({ file: r.filepath, score: r.score ?? 0 })),
      },
      fusion: {
        timing: debug?.timings?.fusionMs ?? 0,
        alpha: fusion.alpha,
        beta: fusion.beta,
        fused_count: (debug?.stage3_fused ?? []).length,
      },
      rerank: {
        timing: debug?.timings?.rerankMs ?? 0,
        gate: debug?.rerank?.gate ?? null,
        threshold: debug?.rerank?.threshold ?? null,
        reranker: debug?.rerank?.enabled ? getRerankerStatus().modelId : "none",
      },
      inject: { timing: 0, chunks: results.length, tokens: 0, efficiency: 0 },
    };

    if (ragRunId) {
      try {
        recordRunEnd(config.BRAIN_PROJECT_ROOT, ragRunId, {
          status: "success",
          metaPatch: {
            intent,
            confidence,
            topK,
            timings: debug?.timings,
            rerank: debug?.rerank,
            pipeline,
            resultsCount: results.length,
          },
        });
      } catch {}
    }

    res.json({
      ok: true,
      query,
      intent,
      confidence,
      topK,
      chunk_hint: `${topK}`,
      pipeline,
      results: results.map((r: any) => ({
        id: r.id,
        filepath: r.filepath,
        fts_score: 0,
        vec_score: 0,
        final_score: r.score ?? 0,
        snippet: r.content ?? "",
      })),
      debug: body.debug ? debug : undefined,
    });
  } catch (err: any) {
    if (ragRunId) {
      try {
        recordRunEnd(config.BRAIN_PROJECT_ROOT, ragRunId, {
          status: "error",
          metaPatch: { error: err?.message ?? String(err) },
        });
      } catch {}
    }
    res.status(500).json({ ok: false, error: err?.message ?? String(err) });
  }
}

app.get("/api/search", async (req, res) => {
  const topK = typeof req.query?.topK === "string" ? Number(req.query.topK) : undefined;
  const confidence =
    typeof req.query?.confidence === "string" ? Number(req.query.confidence) : undefined;
  const debugRaw = typeof req.query?.debug === "string" ? req.query.debug : undefined;

  await handleSearch(
    {
      query:
        typeof req.query?.q === "string"
          ? req.query.q
          : typeof req.query?.query === "string"
            ? req.query.query
            : undefined,
      intent: typeof req.query?.intent === "string" ? req.query.intent : undefined,
      topK: Number.isFinite(topK as number) ? (topK as number) : undefined,
      confidence: Number.isFinite(confidence as number) ? (confidence as number) : undefined,
      debug: debugRaw === "1" || debugRaw === "true",
    },
    res
  );
});

app.post("/api/search", async (req, res) => {
  await handleSearch(req.body, res);
});

function getMaxContextTokens(): number {
  const val = Number(dbGet("max_context_tokens") ?? "3000");
  return Number.isFinite(val) && val > 0 ? Math.floor(val) : 3000;
}

function upsertSessionRow(
  sessionId: string,
  intent: string,
  query: string,
  retrievedChunkIds: string[],
  latencyMs: number
): void {
  const db = getDb();
  const now = Date.now();
  db.prepare(
    `INSERT OR IGNORE INTO sessions (id, started_at, intent, query, retrieved_chunks, used_chunks, user_rating, latency_ms)
     VALUES (?, ?, ?, ?, ?, ?, NULL, ?)`
  ).run(
    sessionId,
    now,
    intent,
    query,
    JSON.stringify(retrievedChunkIds),
    JSON.stringify([]),
    latencyMs
  );
  db.prepare(
    `UPDATE sessions
     SET intent = ?, query = ?, retrieved_chunks = ?, latency_ms = ?
     WHERE id = ?`
  ).run(intent, query, JSON.stringify(retrievedChunkIds), latencyMs, sessionId);
}

app.post("/api/chat/stream", async (req, res) => {
  const body = req.body as {
    message?: string;
    history?: Array<{ role: "user" | "assistant" | "system"; content: string }>;
    sessionId?: string;
    intentOverride?: string;
    debugPrompt?: boolean;
  };

  const message = body?.message;
  if (typeof message !== "string" || message.trim().length === 0) {
    res.status(400).json({ ok: false, error: "Missing message" });
    return;
  }

  const startedAt = Date.now();
  const sessionId =
    typeof body.sessionId === "string" && body.sessionId.trim()
      ? body.sessionId.trim()
      : randomUUID();

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  (res as any).flushHeaders?.();

  try {
    let intent =
      typeof body.intentOverride === "string" && body.intentOverride.trim()
        ? body.intentOverride.trim()
        : "";
    const decisionTree = await getDecisionTree();
    const classification = decisionTree.classify(message, {
      message: "",
      recentFiles: [],
      diagnostics: [],
    });
    if (!intent) intent = classification.node.intent;
    const confidence = Math.max(0, Math.min(1, classification.score));
    const strategyMaxChunks = decisionTree.selectStrategy(classification.node).maxChunks;

    await ensureChatModelIdOnce();

    const retrieval = await searchProjectContextDebug(
      config.BRAIN_PROJECT_ROOT,
      message,
      strategyMaxChunks,
      intent,
      confidence
    );

    const chunks = retrieval.results.map((r: any) => ({
      id: r.id,
      text: r.content ?? "",
      path: r.filepath,
      startLine: r.start_line,
      endLine: r.end_line,
      mtime: 0,
      score: r.score ?? 0,
    }));

    const retrievalResult = {
      chunks: chunks.map((c) => ({
        text: c.text,
        path: c.path,
        startLine: c.startLine,
        endLine: c.endLine,
        mtime: 0,
        score: c.score,
      })),
      totalChunks: chunks.length,
    };

    const maxTokens = getMaxContextTokens();
    const augmentedPrompt = contextInjector.inject(message, retrievalResult as any, {
      intent,
      maxTokens,
    });

    const history =
      Array.isArray(body.history) &&
      body.history.every((h) => h && typeof h.role === "string" && typeof h.content === "string")
        ? body.history
        : [];

    const temperature =
      intent === "debug"
        ? 0.2
        : intent === "refactor"
          ? 0.3
          : intent === "test"
            ? 0.3
            : intent === "feature"
              ? 0.6
              : intent === "learn"
                ? 0.5
                : intent === "quick_chat"
                  ? 0.8
                  : 0.7;

    upsertSessionRow(
      sessionId,
      intent,
      message,
      chunks.map((c) => c.id),
      0
    );
    sessionMemory.recordDecision({
      timestamp: Date.now(),
      intent,
      strategy: "dashboard_chat",
      contextCount: chunks.length,
      query: message,
      success: chunks.length > 0,
    } as any);

    res.write(
      `data: ${JSON.stringify({
        type: "meta",
        sessionId,
        intent,
        confidence,
        context: chunks.slice(0, 10).map((c) => `${c.path}:${c.startLine}-${c.endLine}`),
        ...(body.debugPrompt ? { augmented_prompt: augmentedPrompt } : {}),
      })}\n\n`
    );

    const base = config.LMSTUDIO_BASE_URL.replace(/\/+$/, "");
    const url = `${base}/chat/completions`;
    const upstream = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: chatModelId,
        messages: [...history, { role: "user", content: augmentedPrompt }],
        temperature,
        max_tokens: 1200,
        stream: true,
      }),
    });

    if (!upstream.ok || !upstream.body) {
      const errText = await upstream.text().catch(() => "");
      res.write(
        `data: ${JSON.stringify({
          type: "error",
          error: `LM Studio stream failed (${upstream.status} ${upstream.statusText})${errText ? `: ${errText}` : ""}`,
        })}\n\n`
      );
      res.end();
      return;
    }

    const reader = upstream.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let full = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split("\n");
      buffer = parts.pop() || "";

      for (const line of parts) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const data = trimmed.slice("data:".length).trim();
        if (!data || data === "[DONE]") continue;
        try {
          const json = JSON.parse(data);
          const delta =
            json?.choices?.[0]?.delta?.content ??
            json?.choices?.[0]?.delta?.text ??
            json?.choices?.[0]?.message?.content ??
            "";
          if (delta) {
            full += delta;
            res.write(`data: ${JSON.stringify({ type: "delta", delta })}\n\n`);
          }
        } catch {}
      }
    }

    const latencyMs = Date.now() - startedAt;
    upsertSessionRow(
      sessionId,
      intent,
      message,
      chunks.map((c) => c.id),
      latencyMs
    );
    await indexChatTurn(config.BRAIN_PROJECT_ROOT, sessionId, message, full);

    res.write(`data: ${JSON.stringify({ type: "done", response: full, latencyMs })}\n\n`);
    res.end();
  } catch (err: any) {
    res.write(`data: ${JSON.stringify({ type: "error", error: err?.message ?? String(err) })}\n\n`);
    res.end();
  }
});

app.post("/api/chat", async (req, res) => {
  const body = req.body as {
    message?: string;
    history?: Array<{ role: "user" | "assistant" | "system"; content: string }>;
    sessionId?: string;
    intentOverride?: string;
    debugPrompt?: boolean;
  };

  const message = body?.message;
  if (typeof message !== "string" || message.trim().length === 0) {
    res.status(400).json({ ok: false, error: "Missing message" });
    return;
  }

  try {
    let intent =
      typeof body.intentOverride === "string" && body.intentOverride.trim()
        ? body.intentOverride.trim()
        : "";
    let confidence = 0.7;
    let strategyMaxChunks = 10;

    const decisionTree = await getDecisionTree();
    const classification = decisionTree.classify(message, {
      message: "",
      recentFiles: [],
      diagnostics: [],
    });
    if (!intent) {
      intent = classification.node.intent;
    }
    confidence = Math.max(0, Math.min(1, classification.score));
    strategyMaxChunks = decisionTree.selectStrategy(classification.node).maxChunks;

    await ensureChatModelIdOnce();
    const retrieval = await searchProjectContextDebug(
      config.BRAIN_PROJECT_ROOT,
      message,
      strategyMaxChunks,
      intent,
      confidence
    );

    const chunks = retrieval.results.map((r: any) => ({
      text: r.content ?? "",
      path: r.filepath,
      startLine: r.start_line,
      endLine: r.end_line,
      mtime: 0,
      score: r.score ?? 0,
    }));

    const retrievalResult = {
      chunks,
      totalChunks: chunks.length,
    };

    const sessionId =
      typeof body.sessionId === "string" && body.sessionId.trim()
        ? body.sessionId.trim()
        : randomUUID();
    const maxTokens = getMaxContextTokens();
    const augmentedPrompt = contextInjector.inject(message, retrievalResult as any, {
      intent,
      maxTokens,
    });

    const history =
      Array.isArray(body.history) &&
      body.history.every((h) => h && typeof h.role === "string" && typeof h.content === "string")
        ? body.history
        : [];

    const temperature =
      intent === "debug"
        ? 0.2
        : intent === "refactor"
          ? 0.3
          : intent === "test"
            ? 0.3
            : intent === "feature"
              ? 0.6
              : intent === "learn"
                ? 0.5
                : intent === "quick_chat"
                  ? 0.8
                  : 0.7;

    const response = await defaultProvider.chat(
      chatModelId,
      [...history, { role: "user", content: augmentedPrompt }],
      { temperature, maxTokens: 1200 }
    );

    upsertSessionRow(
      sessionId,
      intent,
      message,
      retrieval.results.map((r: any) => r.id).filter(Boolean),
      0
    );
    await indexChatTurn(config.BRAIN_PROJECT_ROOT, sessionId, message, response);

    res.json({
      ok: true,
      sessionId,
      response,
      context: chunks.slice(0, 10).map((c) => `${c.path}:${c.startLine}-${c.endLine}`),
      ...(body.debugPrompt ? { augmented_prompt: augmentedPrompt } : {}),
      debug: { intent, confidence, timings: retrieval.debug.timings, chunksUsed: chunks.length },
    });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err?.message ?? String(err) });
  }
});

function parseLimit(value: unknown, fallback: number, max: number): number {
  const n = typeof value === "string" ? Number(value) : typeof value === "number" ? value : NaN;
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(Math.floor(n), max);
}

app.get("/api/telemetry/runs", (req, res) => {
  try {
    const limit = parseLimit(req.query?.limit, 50, 500);
    const kind = typeof req.query?.kind === "string" && req.query.kind.trim() ? req.query.kind.trim() : undefined;
    const sessionId =
      typeof req.query?.sessionId === "string" && req.query.sessionId.trim()
        ? req.query.sessionId.trim()
        : undefined;
    const traceId =
      typeof req.query?.traceId === "string" && req.query.traceId.trim() ? req.query.traceId.trim() : undefined;

    const where: string[] = [];
    const params: any[] = [];
    if (kind) {
      where.push("kind = ?");
      params.push(kind);
    }
    if (sessionId) {
      where.push("session_id = ?");
      params.push(sessionId);
    }
    if (traceId) {
      where.push("trace_id = ?");
      params.push(traceId);
    }

    const sql = `SELECT id, started_at, ended_at, duration_ms, kind, name, session_id, trace_id, status, meta_json
                 FROM telemetry_runs
                 ${where.length > 0 ? `WHERE ${where.join(" AND ")}` : ""}
                 ORDER BY started_at DESC
                 LIMIT ?`;
    params.push(limit);

    const rows = getDb().prepare(sql).all(...params) as any[];
    res.json({
      ok: true,
      runs: rows.map((r) => {
        let meta: any = {};
        try {
          meta = r.meta_json ? JSON.parse(r.meta_json) : {};
        } catch {}
        return {
          id: r.id,
          started_at: r.started_at,
          ended_at: r.ended_at,
          duration_ms: r.duration_ms,
          kind: r.kind,
          name: r.name,
          session_id: r.session_id,
          trace_id: r.trace_id,
          status: r.status,
          meta,
        };
      }),
    });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message ?? String(e) });
  }
});

app.get("/api/telemetry/run/:id", (req, res) => {
  try {
    const id = req.params?.id;
    const row = getDb()
      .prepare(
        `SELECT id, started_at, ended_at, duration_ms, kind, name, session_id, trace_id, status, meta_json
         FROM telemetry_runs
         WHERE id = ?`
      )
      .get(id) as any;
    if (!row) {
      res.status(404).json({ ok: false, error: "Not found" });
      return;
    }
    let meta: any = {};
    try {
      meta = row.meta_json ? JSON.parse(row.meta_json) : {};
    } catch {}
    res.json({ ok: true, run: { ...row, meta } });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message ?? String(e) });
  }
});

app.get("/api/telemetry/events", (req, res) => {
  try {
    const limit = parseLimit(req.query?.limit, 100, 1000);
    const traceId =
      typeof req.query?.traceId === "string" && req.query.traceId.trim() ? req.query.traceId.trim() : undefined;
    const sessionId =
      typeof req.query?.sessionId === "string" && req.query.sessionId.trim()
        ? req.query.sessionId.trim()
        : undefined;
    const level =
      typeof req.query?.level === "string" && req.query.level.trim() ? req.query.level.trim() : undefined;

    const where: string[] = [];
    const params: any[] = [];
    if (traceId) {
      where.push("trace_id = ?");
      params.push(traceId);
    }
    if (sessionId) {
      where.push("session_id = ?");
      params.push(sessionId);
    }
    if (level) {
      where.push("level = ?");
      params.push(level);
    }

    const sql = `SELECT id, ts, trace_id, session_id, level, category, message, extra_json
                 FROM telemetry_events
                 ${where.length > 0 ? `WHERE ${where.join(" AND ")}` : ""}
                 ORDER BY ts DESC
                 LIMIT ?`;
    params.push(limit);

    const rows = getDb().prepare(sql).all(...params) as any[];
    res.json({
      ok: true,
      events: rows.map((r) => {
        let extra: any = undefined;
        try {
          extra = r.extra_json ? JSON.parse(r.extra_json) : undefined;
        } catch {}
        return { ...r, extra };
      }),
    });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message ?? String(e) });
  }
});

app.post("/api/telemetry/purge", (_req, res) => {
  try {
    pruneOldTelemetry(config.BRAIN_PROJECT_ROOT, { keepMs: telemetryKeepMs });
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message ?? String(e) });
  }
});

app.get("/api/rag/sessions", (req, res) => {
  try {
    const limit = parseLimit(req.query?.limit, 50, 500);
    const rows = getDb()
      .prepare(
        `SELECT id, started_at, intent, query, retrieved_chunks, used_chunks, user_rating, latency_ms
         FROM sessions
         ORDER BY started_at DESC
         LIMIT ?`
      )
      .all(limit) as any[];
    res.json({
      ok: true,
      sessions: rows.map((r) => ({
        ...r,
        retrieved_chunks: (() => {
          try {
            return JSON.parse(r.retrieved_chunks ?? "[]");
          } catch {
            return [];
          }
        })(),
        used_chunks: (() => {
          try {
            return JSON.parse(r.used_chunks ?? "[]");
          } catch {
            return [];
          }
        })(),
      })),
    });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message ?? String(e) });
  }
});

app.get("/api/rag/session/:id", (req, res) => {
  try {
    const id = req.params?.id;
    const row = getDb()
      .prepare(
        `SELECT id, started_at, intent, query, retrieved_chunks, used_chunks, user_rating, latency_ms
         FROM sessions
         WHERE id = ?`
      )
      .get(id) as any;
    if (!row) {
      res.status(404).json({ ok: false, error: "Not found" });
      return;
    }
    const retrieved: string[] = (() => {
      try {
        return JSON.parse(row.retrieved_chunks ?? "[]");
      } catch {
        return [];
      }
    })();
    const used: string[] = (() => {
      try {
        return JSON.parse(row.used_chunks ?? "[]");
      } catch {
        return [];
      }
    })();

    const ids = Array.from(new Set(retrieved.concat(used))).slice(0, 50);
    let chunks: any[] = [];
    if (ids.length > 0) {
      const placeholders = ids.map(() => "?").join(", ");
      chunks = getDb()
        .prepare(
          `SELECT id, filepath, start_line, end_line, substr(content, 1, 240) as snippet
           FROM chunks
           WHERE id IN (${placeholders})`
        )
        .all(...ids) as any[];
    }

    res.json({
      ok: true,
      session: {
        ...row,
        retrieved_chunks: retrieved,
        used_chunks: used,
        chunks,
      },
    });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message ?? String(e) });
  }
});

app.post("/api/rag/session/:id/feedback", async (req, res) => {
  try {
    const id = req.params?.id;
    const rating = req.body?.rating;
    const usedChunkIds = Array.isArray(req.body?.usedChunkIds) ? req.body.usedChunkIds : undefined;
    if (rating !== 1 && rating !== -1) {
      res.status(400).json({ ok: false, error: "rating must be 1 or -1" });
      return;
    }
    await recordSessionFeedback(config.BRAIN_PROJECT_ROOT, {
      sessionId: id,
      rating,
      usedChunkIds,
    });
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message ?? String(e) });
  }
});

app.get("/api/opencode/health", async (_req, res) => {
  try {
    const base = config.OPENCODE_SERVER_BASE_URL.replace(/\/+$/, "");
    const upstream = await fetch(`${base}/global/health`);
    const json = await upstream.json().catch(() => undefined);
    res.status(upstream.ok ? 200 : 502).json({ ok: upstream.ok, upstream: json });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message ?? String(e) });
  }
});

app.get("/api/opencode/sessions", async (_req, res) => {
  try {
    const base = config.OPENCODE_SERVER_BASE_URL.replace(/\/+$/, "");
    const upstream = await fetch(`${base}/session`);
    const json = await upstream.json().catch(() => undefined);
    res.status(upstream.ok ? 200 : 502).json({ ok: upstream.ok, upstream: json });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message ?? String(e) });
  }
});

app.get("/api/harness/runs", (req, res) => {
  try {
    const limit = parseLimit(req.query?.limit, 50, 500);
    const rows = getDb()
      .prepare(
        `SELECT id, started_at, ended_at, duration_ms, name, session_id, trace_id, status, meta_json
         FROM telemetry_runs
         WHERE kind = 'harness'
         ORDER BY started_at DESC
         LIMIT ?`
      )
      .all(limit) as any[];
    res.json({
      ok: true,
      runs: rows.map((r) => {
        let meta: any = {};
        try {
          meta = r.meta_json ? JSON.parse(r.meta_json) : {};
        } catch {}
        return { ...r, meta };
      }),
    });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message ?? String(e) });
  }
});

app.post("/api/harness/run", async (req, res) => {
  const suite = req.body?.suite === "full" ? "full" : "smoke";
  const mode = req.body?.mode === "live" ? "live" : "simulated";
  let runId: string | undefined;
  try {
    runId = recordRunStart(config.BRAIN_PROJECT_ROOT, {
      kind: "harness",
      name: `benchmark:${suite}`,
      traceId: "dashboard",
      meta: { suite, mode },
    });
  } catch {}

  try {
    const tasksMod = (await import("../meta-harness/benchmark/tasks.ts")) as any;
    const loadTasks = tasksMod.loadTasks ?? tasksMod.default?.loadTasks;
    if (!loadTasks) throw new Error("loadTasks not available");
    const runnerMod = (await import("../meta-harness/runner.ts")) as any;
    const runBenchmark = runnerMod.runBenchmark ?? runnerMod.default?.runBenchmark;
    if (!runBenchmark) throw new Error("runBenchmark not available");
    const tasks = loadTasks(suite);
    const harnessSpace = (await import("../meta-harness/harness-space.ts")) as any;
    const harnessConfig = harnessSpace.DEFAULT_HARNESS_CONFIG ?? harnessSpace.default?.DEFAULT_HARNESS_CONFIG;
    if (!harnessConfig) throw new Error("DEFAULT_HARNESS_CONFIG not available");
    const startedAt = Date.now();
    const result = await runBenchmark({
      mode,
      projectRoot: config.BRAIN_PROJECT_ROOT,
      outputDir: path.join(config.BRAIN_PROJECT_ROOT, ".opencode", "meta-harness-logs"),
      config: harnessConfig,
      tasks,
    });
    const durationMs = Math.max(0, Date.now() - startedAt);

    if (runId) {
      recordRunEnd(config.BRAIN_PROJECT_ROOT, runId, {
        status: "success",
        metaPatch: {
          durationMs,
          score: result.aggregate.score,
          aggregate: result.aggregate,
          tasks: result.tasks.length,
        },
      });
    }

    res.json({ ok: true, result });
  } catch (e: any) {
    if (runId) {
      recordRunEnd(config.BRAIN_PROJECT_ROOT, runId, {
        status: "error",
        metaPatch: { error: e?.message ?? String(e) },
      });
    }
    res.status(500).json({ ok: false, error: e?.message ?? String(e) });
  }
});

async function listenOnce(p: number): Promise<import("http").Server> {
  return await new Promise((resolve, reject) => {
    const server = app.listen(p);
    const onError = (err: any) => {
      server.off("listening", onListening);
      try {
        server.close();
      } catch {}
      reject(err);
    };
    const onListening = () => {
      server.off("error", onError);
      resolve(server);
    };
    server.once("error", onError);
    server.once("listening", onListening);
  });
}

async function startServer(): Promise<void> {
  const attempts = portExplicit ? 1 : 5;
  let currentPort = port;

  for (let i = 0; i < attempts; i++) {
    try {
      const server = await listenOnce(currentPort);
      const addr = server.address();
      const url =
        typeof addr === "object" && addr
          ? `http://localhost:${(addr as AddressInfo).port}`
          : `http://localhost:${currentPort}`;
      console.log(`Brain dashboard server running on ${url}`);
      return;
    } catch (err: any) {
      if (err?.code === "EADDRINUSE" && !portExplicit && i < attempts - 1) {
        currentPort += 1;
        continue;
      }
      throw err;
    }
  }
}

startServer().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
