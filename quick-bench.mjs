#!/usr/bin/env node

const LM_STUDIO_URL = "http://192.168.1.12:1234/v1";

const TEST_TEXTS_BATCH = [
  "function auth() { return true; }",
  "const user = { name: 'test' };",
  "SELECT * FROM users WHERE id = 1",
  "class Controller { }",
];

function log(msg) {
  console.log(`[${new Date().toISOString().split('T')[1].slice(0,8)}] ${msg}`);
}

function ms(n) { return n < 1000 ? `${n.toFixed(0)}ms` : `${(n/1000).toFixed(2)}s`; }

async function getModels() {
  const r = await fetch(`${LM_STUDIO_URL}/api/v1/models`);
  return (await r.json()).models || [];
}

async function loadModel(modelKey, ctxLen) {
  const r = await fetch(`${LM_STUDIO_URL}/api/v1/models/load`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: modelKey, context_length: ctxLen || 512, echo_load_config: true })
  });
  return r.json();
}

async function unloadModel(id) {
  await fetch(`${LM_STUDIO_URL}/api/v1/models/unload`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ instance_id: id })
  });
}

async function embed(model, texts) {
  const r = await fetch(`${LM_STUDIO_URL}/embeddings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, input: texts })
  });
  return r.json();
}

async function chat(model, draftModel, messages, maxTokens = 100) {
  const body = { model, messages, max_tokens: maxTokens, temperature: 0.7 };
  if (draftModel) body.draft_model = draftModel;
  const r = await fetch(`${LM_STUDIO_URL}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  return r.json();
}

async function benchEmbed(model, label, ctxLen) {
  log(`Testing embed: ${label} (ctx=${ctxLen})`);
  const loaded = await loadModel(model, ctxLen);
  if (loaded.error) {
    log(`  LOAD ERROR: ${loaded.error.message}`);
    return null;
  }
  log(`  Load: ${ms(loaded.load_time_seconds * 1000)} | Config: ctx=${loaded.load_config?.context_length}`);

  const times = [];
  for (let i = 0; i < 5; i++) {
    const t0 = Date.now();
    const r = await embed(model, TEST_TEXTS_BATCH);
    if (r.error) { log(`  EMBED ERROR: ${r.error.message}`); continue; }
    times.push(Date.now() - t0);
    log(`  Run ${i+1}: ${ms(times[i])} (${r.data?.length || 0} emb, ${r.data?.[0]?.embedding?.length || 0} dims)`);
  }

  await unloadModel(loaded.instance_id);

  if (!times.length) return null;
  const avg = times.reduce((a,b) => a+b, 0) / times.length;
  log(`  AVG: ${ms(avg)}`);
  return { model, label, ctxLen, loadTime: loaded.load_time_seconds, avg, times };
}

async function benchSpeculative(mainModel, draftModel) {
  log(`\nSpeculative Decoding Test`);
  log(`  Main: ${mainModel}`);
  log(`  Draft: ${draftModel}`);

  const messages = [
    { role: "system", content: "You are a helpful assistant." },
    { role: "user", content: "Explain what authentication is in one sentence." }
  ];

  // WITHOUT draft
  log(`\n  [1] WITHOUT speculative decoding`);
  const m1 = await loadModel(mainModel);
  if (m1.error) { log(`  Load ERROR: ${m1.error.message}`); return; }
  log(`  Main loaded: ${ms(m1.load_time_seconds * 1000)}`);

  const t0 = Date.now();
  const r1 = await chat(mainModel, null, messages);
  const t1 = Date.now() - t0;
  if (r1.error) { log(`  Chat ERROR: ${r1.error.message}`); }
  else log(`  Response: ${ms(t1)} | Tokens: ${r1.usage?.completion_tokens || '?'}`);
  await unloadModel(m1.instance_id);

  // WITH draft
  log(`\n  [2] WITH speculative decoding`);
  const m2 = await loadModel(mainModel);
  const d2 = await loadModel(draftModel);
  if (m2.error || d2.error) { log(`  Load ERROR`); return; }
  log(`  Main: ${ms(m2.load_time_seconds * 1000)}, Draft: ${ms(d2.load_time_seconds * 1000)}`);

  const t2 = Date.now();
  const r2 = await chat(mainModel, draftModel, messages);
  const t3 = Date.now() - t2;
  if (r2.error) { log(`  Chat ERROR: ${r2.error.message}`); }
  else log(`  Response: ${ms(t3)} | Tokens: ${r2.usage?.completion_tokens || '?'}`);
  await unloadModel(m2.instance_id);
  await unloadModel(d2.instance_id);

  log(`\n  Speedup: ${(t1/t3).toFixed(2)}x ${t3 < t1 ? 'faster' : 'slower'}`);
}

async function main() {
  log("=".repeat(50));
  log("LM Studio Quick Benchmark");
  log("=".repeat(50));

  const models = await getModels();
  log(`\nModels: ${models.length}`);
  models.forEach(m => log(`  ${m.type}: ${m.key} (${(m.size_bytes/1e6).toFixed(0)}MB, ctx=${m.max_context_length})`));

  // Embedding tests
  log("\n" + "=".repeat(50));
  log("EMBEDDING BENCHMARKS");
  log("=".repeat(50));

  const nomic = models.find(m => m.key.includes("nomic"));
  const qwenEmbed = models.find(m => m.key.includes("qwen3-embedding"));

  const results = [];

  if (nomic) {
    const r = await benchEmbed(nomic.key, "nomic-embed (84MB)", 512);
    if (r) results.push(r);
  }

  if (qwenEmbed) {
    const r = await benchEmbed(qwenEmbed.key, "qwen3-embed (2.5GB)", 4096);
    if (r) results.push(r);
  }

  // Speculative decoding tests
  log("\n" + "=".repeat(50));
  log("SPECULATIVE DECODING TESTS");
  log("=".repeat(50));

  const llms = models.filter(m => m.type === "llm");
  const mainModel = llms.find(m => m.key.includes("4b")) || llms[0];
  const draftModel = llms.find(m => m.key.includes("0.8b") || m.key.includes("1b") || m.key.includes("2b"));

  if (mainModel && draftModel) {
    await benchSpeculative(mainModel.key, draftModel.key);
  }

  // Summary
  if (results.length) {
    log("\n" + "=".repeat(50));
    log("SUMMARY");
    log("=".repeat(50));
    results.sort((a,b) => a.avg - b.avg);
    results.forEach((r, i) => {
      log(`${i+1}. ${r.label}: ${ms(r.avg)} avg (load ${ms(r.loadTime * 1000)})`);
    });
  }
}

main().catch(console.error);
