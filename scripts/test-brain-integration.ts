#!/usr/bin/env npx tsx
/**
 * Brain Plugin Integration Test
 * Tests all components: LM Studio, database, RAG pipeline, tools
 */

import { existsSync, mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { fileLog, clearLog } from "../meta-harness/utils/logger";
import {
  defaultProvider,
  GPU_AWARE_MODELS,
} from "../brain-plugin/provider/lmstudio";
import * as fusion from "../brain-plugin/retrieval/fusion";
import * as rerankerModule from "../brain-plugin/retrieval/reranker";
import * as tree from "../brain-plugin/tree/engine";
import { getDatabase } from "../brain-plugin/store";
import { isVectorActive } from "../brain-plugin/store/vec";
import { searchProjectContext } from "../brain-plugin/retrieval/searcher";
import { sessionMemory } from "../brain-plugin/state/session";
import { getIndexStatus, diagnoseBrainPlugin } from "../brain-plugin/rag-agent";

const OUTPUT_DIR = join(process.cwd(), ".opencode", "meta-harness-logs");

interface TestResult {
  name: string;
  status: "PASS" | "FAIL" | "WARN";
  duration: number;
  details: string;
  error?: string;
}

async function testLMStudioConnectivity(): Promise<TestResult> {
  const start = Date.now();
  try {
    const url = process.env.LM_STUDIO_URL || "http://192.168.1.12:1234";
    defaultProvider.setBaseURL(url);
    
    const loaded = await defaultProvider.getLoadedModels();
    const canChat = await defaultProvider.isModelLoaded(GPU_AWARE_MODELS.chat);
    
    return {
      name: "LM Studio Connectivity",
      status: "PASS",
      duration: Date.now() - start,
      details: `URL: ${url}, Loaded: [${loaded.join(", ")}], Chat ready: ${canChat}`,
    };
  } catch (err: any) {
    return {
      name: "LM Studio Connectivity",
      status: "FAIL",
      duration: Date.now() - start,
      details: err.message,
      error: err.message,
    };
  }
}

async function testDatabaseAccess(): Promise<TestResult> {
  const start = Date.now();
  try {
    const db = getDatabase(process.cwd());
    const vectorActive = isVectorActive(db);
    
    const chunkCount = (db.prepare("SELECT COUNT(*) as c FROM chunks").get() as any)?.c || 0;
    const fileCount = (db.prepare("SELECT COUNT(*) as c FROM files").get() as any)?.c || 0;
    const ftsCount = (db.prepare("SELECT COUNT(*) as c FROM fts_chunks").get() as any)?.c || 0;
    
    return {
      name: "Database Access",
      status: vectorActive ? "PASS" : "WARN",
      duration: Date.now() - start,
      details: `Chunks: ${chunkCount}, Files: ${fileCount}, FTS: ${ftsCount}, Vec: ${vectorActive ? "active" : "inactive"}`,
    };
  } catch (err: any) {
    return {
      name: "Database Access",
      status: "FAIL",
      duration: Date.now() - start,
      details: err.message,
      error: err.message,
    };
  }
}

async function testEmbeddingModel(): Promise<TestResult> {
  const start = Date.now();
  try {
    const testTexts = ["function hello() { return 'test'; }", "const x = 42;"];
    const embeddings = await defaultProvider.embed(GPU_AWARE_MODELS.embed, testTexts);
    
    return {
      name: "Embedding Model",
      status: embeddings.length === 2 && embeddings[0].length > 0 ? "PASS" : "FAIL",
      duration: Date.now() - start,
      details: `Model: ${GPU_AWARE_MODELS.embed}, Embeddings: ${embeddings.length}, Dim: ${embeddings[0]?.length || 0}`,
    };
  } catch (err: any) {
    return {
      name: "Embedding Model",
      status: "FAIL",
      duration: Date.now() - start,
      details: err.message,
      error: err.message,
    };
  }
}

async function testFusionConfig(): Promise<TestResult> {
  const start = Date.now();
  try {
    const weights = fusion.getFusionWeights();
    
    return {
      name: "Fusion Configuration",
      status: "PASS",
      duration: Date.now() - start,
      details: `α=${weights.alpha.toFixed(2)} (keyword), β=${weights.beta.toFixed(2)} (dense), γ=${weights.gamma.toFixed(2)} (sparse), mem=${weights.memoryBoost}`,
    };
  } catch (err: any) {
    return {
      name: "Fusion Configuration",
      status: "FAIL",
      duration: Date.now() - start,
      details: err.message,
      error: err.message,
    };
  }
}

async function testRerankerConfig(): Promise<TestResult> {
  const start = Date.now();
  try {
    const config = rerankerModule.getRerankerConfig();
    
    return {
      name: "Reranker Configuration",
      status: "PASS",
      duration: Date.now() - start,
      details: `gate=${config.confidenceGate}, min=${config.rerankMinResults}, intents=[${config.rerankIntents.join(", ")}], maxChunks=${config.maxChunks}`,
    };
  } catch (err: any) {
    return {
      name: "Reranker Configuration",
      status: "FAIL",
      duration: Date.now() - start,
      details: err.message,
      error: err.message,
    };
  }
}

async function testTreeConfig(): Promise<TestResult> {
  const start = Date.now();
  try {
    const config = tree.getTreeConfig();
    
    return {
      name: "Decision Tree Configuration",
      status: "PASS",
      duration: Date.now() - start,
      details: `Intents: ${Object.keys(config.intentThresholds).length}, ChunkCounts: learn=${config.chunkCounts.learn}, refactor=${config.chunkCounts.refactor}`,
    };
  } catch (err: any) {
    return {
      name: "Decision Tree Configuration",
      status: "FAIL",
      duration: Date.now() - start,
      details: err.message,
      error: err.message,
    };
  }
}

async function testRAGSearch(): Promise<TestResult> {
  const start = Date.now();
  try {
    const results = await searchProjectContext(process.cwd(), "function test", 5, "learn");
    
    return {
      name: "RAG Search (hybrid)",
      status: "PASS",
      duration: Date.now() - start,
      details: `Query: "function test", Results: ${results.length}`,
    };
  } catch (err: any) {
    return {
      name: "RAG Search (hybrid)",
      status: "FAIL",
      duration: Date.now() - start,
      details: err.message,
      error: err.message,
    };
  }
}

async function testIndexStatus(): Promise<TestResult> {
  const start = Date.now();
  try {
    const status = getIndexStatus(process.cwd());
    
    return {
      name: "Index Status (rag-agent)",
      status: status.totalChunks > 0 ? "PASS" : "WARN",
      duration: Date.now() - start,
      details: `chunks=${status.totalChunks}, fts=${status.ftsRecords}, vec=${status.vectorActive}, qwen=${status.qwenEmbeddings}, nomic=${status.nomicEmbeddings}`,
    };
  } catch (err: any) {
    return {
      name: "Index Status (rag-agent)",
      status: "FAIL",
      duration: Date.now() - start,
      details: err.message,
      error: err.message,
    };
  }
}

async function testDiagnose(): Promise<TestResult> {
  const start = Date.now();
  try {
    const diag = await diagnoseBrainPlugin();
    
    return {
      name: "Brain Diagnose",
      status: diag.indexStatus.totalChunks > 0 ? "PASS" : "WARN",
      duration: Date.now() - start,
      details: `chunks=${diag.indexStatus.totalChunks}, models=${diag.lmStudioModels.length}, issues=${diag.issues.length}`,
    };
  } catch (err: any) {
    return {
      name: "Brain Diagnose",
      status: "FAIL",
      duration: Date.now() - start,
      details: err.message,
      error: err.message,
    };
  }
}

async function testSessionMemory(): Promise<TestResult> {
  const start = Date.now();
  try {
    const mem = sessionMemory.getMemory();
    sessionMemory.markSuccess();
    sessionMemory.markFileDirty("test.ts");
    const mem2 = sessionMemory.getMemory();
    
    return {
      name: "Session Memory",
      status: mem2.recentFiles.length > 0 ? "PASS" : "WARN",
      duration: Date.now() - start,
      details: `Files tracked: ${mem2.recentFiles.length}, Decisions: ${mem2.decisions.length}, Success: ${mem2.successCount}`,
    };
  } catch (err: any) {
    return {
      name: "Session Memory",
      status: "FAIL",
      duration: Date.now() - start,
      details: err.message,
      error: err.message,
    };
  }
}

async function testMetaHarness(): Promise<TestResult> {
  const start = Date.now();
  try {
    // Test that harness config can be applied
    const { DEFAULT_HARNESS_CONFIG } = await import("../meta-harness/harness-space");
    
    fusion.setFusionWeights(DEFAULT_HARNESS_CONFIG.fusionAlpha, DEFAULT_HARNESS_CONFIG.fusionBeta, DEFAULT_HARNESS_CONFIG.fusionGamma);
    rerankerModule.setRerankerConfidenceGate(DEFAULT_HARNESS_CONFIG.confidenceGate);
    tree.setIntentThresholds(DEFAULT_HARNESS_CONFIG.intentThresholds);
    tree.setChunkCounts(DEFAULT_HARNESS_CONFIG.chunkCounts);
    
    const weights = fusion.getFusionWeights();
    
    return {
      name: "Meta-Harness Config Apply",
      status: weights.alpha === DEFAULT_HARNESS_CONFIG.fusionAlpha ? "PASS" : "FAIL",
      duration: Date.now() - start,
      details: `Applied α=${DEFAULT_HARNESS_CONFIG.fusionAlpha}, β=${DEFAULT_HARNESS_CONFIG.fusionBeta}, γ=${DEFAULT_HARNESS_CONFIG.fusionGamma}`,
    };
  } catch (err: any) {
    return {
      name: "Meta-Harness Config Apply",
      status: "FAIL",
      duration: Date.now() - start,
      details: err.message,
      error: err.message,
    };
  }
}

async function runAllTests(): Promise<void> {
  console.log("╔════════════════════════════════════════════════════════════╗");
  console.log("║           Brain Plugin Integration Test Suite              ║");
  console.log("╚════════════════════════════════════════════════════════════╝\n");

  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  clearLog();
  fileLog("=== Brain Integration Test Started ===");

  const tests = [
    testLMStudioConnectivity,
    testDatabaseAccess,
    testEmbeddingModel,
    testFusionConfig,
    testRerankerConfig,
    testTreeConfig,
    testRAGSearch,
    testIndexStatus,
    testDiagnose,
    testSessionMemory,
    testMetaHarness,
  ];

  const results: TestResult[] = [];
  
  for (const test of tests) {
    process.stdout.write(`Testing: ${test.name.slice(0, 30).padEnd(30)} `);
    const result = await test();
    results.push(result);
    const icon = result.status === "PASS" ? "✓" : result.status === "WARN" ? "⚠" : "✗";
    console.log(`[${icon}] ${result.duration}ms`);
    fileLog(`${result.name}: ${result.status} (${result.duration}ms) - ${result.details}`);
  }

  // Summary
  console.log("\n╔════════════════════════════════════════════════════════════╗");
  console.log("║                       RESULTS SUMMARY                      ║");
  console.log("╚════════════════════════════════════════════════════════════╝");
  
  const passed = results.filter(r => r.status === "PASS").length;
  const warned = results.filter(r => r.status === "WARN").length;
  const failed = results.filter(r => r.status === "FAIL").length;
  
  console.log(`\nPassed: ${passed}/${tests.length}`);
  console.log(`Warnings: ${warned}`);
  console.log(`Failed: ${failed}`);
  
  if (failed > 0) {
    console.log("\n⚠️  Failed tests:");
    results.filter(r => r.status === "FAIL").forEach(r => {
      console.log(`   - ${r.name}: ${r.error}`);
    });
  }
  
  if (warned > 0) {
    console.log("\n⚠️  Warning tests:");
    results.filter(r => r.status === "WARN").forEach(r => {
      console.log(`   - ${r.name}: ${r.details}`);
    });
  }

  // Save results
  const report = {
    timestamp: Date.now(),
    total: tests.length,
    passed,
    warned,
    failed,
    results,
  };
  
  const reportFile = join(OUTPUT_DIR, "brain-integration-test.json");
  writeFileSync(reportFile, JSON.stringify(report, null, 2));
  console.log(`\n📄 Report: ${reportFile}`);

  fileLog("=== Brain Integration Test Completed ===");
  
  process.exit(failed > 0 ? 1 : 0);
}

runAllTests().catch((err) => {
  console.error("Test suite failed:", err);
  process.exit(1);
});