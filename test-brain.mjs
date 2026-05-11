#!/usr/bin/env node
import { DecisionTree } from "./brain-plugin/tree/engine.js";
import { LMStudioProvider } from "./brain-plugin/provider/lmstudio.js";
import { searcher } from "./brain-plugin/retrieval/searcher.js";
import { contextInjector } from "./brain-plugin/context/injector.js";
import { sessionMemory } from "./brain-plugin/state/session.js";

const LM_STUDIO_URL = "http://192.168.1.12:1234/v1";

console.log("=" .repeat(50));
console.log("Brain Plugin Test Suite");
console.log("=" .repeat(50));

async function testProvider() {
  console.log("\n[TEST 1] LM Studio Provider");
  const provider = new LMStudioProvider(LM_STUDIO_URL);

  console.log("  - Fetching models...");
  try {
    const modelsResponse = await fetch(`${LM_STUDIO_URL}/models`);
    const models = await modelsResponse.json();
    console.log(`  - Found ${models.data?.length || 0} models`);
  } catch (error) {
    console.log(`  - ERROR: ${error.message}`);
    return false;
  }

  console.log("  - Testing embedding...");
  try {
    const embedHandle = { id: "test", modelId: "text-embedding-nomic-embed-text-v1.5", loadedAt: Date.now() };
    const embeddings = await provider.embed(embedHandle, ["Hello world"]);
    console.log(`  - Embedding dimensions: ${embeddings[0]?.length || 0}`);
  } catch (error) {
    console.log(`  - ERROR: ${error.message}`);
    return false;
  }

  console.log("  - Testing chat...");
  try {
    const chatHandle = { id: "test", modelId: "qwen3.5-4b", loadedAt: Date.now() };
    const response = await provider.chat(chatHandle, [{ role: "user", content: "Say 'test OK' only" }], { maxTokens: 50 });
    console.log(`  - Chat response: ${response.substring(0, 50)}...`);
  } catch (error) {
    console.log(`  - ERROR: ${error.message}`);
    return false;
  }

  console.log("  [PASS] LM Studio Provider");
  return true;
}

async function testDecisionTree() {
  console.log("\n[TEST 2] Decision Tree");

  try {
    const tree = new DecisionTree();

    console.log("  - Classifying 'fix the auth bug'...");
    const result1 = tree.classify("fix the auth bug", { message: "fix the auth bug", recentFiles: [], diagnostics: [] });
    console.log(`  - Intent: ${result1.node.intent}, Score: ${result1.score.toFixed(2)}`);

    console.log("  - Classifying 'how does the router work'...");
    const result2 = tree.classify("how does the router work", { message: "how does the router work", recentFiles: [], diagnostics: [] });
    console.log(`  - Intent: ${result2.node.intent}, Score: ${result2.score.toFixed(2)}`);

    console.log("  - Classifying 'add user authentication'...");
    const result3 = tree.classify("add user authentication", { message: "add user authentication", recentFiles: [], diagnostics: [] });
    console.log(`  - Intent: ${result3.node.intent}, Score: ${result3.score.toFixed(2)}`);

    const stats = tree.getStats();
    console.log(`  - Total nodes: ${stats.totalNodes}`);

    console.log("  [PASS] Decision Tree");
    return true;
  } catch (error) {
    console.log(`  - ERROR: ${error.message}`);
    return false;
  }
}

async function testContextInjector() {
  console.log("\n[TEST 3] Context Injector");

  try {
    const context = {
      chunks: [
        { text: "function auth() { return true; }", path: "src/auth.js", startLine: 1, endLine: 2 },
        { text: "class User { constructor(name) { this.name = name; } }", path: "src/user.js", startLine: 5, endLine: 7 }
      ],
      totalChunks: 2
    };

    const injected = contextInjector.inject("How does auth work?", context);
    console.log(`  - Injected message length: ${injected.length} chars`);

    const formatted = contextInjector.formatResults(context);
    console.log(`  - Formatted results length: ${formatted.length} chars`);

    console.log("  [PASS] Context Injector");
    return true;
  } catch (error) {
    console.log(`  - ERROR: ${error.message}`);
    return false;
  }
}

async function testSessionMemory() {
  console.log("\n[TEST 4] Session Memory");

  try {
    sessionMemory.reset();

    sessionMemory.recordDecision({ timestamp: Date.now(), intent: "debug", strategy: "test", contextCount: 5, query: "test" });
    sessionMemory.markSuccess();
    sessionMemory.markFileDirty("src/test.js");

    const summary = sessionMemory.getSummary();
    console.log(`  - Summary: ${summary.split("\n").length} lines`);

    const memory = sessionMemory.getMemory();
    console.log(`  - Decisions: ${memory.decisions.length}`);
    console.log(`  - Successes: ${memory.successCount}`);

    console.log("  [PASS] Session Memory");
    return true;
  } catch (error) {
    console.log(`  - ERROR: ${error.message}`);
    return false;
  }
}

async function testSearcher() {
  console.log("\n[TEST 5] Searcher");

  try {
    console.log("  - Running search for 'authentication function'...");
    const result = await searcher.search(
      "authentication function",
      { strategy: "test", depth: "broad", maxChunks: 5, rerank: true },
      process.cwd()
    );
    console.log(`  - Found ${result.totalChunks} chunks`);

    console.log("  [PASS] Searcher");
    return true;
  } catch (error) {
    console.log(`  - ERROR: ${error.message}`);
    return false;
  }
}

async function testBrainScenario() {
  console.log("\n[TEST 6] Brain Scenario (End-to-End)");

  try {
    const tree = new DecisionTree();
    const provider = new LMStudioProvider(LM_STUDIO_URL);

    const query = "fix the login bug in auth.js";
    console.log(`  - Query: "${query}"`);

    const signals = {
      message: query,
      recentFiles: ["src/auth.js"],
      diagnostics: [{ severity: "error", message: "Cannot read property 'token' of undefined", file: "src/auth.js", line: 42 }]
    };

    const { node: scenario, score } = tree.classify(query, signals);
    console.log(`  - Detected intent: ${scenario.intent}`);
    console.log(`  - Confidence score: ${score.toFixed(2)}`);
    console.log(`  - Selected strategy: ${scenario.strategy.name}`);
    console.log(`  - Max chunks: ${scenario.strategy.maxChunks}`);
    console.log(`  - Depth: ${scenario.strategy.depth}`);

    sessionMemory.setDiagnostics(signals.diagnostics);
    sessionMemory.recordDecision({
      timestamp: Date.now(),
      intent: scenario.intent,
      strategy: scenario.strategy.name,
      contextCount: scenario.strategy.maxChunks,
      query
    });

    console.log("  [PASS] Brain Scenario");
    return true;
  } catch (error) {
    console.log(`  - ERROR: ${error.message}`);
    return false;
  }
}

async function runAllTests() {
  const results = [];

  results.push(await testProvider());
  results.push(await testDecisionTree());
  results.push(await testContextInjector());
  results.push(await testSessionMemory());
  results.push(await testSearcher());
  results.push(await testBrainScenario());

  console.log("\n" + "=".repeat(50));
  console.log("Test Results");
  console.log("=".repeat(50));

  const passed = results.filter(r => r).length;
  const failed = results.filter(r => !r).length;

  console.log(`Passed: ${passed}/${results.length}`);
  console.log(`Failed: ${failed}/${results.length}`);

  if (failed === 0) {
    console.log("\n[SUCCESS] All tests passed!");
  } else {
    console.log("\n[FAILURE] Some tests failed.");
    process.exit(1);
  }
}

runAllTests().catch(console.error);
