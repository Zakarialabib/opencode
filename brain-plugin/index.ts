export { default } from "./brain";
export { DecisionTree } from "./tree/engine";
export {
  LMStudioProvider,
  defaultProvider,
  META_HARNESS_MODELS,
  GPU_AWARE_MODELS,
} from "./provider/lmstudio";
export { indexProject } from "./retrieval/indexer";
export { searchProjectContext } from "./retrieval/searcher";
export { contextInjector } from "./context/injector";
export { sessionMemory } from "./state/session";

// Harness-configurable setters (for meta-harness integration)
export { setFusionWeights, setMemoryBoost, setRrfK, getFusionWeights } from "./retrieval/fusion";
export {
  setRerankerConfidenceGate,
  setRerankMinResults,
  setRerankIntents,
  setRerankerMaxChunks,
  getRerankerConfig,
} from "./retrieval/reranker";
export { setIntentThresholds, setChunkCounts, getTreeConfig } from "./tree/engine";

// RAG Agent for improvement and diagnostics
export {
  getIndexStatus,
  queryIndexedDocs,
  analyzeRAGPipeline,
  improveRAG,
  diagnoseBrainPlugin,
} from "./rag-agent";
