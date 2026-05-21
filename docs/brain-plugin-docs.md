# Brain Plugin — Complete Documentation

> Source-driven documentation for the OpenCode Brain Plugin. This doc reflects the actual implementation in `brain-plugin/`, with hooks, retrieval behavior, tools, and runtime integration.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Plugin Hooks & Lifecycle](#2-plugin-hooks--lifecycle)
3. [Retrieval Pipeline](#3-retrieval-pipeline)
4. [Tool Reference](#4-tool-reference)
5. [Models & Backends](#5-models--backends)
6. [Memory, Feedback, and Budget](#6-memory-feedback-and-budget)
7. [Session Memory](#7-session-memory)
8. [Brain RAG System Reference](#8-brain-rag-system-reference)
9. [Dashboard Integration](#9-dashboard-integration)
10. [File Structure](#10-file-structure)
11. [Usage & Commands](#11-usage--commands)
12. [SQLite Query Recipes](#12-sqlite-query-recipes)

---

## 1. Architecture Overview

The Brain Plugin is an OpenCode plugin that augments user messages with local context before they are sent to the language model.

Core flow:

- `message.updated` receives a user message
- A decision tree classifies developer intent
- `searchProjectContext()` performs hybrid retrieval
- results are fused and optionally reranked
- context is injected into the user's prompt via `contextInjector`
- the augmented prompt is returned to the OpenCode runtime

Storage and runtime components:

- SQLite (`brain-plugin/store/index.ts`) holds:
  - `files`
  - `chunks`
  - `fts_chunks`
  - `chunk_embeddings`
  - `chunk_embeddings_nomic`
  - `concepts`
  - `concept_chunks`
  - `sessions`
  - `config`
  - `telemetry_runs`
  - `telemetry_events`
- `@lmstudio/sdk` wrapper for LM Studio chat and embedding
- local embeddings and reranker via `@xenova/transformers`
- in-memory docs cache in `docs-store.ts`

### Plugin exports and source-of-truth API

`brain-plugin/index.ts` re-exports the default plugin and helper APIs:

- default export: `BrainPlugin`
- `DecisionTree`
- `LMStudioProvider`, `defaultProvider`, `META_HARNESS_MODELS`, `GPU_AWARE_MODELS`
- `indexProject()`, `searchProjectContext()`, `contextInjector`, `sessionMemory`
- harness setters: `setFusionWeights()`, `setMemoryBoost()`, `setRrfK()`, `getFusionWeights()`
- reranker setters: `setRerankerConfidenceGate()`, `setRerankMinResults()`, `setRerankIntents()`, `setRerankerMaxChunks()`, `getRerankerConfig()`
- tree setters: `setIntentThresholds()`, `setChunkCounts()`, `getTreeConfig()`
- RAG helpers: `getIndexStatus()`, `queryIndexedDocs()`, `analyzeRAGPipeline()`, `improveRAG()`, `diagnoseBrainPlugin()`

---

## 2. Plugin Hooks & Lifecycle

### 2.1 `server.start`

This hook initializes the plugin and is the entrypoint for runtime setup.

What it does:

- loads or initializes the `DecisionTree`
- parses `opencode.json` for `lmstudio` base URL
- configures token budget from `compaction` settings
- initializes `contextInjector`
- opens the project SQLite database
- checks and clears a `needs_reindex` flag if present
- starts a background `indexProject(directory)` job

### 2.2 `message.updated`

The core runtime hook for prompt augmentation.

Behavior:

- only processes messages where `msg.role === 'user'`
- collects signals from `sessionMemory` (`recentFiles`, `diagnostics`, `currentTodo`, `lspSymbols`)
- classifies the user message into a scenario with `DecisionTree.classify()`
- ignores augmentation for `quick_chat` or very low confidence
- uses `tree.selectStrategy()` to get intent strategy
- calls `searchProjectContext(directory, msg.content, adaptiveLimit, scenario.intent)`
- if code context is weak, enriches the prompt with:
  - `context7` local docs service
  - package registry docs from `npm`, `crates.io`, or `packagist`
- injects formatted context using `contextInjector.inject()`
- updates token budget and session memory
- logs search source and intent

### 2.3 `chat.params`

This hook supports a lightweight skill-gap detector.

Behavior:

- examines the message and existing `output.instructions`
- if the query does not match instruction keywords, rewrites the prompt
- the rewritten prompt includes intent and docs cache summary
- this is not speculative decoding or draft-model injection

### 2.4 `tool.execute.after`

The plugin listens for tool execution results to update session feedback.

Supported signals:

- `edit` or `write` tools mark a success
- `bash` tool failures with error output mark a failure

### 2.5 `lsp.client.diagnostics`

- stores diagnostics in session memory
- prewarms the `debug` intent when error diagnostics are present

### 2.6 `file.watcher.updated`

- marks the file dirty in session memory
- batches dirty file paths in a 3-second debounce window
- triggers background reindexing via `indexProject(directory)`

### 2.7 `experimental.session.compacting`

- appends session summaries to compacted context
- saves the `DecisionTree` state

### 2.8 `session.archived`

- closes the SQLite database
- persists docs cache status

---

## 3. Retrieval Pipeline

The search pipeline is implemented in `retrieval/searcher.ts` and combines multiple retrieval modes.

### 3.1 Keyword Search

`ftsSearch()` queries the `fts_chunks` table using a sanitized version of the user query.

- results are joined with `chunks`
- each result receives a fallback lexical score
- this path works even when vectors are unavailable

### 3.2 Dense Search

`denseSearch()` computes query embeddings and performs vector retrieval when available.

- local ONNX embeddings are attempted first
- fallback to LM Studio embedding service if local embedding fails
- if `sqlite-vec` is active, `searchDenseVectors()` is used
- when vector search is unavailable, dense search returns an empty set

### 3.3 Fusion

The plugin fuses keyword and dense results using `reciprocalRankFusion()`.

- weights are configurable: keyword (`alpha`), dense (`beta`), sparse (`gamma`)
- when concept memory is available, related chunks receive a score boost (`1.15×`)
- the system continues gracefully if the memory graph cannot be loaded

### 3.4 Reranking Trigger

`retrieval/reranking-trigger.ts` decides whether reranking should run.

Decision factors:

- reranking enabled status
- minimum result count (`minResults`)
- whether the intent is in `intentsRequiringRerank`
- confidence threshold

When reranking is enabled, an adaptive rerank limit is computed and the top candidates are rescored.

### 3.5 Cross-Encoder Reranking

`rerankChunks()` implements the actual local rerank pass.

- uses `@xenova/transformers` text-classification pipeline
- default model: `Xenova/bge-reranker-base`
- capped to `maxChunksBeforeRerank`
- skipped if the top-3 fused scores already exceed a confidence gate
- on failure, returns the fused results unchanged

### 3.6 Fallbacks and caches

- reranked results are cached for 30 seconds using `RerankingTrigger`
- `context7` docs and package registry docs are added when code chunks are insufficient
- embedding, reranker, and memory graph failures fall back gracefully

---

## 4. Tool Reference

The plugin exposes a set of tools built into its `tool` namespace.

### Core tools

| Tool | Purpose |
| ---- | ------- |
| `brain_index_project` | Index the current project or refresh the SQLite index |
| `brain_search` | Run the hybrid search pipeline and expose chunk results |
| `brain_status` | Return database and plugin health metrics |
| `brain_reset` | Wipe index tables, docs cache, decision tree, and session memory |
| `brain_budget` | Report current token budget and usage |
| `brain_budget_reset` | Reset the session token budget counter |
| `brain_diagnostic` | Run a full pipeline diagnostic check |
| `brain_docs_cache` | List cached package documentation entries |
| `brain_docs_fetch` | Fetch package docs from a registry |
| `brain_embed_test` | Return raw embedding search results for debugging |
| `brain_embed_lmstudio` | Request embeddings from LM Studio directly |
| `brain_metrics` | Expose RAG and session metrics as JSON |
| `brain_benchmark` | Run a quick benchmark through `meta-harness` |
| `brain_config` | Inspect or update reranking configuration |
| `brain_speculative_status` | Report speculative decoding status and loaded models |

### `brain_config` reranking payload

The `brain_config` tool accepts a `reranking` object:

- `enabled` — boolean
- `minResults` — number
- `intents` — string[]
- `confidenceThreshold` — number
- `adaptiveLimit` — boolean

This directly maps to `setRerankingConfig()` in `retrieval/reranking-trigger.ts`.

---

## 5. Models & Backends

### Embedding pipeline

The plugin supports three embedding backends via `retrieval/dense.ts`:

- `local`: attempt CPU embeddings with `@xenova/transformers`
- `lmstudio`: always use LM Studio API embeddings
- `auto`: prefer local, fall back to LM Studio

The local embedding cache is at:

```text
<projectRoot>/.opencode/models/
```

### Reranker

- local CPU reranking
- model id default: `Xenova/bge-reranker-base`
- reranker is only used when the trigger permits it and sufficient candidates exist
- when disabled or unavailable, the plugin uses fused results only

### LM Studio integration

The plugin uses `LMStudioProvider` and reads `opencode.json` for `lmstudio` base URL.
If `opencode.json` is missing or malformed, the plugin falls back to `http://localhost:1234`.

### Speculative decoding

- The plugin reports speculative decoding as `not_configured`
- `chat.params` does prompt rewriting, but there is no draft-model / speculative decoding integration

---

## 6. Memory, Feedback, and Budget

### Concept memory

The memory graph in `memory/graph.ts` links concepts to chunks.

- it can boost fused results by 15% for concept-related chunks
- concept graph loading is optional and non-blocking

### Session feedback

- `tool.execute.after` marks edits as successes and some bash failures
- `learn/feedback.ts` can be used to tune retrieval weights from runtime signals
- `learn/tracer.ts` exposes internal trace metrics for analysis

### Token budget

- `context/token-budget.ts` tracks total tokens, used tokens, reserved tokens, and available tokens
- `contextInjector.inject()` may prune context when budget low
- `brain_budget` and `brain_budget_reset` expose this status to tools

---

## 7. Session Memory

`state/session.ts` provides runtime memory for the plugin.

Stored state includes:

- recent files
- diagnostics
- current todo
- decisions and success/failure markers
- context chunks used

The runtime uses session memory to:

- enhance intent classification
- summarize context during compaction
- inform prompt injection with recent activity

---

## 8. Brain RAG System Reference

### Architecture Overview

The Brain plugin implements a hybrid RAG (Retrieval-Augmented Generation) system with three main components:

```
┌─────────────────────────────────────────────────────────────────┐
│                     BRAIN RAG SYSTEM                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────┐   │
│  │   INPUT     │───▶│  EMBEDDING  │───▶│    SEARCH       │   │
│  │  (Query)    │    │   MODEL     │    │   (Dense)      │   │
│  └─────────────┘    └─────────────┘    └─────────────────┘   │
│                                              │               │
│                                              ▼               │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────┐   │
│  │  RESULTS    │◀───│   FUSION   │◀───│   KEYWORD       │   │
│  │  (Final)   │    │   (RRF)    │    │   (FTS5)        │   │
│  └─────────────┘    └─────────────┘    └─────────────────┘   │
│         │                                     │               │
│         ▼                                     ▼               │
│  ┌─────────────┐                      ┌─────────────────┐   │
│  │  RERANKER   │◀─────────────────────│   MEMORY        │   │
│  │  (Optional) │                      │   (Concept Boost) │  │
│  └─────────────┘                      └─────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### RAG Pipeline Flow

#### 1. Query Processing

User query is classified by the decision tree and mapped to an adaptive retrieval strategy.

#### 2. Parallel Retrieval

- Dense Search (Embeddings)
- Keyword Search (FTS5)
- Results are fused via Reciprocal Rank Fusion.

#### 3. Memory Boost

Known concepts may boost related chunks, improving relevance for repeated topics.

#### 4. Reranking (Optional)

Reranking runs when intent, result count, and confidence gates pass, producing a cross-encoder rescored result list.

### Model Configuration

The plugin relies on LM Studio or local embedding models plus an optional local reranker.

#### Recommended models

- Embedding: `nomic-embed-text-v1.5`
- Local CPU embedding: `Xenova/nomic-embed-text-v1.5`
- Local CPU reranker: `Xenova/bge-reranker-base`

### LM Studio Integration

LM Studio is used for chat completions and as a fallback embedding backend when local embeddings are unavailable.

#### Model loading priority

1. Local embeddings via `@xenova/transformers`
2. LM Studio embeddings
3. Fallback to keyword-only retrieval

#### Reranking

Reranking is implemented locally and does not use LM Studio.

### Embedding Models

#### Local transformers.js (default)

- Model: `Xenova/nomic-embed-text-v1.5`
- Cache location: `<projectRoot>/.opencode/models/`
- Device: CPU

#### LM Studio fallback

- Model ID: `nomic-embed-text-v1.5`
- Endpoint: `http://localhost:1234/v1`

### Reranker

#### Purpose

Cross-encoder reranker rescoring top retrieval candidates using full query-context scoring.

#### Defaults

- `confidenceGate` = 0.85
- `rerankMinResults` = 10
- `rerankIntents` = `["learn", "refactor", "feature"]`
- `rerankerMaxChunks` = 20

#### Trigger behavior

- reranking enabled + intent requires rerank + enough results
- skip if top fused scores already exceed the confidence gate

### Fusion Strategy

#### Reciprocal Rank Fusion (RRF)

RRF combines dense and keyword rankings using smoothing.

#### Default weights

- dense: 0.4
- keyword: 0.4
- smoothing `K`: 60

#### Memory boost

Concept-memory related chunks can receive a relevance boost, though the default fusion path remains robust without it.

### Database Schema

#### Tables

- `files`
- `chunks`
- `chunk_embeddings`
- `chunk_embeddings_nomic`
- `fts_chunks`
- `concepts`
- `concept_chunks`
- `sessions`
- `config`
- `telemetry_runs`
- `telemetry_events`

#### Location

- `<project>/.opencode/brain.db`

### Configuration Guide

#### 1. LM Studio setup

- Install LM Studio
- Download `nomic-embed-text-v1.5`
- Enable local server and CORS

#### 2. OpenCode config update

Add LM Studio provider settings to `opencode.json`.

#### 3. Reranking trigger config

The reranking config is managed internally and tuned via dashboard/tools rather than directly through `opencode.json`.

### Troubleshooting

#### No embeddings generated

- verify LM Studio at `http://localhost:1234/v1/models`
- check `.opencode/models/` for local cache
- run diagnostic tooling

#### Poor retrieval quality

- ensure files/chunks are indexed
- reindex if needed
- adjust fusion weights toward dense or keyword signals

#### Reranking not working

- confirm reranker is enabled
- verify intent is one of `learn`, `refactor`, `feature`
- check that enough candidates are available

#### Memory issues

- use Nomic embedding models for stable local embeddings
- reduce reranker chunk limits if CPU is constrained

### Performance targets

- embedding latency <100ms preferred
- search latency <200ms preferred
- reranking latency <500ms preferred
- indexing speed target ~100 files/s

### Quick reference

#### tools

- `brain_status`
- `brain_diagnostic`
- `brain_search`
- `brain_embed_test`
- `brain_index_project`
- `brain_config`
- `brain_benchmark`

#### config keys

- `rrf_k`
- `rrf_dense_weight`
- `rrf_sparse_weight`
- `rerank_top_k`
- `relevance_threshold`

### Summary

The Brain RAG system provides hybrid retrieval, adaptive chunking, concept-aware memory boosts, optional reranking, and CPU-first embedding fallback.

---

## 9. Dashboard Integration

The Brain Dashboard in `brain-dashboard/` is a companion runtime UI and does not replace plugin logic.

It interacts with plugin helpers and runtime state such as:

- embedding backend configuration and status
- reranker status and model selection
- fusion weight tuning and `rrf_k`
- project indexing and reindex jobs
- search and chat debugging
- telemetry and session trace inspection

The dashboard is implemented as an Express server and exposes a broad HTTP API surface.

---

## 9. File Structure

```
brain-plugin/
├── index.ts                    # Plugin exports and harness helpers
├── brain.ts                    # Plugin hooks, tools, lifecycle, and prompt augmentation
├── package.json
├── provider/
│   └── lmstudio.ts             # LM Studio SDK wrapper and provider configuration
├── retrieval/
│   ├── searcher.ts             # Hybrid search orchestration and reranking trigger
│   ├── indexer.ts              # Semantic chunk indexing and SQLite persistence
│   ├── dense.ts                # Local + LM Studio embedding backend
│   ├── fusion.ts               # RRF fusion and memory boost
│   ├── keyword.ts              # FTS5 keyword search helpers
│   ├── sparse.ts               # Sparse retrieval implementation
│   ├── reranker.ts              # Local cross-encoder reranker (CPU)
│   ├── reranking-trigger.ts    # Rerank gating, confidence threshold, and adaptive limits
│   └── cache.ts                # Embedding batching and deduplication
├── orchestrator/
│   └── loop.ts                 # Prompt-based delegation simulation
├── context/
│   ├── injector.ts             # Prompt augmentation and context injection
│   ├── compression.ts          # Token-based context pruning
│   ├── reasoning-compressor.ts # Thought summarization and breadcrumb-style context
│   └── token-budget.ts         # Budget monitoring and pruning policy
├── store/                      # SQLite schema, DB access, telemetry, and vector store helpers
├── memory/
│   └── graph.ts                # Concept memory graph and chunk relationships
├── learn/
│   ├── feedback.ts             # Success/failure feedback and tuning hooks
│   ├── tracer.ts             # Internal analytics and trace metrics
│   └── tuner.ts                # Context budget tuning and scoring logic
├── state/
│   └── session.ts              # Session state and recent-file/diagnostic memory
├── tree/
│   └── engine.ts               # Intent classification decision tree
└── docs-store.ts               # Cached package documentation fetcher
```

---

## 10. Usage & Commands

### Startup checklist

- LM Studio available at `http://localhost:1234/v1`
- `brain-plugin` enabled in `opencode.json`
- `brain_index_project` available in the plugin tool namespace
- `brain_status` returns database and decision tree health

### Recommended commands

- `brain_index_project` — manual project indexing
- `brain_status` — health and index counts
- `brain_diagnostic` — full pipeline diagnostic check
- `brain_budget` / `brain_budget_reset` — monitor token budget
- `brain_config` — inspect and tune reranking settings

### Failure modes

- local embedding failure falls back to LM Studio
- reranker failure falls back to fused results
- low context queries may still use `context7` and registry docs
- `brain_reset` clears search state and index tables if you need a clean slate

---

## 12. SQLite Query Recipes

The following queries reflect the actual `brain.db` schema defined by `brain-plugin/store/index.ts`.

### Connection

```json
{
  "command": "uvx",
  "args": ["mcp-server-sqlite", "--db-path", "./.opencode/brain.db"]
}
```

### Useful Queries

#### Storage Stats

```sql
SELECT 'chunks' as table, COUNT(*) as count FROM chunks
UNION ALL SELECT 'vectors', COUNT(*) FROM chunk_embeddings
UNION ALL SELECT 'concepts', COUNT(*) FROM concepts
UNION ALL SELECT 'sessions', COUNT(*) FROM sessions
UNION ALL SELECT 'fts_records', COUNT(*) FROM fts_chunks;
```

#### Top Retrieved Chunks

```sql
SELECT c.filepath, c.start_line, c.access_count, c.last_accessed
FROM chunks c
ORDER BY c.access_count DESC
LIMIT 10;
```

#### Recent Sessions

```sql
SELECT id, intent, query, retrieved_chunks, user_rating, latency_ms, started_at
FROM sessions
ORDER BY started_at DESC
LIMIT 10;
```

#### Concept Strength

```sql
SELECT cc.concept_id, cc.strength, c.filepath
FROM concept_chunks cc
JOIN chunks c ON c.id = cc.chunk_id
WHERE cc.concept_id = 'debug'
ORDER BY cc.strength DESC
LIMIT 10;
```

#### Fusion Config

```sql
SELECT key, value FROM config WHERE key LIKE 'rrf_%';
```

#### Vector Health Check

```sql
SELECT vec_version();
```
''' ; Path('docs/brain-plugin-docs.md').write_text(content, encoding='utf-8')"