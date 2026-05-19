# Brain Harness Visualization & Testing System

**Date:** 2026-05-25
**Status:** Approved

## Overview

A lightweight visualization and testing system for the Brain Harness RAG infrastructure. Uses existing MCP sqlite tool + enhanced brain tools in OpenCode chat + terminal commands. No new UI - terminal output + chat formatting.

## Components

### 1. Enhanced Brain Tools (OpenCode Chat)

| Tool | Purpose | Output |
|------|---------|--------|
| `brain_search <query>` | Test retrieval | Formatted results with scores, sources, timing |
| `brain_diagnostic` | Check health | Storage stats, vector health, LM Studio status |
| `brain_metrics` | View metrics | Precision@K, MRR, latency |
| `brain_index` | Index project | Progress, chunk count |

### 2. MCP Integration

Use existing `sqlite` MCP to query `brain.db`:

```sql
-- Check chunk counts
SELECT COUNT(*) as chunks FROM chunks;

-- Check vector health
SELECT vec_version();

-- View concepts
SELECT * FROM concepts LIMIT 10;

-- Session history
SELECT * FROM sessions ORDER BY started_at DESC LIMIT 5;
```

### 3. Terminal Commands

```bash
npm run brain:status      # Quick health check
npm run brain:benchmark    # Run smoke suite
npm run brain:index        # Force re-index
```

## Workflow

```
1. brain_index          → Index repo/docs
2. brain_search <query> → Test retrieval (see scores, timing)
3. brain_diagnostic     → Check storage/vector health
4. brain_metrics        → See Precision@K, MRR
5. brain_benchmark      → Run full smoke suite
```

## Constraints

- **VRAM:** ~2GB for embed + reranker (GPU only)
- **Context:** 8000 tokens max
- **No new UI:** Terminal + chat formatting only
- **LM Studio:** Embedding + reranker on GPU, chat on CPU/elsewhere

## Implementation

### 1. Enhance brain tools in plugin

Add formatted output to existing tools:
- `brain_search`: Add timing, score breakdown, source files
- `brain_diagnostic`: Add table formatting, color coding
- `brain_metrics`: Add trend visualization (ASCII)
- `brain_benchmark`: Add progress bars, summary tables

### 2. Add new tools

- `brain_benchmark`: Run benchmark suite with formatted output
- `brain_health`: Quick health check (faster than diagnostic)
- `brain_stats`: Show storage statistics

### 3. NPM scripts

```json
{
  "scripts": {
    "brain:status": "tsx brain-plugin/scripts/status.ts",
    "brain:benchmark": "tsx meta-harness/runner.ts --smoke",
    "brain:index": "tsx brain-plugin/scripts/index.ts"
  }
}
```

## File Structure

```
brain-plugin/
├── brain.ts                    # Enhanced main plugin
├── scripts/
│   ├── status.ts              # Health check script
│   ├── benchmark.ts            # Benchmark runner
│   └── index.ts               # Indexing script
└── tools/
    └── formatter.ts           # Output formatting utilities
```

## Testing

### Quick Test Sequence

```bash
# 1. Check health
npm run brain:status

# 2. Index if needed
npm run brain:index

# 3. Test a query
@brain search "authentication middleware"

# 4. Run benchmark
npm run brain:benchmark
```

### In Chat

```
@brain search "JWT auth middleware"
@brain diagnostic
@brain metrics
@brain benchmark
```

## Success Criteria

- [ ] `brain_search` returns formatted results with scores and timing
- [ ] `brain_diagnostic` shows storage + vector + LM Studio status
- [ ] `brain_metrics` shows Precision@K, MRR metrics
- [ ] `brain_benchmark` runs smoke suite with formatted output
- [ ] NPM scripts work for terminal usage
- [ ] MCP sqlite can query brain.db
- [ ] Works with 2GB VRAM budget (embed + reranker only)
