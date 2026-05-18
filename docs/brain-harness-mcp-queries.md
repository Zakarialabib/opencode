# Brain Harness MCP SQLite Queries

Use the `sqlite` MCP tool to query `brain.db` directly.

## Connection

```json
{
  "command": "uvx",
  "args": ["mcp-server-sqlite", "--db-path", "./.opencode/brain.db"]
}
```

## Useful Queries

### Storage Stats

```sql
SELECT 'chunks' as table, COUNT(*) as count FROM chunks
UNION ALL SELECT 'vectors', COUNT(*) FROM chunk_embeddings
UNION ALL SELECT 'concepts', COUNT(*) FROM concepts
UNION ALL SELECT 'sessions', COUNT(*) FROM sessions
UNION ALL SELECT 'fts_records', COUNT(*) FROM fts_chunks;
```

### Top Retrieved Chunks

```sql
SELECT c.filepath, c.start_line, c.access_count, c.last_accessed
FROM chunks c
ORDER BY c.access_count DESC
LIMIT 10;
```

### Recent Sessions

```sql
SELECT id, intent, query, retrieved_chunks, user_rating, latency_ms, started_at
FROM sessions
ORDER BY started_at DESC
LIMIT 10;
```

### Concept Strength

```sql
SELECT cc.concept_id, cc.strength, c.filepath
FROM concept_chunks cc
JOIN chunks c ON c.id = cc.chunk_id
WHERE cc.concept_id = 'debug'
ORDER BY cc.strength DESC
LIMIT 10;
```

### Fusion Config

```sql
SELECT key, value FROM config WHERE key LIKE 'rrf_%';
```

### Vector Health Check

```sql
SELECT vec_version();
```
