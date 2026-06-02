import { type Plugin, tool } from "@opencode-ai/plugin";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

function ensureAdrDir(directory: string): string {
  const adrDir = join(directory, "docs", "adr");
  if (!existsSync(adrDir)) mkdirSync(adrDir, { recursive: true });
  return adrDir;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

const AdrWorkflowPlugin: Plugin = async ({ directory }) => {
  return {
    tool: {
      draft_adr: tool({
        description: "Create an ADR draft using the agency governance template",
        args: {
          title: tool.schema.string().describe("ADR title"),
          decider: tool.schema.string().default("cto-governance").describe("Accountable decider"),
          status: tool.schema
            .enum(["proposed", "accepted", "rejected", "superseded"])
            .default("proposed")
            .describe("ADR status"),
          context: tool.schema.string().default("").describe("Decision context"),
        },
        async execute({ title, decider, status, context }) {
          const adrDir = ensureAdrDir(directory);
          const date = new Date().toISOString().slice(0, 10);
          const fileName = `${date}-${slugify(title)}.md`;
          const filePath = join(adrDir, fileName);

          if (existsSync(filePath)) return `ADR already exists: ${filePath}`;

          const body = `# ${title}

Status: ${status}
Date: ${date}
Decider: ${decider}

## Context

${context || "Describe the forces, constraints, and current state that make this decision necessary."}

## Decision

Describe the chosen direction.

## Consequences

- Positive:
- Negative:
- Follow-up:

## Review

- Consulted:
- Evidence:
- Next review date:
`;

          writeFileSync(filePath, body, "utf8");
          return `ADR draft created: ${filePath}`;
        },
      }),

      list_adrs: tool({
        description: "List ADR files and their status lines",
        args: {},
        async execute() {
          const adrDir = ensureAdrDir(directory);
          const files = readdirSync(adrDir).filter((file) => file.endsWith(".md")).sort();
          if (files.length === 0) return "No ADRs found.";

          return files
            .map((file) => {
              const content = readFileSync(join(adrDir, file), "utf8");
              const status = content.match(/^Status:\s*(.+)$/m)?.[1] || "unknown";
              const title = content.match(/^#\s+(.+)$/m)?.[1] || file;
              return `- ${file}: ${title} [${status}]`;
            })
            .join("\n");
        },
      }),
    },
  };
};

export default AdrWorkflowPlugin;
