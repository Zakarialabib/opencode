import { Database } from "bun:sqlite";
import { readFileSync, existsSync, statSync, writeFileSync, mkdirSync, readdirSync, createWriteStream } from "fs";
import { join, dirname, basename } from "path";
import { fileURLToPath } from "url";
import { createHash } from "crypto";
import https from "https";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BRAIN_DB_PATH = join(__dirname, "..", ".opencode", "brain.db");
const CONFIG_PATH = join(__dirname, "brain-dashboard-config.json");
const MODELS_CACHE_DIR = join(__dirname, "..", ".opencode", "models");
const PORT = 3456;

// ─── Model Catalog (HuggingFace) ───────────────────────────────────────────────
const MODEL_CATALOG = [
  {
    id: "qwen3-embedding-0.6b",
    name: "Qwen/Qwen3-Embedding-0.6B",
    type: "embedding",
    sizeGB: 0.32,
    dimensions: 1024,
    description: "Lightweight embedding model for semantic search",
    hfRepo: "Qwen/Qwen3-Embedding-0.6B",
  },
  {
    id: "nomic-embed-text-v1.5",
    name: "nomic-ai/nomic-embed-text-v1.5",
    type: "embedding",
    sizeGB: 0.08,
    dimensions: 768,
    description: "Ultra-light embedding model, 84MB",
    hfRepo: "nomic-ai/nomic-embed-text-v1.5",
  },
  {
    id: "qwen3-reranker-0.6b",
    name: "Qwen/Qwen3-Reranker-0.6B",
    type: "reranker",
    sizeGB: 0.32,
    dimensions: null,
    description: "Cross-encoder reranker for RAG pipeline",
    hfRepo: "Qwen/Qwen3-Reranker-0.6B",
  },
  {
    id: "qwen3.5-4b",
    name: "Qwen/Qwen3.5-4B",
    type: "chat",
    sizeGB: 2.4,
    dimensions: null,
    description: "Main chat model for code assistance",
    hfRepo: "Qwen/Qwen3.5-4B",
  },
  {
    id: "qwen3.5-0.8b",
    name: "Qwen/Qwen3.5-0.8B",
    type: "chat",
    sizeGB: 0.8,
    dimensions: null,
    description: "Light chat model for constrained hardware",
    hfRepo: "Qwen/Qwen3.5-0.8B",
  },
];

// ─── Job Tracking ──────────────────────────────────────────────────────────────
const downloadJobs = new Map(); // jobId -> { id, modelId, status, progress, error, startedAt }

function createJob(modelId) {
  const jobId = `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  downloadJobs.set(jobId, {
    id: jobId,
    modelId,
    status: "pending",
    progress: 0,
    error: null,
    startedAt: Date.now(),
  });
  return jobId;
}

function updateJob(jobId, updates) {
  const job = downloadJobs.get(jobId);
  if (job) {
    Object.assign(job, updates);
  }
  return job;
}

// ─── HuggingFace File Download ─────────────────────────────────────────────────
const HF_BASE = "https://huggingface.co";

function getModelFilesForDownload(catalogEntry) {
  // Common files needed for transformers.js ONNX models
  const files = ["config.json", "tokenizer.json", "tokenizer_config.json"];
  
  // Add ONNX model files based on type
  if (catalogEntry.type === "embedding") {
    files.push("onnx/model.onnx");
    files.push("onnx/model.onnx_data");
  } else if (catalogEntry.type === "reranker") {
    files.push("model.onnx");
    files.push("model.onnx_data");
  } else {
    // Chat models use safetensors or gguf, download config only for now
    files.push("model.safetensors.index.json");
  }
  return files;
}

function downloadHFModelFiles(jobId, modelId, catalogEntry) {
  return new Promise(async (resolve, reject) => {
    const cacheDir = join(MODELS_CACHE_DIR, modelId);
    mkdirSync(cacheDir, { recursive: true });
    
    const files = getModelFilesForDownload(catalogEntry);
    let completedFiles = 0;
    let totalFiles = files.length;
    
    updateJob(jobId, { status: "downloading", progress: 0 });
    
    // Try each file, skip 404s gracefully
    for (const filePath of files) {
      const url = `${HF_BASE}/${catalogEntry.hfRepo}/resolve/main/${filePath}`;
      const destPath = join(cacheDir, basename(filePath));
      const destDir = join(cacheDir, filePath.includes("/") ? filePath.substring(0, filePath.lastIndexOf("/")) : "");
      
      if (destDir && destDir !== cacheDir) {
        mkdirSync(destDir, { recursive: true });
      }
      
      try {
        await new Promise((resolveFile, rejectFile) => {
          https.get(url, (res) => {
            if (res.statusCode === 302 || res.statusCode === 301) {
              // Follow redirect
              https.get(res.headers.location, (res2) => {
                if (res2.statusCode === 200) {
                  const totalBytes = parseInt(res2.headers["content-length"] || "0", 10);
                  let downloadedBytes = 0;
                  const fileStream = createWriteStream(destPath);
                  
                  res2.on("data", (chunk) => {
                    downloadedBytes += chunk.length;
                    fileStream.write(chunk);
                    // Update progress using file fraction
                    const fileProgress = ((completedFiles + (downloadedBytes / (totalBytes || 1))) / totalFiles) * 100;
                    updateJob(jobId, { progress: Math.min(99, Math.round(fileProgress)) });
                  });
                  
                  res2.on("end", () => {
                    fileStream.end();
                    completedFiles++;
                    resolveFile();
                  });
                  
                  res2.on("error", (err) => {
                    fileStream.end();
                    // Don't fail the whole download for a single file
                    completedFiles++;
                    resolveFile();
                  });
                } else {
                  // File not found, skip
                  completedFiles++;
                  resolveFile();
                }
              }).on("error", () => {
                completedFiles++;
                resolveFile();
              });
            } else if (res.statusCode === 200) {
              const totalBytes = parseInt(res.headers["content-length"] || "0", 10);
              let downloadedBytes = 0;
              const fileStream = createWriteStream(destPath);
              
              res.on("data", (chunk) => {
                downloadedBytes += chunk.length;
                fileStream.write(chunk);
                const fileProgress = ((completedFiles + (downloadedBytes / (totalBytes || 1))) / totalFiles) * 100;
                updateJob(jobId, { progress: Math.min(99, Math.round(fileProgress)) });
              });
              
              res.on("end", () => {
                fileStream.end();
                completedFiles++;
                resolveFile();
              });
              
              res.on("error", () => {
                fileStream.end();
                completedFiles++;
                resolveFile();
              });
            } else {
              completedFiles++;
              resolveFile();
            }
          }).on("error", () => {
            completedFiles++;
            resolveFile();
          });
        });
      } catch {
        completedFiles++;
      }
    }
    
    // Create marker file
    writeFileSync(join(cacheDir, ".downloaded"), JSON.stringify({
      modelId,
      downloadedAt: Date.now(),
      source: catalogEntry.hfRepo,
      filesAttempted: totalFiles,
      filesCompleted: completedFiles,
    }));
    
    resolve();
  });
}

// ─── Local Model Cache Detection ───────────────────────────────────────────────
function getLocalCacheStatus() {
  const cached = [];
  try {
    if (existsSync(MODELS_CACHE_DIR)) {
      const entries = readdirSync(MODELS_CACHE_DIR, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const modelPath = join(MODELS_CACHE_DIR, entry.name);
          const stat = statSync(modelPath);
          cached.push({
            id: entry.name,
            path: modelPath,
            sizeBytes: stat.size,
            cachedAt: stat.mtimeMs,
          });
        }
      }
    }
  } catch {}
  return cached;
}

function isModelCached(modelId) {
  const markerFile = join(MODELS_CACHE_DIR, modelId, ".downloaded");
  return existsSync(markerFile);
}

// ─── Settings Persistence ──────────────────────────────────────────────────────
function saveSetting(key, value) {
  try {
    const database = getDB();
    if (!database) return false;
    database.run(
      "INSERT OR REPLACE INTO config (key, value, updated_at) VALUES (?, ?, ?)",
      key,
      JSON.stringify(value),
      Date.now()
    );
    return true;
  } catch (e) {
    console.log("[Settings] Failed to save:", e.message);
    return false;
  }
}

function loadSetting(key, defaultValue = null) {
  try {
    const database = getDB();
    if (!database) return defaultValue;
    const row = database.query("SELECT value FROM config WHERE key = ?").get(key);
    if (row?.value) {
      try {
        return JSON.parse(row.value);
      } catch {
        return row.value;
      }
    }
    return defaultValue;
  } catch {
    return defaultValue;
  }
}

function loadAllSettings() {
  try {
    const database = getDB();
    if (!database) return {};
    const rows = database.query("SELECT key, value FROM config").all();
    const settings = {};
    for (const row of rows) {
      try {
        settings[row.key] = JSON.parse(row.value);
      } catch {
        settings[row.key] = row.value;
      }
    }
    return settings;
  } catch {
    return {};
  }
}

let appConfig = {};
let currentLogs = [];
let lmState = { connected: false, models: [], loadedInstances: [] };

const VRAM_ESTIMATES = {
  "qwen3-embedding": 0.8,
  "nomic-embed": 1.2,
  "qwen3-reranker": 1.5,
  "qwen3.5-4b": 2.6,
  "qwen3.5-0.8b": 1.0,
  "gemma-4": 2.4,
  default: 2.0,
};
const MAX_VRAM_GB = 5.5;

function loadConfig() {
  try {
    return JSON.parse(readFileSync(CONFIG_PATH, "utf8"));
  } catch {
    return {
      lmStudio: { baseURL: "localhost:1234", preferredEmbedding: "", preferredReranker: "" },
      rag: { denseWeight: 0.4, keywordWeight: 0.4, rrfK: 60, memoryBoost: 0.15, rerankMinResults: 10, confidenceGate: 0.85 },
      search: { defaultLimit: 10, defaultIntent: "learn" },
      sources: { folders: [], urls: [] }
    };
  }
}

function saveConfig() {
  try {
    writeFileSync(CONFIG_PATH, JSON.stringify(appConfig, null, 2));
  } catch {}
}

function logActivity(message, type = "info") {
  const entry = { timestamp: Date.now(), time: new Date().toLocaleTimeString(), message, type };
  currentLogs.unshift(entry);
  if (currentLogs.length > 200) currentLogs.pop();
  console.log(`[${type.toUpperCase()}] ${message}`);
}

function getVRAMEstimate(modelKey) {
  for (const [key, val] of Object.entries(VRAM_ESTIMATES)) {
    if (modelKey.toLowerCase().includes(key)) return val;
  }
  return VRAM_ESTIMATES.default;
}

function getLoadedVRAM() {
  let total = 0;
  for (const instance of lmState.loadedInstances) {
    total += getVRAMEstimate(instance.id);
  }
  return total;
}

function getModelHandles() {
  return lmState.loadedInstances.map(i => ({
    instanceId: i.id,
    type: i.config?.type || (i.id.includes("embed") ? "embedding" : "llm")
  }));
}

let db = null;

function getDB() {
  if (!existsSync(BRAIN_DB_PATH)) return null;
  if (db) return db;
  
  try {
    db = new Database(BRAIN_DB_PATH);
    return db;
  } catch (e) {
    console.log("[DB] Failed to open database:", e.message);
    return null;
  }
}

function getDBStats() {
  try {
    const database = getDB();
    if (!database) return { fileCount: 0, chunkCount: 0, ftsCount: 0, vecCount: 0, dbSize: 0, vectorActive: false };
    
    let stats = { size: 0 };
    try {
      const fileStats = statSync(BRAIN_DB_PATH);
      stats.size = fileStats.size;
    } catch {}
    
    let fileCount = 0, chunkCount = 0, ftsCount = 0, vecCount = 0, vectorActive = false;
    
    try {
      const result = database.query("SELECT COUNT(*) as c FROM files").get();
      fileCount = Number(result?.c) || 0;
    } catch {}
    
    try {
      const result = database.query("SELECT COUNT(*) as c FROM chunks").get();
      chunkCount = Number(result?.c) || 0;
    } catch {}
    
    try {
      const result = database.query("SELECT COUNT(*) as c FROM fts_chunks").get();
      ftsCount = Number(result?.c) || 0;
    } catch {}
    
    try {
      const result = database.query("SELECT COUNT(*) as c FROM chunk_embeddings").get();
      vecCount = Number(result?.c) || 0;
      if (vecCount > 0) vectorActive = true;
    } catch {}
    
    return { fileCount, chunkCount, ftsCount, vecCount, dbSize: stats.size, vectorActive };
  } catch {
    return { fileCount: 0, chunkCount: 0, ftsCount: 0, vecCount: 0, dbSize: 0, vectorActive: false };
  }
}

async function fetchLMStudio(path, options = {}) {
  const baseURL = appConfig.lmStudio?.baseURL?.replace(/^https?:\/\//, '') || "localhost:1234";
  const url = `http://${baseURL}${path}`;
  try {
    const response = await fetch(url, {
      headers: { "Content-Type": "application/json", ...options.headers },
      ...options,
    });
    return await response.json();
  } catch (e) {
    console.log(`[LM] REST API error: ${e.message}`);
    return null;
  }
}

async function checkLMConnection() {
  const data = await fetchLMStudio("/api/v1/models");
  if (data && data.models) {
    lmState.connected = true;
    lmState.models = data.models.map(m => m.key).filter(Boolean);
    lmState.loadedInstances = [];
    
    const categories = { embedding: [], reranker: [], chat: [], draft: [] };
    for (const model of data.models) {
      const key = model.key;
      if (!key) continue;
      
      if (model.type === "embedding" || key.includes("embed") || key.includes("nomic")) {
        categories.embedding.push(key);
      } else if (key.includes("rerank")) {
        categories.reranker.push(key);
      } else if (key.includes("draft")) {
        categories.draft.push(key);
      } else {
        categories.chat.push(key);
      }
      
      if (model.loaded_instances && model.loaded_instances.length > 0) {
        for (const instance of model.loaded_instances) {
          lmState.loadedInstances.push({
            id: instance.id,
            modelKey: key,
            type: model.type,
            config: instance.config,
          });
        }
      }
    }
    
    lmState.categories = categories;
    return true;
  }
  lmState.connected = false;
  return false;
}

function sanitizeFTSQuery(query) {
  return query
    .replace(/[^\w\s\-\.\_]/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map(t => `${t}*`)
    .join(" AND ");
}

function reciprocalRankFusion(results, k = 60) {
  const scores = new Map();
  
  for (const resultSet of results) {
    if (!resultSet || resultSet.length === 0) continue;
    for (let i = 0; i < resultSet.length; i++) {
      const item = resultSet[i];
      const key = item.id || item.path;
      const score = scores.get(key) || 0;
      scores.set(key, score + 1 / (k + i + 1));
    }
  }
  
  const fused = [];
  for (const [key, score] of scores) {
    let item = null;
    for (const resultSet of results) {
      if (!resultSet) continue;
      for (const r of resultSet) {
        if ((r.id || r.path) === key) {
          item = { ...r, fusionScore: score };
          break;
        }
      }
      if (item) break;
    }
    if (item) fused.push(item);
  }
  
  fused.sort((a, b) => (b.fusionScore || 0) - (a.fusionScore || 0));
  return fused;
}

const server = Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);
    const path = url.pathname;

    if (path === "/" || path === "/index.html") {
      const html = readFileSync(join(__dirname, "index.html"), "utf8");
      return new Response(html, { headers: { "Content-Type": "text/html" } });
    }

    if (path.startsWith("/api/")) {
      let body = null;
      if (req.method !== "GET" && req.method !== "DELETE") {
        const text = await req.text();
        if (text) {
          try { body = JSON.parse(text); } catch { body = null; }
        }
      }
      return handleAPI(path.slice(4), req.method, body);
    }

    return new Response("Not Found", { status: 404 });
  },
});

async function handleAPI(path, method, body) {
  const json = (data) => new Response(JSON.stringify(data), { headers: { "Content-Type": "application/json" } });
  const error = (msg) => new Response(JSON.stringify({ success: false, error: msg }), { status: 500, headers: { "Content-Type": "application/json" } });

  try {
  if (path === "/config") {
    if (method === "GET") return json({ success: true, data: appConfig });
    appConfig = { ...appConfig, ...body };
    saveConfig();
    return json({ success: true, data: appConfig });
  }

  if (path === "/logs") {
    return json({ success: true, data: currentLogs });
  }

  if (path === "/lmstudio/status") {
    await checkLMConnection();
    
    const categories = lmState.categories || { embedding: [], reranker: [], chat: [], draft: [] };

    const loadedModelKeys = lmState.loadedInstances.map(i => i.modelKey || i.id);
    
    return json({
      success: true,
      data: {
        connected: lmState.connected,
        available: lmState.models,
        loaded: loadedModelKeys,
        loadedInstances: lmState.loadedInstances,
        categories,
        vram: {
          used: getLoadedVRAM().toFixed(1),
          max: MAX_VRAM_GB,
          handles: getModelHandles()
        },
        stats: {
          totalAvailable: lmState.models.length,
          totalLoaded: lmState.loadedInstances.length
        }
      }
    });
  }

  if (path === "/lmstudio/load") {
    const { modelId } = body;
    
    if (!lmState.connected) {
      await checkLMConnection();
    }
    
    if (!lmState.connected) {
      return json({ success: false, error: "LM Studio not connected. Start LM Studio first." });
    }
    
    try {
      logActivity(`Loading model: ${modelId}`);
      
      const result = await fetchLMStudio("/api/v1/models/load", {
        method: "POST",
        body: JSON.stringify({ model: modelId }),
      });
      
      if (result && result.status === "loaded") {
        await checkLMConnection();
        logActivity(`✓ Model loaded: ${modelId}`, "success");
        return json({ success: true, data: { modelId, loadedInstances: lmState.loadedInstances, vram: { used: getLoadedVRAM().toFixed(1), max: MAX_VRAM_GB } } });
      }
      
      return json({ success: false, error: result?.error || "Failed to load model" });
    } catch (error) {
      logActivity(`Failed to load ${modelId}: ${error.message}`, "error");
      return json({ success: false, error: error.message });
    }
  }

  if (path === "/lmstudio/unload") {
    const { instanceId } = body;
    
    if (!instanceId) {
      for (const instance of [...lmState.loadedInstances]) {
        await fetchLMStudio("/api/v1/models/unload", {
          method: "POST",
          body: JSON.stringify({ instance_id: instance.id }),
        });
      }
      await checkLMConnection();
      logActivity("All models unloaded", "success");
      return json({ success: true, data: { loadedInstances: [], vram: { used: "0.0", max: MAX_VRAM_GB } } });
    }
    
    try {
      const result = await fetchLMStudio("/api/v1/models/unload", {
        method: "POST",
        body: JSON.stringify({ instance_id: instanceId }),
      });
      
      if (result && result.instance_id) {
        await checkLMConnection();
        logActivity(`Model unloaded: ${instanceId}`, "success");
        return json({ success: true, data: { loadedInstances: lmState.loadedInstances, vram: { used: getLoadedVRAM().toFixed(1), max: MAX_VRAM_GB } } });
      }
      
      return json({ success: false, error: "Failed to unload model" });
    } catch (error) {
      return json({ success: false, error: error.message });
    }
  }

  if (path === "/rag/search") {
    const { query, intent = "learn", limit = 10 } = body;
    const database = getDB();
    if (!database) return json({ success: false, error: "No database. Run Reindex first." });

    try {
      const ftsResults = [];
      const likeResults = [];
      
      const sanitized = sanitizeFTSQuery(query);
      if (sanitized) {
        try {
          const ftsRows = database.query(`
            SELECT c.id, c.filepath, c.language, c.type, c.name, c.start_line, c.end_line, c.content
            FROM fts_chunks f
            JOIN chunks c ON c.id = f.chunk_id
            WHERE fts_chunks MATCH ?
            ORDER BY rank
            LIMIT ?
          `).all(sanitized, limit * 2);
          
          for (const row of ftsRows) {
            ftsResults.push({
              id: row.id,
              filepath: row.filepath,
              language: row.language,
              type: row.type,
              name: row.name,
              start_line: row.start_line,
              end_line: row.end_line,
              content: row.content,
              score: 0.6
            });
          }
        } catch (e) {
          console.log("[Search] FTS search failed:", e.message);
        }
      }
      
      if (ftsResults.length === 0) {
        try {
          const likeRows = database.query(`
            SELECT id, filepath, language, type, name, start_line, end_line, content, access_count
            FROM chunks
            WHERE content LIKE ? OR name LIKE ?
            ORDER BY access_count DESC
            LIMIT ?
          `).all(`%${query}%`, `%${query}%`, limit);
          
          for (const row of likeRows) {
            likeResults.push({
              id: row.id,
              filepath: row.filepath,
              language: row.language,
              type: row.type,
              name: row.name,
              start_line: row.start_line,
              end_line: row.end_line,
              content: row.content,
              score: (row.access_count || 0) / 100
            });
          }
        } catch (e) {
          console.log("[Search] LIKE search failed:", e.message);
        }
      }
      
      let results = ftsResults.length > 0 ? ftsResults : likeResults;
      
      results = results.slice(0, limit).map(r => ({
        id: r.id,
        path: r.filepath,
        language: r.language || "unknown",
        type: r.type || "unknown",
        name: r.name || "",
        start_line: r.start_line || 0,
        end_line: r.end_line || 0,
        content: r.content,
        score: r.score || 0.5
      }));

      return json({ success: true, data: { results, count: results.length, intent, searchMode: ftsResults.length > 0 ? "fts" : "like" } });
    } catch (error) {
      console.log("Search error:", error.message);
      return json({ success: false, error: error.message });
    }
  }

  if (path === "/rag/benchmark") {
    const testQueries = [
      { query: "How does indexing work?", intent: "learn" },
      { query: "Refactor the search function", intent: "refactor" },
      { query: "Add feature to dashboard", intent: "feature" },
      { query: "Fix embedding error", intent: "debug" },
      { query: "Write tests for API", intent: "test" }
    ];

    const results = [];
    for (const q of testQueries) {
      const start = Date.now();
      const database = getDB();
      if (!database) { results.push({ query: q.query, success: false, error: "No database" }); continue; }
      try {
        const sanitized = sanitizeFTSQuery(q.query);
        let count = 0;
        
        if (sanitized) {
          try {
            const result = database.query("SELECT COUNT(*) as c FROM fts_chunks WHERE fts_chunks MATCH ?").get(sanitized);
            count = result?.c || 0;
          } catch {}
        }
        
        if (count === 0) {
          const result = database.query("SELECT COUNT(*) as c FROM chunks WHERE content LIKE ?").get(`%${q.query}%`);
          count = result?.c || 0;
        }
        
        results.push({ query: q.query, intent: q.intent, success: true, latency: Date.now() - start, resultCount: count });
      } catch (e) { results.push({ query: q.query, success: false, error: e.message }); }
    }

    const successful = results.filter(r => r.success);
    return json({
      success: true,
      data: {
        results,
        summary: { total: 5, successful: successful.length, failed: 5 - successful.length },
        avgLatency: successful.length ? Math.round(successful.reduce((s, r) => s + r.latency, 0) / successful.length) : 0
      }
    });
  }

  if (path === "/brain/status") {
    await checkLMConnection();
    const stats = getDBStats();
    return json({ success: true, data: {
      status: stats.fileCount > 0 ? "healthy" : "no_database",
      ...stats,
      lmConnected: lmState.connected,
      loadedModels: lmState.loadedInstances.map(i => i.modelKey || i.id),
      loadedInstances: lmState.loadedInstances,
      vram: { used: getLoadedVRAM().toFixed(1), max: MAX_VRAM_GB }
    }});
  }

  if (path === "/brain/diagnostic") {
    await checkLMConnection();
    const stats = getDBStats();
    return json({ success: true, data: {
      database: stats.fileCount > 0 ? "connected" : "not_found",
      ...stats,
      lmStudio: lmState.connected ? "connected" : "disconnected",
      availableModels: lmState.models.length,
      loadedInstances: lmState.loadedInstances,
      vram: { used: getLoadedVRAM().toFixed(1), max: MAX_VRAM_GB }
    }});
  }

  if (path === "/brain/config") {
    return json({ success: true, data: appConfig.rag || {} });
  }

  if (path === "/brain/init-db" && method === "POST") {
    try {
      const { mkdirSync } = require("fs");
      const dbDir = join(__dirname, "..", ".opencode");
      mkdirSync(dbDir, { recursive: true });
      
      if (existsSync(BRAIN_DB_PATH)) {
        return json({ success: true, message: "Database already exists", stats: getDBStats() });
      }
      
      const database = new Database(BRAIN_DB_PATH);
      
      database.exec(`
        CREATE TABLE IF NOT EXISTS files (
          path TEXT PRIMARY KEY,
          mtime INTEGER NOT NULL,
          size INTEGER NOT NULL,
          hash TEXT NOT NULL,
          indexed_at INTEGER NOT NULL,
          chunk_count INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS chunks (
          id TEXT PRIMARY KEY,
          filepath TEXT NOT NULL,
          language TEXT,
          type TEXT,
          name TEXT,
          start_line INTEGER NOT NULL,
          end_line INTEGER NOT NULL,
          parent_id TEXT,
          content TEXT NOT NULL,
          content_hash TEXT NOT NULL,
          indexed_at INTEGER NOT NULL,
          access_count INTEGER DEFAULT 0,
          last_accessed INTEGER
        );
        CREATE VIRTUAL TABLE IF NOT EXISTS fts_chunks USING fts5(
          chunk_id UNINDEXED,
          filepath UNINDEXED,
          content,
          tokenize="unicode61"
        );
        CREATE TABLE IF NOT EXISTS concepts (
          id INTEGER PRIMARY KEY,
          name TEXT UNIQUE,
          description TEXT,
          boost REAL DEFAULT 1.0
        );
        CREATE TABLE IF NOT EXISTS concept_chunks (
          concept_id INTEGER,
          chunk_id TEXT,
          score REAL DEFAULT 1.0
        );
        CREATE TABLE IF NOT EXISTS sessions (
          id INTEGER PRIMARY KEY,
          name TEXT,
          context TEXT,
          created_at INTEGER,
          last_active INTEGER
        );
        CREATE TABLE IF NOT EXISTS config (
          key TEXT PRIMARY KEY,
          value TEXT,
          updated_at INTEGER
        );
        CREATE TABLE IF NOT EXISTS schema_version (
          version INTEGER PRIMARY KEY,
          applied_at INTEGER NOT NULL
        );
        INSERT INTO schema_version (version, applied_at) VALUES (1, ${Date.now()});
      `);
      
      database.close();
      db = null;
      logActivity("Database schema created", "success");
      return json({ success: true, message: "Database initialized" });
    } catch (error) {
      console.log("Init DB error:", error.message);
      return json({ success: false, error: error.message });
    }
  }

  if (path === "/index/sources") {
    const sources = [
      ...(appConfig.sources?.folders || []).map(f => ({ type: "folder", path: f })),
      ...(appConfig.sources?.urls || []).map(u => ({ type: "url", url: u }))
    ];
    return json({ success: true, data: sources });
  }

  if (path === "/index/folder" && method === "POST") {
    const { path: folderPath } = body;
    if (!appConfig.sources) appConfig.sources = { folders: [], urls: [] };
    if (!appConfig.sources.folders.includes(folderPath)) appConfig.sources.folders.push(folderPath);
    saveConfig();
    logActivity(`Folder added: ${folderPath}`, "success");
    return json({ success: true, message: "Folder queued. Use brain-index-project command to index." });
  }

  if (path === "/index/url" && method === "POST") {
    const { url } = body;
    if (!appConfig.sources) appConfig.sources = { folders: [], urls: [] };
    if (!appConfig.sources.urls.includes(url)) appConfig.sources.urls.push(url);
    saveConfig();
    logActivity(`URL added: ${url}`, "success");
    return json({ success: true, message: "URL queued. Use brain-index-project command to index." });
  }

  if (path === "/index/clear" && method === "POST") {
    try {
      const database = getDB();
      if (database) {
        database.exec("DELETE FROM chunks; DELETE FROM files; DELETE FROM fts_chunks; DELETE FROM concept_chunks; DELETE FROM concepts;");
      }
      appConfig.sources = { folders: [], urls: [] };
      saveConfig();
      logActivity("Index cleared", "success");
      return json({ success: true, message: "Index cleared" });
    } catch (error) {
      return json({ success: false, error: error.message });
    }
  }

  if (path === "/brain/chunks") {
    const { limit = 20, offset = 0 } = body || {};
    const database = getDB();
    if (!database) return json({ success: false, error: "No database" });

    try {
      const chunks = database.query("SELECT * FROM chunks LIMIT ? OFFSET ?").all(limit, offset);
      const total = database.query("SELECT COUNT(*) as c FROM chunks").get();
      return json({ success: true, data: { chunks, total: total?.c || 0 } });
    } catch (error) {
      return json({ success: false, error: error.message });
    }
  }

  // ─── Unified Model State API ─────────────────────────────────────────────────
  if (path === "/model/state") {
    await checkLMConnection();
    const localCache = getLocalCacheStatus();
    const cachedModelIds = new Set(localCache.map(c => c.id));
    const loadedModelKeys = new Set(lmState.loadedInstances.map(i => i.modelKey || i.id));

    // Build per-model readiness
    const modelReadiness = MODEL_CATALOG.map(m => {
      const isLoaded = loadedModelKeys.has(m.id) || lmState.models.some(lm => lm.key?.includes(m.id) || lm.includes(m.id));
      const isCached = cachedModelIds.has(m.id);
      const isActiveJob = [...downloadJobs.values()].some(j => j.modelId === m.id && j.status === "downloading");

      let readiness = "missing";
      if (isLoaded) readiness = "loaded";
      else if (isActiveJob) readiness = "downloading";
      else if (isCached) readiness = "ready";

      return {
        id: m.id,
        name: m.name,
        type: m.type,
        readiness,
        isLoaded,
        isCached,
        sizeGB: m.sizeGB,
        dimensions: m.dimensions,
      };
    });

    // Also include LM Studio models not in catalog
    const lmModelsNotInCatalog = lmState.models
      .filter(m => !MODEL_CATALOG.some(c => m.key?.includes(c.id) || m.includes(c.id)))
      .map(m => ({
        id: m.key || m,
        name: m.key || m,
        type: m.type || "unknown",
        readiness: loadedModelKeys.has(m.key || m) ? "loaded" : "ready",
        isLoaded: loadedModelKeys.has(m.key || m),
        isCached: true,
        sizeGB: null,
        dimensions: null,
      }));

    const selected = {
      chat: loadSetting("selected_chat_model", appConfig.lmStudio?.chatModel || ""),
      embedding: loadSetting("selected_embedding_model", appConfig.lmStudio?.preferredEmbedding || ""),
      reranker: loadSetting("selected_reranker_model", appConfig.lmStudio?.preferredReranker || ""),
    };

    return json({
      success: true,
      data: {
        selected,
        available: MODEL_CATALOG,
        loaded: lmState.loadedInstances,
        readiness: [...modelReadiness, ...lmModelsNotInCatalog],
        localCache,
        effectiveRuntime: {
          provider: "lmstudio",
          baseURL: appConfig.lmStudio?.baseURL || "localhost:1234",
          vramBudget: MAX_VRAM_GB,
          vramUsed: parseFloat(getLoadedVRAM().toFixed(1)),
        },
      },
    });
  }

  if (path === "/model/state" && method === "POST") {
    const { selected } = body || {};
    if (selected) {
      if (selected.chat !== undefined) saveSetting("selected_chat_model", selected.chat);
      if (selected.embedding !== undefined) saveSetting("selected_embedding_model", selected.embedding);
      if (selected.reranker !== undefined) saveSetting("selected_reranker_model", selected.reranker);
    }
    return json({ success: true, message: "Model selection updated" });
  }

  // ─── Model Catalog ───────────────────────────────────────────────────────────
  if (path === "/model/catalog") {
    const localCache = getLocalCacheStatus();
    const cachedModelIds = new Set(localCache.map(c => c.id));
    const catalogWithStatus = MODEL_CATALOG.map(m => ({
      ...m,
      cached: cachedModelIds.has(m.id),
      loaded: lmState.loadedInstances.some(i => (i.modelKey || i.id)?.includes(m.id)),
    }));
    return json({ success: true, data: catalogWithStatus });
  }

  // ─── Model Download ──────────────────────────────────────────────────────────
  if (path === "/model/download" && method === "POST") {
    const { modelId } = body || {};
    if (!modelId) return json({ success: false, error: "modelId is required" });

    const catalogEntry = MODEL_CATALOG.find(m => m.id === modelId);
    if (!catalogEntry) return json({ success: false, error: `Unknown model: ${modelId}` });

    if (isModelCached(modelId)) {
      return json({ success: true, message: "Model already cached", jobId: null, cached: true });
    }

    const jobId = createJob(modelId);
    logActivity(`Download started: ${catalogEntry.name}`, "info");

    // Async download via HuggingFace
    (async () => {
      try {
        await downloadHFModelFiles(jobId, modelId, catalogEntry);
        updateJob(jobId, { status: "complete", progress: 100 });
        logActivity(`Download complete: ${catalogEntry.name}`, "success");
      } catch (error) {
        updateJob(jobId, { status: "failed", error: error.message });
        logActivity(`Download failed: ${catalogEntry.name} - ${error.message}`, "error");
      }
    })();

    return json({ success: true, message: "Download queued", jobId });
  }

  // ─── Model Job Status ────────────────────────────────────────────────────────
  if (path.startsWith("/model/jobs/") && method === "GET") {
    const jobId = path.replace("/model/jobs/", "");
    const job = downloadJobs.get(jobId);
    if (!job) return json({ success: false, error: "Job not found" });
    return json({ success: true, data: job });
  }

  if (path === "/model/jobs" && method === "GET") {
    const jobs = [...downloadJobs.values()].sort((a, b) => b.startedAt - a.startedAt);
    return json({ success: true, data: jobs });
  }

  // ─── Model Prewarm (Load into LM Studio) ─────────────────────────────────────
  if (path === "/model/prewarm" && method === "POST") {
    const { modelId, type } = body || {};
    if (!modelId) return json({ success: false, error: "modelId is required" });

    if (!lmState.connected) {
      await checkLMConnection();
    }
    if (!lmState.connected) {
      return json({ success: false, error: "LM Studio not connected. Start LM Studio first." });
    }

    try {
      logActivity(`Prewarming model: ${modelId}`);
      const result = await fetchLMStudio("/api/v1/models/load", {
        method: "POST",
        body: JSON.stringify({ model: modelId }),
      });

      if (result && (result.status === "loaded" || result.loaded)) {
        await checkLMConnection();
        logActivity(`Model prewarmed: ${modelId}`, "success");
        return json({
          success: true,
          data: {
            modelId,
            loadedInstances: lmState.loadedInstances,
            vram: { used: getLoadedVRAM().toFixed(1), max: MAX_VRAM_GB },
          },
        });
      }

      return json({ success: false, error: result?.error || "Failed to prewarm model" });
    } catch (error) {
      logActivity(`Prewarm failed: ${modelId} - ${error.message}`, "error");
      return json({ success: false, error: error.message });
    }
  }

  // ─── Settings CRUD ───────────────────────────────────────────────────────────
  if (path === "/settings") {
    if (method === "GET") {
      const settings = loadAllSettings();
      return json({ success: true, data: settings });
    }
    if (method === "POST") {
      const { key, value } = body || {};
      if (!key) return json({ success: false, error: "key is required" });
      const saved = saveSetting(key, value);
      if (saved) {
        logActivity(`Setting saved: ${key}`, "success");
        return json({ success: true, message: `Setting ${key} saved` });
      }
      return json({ success: false, error: "Failed to save setting" });
    }
  }

  if (path.startsWith("/settings/") && method === "GET") {
    const key = path.replace("/settings/", "");
    const value = loadSetting(key);
    return json({ success: true, data: { key, value } });
  }

  // ─── Brain Plugin Status ─────────────────────────────────────────────────────
  if (path === "/brain/plugin-status" && method === "GET") {
    const database = getDB();
    if (!database) {
      return json({ success: false, error: "No database. Initialize DB first." });
    }
    try {
      const row = database.query("SELECT value FROM config WHERE key = ?").get("brain_plugin_status");
      if (!row) {
        return json({ success: true, data: null, message: "No plugin status available yet. The brain plugin may not have written its state." });
      }
      const data = JSON.parse(row.value);
      return json({ success: true, data });
    } catch (e) {
      return json({ success: false, error: e.message });
    }
  }

  // ─── Brain Reindex (flag for brain plugin) ────────────────────────────────────
  if (path === "/brain/reindex" && method === "POST") {
    const database = getDB();
    if (!database) return json({ success: false, error: "No database. Initialize DB first." });
    try {
      database.run("INSERT OR REPLACE INTO config (key, value, updated_at) VALUES ('brain_reindex_request', 'true', ?)", Date.now());
      logActivity("Reindex requested — brain plugin will pick it up within 30s", "success");
      return json({ success: true, message: "Reindex flag written. Brain plugin will reindex within 30s." });
    } catch (e) {
      return json({ success: false, error: e.message });
    }
  }

  // ─── Brain Reset (flag for brain plugin) ──────────────────────────────────────
  if (path === "/brain/reset" && method === "POST") {
    const database = getDB();
    if (!database) return json({ success: false, error: "No database. Initialize DB first." });
    try {
      database.run("INSERT OR REPLACE INTO config (key, value, updated_at) VALUES ('brain_reset_request', 'true', ?)", Date.now());
      logActivity("Reset requested — brain plugin will pick it up within 30s", "warning");
      return json({ success: true, message: "Reset flag written. Brain plugin will reset within 30s." });
    } catch (e) {
      return json({ success: false, error: e.message });
    }
  }

  return json({ success: false, error: "Unknown endpoint" });
  } catch (err) {
    console.log("[API] Error:", err.message, err.stack);
    return error(err.message);
  }
}

async function main() {
  appConfig = loadConfig();
  
  // Load persisted settings from brain.db
  const persistedSettings = loadAllSettings();
  if (persistedSettings.lmStudio_baseURL) {
    appConfig.lmStudio = appConfig.lmStudio || {};
    appConfig.lmStudio.baseURL = persistedSettings.lmStudio_baseURL;
  }
  if (persistedSettings.lmStudio_preferredEmbedding) {
    appConfig.lmStudio = appConfig.lmStudio || {};
    appConfig.lmStudio.preferredEmbedding = persistedSettings.lmStudio_preferredEmbedding;
  }
  if (persistedSettings.lmStudio_preferredReranker) {
    appConfig.lmStudio = appConfig.lmStudio || {};
    appConfig.lmStudio.preferredReranker = persistedSettings.lmStudio_preferredReranker;
  }
  
  let connected = false;
  let stats = getDBStats();
  const localCache = getLocalCacheStatus();
  
  try {
    connected = await checkLMConnection();
  } catch {}

  console.log(`
🧠 Brain RAG Dashboard v2 (Bun + REST API)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   URL:      http://localhost:${PORT}
   DB:       ${BRAIN_DB_PATH}
   LM Studio: ${connected ? "✅ Connected" : "⚠️ Not connected"}
   Available: ${lmState.models.length} models
   Loaded:    ${lmState.loadedInstances.length} instances
   VRAM:      ${getLoadedVRAM().toFixed(1)}/${MAX_VRAM_GB} GB
   DB Stats:  ${stats.fileCount} files | ${stats.chunkCount} chunks
   Vectors:   ${stats.vecCount} (${stats.vectorActive ? "active" : "inactive"})
   DB Size:   ${(stats.dbSize / 1024).toFixed(1)} KB
   Cached:    ${localCache.length} models
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  `);

  logActivity("Dashboard started");
}

main();
