#!/usr/bin/env node

const LM_STUDIO_URL = "http://192.168.1.12:1234/v1";

const TEST_TEXTS = [
  "function calculateTotal(items) { return items.reduce((sum, item) => sum + item.price, 0); }",
  "class UserController extends BaseController { async login(req, res) { return this.authService.verify(req.body); } }",
  "SELECT * FROM users WHERE active = 1",
  "const useAuth = () => { const { user } = useContext(AuthContext); return { user }; };"
];

async function log(message) {
  console.log(`[${new Date().toISOString()}] ${message}`);
}

function formatMs(ms) {
  return ms < 1000 ? `${ms.toFixed(0)}ms` : `${(ms / 1000).toFixed(2)}s`;
}

async function getAvailableModels() {
  const res = await fetch(`${LM_STUDIO_URL}/models`);
  const data = await res.json();
  return data.data || [];
}

async function loadModel(modelId, contextLength = 512) {
  try {
    const res = await fetch(`${LM_STUDIO_URL}/models/load`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: modelId,
        context_length: contextLength,
        echo_load_config: true
      })
    });
    const data = await res.json();
    return data;
  } catch (error) {
    return { error: error.message };
  }
}

async function unloadModel(instanceId) {
  try {
    await fetch(`${LM_STUDIO_URL}/models/unload`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ instance_id: instanceId })
    });
    return true;
  } catch {
    return false;
  }
}

async function testEmbedding(modelId, texts, contextLength = 512) {
  log(`Testing embedding: ${modelId} (ctx=${contextLength})`);

  const loadResult = await loadModel(modelId, contextLength);
  if (loadResult.error) {
    log(`  Load ERROR: ${loadResult.error}`);
    return null;
  }
  log(`  Load time: ${loadResult.load_time_seconds?.toFixed(2)}s`);

  const times = [];
  for (let i = 0; i < 5; i++) {
    const start = Date.now();
    try {
      const res = await fetch(`${LM_STUDIO_URL}/embeddings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: modelId,
          input: texts
        })
      });
      const data = await res.json();
      if (data.error) {
        log(`  Error: ${data.error.message}`);
        continue;
      }
      const elapsed = Date.now() - start;
      times.push(elapsed);
      log(`  Run ${i + 1}: ${formatMs(elapsed)} (${data.data?.length || 0} emb)`);
    } catch (error) {
      log(`  Error: ${error.message}`);
    }
  }

  await unloadModel(loadResult.instance_id);

  if (times.length === 0) return null;

  return {
    model: modelId,
    contextLength,
    loadTime: loadResult.load_time_seconds,
    avgTime: times.reduce((a, b) => a + b, 0) / times.length,
    minTime: Math.min(...times),
    maxTime: Math.max(...times)
  };
}

async function testChatWithSpeculative(modelId, draftModelId, messages) {
  log(`\n--- WITH speculative decoding ---`);
  log(`  Main: ${modelId}, Draft: ${draftModelId}`);

  const mainLoad = await loadModel(modelId);
  if (mainLoad.error) {
    log(`  Main load ERROR: ${mainLoad.error}`);
    return null;
  }

  const draftLoad = await loadModel(draftModelId);
  if (draftLoad.error) {
    log(`  Draft load ERROR: ${draftLoad.error}`);
    return null;
  }

  const start = Date.now();
  try {
    const res = await fetch(`${LM_STUDIO_URL}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: modelId,
        messages,
        max_tokens: 100,
        temperature: 0.7,
        draft_model: draftModelId
      })
    });
    const data = await res.json();
    const elapsed = Date.now() - start;

    if (data.error) {
      log(`  Chat ERROR: ${data.error.message}`);
      return null;
    }

    log(`  Response: ${formatMs(elapsed)}`);
    return { model: modelId, draftModel: draftModelId, responseTime: elapsed, usage: data.usage };
  } catch (error) {
    log(`  Error: ${error.message}`);
    return null;
  } finally {
    await unloadModel(mainLoad.instance_id);
    await unloadModel(draftLoad.instance_id);
  }
}

async function testChatWithoutSpeculative(modelId, messages) {
  log(`\n--- WITHOUT speculative decoding ---`);
  log(`  Model: ${modelId}`);

  const loadResult = await loadModel(modelId);
  if (loadResult.error) {
    log(`  Load ERROR: ${loadResult.error}`);
    return null;
  }

  const start = Date.now();
  try {
    const res = await fetch(`${LM_STUDIO_URL}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: modelId,
        messages,
        max_tokens: 100,
        temperature: 0.7
      })
    });
    const data = await res.json();
    const elapsed = Date.now() - start;

    if (data.error) {
      log(`  Chat ERROR: ${data.error.message}`);
      return null;
    }

    log(`  Response: ${formatMs(elapsed)}`);
    return { model: modelId, responseTime: elapsed, usage: data.usage };
  } catch (error) {
    log(`  Error: ${error.message}`);
    return null;
  } finally {
    await unloadModel(loadResult.instance_id);
  }
}

async function main() {
  log("=".repeat(60));
  log("LM Studio Parameter Testing");
  log("=".repeat(60));

  const allModels = await getAvailableModels();
  log(`\nAvailable models: ${allModels.length}`);
  allModels.forEach(m => log(`  - ${m.id}`));

  const chatModels = allModels.filter(m => !m.id.includes("embedding") && !m.id.includes("embed"));
  const embedModels = allModels.filter(m => m.id.includes("embedding") || m.id.includes("embed"));

  log("\n" + "=".repeat(60));
  log("EMBEDDING MODEL TESTS");
  log("=".repeat(60));

  for (const model of embedModels) {
    log("\n" + "-".repeat(40));

    await testEmbedding(model.id, TEST_TEXTS, 512);
    await testEmbedding(model.id, TEST_TEXTS, 256);
    await testEmbedding(model.id, TEST_TEXTS, 128);
  }

  log("\n" + "=".repeat(60));
  log("SPECULATIVE DECODING TESTS");
  log("=".repeat(60));

  const testMessages = [
    { role: "system", content: "You are a helpful assistant." },
    { role: "user", content: "What is authentication?" }
  ];

  if (chatModels.length >= 2) {
    const mainModel = chatModels.find(m => m.id.includes("4b") || m.id.includes("8b")) || chatModels[0];
    const draftModel = chatModels.find(m =>
      m.id.includes("0.5b") || m.id.includes("1b") || m.id.includes("2b")
    ) || chatModels[chatModels.length - 1];

    if (mainModel && draftModel && mainModel.id !== draftModel.id) {
      log(`\nMain: ${mainModel.id}`);
      log(`Draft: ${draftModel.id}`);

      const withSpec = await testChatWithSpeculative(mainModel.id, draftModel.id, testMessages);
      const withoutSpec = await testChatWithoutSpeculative(mainModel.id, testMessages);

      if (withSpec && withoutSpec) {
        log("\n" + "=".repeat(60));
        log("COMPARISON");
        log("=".repeat(60));
        const speedup = withoutSpec.responseTime / withSpec.responseTime;
        log(`With draft:   ${formatMs(withSpec.responseTime)}`);
        log(`Without:      ${formatMs(withoutSpec.responseTime)}`);
        log(`Speedup:      ${speedup.toFixed(2)}x`);
      }
    } else {
      log("\nNo suitable model pair found for speculative decoding test");
      log("Need at least one main model (4b+) and one draft model (0.5b-2b)");
    }
  }

  log("\n" + "=".repeat(60));
  log("Done!");
}

main().catch(console.error);
