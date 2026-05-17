import { defaultProvider } from "../provider/lmstudio";
import type { DevIntent } from "../tree/engine";

/**
 * Gets the custom compression threshold in characters based on the classified developer intent.
 * Debug and refactor require detailed context; quick chats and learn queries prioritize speed and low latency.
 */
export function getCompressionThreshold(intent: DevIntent | string): number {
  switch (intent) {
    case "debug":
    case "refactor":
    case "feature":
      return 2000; // Keep high-fidelity trace/source text
    case "learn":
    case "quick_chat":
    case "review":
    case "test":
    default:
      return 600; // Compress aggressively for lightweight conversations
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
  
  if (content.length <= threshold) {
    return content;
  }

  console.log(`[Brain/Compression] Compressing output from '${toolName}' (${content.length} chars) under intent '${intent}' (threshold: ${threshold})`);

  const messages = [
    {
      role: "system",
      content: "[COGNITIVE MODE: COMPRESSION] You are an elite codebase data compressor. Summarize this raw tool result into a concise, fact-only, single-paragraph conclusion. Discard raw markup, boilerplate, noise, or unnecessary lines. Keep only crucial technical details."
    },
    {
      role: "user",
      content: `Tool: ${toolName}\nRaw Output:\n${content.slice(0, 8000)}`
    }
  ];

  try {
    const summary = await defaultProvider.chat("", messages, {
      temperature: 0.1,
      maxTokens: 256
    });

    const compressed = `[COMPRESSED SUMMARY for ${toolName}]\n${summary.trim()}\n[END SUMMARY]`;
    console.log(`[Brain/Compression] Compressed ${content.length} chars to ${compressed.length} chars.`);
    return compressed;
  } catch (error: any) {
    console.warn(`[Brain/Compression] Compression failed, falling back to truncation: ${error.message}`);
    return content.slice(0, threshold) + `\n... [ToolResult truncated from ${content.length} chars to save context]`;
  }
}
