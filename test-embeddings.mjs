const BASE_URL = "http://192.168.1.12:1234/v1";

async function embed(text, model = "text-embedding-nomic-embed-text-v1.5") {
  const response = await fetch(`${BASE_URL}/embeddings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      input: text.replace(/\n/g, " "),
    }),
  });
  const data = await response.json();
  if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));
  return data.data[0].embedding;
}

function cosineSimilarity(a, b) {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

async function test() {
  console.log("🧪 Testing LM Studio Embeddings\n");

  console.log("📌 Testing available models...");
  const modelsRes = await fetch(`${BASE_URL}/models`);
  const models = await modelsRes.json();
  console.log("   Available models:");
  models.data.forEach((m) => console.log(`   - ${m.id}`));

  console.log("\n📌 Single embedding (Nomic):");
  const e1 = await embed("Hello world");
  console.log(`   Dimensions: ${e1.length}`);
  console.log(`   First 5: [${e1.slice(0, 5).map((v) => v.toFixed(4)).join(", ")}]`);

  console.log("\n📌 Single embedding (Qwen3):");
  const e2 = await embed("Hello world", "text-embedding-qwen3-embedding-4b");
  console.log(`   Dimensions: ${e2.length}`);

  console.log("\n📌 Batch embeddings with Nomic:");
  const texts = [
    "The quick brown fox jumps over the lazy dog",
    "A fast brown canine leaps over a sleepy hound",
    "Machine learning is transforming AI",
    "Deep neural networks power modern applications",
  ];
  const embeddings = [];
  for (const t of texts) {
    try {
      const e = await embed(t);
      embeddings.push(e);
      console.log(`   - "${t.substring(0, 30)}..." -> ${e.length}d`);
    } catch (err) {
      console.log(`   - "${t.substring(0, 30)}..." -> ERROR: ${err.message}`);
    }
  }

  console.log("\n📌 Similarity tests:");
  if (embeddings.length >= 4) {
    const sim1 = cosineSimilarity(embeddings[0], embeddings[1]);
    const sim2 = cosineSimilarity(embeddings[2], embeddings[3]);
    const sim3 = cosineSimilarity(embeddings[0], embeddings[2]);
    console.log(`   "fox" vs "dog" (similar): ${sim1.toFixed(4)}`);
    console.log(`   "ML" vs "AI" (similar): ${sim2.toFixed(4)}`);
    console.log(`   "fox" vs "ML" (dissimilar): ${sim3.toFixed(4)}`);
  }

  console.log("\n✅ Embedding tests completed!");
}

test().catch(console.error);
