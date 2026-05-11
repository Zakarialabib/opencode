#!/usr/bin/env node

const LM_STUDIO_URL = "http://192.168.1.12:1234/v1";

const EMBEDDING_MODELS = [
  "text-embedding-nomic-embed-text-v1.5",
  "text-embedding-qwen3-embedding-4b"
];

const TEST_TEXTS = [
  "function calculateTotal(items) { return items.reduce((sum, item) => sum + item.price, 0); }",
  "class UserController extends BaseController { async login(req, res) { const { email, password } = req.body; return this.authService.verify(email, password); } }",
  "SELECT u.*, p.name as profile_name FROM users u LEFT JOIN profiles p ON u.id = p.user_id WHERE u.active = 1",
  "const useAuth = () => { const { user, logout } = useContext(AuthContext); return { user, logout }; };",
  "def predict(self, X): return self.model.predict_proba(X)[:, 1] if hasattr(self.model, 'predict_proba') else self.model.predict(X)",
  "export interface UserProps { id: string; name: string; email: string; role: 'admin' | 'user'; createdAt: Date; }",
  "async function fetchUserData(userId: string): Promise<User> { const response = await fetch(`/api/users/${userId}`); if (!response.ok) throw new Error('User not found'); return response.json(); }",
  "SELECT orders.*, customers.name as customer_name FROM orders INNER JOIN customers ON orders.customer_id = customers.id WHERE orders.created_at > '2024-01-01'",
  "private Vector<Double> computeFeatures(List<Double> input) { return input.stream().map(x -> Math.sqrt(x * x)).collect(Collectors.toList()); }",
  "func (r *Repository) FindAll(ctx context.Context) ([]*Model, error) { var models []*Model; if err := r.db.Find(&models).Error; err != nil { return nil, err }; return models, nil }"
];

function log(message) {
  console.log(`[${new Date().toISOString()}] ${message}`);
}

function formatMs(ms) {
  if (ms < 1000) return `${ms.toFixed(0)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

async function getAvailableModels() {
  const res = await fetch(`${LM_STUDIO_URL}/models`);
  const data = await res.json();
  return data.data
    .filter(m => m.id.includes("embedding") || m.id.includes("embed"))
    .map(m => m.id);
}

async function benchmarkModel(modelId, texts, iterations = 3) {
  log(`Benchmarking: ${modelId}`);

  const times = [];

  for (let i = 0; i < iterations; i++) {
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
      const elapsed = Date.now() - start;

      if (data.error) {
        log(`  Error: ${data.error.message}`);
        continue;
      }

      const embeddingCount = data.data?.length || 0;
      const dimensions = data.data?.[0]?.embedding?.length || 0;

      times.push(elapsed);
      log(`  Run ${i + 1}: ${formatMs(elapsed)} (${embeddingCount} embeddings, ${dimensions} dims)`);
    } catch (error) {
      log(`  Error: ${error.message}`);
    }
  }

  if (times.length === 0) {
    return null;
  }

  const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
  const minTime = Math.min(...times);
  const maxTime = Math.max(...times);

  return {
    model: modelId,
    avgTime: avgTime,
    minTime: minTime,
    maxTime: maxTime,
    runs: times.length
  };
}

async function benchmarkBatchVsSequential(modelId, texts) {
  log(`\nBatch vs Sequential: ${modelId}`);

  const batchSize = texts.length;

  log(`  Testing batch (${batchSize} texts)...`);
  const batchStart = Date.now();
  try {
    await fetch(`${LM_STUDIO_URL}/embeddings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: modelId, input: texts })
    });
    log(`  Batch time: ${formatMs(Date.now() - batchStart)}`);
  } catch (e) {
    log(`  Batch error: ${e.message}`);
  }

  log(`  Testing sequential (${batchSize} calls)...`);
  const seqStart = Date.now();
  for (const text of texts) {
    try {
      await fetch(`${LM_STUDIO_URL}/embeddings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: modelId, input: [text] })
      });
    } catch (e) {
      log(`  Sequential error: ${e.message}`);
    }
  }
  log(`  Sequential time: ${formatMs(Date.now() - seqStart)}`);
}

async function getModelInfo(modelId) {
  try {
    const res = await fetch(`${LM_STUDIO_URL}/models`);
    const data = await res.json();
    const model = data.data.find(m => m.id === modelId);
    return model || { id: modelId };
  } catch {
    return { id: modelId };
  }
}

async function main() {
  log("=".repeat(60));
  log("Embedding Model Benchmark");
  log("=".repeat(60));
  log(`LM Studio: ${LM_STUDIO_URL}`);
  log(`Test texts: ${TEST_TEXTS.length}`);
  log("=".repeat(60));

  const availableModels = await getAvailableModels();
  log(`\nAvailable embedding models: ${availableModels.length}`);
  availableModels.forEach(m => log(`  - ${m}`));

  const modelsToTest = EMBEDDING_MODELS.filter(m => availableModels.includes(m));
  if (modelsToTest.length === 0) {
    log("\nNo embedding models found in available models!");
    return;
  }

  const results = [];

  for (const modelId of modelsToTest) {
    log("\n" + "-".repeat(60));

    const result = await benchmarkModel(modelId, TEST_TEXTS, 3);
    if (result) {
      results.push(result);
      await benchmarkBatchVsSequential(modelId, TEST_TEXTS);
    }
  }

  log("\n" + "=".repeat(60));
  log("RESULTS SUMMARY");
  log("=".repeat(60));

  results.sort((a, b) => a.avgTime - b.avgTime);

  results.forEach((r, i) => {
    log(`${i + 1}. ${r.model}`);
    log(`   Avg: ${formatMs(r.avgTime)} | Min: ${formatMs(r.minTime)} | Max: ${formatMs(r.maxTime)}`);
  });

  if (results.length > 0) {
    const fastest = results[0];
    const slowest = results[results.length - 1];
    const speedup = slowest.avgTime / fastest.avgTime;

    log("\n" + "=".repeat(60));
    log("RECOMMENDATION");
    log("=".repeat(60));
    log(`Fastest: ${fastest.model} (${formatMs(fastest.avgTime)})`);

    if (speedup > 1.1) {
      log(`Speedup vs slowest: ${speedup.toFixed(2)}x faster`);
    }

    log(`\nTo use the fastest model, update brain-plugin/provider/lmstudio.ts:`);
    log(`  embedModel: "${fastest.model}"`);
  }
}

main().catch(console.error);
