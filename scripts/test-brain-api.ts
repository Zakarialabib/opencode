#!/usr/bin/env npx tsx
/**
 * Brain Plugin HTTP/API Test
 * Tests LM Studio connectivity and basic API without native modules
 */

const LM_STUDIO_URL = process.env.LM_STUDIO_URL || "http://192.168.1.12:1234";

interface TestResult {
  name: string;
  status: "PASS" | "FAIL" | "WARN";
  duration: number;
  details: string;
  error?: string;
}

async function testLMStudioAPI(): Promise<TestResult> {
  const start = Date.now();
  try {
    const response = await fetch(LM_STUDIO_URL + "/api/v0/models");
    const data = await response.json();
    const models = Array.isArray(data) ? data : data.data || [];
    
    return {
      name: "LM Studio API - List Models",
      status: "PASS",
      duration: Date.now() - start,
      details: "Found " + models.length + " models: " + models.map((m: any) => m.id).join(", "),
    };
  } catch (err: any) {
    return {
      name: "LM Studio API - List Models",
      status: "FAIL",
      duration: Date.now() - start,
      details: err.message,
      error: err.message,
    };
  }
}

async function testEmbeddingEndpoint(): Promise<TestResult> {
  const start = Date.now();
  try {
    const response = await fetch(LM_STUDIO_URL + "/api/v0/embedding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "text-embedding-qwen3-embedding-0.6b",
        input: ["function test() { return 42; }"],
      }),
    });
    
    if (response.ok) {
      const data = await response.json();
      return {
        name: "LM Studio - Embedding Endpoint",
        status: "PASS",
        duration: Date.now() - start,
        details: "Embedding dim: " + (data.data?.[0]?.embedding?.length || "unknown"),
      };
    } else {
      return {
        name: "LM Studio - Embedding Endpoint",
        status: "FAIL",
        duration: Date.now() - start,
        details: "HTTP " + response.status,
        error: "HTTP " + response.status,
      };
    }
  } catch (err: any) {
    return {
      name: "LM Studio - Embedding Endpoint",
      status: "FAIL",
      duration: Date.now() - start,
      details: err.message,
      error: err.message,
    };
  }
}

async function testChatEndpoint(): Promise<TestResult> {
  const start = Date.now();
  try {
    const response = await fetch(LM_STUDIO_URL + "/api/v0/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "qwen3.5-0.8b-claude-4.6-opus-reasoning-distilled",
        messages: [{ role: "user", content: "Reply with just 'pong' to test connectivity" }],
        max_tokens: 10,
        temperature: 0.1,
      }),
    });
    
    if (response.ok) {
      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || "";
      return {
        name: "LM Studio - Chat Endpoint (small model)",
        status: content.toLowerCase().includes("pong") ? "PASS" : "WARN",
        duration: Date.now() - start,
        details: "Response: " + content.slice(0, 50),
      };
    } else {
      const errText = await response.text();
      return {
        name: "LM Studio - Chat Endpoint (small model)",
        status: "FAIL",
        duration: Date.now() - start,
        details: "HTTP " + response.status + ": " + errText.slice(0, 100),
        error: "HTTP " + response.status,
      };
    }
  } catch (err: any) {
    return {
      name: "LM Studio - Chat Endpoint (small model)",
      status: "FAIL",
      duration: Date.now() - start,
      details: err.message,
      error: err.message,
    };
  }
}

async function testNomicEmbedding(): Promise<TestResult> {
  const start = Date.now();
  try {
    const response = await fetch(LM_STUDIO_URL + "/api/v0/embedding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "nomic-embed-text-v1.5",
        input: ["const x = 42;"],
      }),
    });
    
    if (response.ok) {
      const data = await response.json();
      return {
        name: "LM Studio - Nomic Embedding",
        status: "PASS",
        duration: Date.now() - start,
        details: "Model: nomic-embed-text-v1.5, Dim: " + (data.data?.[0]?.embedding?.length || "unknown"),
      };
    } else {
      return {
        name: "LM Studio - Nomic Embedding",
        status: "FAIL",
        duration: Date.now() - start,
        details: "HTTP " + response.status,
        error: "HTTP " + response.status,
      };
    }
  } catch (err: any) {
    return {
      name: "LM Studio - Nomic Embedding",
      status: "FAIL",
      duration: Date.now() - start,
      details: err.message,
      error: err.message,
    };
  }
}

async function testRerankerModel(): Promise<TestResult> {
  const start = Date.now();
  try {
    const response = await fetch(LM_STUDIO_URL + "/api/v0/llm/load", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "qwen3-reranker-0.6b",
      }),
    });
    
    const text = await response.text();
    const isLoaded = text.includes("loaded") || text.includes("loading") || response.ok;
    
    return {
      name: "LM Studio - Reranker Model",
      status: isLoaded ? "PASS" : "WARN",
      duration: Date.now() - start,
      details: "qwen3-reranker-0.6b available: " + isLoaded,
    };
  } catch (err: any) {
    return {
      name: "LM Studio - Reranker Model",
      status: "WARN",
      duration: Date.now() - start,
      details: err.message,
      error: err.message,
    };
  }
}

async function testGemmaModel(): Promise<TestResult> {
  const start = Date.now();
  try {
    const response = await fetch(LM_STUDIO_URL + "/api/v0/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gemma-4-e4b-it",
        messages: [{ role: "user", content: "Reply with just 'hi' to test" }],
        max_tokens: 10,
        temperature: 0.1,
      }),
    });
    
    if (response.ok) {
      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || "";
      return {
        name: "LM Studio - Gemma 4E Chat",
        status: content.toLowerCase().includes("hi") ? "PASS" : "WARN",
        duration: Date.now() - start,
        details: "Response: " + content.slice(0, 50),
      };
    } else {
      return {
        name: "LM Studio - Gemma 4E Chat",
        status: "WARN",
        duration: Date.now() - start,
        details: "HTTP " + response.status,
      };
    }
  } catch (err: any) {
    return {
      name: "LM Studio - Gemma 4E Chat",
      status: "WARN",
      duration: Date.now() - start,
      details: err.message,
    };
  }
}

async function runAllTests(): Promise<void> {
  console.log("================================================================");
  console.log("         Brain Plugin - LM Studio API Test Suite              ");
  console.log("================================================================");
  console.log("");
  console.log("Target: " + LM_STUDIO_URL);
  console.log("");

  const tests = [
    testLMStudioAPI,
    testEmbeddingEndpoint,
    testNomicEmbedding,
    testChatEndpoint,
    testGemmaModel,
    testRerankerModel,
  ];

  const results: TestResult[] = [];
  
  for (const test of tests) {
    const name = test.name.replace("LM Studio - ", "");
    process.stdout.write(name.padEnd(40) + " ");
    const result = await test();
    results.push(result);
    const icon = result.status === "PASS" ? "[PASS]" : result.status === "WARN" ? "[WARN]" : "[FAIL]";
    console.log(icon + " " + result.duration + "ms");
  }

  // Summary
  console.log("");
  console.log("================================================================");
  console.log("                       RESULTS SUMMARY                         ");
  console.log("================================================================");
  
  const passed = results.filter(r => r.status === "PASS").length;
  const warned = results.filter(r => r.status === "WARN").length;
  const failed = results.filter(r => r.status === "FAIL").length;
  
  console.log("");
  console.log("Passed: " + passed + "/" + tests.length);
  console.log("Warnings: " + warned);
  console.log("Failed: " + failed);
  
  if (failed > 0) {
    console.log("");
    console.log("FAILURE DETAILS:");
    results.filter(r => r.status === "FAIL").forEach(r => {
      console.log("  - " + r.name + ": " + r.error);
    });
  }
  
  if (warned > 0) {
    console.log("");
    console.log("WARNING DETAILS:");
    results.filter(r => r.status === "WARN").forEach(r => {
      console.log("  - " + r.name + ": " + r.details);
    });
  }

  console.log("");
  console.log("--- Detailed Results ---");
  results.forEach(r => {
    console.log("");
    console.log(r.status + " " + r.name);
    console.log("  " + r.details);
  });

  process.exit(failed > 0 ? 1 : 0);
}

runAllTests().catch((err) => {
  console.error("Test suite failed:", err);
  process.exit(1);
});