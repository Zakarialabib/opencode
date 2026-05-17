#!/usr/bin/env npx tsx
/**
 * Model Orchestration Demo - Real RAG Pipeline
 *
 * Uses the loaded models in a real agent scenario:
 * - text-embedding-qwen3-embedding-0.6b (or splade) for embeddings
 * - qwen3-reranker-0.6b for result re-ranking
 * - qwen3.5-0.8b-claude-4.6-opus-reasoning-distilled for chat
 *
 * This demonstrates actual performance, not just benchmark scores.
 */

import { defaultProvider, GPU_AWARE_MODELS } from "../brain-plugin/provider/lmstudio";
import { searchProjectContext } from "../brain-plugin/retrieval/searcher";
import { contextInjector } from "../brain-plugin/context/injector";
import { reciprocalRankFusion, setFusionWeights } from "../brain-plugin/retrieval/fusion";
import {
  setRerankerConfidenceGate,
  setRerankMinResults,
  setRerankerMaxChunks,
} from "../brain-plugin/retrieval/reranker";
import { setIntentThresholds, setChunkCounts } from "../brain-plugin/tree/engine";
import { indexProject } from "../brain-plugin/retrieval/indexer";
import { fileLog, clearLog } from "../meta-harness/utils/logger";
import { join } from "path";

const PROJECT_ROOT = process.cwd();

interface ModelPerfMetrics {
  modelId: string;
  operation: string;
  durationMs: number;
  success: boolean;
  result?: any;
}

interface AgentScenario {
  name: string;
  query: string;
  intent: "learn" | "debug" | "refactor" | "feature" | "test";
  expectedChunks: number;
}

// Define test scenarios for different intents
const AGENT_SCENARIOS: AgentScenario[] = [
  {
    name: "Learn - Architecture Discovery",
    query: "How does the authentication flow work in this codebase?",
    intent: "learn",
    expectedChunks: 5,
  },
  {
    name: "Debug - Error Investigation",
    query: "Why is the database connection failing at startup?",
    intent: "debug",
    expectedChunks: 3,
  },
  {
    name: "Refactor - Extract Logic",
    query: "Extract the validation logic into a reusable function",
    intent: "refactor",
    expectedChunks: 4,
  },
  {
    name: "Feature - Add Endpoint",
    query: "Add a new REST endpoint for user preferences",
    intent: "feature",
    expectedChunks: 5,
  },
  {
    name: "Test - Generate Tests",
    query: "Write unit tests for the payment processing module",
    intent: "test",
    expectedChunks: 4,
  },
];

async function embedQuery(text: string, modelId: string): Promise<number[]> {
  console.log(`   📊 Embedding with ${modelId}...`);
  const start = Date.now();
  try {
    const embeddings = await defaultProvider.embed(modelId, [text]);
    const duration = Date.now() - start;
    console.log(
      `      ✓ Embedding done in ${duration}ms (vector dim: ${embeddings[0]?.length || "unknown"})`
    );
    return embeddings[0];
  } catch (err: any) {
    console.log(`      ✗ Embedding failed: ${err.message}`);
    return [];
  }
}

async function rerankResults(query: string, chunks: any[], modelId: string): Promise<any[]> {
  console.log(`   🎯 Re-ranking ${chunks.length} chunks with ${modelId}...`);
  const start = Date.now();
  try {
    // For simplicity, we'll use the chat model as a reranker substitute
    // since the actual reranker endpoint may differ
    const scored = await Promise.all(
      chunks.map(async (chunk, idx) => {
        const prompt = `Query: ${query}\n\nChunk: ${chunk.content?.slice(0, 200)}...\n\nScore relevance 0-1:`;
        const result = await defaultProvider.chat(modelId, [{ role: "user", content: prompt }], {
          maxTokens: 20,
          temperature: 0.1,
        });

        const score = parseFloat(result.match(/0\.\d+/)?.[0] || "0.5");
        return { ...chunk, rerankScore: score, originalIdx: idx };
      })
    );

    scored.sort((a, b) => b.rerankScore - a.rerankScore);
    const duration = Date.now() - start;
    console.log(`      ✓ Re-ranking done in ${duration}ms`);
    return scored;
  } catch (err: any) {
    console.log(`      ✗ Re-ranking failed: ${err.message}`);
    return chunks;
  }
}

async function chatWithModel(modelId: string, messages: any[], options?: any): Promise<string> {
  console.log(`   💬 Chat with ${modelId}...`);
  const start = Date.now();
  try {
    const response = await defaultProvider.chat(modelId, messages, options);
    const duration = Date.now() - start;
    console.log(`      ✓ Response in ${duration}ms (${response.length} chars)`);
    return response;
  } catch (err: any) {
    console.log(`      ✗ Chat failed: ${err.message}`);
    return `Error: ${err.message}`;
  }
}

async function runScenario(scenario: AgentScenario, metrics: ModelPerfMetrics[]): Promise<void> {
  console.log(`\n${"═".repeat(60)}`);
  console.log(`📋 Scenario: ${scenario.name}`);
  console.log(`   Query: "${scenario.query.slice(0, 60)}..."`);
  console.log(`   Intent: ${scenario.intent}`);

  // Step 1: Semantic Search with Embedding
  const embedStart = Date.now();
  const searchResults = await searchProjectContext(
    PROJECT_ROOT,
    scenario.query,
    10,
    scenario.intent
  );
  const embedDuration = Date.now() - embedStart;

  metrics.push({
    modelId: GPU_AWARE_MODELS.embed,
    operation: "semantic_search",
    durationMs: embedDuration,
    success: searchResults.length > 0,
    result: { chunksFound: searchResults.length },
  });

  console.log(`   📦 Search returned ${searchResults.length} chunks`);

  if (searchResults.length === 0) {
    console.log(`   ⚠️ No results - project may not be indexed`);
    console.log(`   💡 Run: npx tsx scripts/index-project.ts to index first`);
    return;
  }

  // Step 2: Re-ranking with Reranker
  const rerankStart = Date.now();
  const rerankedResults = await rerankResults(
    scenario.query,
    searchResults.slice(0, 8),
    GPU_AWARE_MODELS.reranker
  );
  const rerankDuration = Date.now() - rerankStart;

  metrics.push({
    modelId: GPU_AWARE_MODELS.reranker,
    operation: "rerank_chunks",
    durationMs: rerankDuration,
    success: rerankedResults.length > 0,
    result: { chunksReranked: rerankedResults.length },
  });

  // Step 3: Context Injection
  const topChunks = rerankedResults.slice(0, scenario.expectedChunks);
  const context = {
    chunks: topChunks.map((c) => ({
      id: c.id,
      filepath: c.filepath,
      content: c.content,
      start_line: c.start_line,
      end_line: c.end_line,
    })),
    totalChunks: topChunks.length,
  };

  // Step 4: Generate Response with Chat Model (light model)
  const chatStart = Date.now();

  const contextText = context.chunks
    .map((c) => `// ${c.filepath} (lines ${c.start_line}-${c.end_line})\n${c.content}`)
    .join("\n\n---\n\n");

  const prompt = `You are an expert coding assistant. Based on the following codebase context, answer the user's question.

Context:
${contextText}

Question: ${scenario.query}

Answer:`;

  const response = await chatWithModel(
    "qwen3.5-0.8b-claude-4.6-opus-reasoning-distilled", // Light model for speed
    [{ role: "user", content: prompt }],
    { maxTokens: 500, temperature: 0.7 }
  );

  const chatDuration = Date.now() - chatStart;

  metrics.push({
    modelId: "qwen3.5-0.8b-claude-4.6-opus-reasoning-distilled",
    operation: "generate_response",
    durationMs: chatDuration,
    success: response.length > 0,
    result: { responseLength: response.length },
  });

  // Summary for this scenario
  console.log(`\n   📊 Performance Summary:`);
  console.log(`      Embedding: ${embedDuration}ms`);
  console.log(`      Re-ranking: ${rerankDuration}ms`);
  console.log(`      Chat: ${chatDuration}ms`);
  console.log(`      Total: ${embedDuration + rerankDuration + chatDuration}ms`);

  console.log(`\n   💬 Response Preview:`);
  console.log(`   "${response.slice(0, 200)}..."`);
}

async function checkLoadedModels(): Promise<string[]> {
  console.log("\n🔍 Checking loaded models in LM Studio...");
  try {
    const models = await defaultProvider.getLoadedModels();
    console.log(`   Found ${models.length} loaded models:`);
    for (const m of models) {
      console.log(`   - ${m}`);
    }
    return models;
  } catch (err: any) {
    console.log(`   ✗ Failed to list models: ${err.message}`);
    return [];
  }
}

function configureBrainPlugin() {
  console.log("\n🧠 Configuring Brain Plugin with optimized settings...");

  // Fusion weights optimized for RAG
  setFusionWeights(0.35, 0.45, 0.2); // Slightly more weight on dense
  setRerankerConfidenceGate(0.8); // Lower gate for more reranking
  setRerankMinResults(5);
  setRerankerMaxChunks(15);

  // Tree thresholds per intent
  setIntentThresholds({
    debug: 0.65,
    refactor: 0.55,
    feature: 0.55,
    test: 0.6,
    learn: 0.45, // Lower threshold for learn (more context)
    quick_chat: 0.25,
  });

  setChunkCounts({
    debug: 8,
    refactor: 12,
    feature: 10,
    test: 8,
    learn: 15, // More chunks for learn intent
    quick_chat: 0,
  });

  console.log(`   ✓ Brain plugin configured`);
}

async function main() {
  console.log("╔════════════════════════════════════════════════════════════╗");
  console.log("║  Model Orchestration Demo - Real RAG Pipeline              ║");
  console.log("╚════════════════════════════════════════════════════════════╝");

  clearLog();
  fileLog("=== Model Orchestration Demo Started ===");

  // Set LM Studio URL (SDK requires ws:// or wss://)
  const lmStudioUrl = process.env.LM_STUDIO_URL || "ws://127.0.0.1:1234";
  defaultProvider.setBaseURL(lmStudioUrl);

  // Check loaded models
  const loadedModels = await checkLoadedModels();

  if (loadedModels.length === 0) {
    console.log("\n❌ No models loaded in LM Studio!");
    console.log("   Please load these models in LM Studio:");
    console.log("   - text-embedding-qwen3-embedding-0.6b");
    console.log("   - qwen3-reranker-0.6b");
    console.log("   - qwen3.5-0.8b-claude-4.6-opus-reasoning-distilled");
    return;
  }

  // Verify required models (check LLM list + try embedding model info)
  const hasEmbed =
    loadedModels.some((m) => m.includes("embedding") || m.includes("embed")) ||
    (await defaultProvider
      .getEmbeddingModelInfo()
      .then(() => true)
      .catch(() => false));
  const hasReranker = loadedModels.some((m) => m.includes("reranker"));
  const hasChat = loadedModels.some((m) => m.includes("0.8b") || m.includes("qwen3"));

  console.log(`\n📋 Model Availability:`);
  console.log(`   Embedding: ${hasEmbed ? "✓" : "✗"}`);
  console.log(`   Reranker: ${hasReranker ? "✓" : "✗"}`);
  console.log(`   Chat (light): ${hasChat ? "✓" : "✗"}`);

  if (!hasEmbed) {
    console.log("\n❌ Embedding model required for RAG!");
    return;
  }

  // Configure brain plugin
  configureBrainPlugin();

  const metrics: ModelPerfMetrics[] = [];

  // Run scenarios
  console.log("\n" + "═".repeat(60));
  console.log("🚀 Running Agent Scenarios");
  console.log("═".repeat(60));

  for (const scenario of AGENT_SCENARIOS) {
    await runScenario(scenario, metrics);
  }

  // Performance Summary
  console.log("\n" + "╔════════════════════════════════════════════════════════════╗");
  console.log("║           PERFORMANCE SUMMARY                              ║");
  console.log("╚════════════════════════════════════════════════════════════╝");

  // Group by model
  const byModel = new Map<string, ModelPerfMetrics[]>();
  for (const m of metrics) {
    if (!byModel.has(m.modelId)) byModel.set(m.modelId, []);
    byModel.get(m.modelId)!.push(m);
  }

  for (const [modelId, modelMetrics] of byModel) {
    const totalDuration = modelMetrics.reduce((sum, m) => sum + m.durationMs, 0);
    const avgDuration = totalDuration / modelMetrics.length;
    const successCount = modelMetrics.filter((m) => m.success).length;

    console.log(`\n📊 ${modelId}`);
    console.log(`   Operations: ${modelMetrics.length}`);
    console.log(`   Success: ${successCount}/${modelMetrics.length}`);
    console.log(`   Avg Duration: ${avgDuration.toFixed(0)}ms`);
    console.log(`   Total Time: ${totalDuration}ms`);
  }

  // Save metrics
  const outputPath = join(
    PROJECT_ROOT,
    ".opencode",
    "meta-harness-logs",
    "orchestration-metrics.json"
  );
  const fs = await import("fs");
  fs.writeFileSync(
    outputPath,
    JSON.stringify(
      {
        timestamp: Date.now(),
        models: loadedModels,
        scenarios: AGENT_SCENARIOS.map((s) => s.name),
        metrics,
        summary: {
          totalOperations: metrics.length,
          totalDurationMs: metrics.reduce((sum, m) => sum + m.durationMs, 0),
          successRate:
            ((metrics.filter((m) => m.success).length / metrics.length) * 100).toFixed(1) + "%",
        },
      },
      null,
      2
    )
  );

  console.log(`\n📄 Metrics saved to: ${outputPath}`);

  fileLog("=== Model Orchestration Demo Completed ===");
}

main().catch((err) => {
  console.error("Demo failed:", err);
  process.exit(1);
});
