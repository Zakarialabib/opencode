import type { Chunk } from "../retrieval/indexer";

export interface RetrievalResult {
  chunks: Chunk[];
  scores?: number[];
  totalChunks: number;
}

export interface InjectOptions {
  intent?: string;
  sessionSummary?: string;
  recentFiles?: string[];
  diagnostics?: string[];
}

export class ContextInjector {
  inject(
    userMessage: string,
    context: RetrievalResult,
    opts?: InjectOptions
  ): string {
    if (context.chunks.length === 0 && !opts?.sessionSummary) {
      return userMessage;
    }

    const parts: string[] = [];

    // Session summary injection
    if (opts?.sessionSummary) {
      parts.push(`## Session Context\n${opts.sessionSummary}\n`);
    }

    // Code context injection
    if (context.chunks.length > 0) {
      const shownFiles = new Set<string>();
      const targetedChunks = context.chunks.filter((c) => {
        const key = `${c.path}:${c.startLine}`;
        if (shownFiles.has(key)) return false;
        shownFiles.add(key);
        return true;
      });

      const chunksText = targetedChunks
        .map((c, i) => {
          const pathDisplay = `${c.path}:${c.startLine}-${c.endLine}`;
          const tag = opts?.intent ? ` (relevant for: ${opts.intent})` : "";
          return `## Context ${i + 1}: \`${pathDisplay}\`${tag}\n\`\`\`\n${c.text}\n\`\`\``;
        })
        .join("\n\n");

      parts.push(`## Retrieved Code Context\n${chunksText}\n`);
    }

    // Diagnostics context (for debug intent)
    if (opts?.intent === "debug" && opts?.diagnostics && opts.diagnostics.length > 0) {
      parts.push(`## Active Diagnostics\n${opts.diagnostics.join("\n")}\n`);
    }

    parts.push(`User request: ${userMessage}`);

    return `You are working on a software development task. Relevant context has been injected.\n\n${parts.join("\n---\n")}\n\nAnalyze the provided context carefully before responding. If the context is insufficient or irrelevant, say so.`;
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
