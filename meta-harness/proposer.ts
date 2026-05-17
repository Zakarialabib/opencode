import type { BrainHarnessConfig, ProposerResult, LMStudioClient } from "./types"
import { DEFAULT_HARNESS_CONFIG, PARAMETER_BOUNDS } from "./harness-space"
import { fileLog } from "./utils/logger"

/**
 * Meta-Harness Proposer using LM Studio.
 * 
 * Uses qwen3.5-4b-claude-4.6-opus-reasoning-distilled-v2 as the proposer model
 * to generate mutated harness configurations based on evaluation history.
 * 
 * The proposer receives:
 * - Current best config
 * - Recent evaluation history (last 5 entries)
 * - Parameter bounds and mutation rules
 * 
 * Returns a new proposed config + reasoning.
 */

export async function proposeHarness(
  currentBest: BrainHarnessConfig,
  history: Array<{ config: BrainHarnessConfig; score: number; metrics: any }>,
  lmStudio: LMStudioClient,
  logger?: (msg: string, level?: "info" | "warn" | "error") => void
): Promise<ProposerResult> {
  const log = logger || ((msg: string, level?: "info" | "warn" | "error") => {
    fileLog(`[Proposer] ${msg}`, level)
  })

  log("Generating harness proposal via LM Studio...")

  const prompt = buildProposerPrompt(currentBest, history)

  try {
    const response = await lmStudio.chatCompletion(
      [
        {
          role: "system",
          content: `You are an expert ML systems optimizer. Your job is to propose improved configurations for an AI coding assistant's retrieval and context injection pipeline (the "harness").\n\nRules:\n1. Only mutate numeric fields within ±20% of current values\n2. Boolean flags can flip if history supports it\n3. Arrays can add/remove one item\n4. Return ONLY valid JSON matching the BrainHarnessConfig schema\n5. Reason briefly, then output JSON in a code block`,
        },
        { role: "user", content: prompt },
      ],
      {
        temperature: 0.8, // Slightly creative for exploration
        max_tokens: 2048,
      }
    )

    const content = response.choices?.[0]?.message?.content || ""

    // Extract JSON from markdown code block or raw text
    const jsonMatch = content.match(/\`\`\`json\s*([\s\S]*?)\s*\`\`\`/) || 
                      content.match(/\`\`\`\s*([\s\S]*?)\s*\`\`\`/) ||
                      content.match(/\{[\s\S]*\}/)

    if (!jsonMatch) {
      throw new Error("No JSON found in proposer response")
    }

    const proposed = JSON.parse(jsonMatch[1] || jsonMatch[0])

    // Validate and clamp to bounds
    const clamped = clampConfig(proposed)

    log(`Proposed config generated. Changes from best: ${diffConfig(currentBest, clamped)}`)

    return {
      proposedConfig: clamped,
      reasoning: content.slice(0, 500), // Truncate for logs
    }
  } catch (err) {
    log(`Proposer failed: ${err}`, "error")
    log("Falling back to random mutation of current best", "warn")

    // Fallback: random mutation
    return {
      proposedConfig: randomMutate(currentBest),
      reasoning: `Fallback random mutation due to proposer error: ${err}`,
    }
  }
}

function buildProposerPrompt(
  currentBest: BrainHarnessConfig,
  history: Array<{ config: BrainHarnessConfig; score: number; metrics: any }>
): string {
  const recentHistory = history.slice(0, 5).map((h, i) => {
    return `Entry ${i + 1}:\nScore: ${h.score.toFixed(4)}\nMetrics: ${JSON.stringify(h.metrics, null, 2)}\nConfig snapshot: ${JSON.stringify(summarizeConfig(h.config))}`
  }).join("\n\n---\n\n")

  return `Optimize this Brain Plugin harness configuration for an AI coding assistant.

## Current Best Config (Score: ${history[0]?.score.toFixed(4) || "N/A"})
\`\`\`json
${JSON.stringify(currentBest, null, 2)}
\`\`\`

## Parameter Bounds
${JSON.stringify(PARAMETER_BOUNDS, null, 2)}

## Recent History (last ${Math.min(history.length, 5)} entries)
${recentHistory}

## Instructions
1. Analyze what worked and what didn't in the history
2. Propose a NEW config that improves the aggregate score
3. Focus on underperforming intents based on metrics
4. Keep fusion weights roughly balanced (sum ≈ 1.0)
5. Return ONLY the JSON config in a markdown code block

## Output Format
Brief reasoning (2-3 sentences), then:
\`\`\`json
{ /* complete BrainHarnessConfig object */ }
\`\`\``
}

function summarizeConfig(config: BrainHarnessConfig): object {
  // Return a condensed version for prompt context
  return {
    intentThresholds: config.intentThresholds,
    chunkCounts: config.chunkCounts,
    fusionWeights: [config.fusionAlpha, config.fusionBeta, config.fusionGamma],
    confidenceGate: config.confidenceGate,
    maxContextTokens: config.maxContextTokens,
  }
}

function clampConfig(proposed: any): BrainHarnessConfig {
  const config = { ...DEFAULT_HARNESS_CONFIG, ...proposed }

  // Clamp numeric fields to bounds
  const clamp = (val: number, min: number, max: number) => Math.max(min, Math.min(max, val))

  for (const [intent, val] of Object.entries(config.intentThresholds)) {
    config.intentThresholds[intent] = clamp(val as number, 0.1, 0.95)
  }

  for (const [intent, val] of Object.entries(config.chunkCounts)) {
    config.chunkCounts[intent] = Math.round(clamp(val as number, 0, 50))
  }

  config.fusionAlpha = clamp(config.fusionAlpha, 0.05, 0.80)
  config.fusionBeta = clamp(config.fusionBeta, 0.05, 0.80)
  config.fusionGamma = clamp(config.fusionGamma, 0.05, 0.80)
  config.memoryBoost = clamp(config.memoryBoost, 0.0, 0.40)
  config.confidenceGate = clamp(config.confidenceGate, 0.5, 0.99)
  config.rerankMinResults = Math.round(clamp(config.rerankMinResults, 5, 50))

  for (const [intent, val] of Object.entries(config.tokenThresholds)) {
    config.tokenThresholds[intent] = Math.round(clamp(val as number, 50, 2000))
  }

  config.maxContextTokens = Math.round(clamp(config.maxContextTokens, 1024, 32768))
  config.chatTemperature = clamp(config.chatTemperature, 0.0, 1.5)
  config.embedBatchSize = Math.round(clamp(config.embedBatchSize, 1, 16))
  config.rerankerMaxChunks = Math.round(clamp(config.rerankerMaxChunks, 5, 100))

  // Normalize fusion weights
  const sum = config.fusionAlpha + config.fusionBeta + config.fusionGamma
  config.fusionAlpha /= sum
  config.fusionBeta /= sum
  config.fusionGamma /= sum

  return config
}

function randomMutate(config: BrainHarnessConfig): BrainHarnessConfig {
  const mutated = JSON.parse(JSON.stringify(config))

  // Mutate 2-3 random fields
  const fields = [
    () => { mutated.fusionAlpha += (Math.random() - 0.5) * 0.1 },
    () => { mutated.fusionBeta += (Math.random() - 0.5) * 0.1 },
    () => { mutated.memoryBoost += (Math.random() - 0.5) * 0.05 },
    () => { mutated.confidenceGate += (Math.random() - 0.5) * 0.05 },
    () => { mutated.maxContextTokens += Math.round((Math.random() - 0.5) * 2048) },
  ]

  const numMutations = 2 + Math.floor(Math.random() * 2)
  for (let i = 0; i < numMutations; i++) {
    const field = fields[Math.floor(Math.random() * fields.length)]
    field()
  }

  return clampConfig(mutated)
}

function diffConfig(old: BrainHarnessConfig, neu: BrainHarnessConfig): string {
  const changes: string[] = []

  if (old.fusionAlpha !== neu.fusionAlpha) changes.push(`alpha: ${old.fusionAlpha.toFixed(2)}→${neu.fusionAlpha.toFixed(2)}`)
  if (old.confidenceGate !== neu.confidenceGate) changes.push(`gate: ${old.confidenceGate.toFixed(2)}→${neu.confidenceGate.toFixed(2)}`)
  if (old.maxContextTokens !== neu.maxContextTokens) changes.push(`ctx: ${old.maxContextTokens}→${neu.maxContextTokens}`)
  if (old.memoryBoost !== neu.memoryBoost) changes.push(`boost: ${old.memoryBoost.toFixed(2)}→${neu.memoryBoost.toFixed(2)}`)

  return changes.join(", ") || "no significant changes"
}
