import type { LMStudioModel } from "./types"
import { fileLog } from "./utils/logger"

/**
 * LM Studio SDK Client wrapper for Meta-Harness.
 * 
 * Uses the LM Studio REST API (OpenAI-compatible) for:
 * - Chat completions (qwen3.5-4b)
 * - Embeddings (qwen3-embedding-0.6b, nomic-embed-v1.5)
 * - Reranking (qwen3-reranker-0.6b)
 * 
 * Models configured for your setup:
 * - Chat: qwen3.5-4b-claude-4.6-opus-reasoning-distilled-v2 (4.2B, Q8_0, 262k ctx)
 * - Embed: text-embedding-qwen3-embedding-0.6b (0.6B, Q8_0, 32k ctx)
 * - Reranker: qwen3-reranker-0.6b (0.6B, Q8_0, 40k ctx)
 * 
 * Fallback chain:
 * 1. LM Studio local API (http://127.0.0.1:1234)
 * 2. Environment override LM_STUDIO_URL
 * 3. Degraded mode with warnings
 */

export class LMStudioClient {
  config: {
    baseUrl: string
    chatModel: string
    embedModel: string
    rerankerModel: string
  }

  private logger: typeof fileLog

  constructor(config: {
    baseUrl: string
    chatModel: string
    embedModel: string
    rerankerModel: string
  }) {
    this.config = config
    this.logger = (msg: string, level?: "info" | "warn" | "error") => {
      fileLog(`[LMStudio] ${msg}`, level)
    }
  }

  async listModels(): Promise<LMStudioModel[]> {
    try {
      const res = await fetch(`${this.config.baseUrl}/v1/models`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      return data.data || []
    } catch (err) {
      this.logger(`Failed to list models: ${err}`, "error")
      return []
    }
  }

  async chatCompletion(
    messages: Array<{ role: string; content: string }>,
    options: {
      temperature?: number
      max_tokens?: number
      model?: string
    } = {}
  ): Promise<any> {
    const model = options.model || this.config.chatModel

    try {
      const res = await fetch(`${this.config.baseUrl}/v1/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          messages,
          temperature: options.temperature ?? 0.7,
          max_tokens: options.max_tokens ?? 4096,
          stream: false,
        }),
      })

      if (!res.ok) {
        const errText = await res.text()
        throw new Error(`HTTP ${res.status}: ${errText}`)
      }

      return await res.json()
    } catch (err) {
      this.logger(`Chat completion failed: ${err}`, "error")
      throw err
    }
  }

  async getEmbeddings(texts: string[]): Promise<number[][]> {
    const model = this.config.embedModel

    try {
      // LM Studio embeddings endpoint is OpenAI-compatible
      const res = await fetch(`${this.config.baseUrl}/v1/embeddings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          input: texts,
        }),
      })

      if (!res.ok) {
        const errText = await res.text()
        throw new Error(`HTTP ${res.status}: ${errText}`)
      }

      const data = await res.json()
      return data.data.map((d: any) => d.embedding)
    } catch (err) {
      this.logger(`Embeddings failed: ${err}`, "error")
      // Return zero embeddings as fallback (evaluator will penalize)
      return texts.map(() => new Array(768).fill(0))
    }
  }

  /**
   * Rerank documents using qwen3-reranker-0.6b.
   * LM Studio doesn't have a native rerank endpoint, so we use
   * the chat completion API with a reranking prompt.
   * 
   * Alternative: Use the model directly via /v1/completions with
   * a scoring prompt if your LM Studio version supports it.
   */
  async rerank(
    query: string,
    documents: string[]
  ): Promise<Array<{ index: number; score: number }>> {
    const model = this.config.rerankerModel

    try {
      // Batch reranking via chat API
      const results: Array<{ index: number; score: number }> = []

      for (let i = 0; i < documents.length; i++) {
        const prompt = `Query: ${query}\nDocument: ${documents[i].slice(0, 500)}\n\nRate relevance 0-10: `

        const res = await fetch(`${this.config.baseUrl}/v1/chat/completions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model,
            messages: [{ role: "user", content: prompt }],
            temperature: 0.0,
            max_tokens: 5,
          }),
        })

        if (!res.ok) continue

        const data = await res.json()
        const content = data.choices?.[0]?.message?.content || "0"
        const score = parseFloat(content.match(/\d+/)?.[0] || "0") / 10

        results.push({ index: i, score: Math.max(0, Math.min(1, score)) })
      }

      return results.sort((a, b) => b.score - a.score)
    } catch (err) {
      this.logger(`Reranking failed: ${err}`, "error")
      // Return identity order as fallback
      return documents.map((_, i) => ({ index: i, score: 0.5 }))
    }
  }

  /**
   * Check if a specific model is loaded and ready.
   */
  async isModelLoaded(modelKey: string): Promise<boolean> {
    try {
      const models = await this.listModels()
      return models.some(m => m.key === modelKey)
    } catch {
      return false
    }
  }
}
