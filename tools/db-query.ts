import { tool } from "@opencode-ai/plugin";

const db_query_impl = tool({
  description: "Queries the local SQLite metadata database",
  args: {
    query: tool.schema.string(),
  },
  async execute({ query }: { query: string }, _context: { abort: AbortSignal }): Promise<string> {
    const result = await Bun.$`sqlite3 metadata.db ${query}`;
    return result.stdout.toString();
  },
});

export const db_query = db_query_impl as ReturnType<typeof tool>;
