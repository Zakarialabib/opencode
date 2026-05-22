import { defaultProvider } from "../provider/lmstudio.js";

/**
 * Extracts all <thought>...</thought> tags from an assistant message, summaries them,
 * and returns the cleaned text with a concise reasoning breadcrumb summary injected.
 */
export async function summarizeThoughts(content: string): Promise<{
  cleanedContent: string;
  summary: string;
  hasThoughts: boolean;
}> {
  const thoughtRegex = /<thought>([\s\S]*?)<\/thought>/gi;
  const match = thoughtRegex.exec(content);

  if (!match) {
    return { cleanedContent: content, summary: "", hasThoughts: false };
  }

  const rawThought = match[1].trim();

  // Strip all thought blocks from the content
  const cleanedContent = content.replace(/<thought>[\s\S]*?<\/thought>/gi, "").trim();

  if (rawThought.length === 0) {
    return { cleanedContent, summary: "", hasThoughts: true };
  }

  console.log(`[Brain/Breadcrumb] Summarizing reasoning block (${rawThought.length} chars)`);

  const messages = [
    {
      role: "system",
      content:
        "[COGNITIVE MODE: BREADCRUMB] You are a reasoning compiler. Summarize this step-by-step assistant thought block into a single, concise one-sentence action-focused statement starting with 'Decided to'. Output only the summarized sentence.",
    },
    {
      role: "user",
      content: `Reasoning Block:\n${rawThought.slice(0, 4000)}`,
    },
  ];

  try {
    const summary = await defaultProvider.chat("", messages, {
      temperature: 0.1,
      maxTokens: 64,
    });

    const summaryTag = `[Thought: ${summary.trim()}]`;
    console.log(`[Brain/Breadcrumb] Summarized reasoning to: "${summaryTag}"`);
    return {
      cleanedContent: `${summaryTag}\n\n${cleanedContent}`,
      summary: summaryTag,
      hasThoughts: true,
    };
  } catch (error: unknown) {
    console.warn(
      `[Brain/Breadcrumb] Summarization failed, falling back to basic extraction: ${(error as Error).message}`
    );
    const wordCount = rawThought ? rawThought.split(/\s+/).length : 0;
    const fallbackSummary = `[Thought: Step completed containing ${wordCount} words of reasoning]`;
    return {
      cleanedContent: `${fallbackSummary}\n\n${cleanedContent}`,
      summary: fallbackSummary,
      hasThoughts: true,
    };
  }
}
