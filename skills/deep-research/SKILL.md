# Deep Research Skill

## Description

A methodology for The Documentarian or The Research Agent to autonomously ingest, synthesize, and structure new technical domains into the local knowledge base.

## Triggers

- When the Scribe detects a compilation error related to a missing or misunderstood library.
- When the user explicitly commands `/research [Topic]`.
- When an unknown protocol is introduced to the `opencode` workspace.

## Workflow

1. **Query Generation**: Formulate specific, highly-targeted technical queries based on the gap in understanding.
2. **Ingestion (No-API)**:
   - Use the `fetch` MCP tool to retrieve raw documentation from official sources.
   - If interactive pages are needed, utilize the `puppeteer` MCP to render and scrape the DOM.
3. **Synthesization**:
   - DO NOT dump raw code.
   - Summarize the findings into **Conceptual Algorithms** and **Decision Matrices**.
   - Note the trade-offs (e.g., "WebSockets vs Systems IPC Events for high-frequency hardware events").
4. **Knowledge Crystallization**: Write the findings into `C:\opencode\.opencode\skills\[domain]\references\`. If it's a new domain, create the skill directory. Use the template provided in `assets/tech-brief-template.md` to ensure standardized formatting.

## Assets

- `assets/tech-brief-template.md`: The required structure for generating a Technical Brief after research concludes.

## Best Practices

- Focus on constraints, limitations, and edge cases. (e.g., "What happens to the UI store if the Systems backend drops the event stream?").
- Always cite the URLs ingested via `fetch` so The Architect can review the source of truth if necessary.
