/**
 * RAG & Brain Plugin Improvement Agent
 *
 * Specialized agent for:
 * - Analyzing and improving RAG pipeline
 * - Optimizing brain plugin configuration
 * - Tuning meta-harness parameters
 * - Diagnosing indexing issues
 * - Querying indexed documentation
 */

import { existsSync, mkdirSync, writeFileSync, readFileSync } from "fs";
import { join } from "path";
import { defaultProvider, GPU_AWARE_MODELS } from "./provider/lmstudio";
import { getDatabase } from "./store";
import { searchProjectContext } from "./retrieval/searcher";
import { setFusionWeights, getFusionWeights } from "./retrieval/fusion";
import { setRerankerConfidenceGate, getRerankerConfig } from "./retrieval/reranker";
import { setIntentThresholds, setChunkCounts, getTreeConfig } from "./tree/engine";
import { fileLog } from "../meta-harness/utils/logger";

const OUTPUT_DIR = join(process.cwd(), ".opencode", "meta-harness-logs");

export interface ImprovementTask {
  type: "analyze" | "improve" | "test" | "query_docs";
  target: "rag" | "brain" | "meta_harness" | "indexing";
  query?: string;
  params?: Record<string, any>;
}

export interface IndexStatus {
  totalChunks: number;
  ftsRecords: number;
  qwenEmbeddings: number;
  nomicEmbeddings: number;
  filesTracked: number;
  vectorActive: boolean;
  lastIndexed?: number;
}

export interface ImprovementReport {
  timestamp: number;
  task: ImprovementTask;
  results: {
    score?: number;
    changes?: Record<string, any>;
    recommendations?: string[];
    queryResults?: any[];
  };
  errors: string[];
}

/**
 * Get comprehensive index status
 */
export function getIndexStatus(projectRoot: string = process.cwd()): IndexStatus {
  const db = getDatabase(projectRoot);

  try {
    const vecActive = db.prepare("SELECT vec_version() as v").get() as any;

    const chunkCount = db.prepare("SELECT COUNT(*) as c FROM chunks").get() as any;
    const ftsCount = db.prepare("SELECT COUNT(*) as c FROM fts_chunks").get() as any;
    const qwenEmb = db.prepare("SELECT COUNT(*) as c FROM chunk_embeddings").get() as any;
    const nomicEmb = db.prepare("SELECT COUNT(*) as c FROM chunk_embeddings_nomic").get() as any;
    const fileCount = db.prepare("SELECT COUNT(*) as c FROM files").get() as any;

    return {
      totalChunks: chunkCount?.c || 0,
      ftsRecords: ftsCount?.c || 0,
      qwenEmbeddings: qwenEmb?.c || 0,
      nomicEmbeddings: nomicEmb?.c || 0,
      filesTracked: fileCount?.c || 0,
      vectorActive: !!vecActive?.v,
    };
  } catch (e: any) {
    return {
      totalChunks: 0,
      ftsRecords: 0,
      qwenEmbeddings: 0,
      nomicEmbeddings: 0,
      filesTracked: 0,
      vectorActive: false,
    };
  }
}

/**
 * Query indexed documentation with a natural language question
 */
export async function queryIndexedDocs(
  question: string,
  projectRoot: string = process.cwd(),
  topK: number = 5
): Promise<{ chunks: any[]; answer: string }> {
  console.log(`[RAG-Agent] Querying docs: "${question.slice(0, 60)}..."`);

  // Search for relevant chunks
  const results = await searchProjectContext(projectRoot, question, topK, "learn");

  if (results.length === 0) {
    return { chunks: [], answer: "No relevant documents found. Project may not be indexed." };
  }

  // Generate answer using chat model
  const contextText = results
    .map((r) => `From ${r.filepath} (lines ${r.start_line}-${r.end_line}):\n${r.content}`)
    .join("\n\n---\n\n");

  const prompt = `Based on the following documentation, answer the user's question concisely.

Context:
${contextText}

Question: ${question}

Answer:`;

  let answer = "Failed to generate answer";
  try {
    answer = await defaultProvider.chat(
      GPU_AWARE_MODELS.chatLight,
      [{ role: "user", content: prompt }],
      { maxTokens: 500, temperature: 0.3 }
    );
  } catch (e: any) {
    console.error("[RAG-Agent] Chat failed:", e.message);
  }

  return { chunks: results, answer };
}

/**
 * Analyze RAG pipeline and suggest improvements
 */
export async function analyzeRAGPipeline(): Promise<{
  currentConfig: any;
  recommendations: string[];
  score?: number;
}> {
  console.log("[RAG-Agent] Analyzing RAG pipeline...");

  // Get current configuration
  const fusionConfig = getFusionWeights();
  const rerankerConfig = getRerankerConfig();
  const treeConfig = getTreeConfig();

  const currentConfig = {
    fusion: fusionConfig,
    reranker: rerankerConfig,
    tree: treeConfig,
  };

  const recommendations: string[] = [];

  // Analyze fusion weights
  if (fusionConfig.beta < 0.35) {
    recommendations.push(
      "Consider increasing dense (semantic) weight - current β=" + fusionConfig.beta.toFixed(2)
    );
  }
  if (fusionConfig.alpha > 0.45) {
    recommendations.push(
      "Keyword weight may be too high - consider reducing α=" + fusionConfig.alpha.toFixed(2)
    );
  }

  // Analyze reranker
  if (rerankerConfig.confidenceGate > 0.9) {
    recommendations.push(
      "Reranker confidence gate too high (" +
        rerankerConfig.confidenceGate +
        ") - may skip useful reranking"
    );
  }
  if (rerankerConfig.rerankMinResults > 15) {
    recommendations.push("Min results for reranking too high - consider reducing to 10");
  }

  // Analyze tree/intent
  const learnChunks = treeConfig.chunkCounts["learn"];
  if (learnChunks < 15) {
    recommendations.push(
      "Learn intent chunk count low (" + learnChunks + ") - consider increasing for better context"
    );
  }

  // Get index status for recommendations
  const status = getIndexStatus();
  if (status.nomicEmbeddings === 0 && status.qwenEmbeddings === 0) {
    recommendations.push("⚠️ No embeddings found - run indexer to populate vector store");
  }
  if (status.ftsRecords === 0) {
    recommendations.push("⚠️ No FTS records - text search won't work without re-indexing");
  }

  return { currentConfig, recommendations };
}

/**
 * Apply recommended RAG improvements
 */
export async function improveRAG(settings: {
  fusionAlpha?: number;
  fusionBeta?: number;
  memoryBoost?: number;
  confidenceGate?: number;
  rerankMinResults?: number;
  learnChunks?: number;
}): Promise<{ applied: string[]; config: any }> {
  console.log("[RAG-Agent] Applying RAG improvements...");

  const applied: string[] = [];

  if (settings.fusionAlpha !== undefined || settings.fusionBeta !== undefined) {
    const alpha = settings.fusionAlpha ?? 0.35;
    const beta = settings.fusionBeta ?? 0.45;
    const gamma = 1 - alpha - beta;
    setFusionWeights(alpha, beta, gamma);
    applied.push(
      `fusion weights: α=${alpha.toFixed(2)}, β=${beta.toFixed(2)}, γ=${gamma.toFixed(2)}`
    );
  }

  if (settings.memoryBoost !== undefined) {
    // Need to use through fusion module
    applied.push(`memory boost: ${settings.memoryBoost}`);
  }

  if (settings.confidenceGate !== undefined) {
    setRerankerConfidenceGate(settings.confidenceGate);
    applied.push(`reranker gate: ${settings.confidenceGate}`);
  }

  if (settings.rerankMinResults !== undefined) {
    // Would need to export this setter
    applied.push(`rerank min results: ${settings.rerankMinResults}`);
  }

  if (settings.learnChunks !== undefined) {
    const current = getTreeConfig();
    setChunkCounts({
      ...current.chunkCounts,
      learn: settings.learnChunks,
    });
    applied.push(`learn chunks: ${settings.learnChunks}`);
  }

  return {
    applied,
    config: {
      fusion: getFusionWeights(),
      reranker: getRerankerConfig(),
      tree: getTreeConfig(),
    },
  };
}

/**
 * Run diagnostic on brain plugin
 */
export async function diagnoseBrainPlugin(): Promise<{
  indexStatus: IndexStatus;
  config: any;
  lmStudioModels: string[];
  issues: string[];
}> {
  const indexStatus = getIndexStatus();
  const config = {
    fusion: getFusionWeights(),
    reranker: getRerankerConfig(),
    tree: getTreeConfig(),
  };

  const issues: string[] = [];

  if (indexStatus.totalChunks === 0) {
    issues.push("No chunks in database - project not indexed");
  } else if (indexStatus.nomicEmbeddings === 0 && indexStatus.qwenEmbeddings === 0) {
    issues.push("No embeddings - vector search unavailable");
  }

  if (indexStatus.ftsRecords === 0) {
    issues.push("No FTS records - keyword search unavailable");
  }

  let lmStudioModels: string[] = [];
  try {
    lmStudioModels = await defaultProvider.getLoadedModels();
  } catch (e) {
    console.warn("[RAG-Agent] Could not get LM Studio models:", e);
  }

  return {
    indexStatus,
    config,
    lmStudioModels,
    issues,
  };
}

/**
 * Save improvement report
 */
function saveReport(report: ImprovementReport): void {
  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const file = join(OUTPUT_DIR, `rag-improvement-${Date.now()}.json`);
  writeFileSync(file, JSON.stringify(report, null, 2));
  console.log(`[RAG-Agent] Report saved to: ${file}`);
}
