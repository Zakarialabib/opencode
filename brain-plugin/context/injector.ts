import type { Chunk } from "../retrieval/indexer";

export interface RetrievalResult {
  chunks: Chunk[];
  scores?: number[];
  totalChunks: number;
}

export class ContextInjector {
  inject(userMessage: string, context: RetrievalResult): string {
    if (context.chunks.length === 0) {
      return userMessage;
    }

    const chunksText = context.chunks
      .map((c, i) => {
        const pathDisplay = `${c.path}:${c.startLine}-${c.endLine}`;
        return `## Context ${i + 1}: \`${pathDisplay}\`\n\`\`\`\n${c.text}\n\`\`\``;
      })
      .join("\n\n");

    return `You are working on a software development task. Relevant code context has been retrieved from the codebase.

${chunksText}

---

User request: ${userMessage}

Analyze the context carefully before responding. If the context is insufficient or irrelevant, say so.`;
  }

  injectIntoSystem(systemPrompt: string, context: RetrievalResult): string {
    if (context.chunks.length === 0) {
      return systemPrompt;
    }

    const contextText = context.chunks
      .map((c, i) => {
        const pathDisplay = `${c.path}:${c.startLine}`;
        return `[${i + 1}] ${pathDisplay}: ${c.text.slice(0, 200)}${c.text.length > 200 ? "..." : ""}`;
      })
      .join("\n");

    return `${systemPrompt}

## Codebase Context
The following relevant code was retrieved from the codebase:
${contextText}

Use this context to inform your response.`;
  }

  formatResults(context: RetrievalResult): string {
    if (context.chunks.length === 0) {
      return "No relevant context found.";
    }

    let output = `Found ${context.totalChunks} relevant context(s):\n\n`;

    context.chunks.forEach((c, i) => {
      output += `### ${i + 1}. ${c.path}:${c.startLine}\n`;
      output += `\`\`\`\n${c.text.slice(0, 300)}${c.text.length > 300 ? "\n..." : ""}\n\`\`\`\n\n`;
    });

    return output;
  }
}

export const contextInjector = new ContextInjector();
