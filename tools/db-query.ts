import { tool } from "@opencode-ai/plugin";

export const db_query = tool({
    description: "Queries the local SQLite metadata database", // Prompt for the LLM [49]
    args: {
        query: tool.schema.string(), // Input validation via Zod [49, 50]
    },
    async execute({ query }, context) {
        // Bun's shell API ($) can be used to run external scripts [49, 51]
        const result = await context.$`sqlite3 metadata.db ${query}`;
        return result.stdout;
    },
});