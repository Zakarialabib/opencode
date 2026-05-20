import { Database } from "bun:sqlite";
import { readFileSync, existsSync, statSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BRAIN_DB_PATH = join(__dirname, "..", ".opencode", "brain.db");
const CONFIG_PATH = join(__dirname, "brain-dashboard-config.json");
const PORT = 3456;

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

  return json({ success: false, error: "Unknown endpoint" });
  } catch (err) {
    console.log("[API] Error:", err.message, err.stack);
    return error(err.message);
  }
}

async function main() {
  appConfig = loadConfig();
  
  let connected = false;
  let stats = getDBStats();
  
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
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  `);

  logActivity("Dashboard started");
}

main();
