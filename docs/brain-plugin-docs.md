# Brain Plugin — Complete Documentation

> Cognitive layer for OpenCode: auto-classifies developer intent, retrieves
> relevant codebase context via local embeddings, and augments LLM prompts
> with RAG — all running 100% locally through LM Studio and Node-native SQLite.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [How the Brain Plugin Works](#2-how-the-brain-plugin-works)
3. [Lifecycle & Orchestration](#3-lifecycle--orchestration)
4. [Retrieval Pipeline](#4-retrieval-pipeline)
5. [Tool Reference](#5-tool-reference)
6. [Models & LM Studio](#6-models--lm-studio)
7. [Speculative Decoding](#7-speculative-decoding)
8. [Memory & Learning](#8-memory--learning)
9. [Session Memory](#9-session-memory)
10. [Eval Integration](#10-eval-integration)
11. [File Structure](#11-file-structure)
12. [Usage & Commands](#12-usage--commands)

---

## 1. Architecture Overview

```
User types → message.updated hook
  → Decision Tree (classify intent)
  → Retrieval Pipeline (SQLite FTS5 + ONNX dense)
  → Fusion + Rerank (optional)
  → Context Injector (prepend chunks to prompt)
  → Augmented prompt sent to LLM

Storage:
  ├── SQLite (better-sqlite3):
  │   ├── FTS5 keyword index (instant)
  │   ├── ONNX dense embeddings (xenova/transformers)
  │   └── Memory graph (K-means clusters)
  ├── LM Studio SDK (@lmstudio/sdk):
  │   ├── Chat completions
  │   ├── Embeddings (no sidecar needed)
  │   └── Speculative decoding (draft_model param)
  └── Docs store (SQLite-backed documentation cache)

Brain plugin hooks:
  - server.start: init SQLite, warm models
  - message.updated: RAG pipeline
  - chat.params: inject draft_model
  - file.watcher.updated: dirty tracking → debounced reindex
  - tool.execute.after: collect feedback (success/failure)
  - session.compacting: persist decision tree state
  - session.archived: save memory graph, cleanup
```

### Key Design Decisions

| Decision               | Rationale                                                         |
| ---------------------- | ----------------------------------------------------------------- |
| Node-native SQLite     | Zero sidecar, zero WSL dependency; faster startup, simpler deploy |
| LM Studio SDK          | Direct API access; no HTTP proxy needed                           |
| FTS5 + ONNX hybrid     | Keyword for speed (instant), dense for quality                    |
| ONNX int8 quantization | 2-4x faster than FP16; ~200ms per query                           |
| K-means memory graph   | Cross-session concept clustering; incremental updates             |
| Serial model loading   | ~4GB VRAM (M4400) can't hold all 3 models simultaneously          |

---

## 2. How the Brain Plugin Works

### 2.1 Entry Point — `brain.ts`

**Hooks (automatic):**

| Hook                     | What it does                                                       |
| ------------------------ | ------------------------------------------------------------------ |
| `server.start`           | Init SQLite DB, warm LM Studio connection, load decision tree      |
| `message.updated`        | Classify intent → retrieve context → inject into prompt            |
| `chat.params`            | Inject `draft_model` into LM Studio calls when speculative enabled |
| `tool.execute.after`     | Track success/failure; update tuner weights                        |
| `lsp.client.diagnostics` | Store diagnostics; prewarm "debug" intent                          |
| `file.watcher.updated`   | Mark dirty; batch 5 → 5s debounce → reindex                        |
| `session.compacting`     | Summarize memory; persist decision tree state                      |
| `session.archived`       | Save memory graph, close SQLite, cleanup                           |

### 2.2 Decision Tree — `tree/engine.ts`

7 intent categories. Scored by `weight × log(visits + 2)`:

| Intent           | Triggers                        | Chunks | Prewarm |
| ---------------- | ------------------------------- | ------ | ------- |
| `debug`          | error, exception, fail, panic   | 10     | embed   |
| debug+stacktrace | stack traces                    | 5      | embed   |
| `refactor`       | refactor, extract, rename       | 20     | embed   |
| refactor+single  | "this function" + 1 recent file | 8      | embed   |
| `feature`        | add, implement, create          | 15     | embed   |
| `test`           | test, spec, jest, pytest        | 12     | embed   |
| `learn`          | how does, explain, architecture | 25     | embed   |
| `quick_chat`     | default                         | 0      | none    |

---

## 3. Lifecycle & Orchestration

### 3.1 Startup

```
server.start:
1. Open SQLite DB (WAL mode)
2. Create tables: files, chunks, fts5, memory_graph, decisions
3. Warm LM Studio connection (health check → /v1/models)
4. Load decision tree from DB
5. Start dirty-file watcher
```

### 3.2 Message Flow

```
message.updated:
1. Classify intent (decision tree)
2. Prewarm embed model if needed
3. Run retrieval pipeline:
   a. Keyword search (FTS5) — instant
   b. Dense search (ONNX) — ~200ms
   c. Fusion (weighted combine)
   d. Rerank (optional, LM Studio)
4. Compress results (token budget)
5. Inject into prompt as context block
```

### 3.3 File Change → Reindex

```
file.watcher.updated:
  → add to dirtyFiles Set
  → if >= 5 dirty && not indexing:
    → 5s debounce
    → parse files, update FTS5, recompute embeddings
    → clear dirtyFiles
```

### 3.4 Session Teardown

```
session.archived:
  → save memory graph clusters
  → persist decision tree weights
  → close SQLite
```

---

## 4. Retrieval Pipeline

The pipeline supports progressive quality: you can stop at any stage.

### 4.1 Keyword Search (`retrieval/keyword.ts`)

- SQLite FTS5 full-text search
- `.gitignore`-aware file walk
- Blake3 hash → skip unchanged files
- Speed: <5ms

### 4.2 Dense Search (`retrieval/dense.ts`)

- ONNX runtime via `@xenova/transformers`
- int8 quantized embeddings (~200ms/query)
- Cooldown recovery with automatic reset
- Fallback to keyword-only on failure

### 4.3 Fusion (`retrieval/fusion.ts`)

- Weighted reciprocal-rank fusion of keyword + dense results
- Configurable alpha/beta weights per intent

### 4.4 Reranker (`retrieval/reranker.ts`)

- Cross-encoder reranking via LM Studio (optional, slow)
- Activated only for "learn" and high-value queries
- Top-10 results rescored

### 4.5 Orchestrator Loop (`orchestrator/loop.ts`)

Agent Delegation Protocol — routes sub-tasks to specialized agents:

- `core-factory` for implementation
- `explore` for research
- `qa-guardian` for testing
- Tracks agent context and results

---

## 5. Tool Reference

### Diagnostic & Status

| Tool                   | Purpose                                                  |
| ---------------------- | -------------------------------------------------------- |
| `brain_diagnostic`     | Full pipeline: health → cache → search test → config     |
| `brain_status`         | Backend health, index stats, memory graph, decision tree |
| `brain_sidecar_status` | LM Studio health: models loaded, VRAM usage              |

### RAG & Search

| Tool                  | Purpose                                  |
| --------------------- | ---------------------------------------- |
| `brain_search`        | Hybrid semantic search (keyword + dense) |
| `brain_embed_test`    | Test query → top-K chunks with scores    |
| `brain_index_project` | Index/re-index current project           |

### Model Management

| Tool               | Purpose                       |
| ------------------ | ----------------------------- |
| `brain_model_load` | Prewarm a model (chat, embed) |

### Lifecycle

| Tool          | Purpose                             |
| ------------- | ----------------------------------- |
| `brain_reset` | Clear index and reset decision tree |

---

## 6. Models & LM Studio

### Provider (`provider/lmstudio.ts`)

Full LM Studio SDK integration:

```typescript
import { LMStudioClient } from "@lmstudio/sdk";

const client = new LMStudioClient({ baseUrl: "http://127.0.0.1:1234" });
```

Features:

- Model loading/listing (`/v1/models`)
- Chat completions with optional `draft_model`
- Embeddings endpoint
- Automatic model detection and fallback
- Connection health monitoring

### Models

| Model                | Size    | Dims | Speed       | Use              |
| -------------------- | ------- | ---- | ----------- | ---------------- |
| nomic-embed-v1.5     | 84MB    | 768  | ~1s/batch   | Indexing, search |
| qwen3-embedding-0.6b | 320MB   | 1024 | ~359ms/4emb | Indexing, search |
| qwen3-embedding-4b   | 2,458MB | 2560 | ~39s/batch  | Quality only     |

### VRAM Analysis

16GB RAM / M4400 ~4GB VRAM:

| Model                | Offload   | VRAM        |
| -------------------- | --------- | ----------- |
| qwen3.5-4b (chat)    | 20 layers | ~3.0 GB     |
| qwen3.5-0.8b (draft) | 24 layers | ~1.5 GB     |
| qwen3-0.6b (embed)   | 15 layers | ~0.5 GB     |
| **Total**            |           | **~5.0 GB** |

All 3 cannot fit simultaneously (~5GB > ~4GB). Strategy:

```
Normal:      chat (3.0 GB) + 1.0 GB free
Search:      chat + embed (0.5 GB) = 3.5 GB → unload embed
Speculative: chat + draft (1.5 GB) = 4.5 GB → reduce draft to 16 layers
```

### Recommended LM Studio Settings

```
qwen3.5-4b (chat):
  GPU Offload: 20, Context: 4096, Flash Attention: ON

qwen3.5-0.8b (draft):
  GPU Offload: 16 (reduced), Context: 2048

qwen3-embedding-0.6b (embed):
  GPU Offload: 15, Context: 2048
```

---

## 7. Speculative Decoding

### Wiring

The `chat.params` hook in `brain.ts` injects `draft_model` into LM Studio calls:

```typescript
"chat.params": async (params: any) => {
  if (!client) return params;
  const models = await client.models.list();
  if (models.find(m => m.path?.includes("draft"))) {
    params.draft_model = "qwen3.5-0.8b";
  }
  return params;
}
```

### Model Pairs

| Main           | Draft          | Status              |
| -------------- | -------------- | ------------------- |
| qwen3.5-4b     | qwen3.5-0.8b   | Test (may mismatch) |
| gemma-4-e4b-it | gemma-4-e2b-it | 1.23x speedup       |

---

## 8. Memory & Learning

### 8.1 Memory Graph (`memory/graph.ts`)

- K-means clustering of code chunks by embedding similarity
- Incremental updates (no full recompute)
- Cross-session concept discovery
- SQLite-backed persistence

### 8.2 Tuner (`learn/tuner.ts`)

- Adjusts retrieval weights based on feedback
- Tracks successful vs failed retrievals per intent
- Learns per-user patterns over time

### 8.3 Feedback (`learn/feedback.ts`)

- Collects `tool.execute.after` signals
- Marks chunks as helpful/unhelpful
- Feeds into tuner for weight adjustment

### 8.4 Context Compression (`context/compression.ts`)

- Token budget management for context injection
- Priority-aware truncation (most relevant chunks first)
- Configurable max tokens per intent category

### 8.5 Breadcrumb (`context/breadcrumb.ts`)

- Lightweight navigation trail across messages
- Tracks recent files and decisions per session
- Used by session memory for context recovery

---

## 9. Session Memory

Defined in `plugins/index.ts` as `PlanState` / `planMemory`:

### PlanState Interface

```typescript
interface PlanState {
  recentFiles: string[];
  decisions: string[];
  failedApproaches: string[];
  parentAgent: string;
}
```

### Key Functions

| Function                 | Purpose                                          |
| ------------------------ | ------------------------------------------------ |
| `getPlanState(id)`       | Retrieve plan state for a session                |
| `buildPlanContext(id)`   | Build context string from plan state             |
| `detectTaskCompletion()` | Check if current step is done; suggest follow-up |

### Follow-up Injection

The `chat.message` hook detects task completion keywords ("done", "completed", "fixed") and appends a follow-up suggestion to continue the multi-step plan.

---

## 10. Eval Integration

### Eval Bridge (`eval/bridge.ts`)

Connects brain plugin to the eval framework:

- `capture(ty, data, opts)` — captures instrument traces
- Exports trace data for external eval tooling
- Tracks: function calls, tool executions, model responses

For full details, see [Evals Integration Guide](evals-integration-guide.md).

---

## 11. File Structure

```
brain-plugin/
├── index.ts                    # Plugin re-exports
├── brain.ts                    # Hooks + tools + lifecycle
├── package.json
├── provider/
│   └── lmstudio.ts             # @lmstudio/sdk wrapper
├── retrieval/
│   ├── searcher.ts             # Combined search orchestrator
│   ├── indexer.ts              # File indexing (FTS5 + embeddings)
│   ├── dense.ts                # ONNX dense embeddings (xenova)
│   ├── fusion.ts               # Reciprocal-rank fusion
│   ├── keyword.ts              # FTS5 keyword search
│   └── reranker.ts             # Cross-encoder reranking
├── orchestrator/
│   └── loop.ts                 # Agent Delegation Protocol
├── context/
│   ├── injector.ts             # Prompt augmentation
│   ├── breadcrumb.ts           # Navigation trail
│   └── compression.ts          # Token budget management
├── store/                      # SQLite storage layer
├── memory/
│   └── graph.ts                # K-means memory graph
├── learn/
│   ├── tuner.ts                # Weight tuning
│   └── feedback.ts             # Success/failure tracking
├── eval/
│   └── bridge.ts               # Eval instrumentation bridge
├── state/
│   └── session.ts              # Session state management
├── tree/
│   └── engine.ts               # Intent decision tree
└── docs-store.ts               # Documentation cache
```

---

## 12. Usage & Commands

### Quick Start

- [ ] LM Studio running at `http://127.0.0.1:1234`
- [ ] Models loaded: qwen3.5-4b (chat), qwen3-0.6b-embed (embed)
- [ ] `"brain-plugin/brain.ts"` in opencode.json plugin array
- [ ] Run `brain_diagnostic` to verify
- [ ] Run `brain_index_project` to index
- [ ] Test: `brain_search "auth"`
