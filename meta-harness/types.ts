/**
 * Core types for Meta-Harness OpenCode integration
 */

export interface MetaHarnessOptions {
  iterations: number
  suite: "smoke" | "full"
  topK: number
  intent?: string // Optional: optimize for specific intent only
  lmStudio: LMStudioClient
  logger: (msg: string, level?: "info" | "warn" | "error") => void
  outputDir: string
}

export interface EvalResult {
  score: number // 0-1 aggregate
  metrics: {
    retrievalAccuracy: number
    contextEfficiency: number
    tokenEconomy: number
    taskSuccessRate: number
    latencyMs: number
    intentPrecision: Record<string, number>
  }
  raw: TaskResult[]
}

export interface TaskResult {
  taskName: string
  taskScore: number
  latency: number
  intent: string
  retrieval: number
  generation: number
  efficiency: number
  economy: number
  chunksRetrieved: number
  chunksInjected: number
  tokensUsed: number
  tokensWasted: number
  llmOutput: string
  expectedMatch: boolean
}

export interface BenchmarkTask {
  name: string
  query: string
  intent: string
  goldChunks: string[] // File paths or chunk IDs expected
  expectedOutput: RegExp | string
  reset: () => Promise<void>
  run: (config: any) => Promise<{
    intent: string
    retrievedChunks: string[]
    chunksRetrieved: number
    chunksInjected: number
    tokensUsed: number
    tokensWasted: number
    llmOutput: string
  }>
}

export interface ProposerResult {
  proposedConfig: BrainHarnessConfig
  reasoning: string
}

export interface HarnessPopulationMember {
  config: BrainHarnessConfig
  score: number
  result: EvalResult
}

export interface PluginState {
  isOptimizing: boolean
  currentIteration: number
  bestConfig: BrainHarnessConfig
  history: Array<{ config: BrainHarnessConfig; score: number; metrics: EvalResult["metrics"] }>
  lmStudio: LMStudioClient
  logger: (msg: string, level?: "info" | "warn" | "error") => void
}

// Forward declarations for circular refs
export interface BrainHarnessConfig {
  intentThresholds: Record<string, number>
  chunkCounts: Record<string, number>
  rerankFlags: Record<string, boolean>
  fusionAlpha: number
  fusionBeta: number
  fusionGamma: number
  memoryBoost: number
  confidenceGate: number
  rerankMinResults: number
  rerankIntents: string[]
  tokenThresholds: Record<string, number>
  compressionStrategy: "truncate" | "summarize" | "hybrid"
  contextHeader: string
  chunkSeparator: string
  maxContextTokens: number
  // LM Studio specific
  chatTemperature: number
  chatMaxTokens: number
  embedBatchSize: number
  rerankerMaxChunks: number
}

export interface LMStudioModel {
  type: "llm" | "embedding"
  key: string
  display_name: string
  quantization: { name: string; bits_per_weight: number }
  size_bytes: number
  params_string: string | null
  max_context_length: number
  format: string
  capabilities?: { vision: boolean; trained_for_tool_use: boolean }
}

export { LMStudioClient } from "./lmstudio-client.js"
