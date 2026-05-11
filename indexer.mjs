#!/usr/bin/env node

const LM_STUDIO_URL = "http://192.168.1.12:1234";
const LM_API = `${LM_STUDIO_URL}/api/v1`;
const LM_V1 = `${LM_STUDIO_URL}/v1`;
const INDEX_ROOT = "C:/opencode/.indexes";

const PROJECTS = [
  { path: "C:/laragon/www/Simple-Signage", name: "Simple-Signage" },
  // { path: "C:/laragon/www/CamControl", name: "CamControl" },
  // { path: "C:/laragon/www/myStockMaster", name: "myStockMaster" },
];

const EXTENSIONS = {
  code: [".ts", ".tsx", ".js", ".jsx", ".php", ".java", ".go", ".rs", ".py", ".vue", ".svelte", ".c", ".cpp", ".h"],
  docs: [".md", ".txt", ".rst"],
  config: [".json", ".yaml", ".yml", ".toml", ".ini", ".env.example"],
  sql: [".sql"],
};

const IGNORE_DIRS = ["node_modules", ".git", "vendor", "target", "dist", "build", ".next", "__pycache__", ".cache", "vendor"];

const CHUNK_CONFIG = {
  code: { size: 30, overlap: 8 },
  docs: { size: 60, overlap: 15 },
  config: { size: 20, overlap: 5 },
  sql: { size: 25, overlap: 8 },
};

// === Model Selection ===
const EMBED_MODEL_FAST = "text-embedding-nomic-embed-text-v1.5";          // 84MB, 768d
const EMBED_MODEL_QUALITY = "text-embedding-qwen3-embedding-0.6b";        // 639MB, balanced
const EMBED_MODEL_BEST = "text-embedding-qwen3-embedding-4b";            // 2.5GB, 2560d
const DEFAULT_EMBED_MODEL = EMBED_MODEL_QUALITY;                         // Use 0.6b for best quality/speed tradeoff
const SPEC_MAIN = "qwen3.5-4b-claude-4.6-opus-reasoning-distilled-v2";
const SPEC_DRAFT = "qwen3.5-0.8b-claude-4.6-opus-reasoning-distilled";

// === Performance Tuning ===
const EMBED_BATCH_SIZE = 32;        // Increased from 16
const EMBED_CONCURRENT = 1;        // Sequential to avoid OOM
const SEARCH_CACHE_TTL = 300000;   // 5 min cache

function log(msg, type = "info") {
  const ts = new Date().toISOString().split("T")[1].slice(0, 8);
  const p = { info: "[INFO]", ok: "[OK]", err: "[ERR]", run: "[>>>]", dot: "[...]", warn: "[WRN]" };
  console.log(`${ts} ${p[type] || "[INFO]"} ${msg}`);
}
function ms(n) { return n < 1000 ? `${Math.round(n)}ms` : `${(n / 1000).toFixed(1)}s`; }
function sleep(msValue) { return new Promise(resolve => setTimeout(resolve, msValue)); }

// === API Helpers with Retry ===
async function api(endpoint, body, method = "POST", retries = 3) {
  let lastErr;
  for (let i = 0; i < retries; i++) {
    try {
      const r = await fetch(`${LM_API}${endpoint}`, {
        method,
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      return await r.json();
    } catch (e) {
      lastErr = e;
      if (i < retries - 1) {
        await sleep(500 * (i + 1));
      }
    }
  }
  throw lastErr;
}

async function v1(endpoint, body, method = "POST", retries = 3) {
  let lastErr;
  for (let i = 0; i < retries; i++) {
    try {
      const r = await fetch(`${LM_V1}${endpoint}`, {
        method,
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      return await r.json();
    } catch (e) {
      lastErr = e;
      if (i < retries - 1) {
        await sleep(500 * (i + 1));
      }
    }
  }
  throw lastErr;
}

async function getLoadedModels() {
  try {
    const r = await fetch(`${LM_API}/models`, { signal: AbortSignal.timeout(10000) });
    const d = await r.json();
    return d.models || [];
  } catch { return []; }
}

async function loadModel(modelKey, ctxLen = 512) {
  return api("/models/load", { model: modelKey, context_length: ctxLen, echo_load_config: true });
}

async function unloadModel(instanceId) {
  if (!instanceId) return;
  try { await api("/models/unload", { instance_id: instanceId }); } catch {}
}

// === Embedding with retry + batching ===
async function embedTexts(modelKey, texts) {
  let lastErr = null;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const r = await v1("/embeddings", { model: modelKey, input: texts.map(t => t.replace(/\n/g, " ")) });
      if (r.error) throw new Error(r.error.message);
      return r.data.map(d => d.embedding);
    } catch (e) {
      lastErr = e;
      if (attempt < 4) {
        log(`Embedding retry ${attempt}/3: ${e.message}`, "dot");
        await sleep(500 * attempt);
      }
    }
  }
  throw lastErr || new Error("Unknown embedding error");
}

async function embedBatchSequential(modelKey, texts, onProgress) {
  const results = [];
  for (let i = 0; i < texts.length; i += EMBED_BATCH_SIZE) {
    const batch = texts.slice(i, i + EMBED_BATCH_SIZE);
    const embeddings = await embedTexts(modelKey, batch);
    results.push(...embeddings);
    if (onProgress) onProgress(Math.min(i + EMBED_BATCH_SIZE, texts.length), texts.length);
  }
  return results;
}

// === Search Cache ===
const searchCache = new Map();

function cacheKey(model, query, topK) { return `${model}:${query}:${topK}`; }

function getCached(key) {
  const entry = searchCache.get(key);
  if (entry && Date.now() - entry.ts < SEARCH_CACHE_TTL) return entry.result;
  searchCache.delete(key);
  return null;
}

function setCached(key, result) {
  searchCache.set(key, { result, ts: Date.now() });
}

function clearSearchCache() { searchCache.clear(); }

// === Utility ===
function hashStr(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return h >>> 0;
}

function projectId(projectPath) {
  return projectPath.replace(/[:\\/]+/g, "_").replace(/_+/g, "_").replace(/^_+|_+$/g, "").toLowerCase();
}

function getFileCategory(filename) {
  const ext = (filename.slice(filename.lastIndexOf(".")) || "").toLowerCase();
  for (const [cat, exts] of Object.entries(EXTENSIONS)) {
    if (exts.includes(ext)) return cat;
  }
  return null;
}

function chunkText(text, config) {
  if (!text || !text.trim()) return [];
  const lines = text.split("\n");
  const chunks = [];
  for (let i = 0; i < lines.length; i += config.size - config.overlap) {
    const chunk = lines.slice(i, i + config.size).join("\n").trim();
    if (chunk.length > 20) chunks.push(chunk);
  }
  return chunks;
}

async function* walkDir(dir) {
  const fs = await import("fs");
  const path = await import("path");
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
  catch { return; }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!IGNORE_DIRS.includes(entry.name) && !entry.name.startsWith(".")) yield* walkDir(full);
    } else if (entry.isFile()) {
      yield full;
    }
  }
}

async function getFileMtimeHash(filepath) {
  const fs = await import("fs");
  try { const stat = fs.statSync(filepath); return `${stat.mtimeMs}-${stat.size}`; } catch { return null; }
}

function getEmbedDir(projectPath) { return `${INDEX_ROOT}/${projectId(projectPath)}`; }
function getEmbedFile(projectPath) { return `${getEmbedDir(projectPath)}/embeddings.json`; }
function getStateFile(projectPath) { return `${getEmbedDir(projectPath)}/state.json`; }

async function loadState(projectPath) {
  const fs = await import("fs");
  try { return JSON.parse(fs.readFileSync(getStateFile(projectPath), "utf-8")); }
  catch { return { fileHashes: {}, lastIndexed: 0, model: null }; }
}

async function saveState(projectPath, state) {
  const fs = await import("fs");
  try {
    const dir = getEmbedDir(projectPath);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(getStateFile(projectPath), JSON.stringify(state, null, 2));
    return true;
  } catch (e) { log(`Save state error: ${e.message}`, "err"); return false; }
}

async function loadEmbeddings(projectPath) {
  const fs = await import("fs");
  try { return JSON.parse(fs.readFileSync(getEmbedFile(projectPath), "utf-8")).chunks || []; }
  catch { return []; }
}

async function saveEmbeddings(projectPath, chunks) {
  const fs = await import("fs");
  try {
    const dir = getEmbedDir(projectPath);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(getEmbedFile(projectPath), JSON.stringify({ version: 1, chunks, savedAt: Date.now() }, null, 2));
    return true;
  } catch (e) { log(`Save error: ${e.message}`, "err"); return false; }
}

function cosineSimilarity(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

function findActiveProject() {
  const cwd = process.cwd().replace(/\\/g, "/").toLowerCase();
  return PROJECTS.find(p => cwd.startsWith(p.path.toLowerCase()));
}

// === Core Functions ===

async function indexProject(project, embedModel, force = false) {
  const fs = await import("fs");
  log(`Indexing: ${project.name}`, "run");
  log(`  Path: ${project.path}`, "info");
  log(`  Model: ${embedModel}`, "info");

  if (!fs.existsSync(project.path)) {
    log(`  Project not found: ${project.path}`, "err");
    return { status: "error", name: project.name };
  }

  const state = await loadState(project.path);
  const newHashes = {};
  const allChunks = [];

  log("  Discovering files...", "info");
  let totalFiles = 0;
  for await (const _ of walkDir(project.path)) totalFiles++;

  let processed = 0, skipped = 0;
  for await (const filepath of walkDir(project.path)) {
    const cat = getFileCategory(filepath);
    if (!cat) continue;

    const mtimeHash = await getFileMtimeHash(filepath);
    if (!mtimeHash) continue;
    newHashes[filepath] = mtimeHash;

    if (state.fileHashes[filepath] === mtimeHash && !force) { skipped++; processed++; continue; }

    try {
      const content = fs.readFileSync(filepath, "utf-8");
      const config = CHUNK_CONFIG[cat] || CHUNK_CONFIG.code;
      const chunks = chunkText(content, config);
      if (!chunks.length) continue;

      const stat = fs.statSync(filepath);
      chunks.forEach((text, i) => {
        allChunks.push({ text, path: filepath, startLine: i * (config.size - config.overlap) + 1, endLine: (i + 1) * config.size, mtime: stat.mtimeMs });
      });
    } catch {}

    processed++;
    if (processed % 100 === 0) process.stdout.write(`\r  Discovered: ${processed}/${totalFiles} files, ${allChunks.length} chunks (${skipped} skipped)`);
  }
  console.log(`\r  Discovered: ${processed}/${totalFiles} files, ${allChunks.length} new chunks, ${skipped} unchanged    `);

  if (allChunks.length === 0 && !force) {
    const existing = await loadEmbeddings(project.path);
    log(`  No changes. Using existing ${existing.length} embeddings.`, "dot");
    await saveState(project.path, { ...state, lastIndexed: Date.now() });
    return { status: "fresh", name: project.name, chunks: existing.length };
  }

  log(`  Loading: ${embedModel}`, "info");
  const loaded = await loadModel(embedModel);
  if (loaded.error) { log(`  Load failed: ${loaded.error.message}`, "err"); return { status: "error", name: project.name, message: loaded.error.message }; }
  log(`  Model loaded in ${ms(loaded.load_time_seconds * 1000)}`, "ok");

  log(`  Embedding ${allChunks.length} chunks (batch=${EMBED_BATCH_SIZE})...`, "info");
  const t0 = Date.now();
  const dedupMap = new Map();

  const embeddings = await embedBatchSequential(embedModel, allChunks.map(c => c.text), (done, total) => {
    process.stdout.write(`\r  Embedding: ${done}/${total} (${Math.round(done / total * 100)}%)`);
  });
  console.log(`\r  Embedded ${allChunks.length} chunks in ${ms(Date.now() - t0)}    `);

  for (let i = 0; i < allChunks.length; i++) {
    const key = hashStr(allChunks[i].text);
    if (!dedupMap.has(key)) dedupMap.set(key, { chunk: allChunks[i], embedding: embeddings[i] });
  }

  const uniqueChunks = [...dedupMap.values()].map(v => ({ ...v.chunk, vector: v.embedding }));
  log(`  Deduplicated: ${allChunks.length} -> ${uniqueChunks.length} unique`, "info");

  // Merge with existing embeddings for incremental indexing
  const existing = force ? [] : await loadEmbeddings(project.path);
  if (existing.length > 0) {
    log(`  Merging with ${existing.length} existing embeddings...`, "info");
    for (const ex of existing) {
      const key = hashStr(ex.text);
      if (!dedupMap.has(key)) uniqueChunks.push(ex);
    }
    log(`  Total after merge: ${uniqueChunks.length}`, "info");
  }

  const savedEmb = await saveEmbeddings(project.path, uniqueChunks);
  const savedState = await saveState(project.path, { fileHashes: newHashes, lastIndexed: Date.now(), model: embedModel });
  await unloadModel(loaded.instance_id);

  if (!savedEmb || !savedState) return { status: "error", name: project.name, message: "failed to save index files" };
  log(`  Saved ${uniqueChunks.length} chunks to ${getEmbedFile(project.path)}`, "ok");
  return { status: "indexed", name: project.name, chunks: uniqueChunks.length, time: Date.now() - t0 };
}

async function searchProject(project, embedModel, query, topK = 5) {
  const chunks = await loadEmbeddings(project.path);
  if (!chunks.length) { log(`No embeddings for ${project.name}`, "err"); return []; }

  const cacheHit = getCached(cacheKey(embedModel, query, topK));
  if (cacheHit) { log(`  [Cache HIT]`, "ok"); return cacheHit; }

  log(`Searching: "${query}" in ${project.name}`, "run");
  const loaded = await loadModel(embedModel);
  if (loaded.error) { log(`Load error: ${loaded.error.message}`, "err"); return []; }

  const [queryEmbedding] = await embedTexts(embedModel, [query]);
  await unloadModel(loaded.instance_id);

  const results = chunks.map(c => ({ ...c, score: cosineSimilarity(queryEmbedding, c.vector) }));
  results.sort((a, b) => b.score - a.score);
  const top = results.slice(0, topK);

  setCached(cacheKey(embedModel, query, topK), top);
  top.forEach((r, i) => { log(`  ${i + 1}. [${(r.score * 100).toFixed(1)}%] ${r.path}:${r.startLine}`); log(`     "${r.text.slice(0, 80)}..."`); });
  return top;
}

async function searchAllProjects(query, topK = 5) {
  let anyFound = false;
  for (const project of PROJECTS) {
    const chunks = await loadEmbeddings(project.path);
    if (!chunks.length) continue;
    anyFound = true;
    log(`\n=== ${project.name} ===`, "info");
    await searchProject(project, DEFAULT_EMBED_MODEL, query, topK);
  }
  if (!anyFound) log("No indexed projects found. Run 'node indexer.mjs index' first.", "warn");
}

// === Benchmarks ===

async function benchmarkEmbeddings() {
  log("=== EMBEDDING BENCHMARK ===", "run");

  const models = await getLoadedModels();
  const embedModels = models.filter(m => m.key.includes("embedding") || m.key.includes("embed")).sort((a, b) => a.size_bytes - b.size_bytes);
  const testTexts = Array.from({ length: 32 }, (_, i) => `function test${i}() { return ${i}; }`);
  const results = [];

  for (const m of embedModels) {
    log(`\nBenchmarking: ${m.key} (${Math.round(m.size_bytes / 1e6)}MB)`, "info");
    const load = await loadModel(m.key);
    if (load.error) { log(`  Load failed: ${load.error.message}`, "err"); continue; }
    log(`  Load: ${ms(load.load_time_seconds * 1000)} | ctx=${load.load_config?.context_length || "?"}`, "ok");

    const times = [];
    for (let i = 0; i < 3; i++) {
      const t0 = Date.now();
      try { await embedTexts(m.key, testTexts); times.push(Date.now() - t0); log(`  Run ${i + 1}: ${ms(times[i])}`); }
      catch (e) { log(`  Error: ${e.message}`, "err"); }
    }
    await unloadModel(load.instance_id);
    if (times.length) { const avg = times.reduce((a, b) => a + b, 0) / times.length; results.push({ model: m.key, sizeMB: Math.round(m.size_bytes / 1e6), loadTime: load.load_time_seconds * 1000, avgTime: avg, dims: load.load_config?.dimensions || "?" }); }
  }

  if (results.length) {
    log("\n--- RESULTS ---", "info");
    results.sort((a, b) => a.avgTime - b.avgTime);
    results.forEach((r, i) => log(`  ${i + 1}. ${r.model} (${r.sizeMB}MB, ${r.dims}d): ${ms(r.avgTime)} avg, load ${ms(r.loadTime)}`));
  }
  return results;
}

async function benchmarkSpeculative() {
  log("\n=== SPECULATIVE DECODING BENCHMARK ===", "run");

  const models = await getLoadedModels();
  const llms = models.filter(m => !m.key.includes("embedding"));

  log("Available LLMs:", "info");
  llms.forEach(m => log(`  - ${m.key} (${Math.round(m.size_bytes / 1e6)}MB)`, "info"));

  // Find best matching pairs
  const pairs = [];

  // Try qwen3.5 pair
  const qwenMain = llms.find(m => m.key === SPEC_MAIN);
  const qwenDraft = llms.find(m => m.key === SPEC_DRAFT);
  if (qwenMain && qwenDraft) pairs.push({ main: qwenMain.key, draft: qwenDraft.key, label: "qwen3.5 4B + 0.8B" });

  // Try gemma pair if both exist
  const gemma4 = llms.find(m => m.key === "gemma-4-e4b-it");
  const gemma2 = llms.find(m => m.key === "gemma-4-e2b-it");
  if (gemma4 && gemma2) pairs.push({ main: gemma4.key, draft: gemma2.key, label: "gemma-4-e4b + e2b" });

  if (!pairs.length) { log("No speculative pairs found", "warn"); return null; }

  const testMessages = [{ role: "system", content: "You are a helpful assistant." }, { role: "user", content: "Explain what authentication means in one sentence." }];
  const allResults = [];

  for (const pair of pairs) {
    log(`\n--- Testing: ${pair.label} ---`, "info");

    // WITHOUT speculative
    const m1 = await loadModel(pair.main);
    if (m1.error) { log(`  Main load error: ${m1.error.message}`, "err"); continue; }
    const t0 = Date.now();
    const r1 = await v1("/chat/completions", { model: pair.main, messages: testMessages, max_tokens: 60, temperature: 0.7 });
    const tWithout = Date.now() - t0;
    const tokensWithout = r1.usage?.completion_tokens || 0;
    const contentWithout = r1.choices?.[0]?.message?.content || "";
    await unloadModel(m1.instance_id);
    log(`  Without speculative: ${ms(tWithout)} | ${tokensWithout} tokens`, "ok");

    if (!tokensWithout) { log("  Main model failed to generate", "err"); continue; }

    // WITH speculative
    const m2 = await loadModel(pair.main);
    const d2 = await loadModel(pair.draft);
    if (m2.error || d2.error) { log(`  Load error: ${m2.error?.message || d2.error?.message}`, "err"); continue; }
    const t2 = Date.now();
    const r2 = await v1("/chat/completions", { model: pair.main, messages: testMessages, max_tokens: 60, temperature: 0.7, draft_model: pair.draft });
    const tWith = Date.now() - t2;
    const tokensWith = r2.usage?.completion_tokens || 0;
    const contentWith = r2.choices?.[0]?.message?.content || "";
    await unloadModel(m2.instance_id);
    await unloadModel(d2.instance_id);
    log(`  With speculative:    ${ms(tWith)} | ${tokensWith} tokens`, "ok");

    if (!tokensWith || !contentWith) {
      log(`  Result: INCOMPATIBLE — draft model output rejected`, "warn");
      allResults.push({ pair: pair.label, status: "incompatible", without: tWithout, with: tWith, tokensWithout, tokensWith });
    } else {
      const speedup = tWithout / tWith;
      log(`  Result: ${speedup.toFixed(2)}x speedup — COMPATIBLE ✅`, "ok");
      allResults.push({ pair: pair.label, status: "compatible", without: tWithout, with: tWith, speedup, tokensWithout, tokensWith });
    }
  }

  // Summary
  log("\n--- SUMMARY ---", "info");
  allResults.forEach(r => {
    if (r.status === "compatible") log(`  ${r.pair}: ${r.speedup.toFixed(2)}x faster (${ms(r.without)} → ${ms(r.with)})`, "ok");
    else log(`  ${r.pair}: INCOMPATIBLE (${r.tokensWith} tokens with speculative vs ${r.tokensWithout} without)`, "warn");
  });

  const compatible = allResults.find(r => r.status === "compatible");
  const incompatible = allResults.find(r => r.status === "incompatible");

  if (compatible) return compatible;
  if (incompatible) return { ...incompatible, note: "Needs compatible model pair" };
  return null;
}

// === Main CLI ===
async function indexAll(force = false) {
  log("====================================================", "info");
  log("  INDEXING ALL PROJECTS", "info");
  log("====================================================", "info");
  const results = [];
  for (const project of PROJECTS) { const r = await indexProject(project, DEFAULT_EMBED_MODEL, force); results.push(r); log(""); }
  log("====================================================", "info");
  log("  SUMMARY", "info");
  log("====================================================", "info");
  results.forEach(r => {
    if (r.status === "indexed") log(`  ${r.name}: ${r.chunks} chunks in ${ms(r.time)}`);
    else if (r.status === "fresh") log(`  ${r.name}: up to date (${r.chunks} chunks)`);
    else log(`  ${r.name}: FAILED - ${r.message || "unknown"}`, "err");
  });
  return results;
}

async function statusAll() {
  log("====================================================", "info");
  log("  PROJECT INDEX STATUS", "info");
  log("====================================================", "info");
  for (const project of PROJECTS) {
    const state = await loadState(project.path);
    const chunks = await loadEmbeddings(project.path);
    const ts = state.lastIndexed ? new Date(state.lastIndexed).toISOString() : "never";
    log(`\n${project.name}:`, "info");
    log(`  Path: ${project.path}`);
    log(`  Embeddings: ${chunks.length} chunks`);
    log(`  Last indexed: ${ts}`);
    log(`  Model: ${state.model || "unknown"}`);
    log(`  Files tracked: ${Object.keys(state.fileHashes || {}).length}`);
  }
  log(`\n  Embed models available:`, "info");
  log(`    Fast:    ${EMBED_MODEL_FAST}`, "info");
  log(`    Quality: ${EMBED_MODEL_QUALITY}`, "info");
  log(`    Best:    ${EMBED_MODEL_BEST}`, "info");
  log(`  Current default: ${DEFAULT_EMBED_MODEL}`, "info");
  log(`  Search cache: ${searchCache.size} entries`, "info");
}

async function main() {
  const args = process.argv.slice(2);
  const cmd = args[0] || "help";

  switch (cmd) {
    case "index":
      if (args.includes("--all")) { await indexAll(args.includes("--force")); break; }
      const active = findActiveProject();
      if (!active) { log("No active project detected from CWD.", "err"); log(`Run from: ${PROJECTS.map(p => p.path).join(" | ")}`, "info"); log("Or: node indexer.mjs index --all", "info"); break; }
      await indexProject(active, DEFAULT_EMBED_MODEL, args.includes("--force"));
      break;

    case "index-fast": {
      const active = findActiveProject();
      if (!active) { log("No active project", "err"); break; }
      await indexProject(active, EMBED_MODEL_FAST, args.includes("--force"));
      break;
    }

    case "index-best": {
      const active = findActiveProject();
      if (!active) { log("No active project", "err"); break; }
      await indexProject(active, EMBED_MODEL_BEST, args.includes("--force"));
      break;
    }

    case "index-specific": {
      const name = args[1]; const project = PROJECTS.find(p => p.name === name);
      if (!project) { log(`Unknown: ${name}`, "err"); log(`Available: ${PROJECTS.map(p => p.name).join(", ")}`, "info"); return; }
      await indexProject(project, DEFAULT_EMBED_MODEL, args[2] === "--force");
      break;
    }

    case "search": {
      const query = args.slice(1).join(" ");
      if (!query) { log("Usage: indexer.mjs search <query>", "err"); return; }
      await searchAllProjects(query, 5);
      break;
    }

    case "search-specific": {
      const name = args[1]; const query = args.slice(2).join(" ");
      const project = PROJECTS.find(p => p.name === name);
      if (!project) { log(`Unknown: ${name}`, "err"); return; }
      if (!query) { log("Usage: indexer.mjs search-specific <project> <query>", "err"); return; }
      await searchProject(project, DEFAULT_EMBED_MODEL, query, 5);
      break;
    }

    case "benchmark":
      await benchmarkEmbeddings();
      await benchmarkSpeculative();
      break;

    case "status":
      await statusAll();
      break;

    case "clear-cache":
      clearSearchCache();
      log("Search cache cleared", "ok");
      break;

    case "help":
    default:
      log("Brain Plugin Indexer v2 - Usage:", "info");
      log("  node indexer.mjs index                - Index active project (auto-detected from CWD)", "info");
      log("  node indexer.mjs index --force         - Force re-index active project", "info");
      log("  node indexer.mjs index --all            - Index all projects", "info");
      log("  node indexer.mjs index --all --force    - Force re-index all projects", "info");
      log("  node indexer.mjs index-fast             - Index active project with fast nomic model", "info");
      log("  node indexer.mjs index-best             - Index active project with best qwen3-4b model", "info");
      log("  node indexer.mjs index-specific <name>  - Index specific project", "info");
      log("  node indexer.mjs search <query>         - Search all projects", "info");
      log("  node indexer.mjs search-specific <proj> <query> - Search one project", "info");
      log("  node indexer.mjs benchmark              - Run embedding + speculative benchmarks", "info");
      log("  node indexer.mjs status                 - Show index status", "info");
      log("  node indexer.mjs clear-cache            - Clear search cache", "info");
      break;
  }
}

main().catch(e => { console.error(e); process.exit(1); });