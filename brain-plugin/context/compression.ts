import { defaultProvider } from "../provider/lmstudio";
import type { DevIntent } from "../tree/engine";

/**
 * Rough token estimation for code content (~4 chars/token for code, ~5 for prose).
 * Used for diagnostics and budget awareness alongside character-based thresholds.
 */
export function estimateTokens(text: string): number {
  // Simple heuristic: count whitespace-separated groups, weighted by non-ASCII presence
  let cjkCount = 0;
  let asciiCount = 0;
  for (const ch of text) {
    if (ch > "\u4e00" && ch < "\u9fff") cjkCount++;
    else if (ch.charCodeAt(0) < 128) asciiCount++;
  }
  // CJK ~2 chars/token, ASCII code ~4 chars/token, mixed ~3 chars/token
  const effective = cjkCount * 2 + asciiCount;
  return Math.ceil(effective / (cjkCount > asciiCount ? 3 : 4));
}

/**
 * Gets the custom compression threshold in characters based on the classified developer intent.
 * Debug and refactor require detailed context; quick chats and learn queries prioritize speed and low latency.
 * Note: thresholds are character-based, not token-based. estimate ~4 chars ≈ 1 token for code.
 */
export function getCompressionThreshold(intent: DevIntent | string): number {
  switch (intent) {
    case "debug":
    case "refactor":
    case "feature":
      return 500; // Keep high-fidelity trace/source text
    case "learn":
    case "quick_chat":
    case "review":
    case "test":
    default:
      return 150; // Compress aggressively for lightweight conversations
  }
}

/**
 * Checks if the tool output exceeds the intent-aware threshold and compresses it using LM Studio if needed.
 */
export async function compressIfNeeded(
  intent: DevIntent | string,
  toolName: string,
  content: string
): Promise<string> {
  const threshold = getCompressionThreshold(intent);

  if (estimateTokens(content) <= threshold) {
    return content;
  }

  const estTokens = estimateTokens(content.slice(0, 8000));
  console.log(
    `[Brain/Compression] Compressing output from '${toolName}' (${content.length} chars, ~${estTokens} tokens) under intent '${intent}' (threshold: ${threshold} tokens)`
  );

  const messages = [
    {
      role: "system",
      content:
        "[COGNITIVE MODE: COMPRESSION] You are an elite codebase data compressor. Summarize this raw tool result into a concise, fact-only, single-paragraph conclusion. Discard raw markup, boilerplate, noise, or unnecessary lines. Keep only crucial technical details.",
    },
    {
      role: "user",
      content: `Tool: ${toolName}\nRaw Output:\n${content.slice(0, 8000)}`,
    },
  ];

  try {
    const summary = await defaultProvider.chat("", messages, {
      temperature: 0.1,
      maxTokens: 256,
    });

    const compressed = `[COMPRESSED SUMMARY for ${toolName}]\n${summary.trim()}\n[END SUMMARY]`;
    console.log(
      `[Brain/Compression] Compressed ${content.length} chars to ${compressed.length} chars.`
    );
    return compressed;
  } catch (error: any) {
    console.warn(
      `[Brain/Compression] Compression failed, falling back to truncation: ${error.message}`
    );
    return (
      content.slice(0, threshold * 4) +
      `\n... [ToolResult truncated from ~${estTokens} tokens to save context]`
    );
  }
}
