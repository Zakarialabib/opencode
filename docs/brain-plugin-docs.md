# Brain Plugin — Complete Documentation

> Cognitive layer for OpenCode: auto-classifies developer intent, retrieves
> relevant codebase context via local embeddings, and augments LLM prompts
> with RAG — all running 100% locally through LM Studio and Node-native SQLite.
>
> Includes a **Bun-based dashboard** (port 3456) for model management, runtime observability,
> and brain plugin lifecycle control.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [How the Brain Plugin Works](#2-how-the-brain-plugin-works)
3. [Lifecycle & Orchestration](#3-lifecycle--orchestration)
4. [Retrieval Pipeline](#4-retrieval-pipeline)
5. [Tool Reference](#5-tool-reference)
6. [Models & LM Studio](#6-models--lm-studio)
7. [Provider Modes & Download Flow](#7-provider-modes--download-flow)
8. [Dashboard Bridge](#8-dashboard-bridge)
9. [Memory & Learning](#9-memory--learning)
10. [Session Memory](#10-session-memory)
11. [Internal Tracing](#11-internal-tracing)
12. [File Structure](#12-file-structure)
13. [Usage & Commands](#13-usage--commands)

---

## 1. Architecture Overview

```
User types → message.updated hook
  → Decision Tree (classify intent: debug, refactor, feature, test, learn, quick_chat)
  → Retrieval Pipeline (parallel keyword FTS5 + dense ONNX + pseudo-SPLADE sparse)
  → RRF fusion (adaptive weights per intent, memory-aware 15% boost for known concepts)
  → Rerank via ONNX cross-encoder (learn/refactor/feature intents, confidence gate >0.85 skips)
  → Adaptive chunk count by confidence score (high confidence → fewer chunks)
  → Context Injector (token-based compression via estimateTokens(), prepend chunks to prompt)
  → Augmented prompt sent to LLM

Storage:
  ├── SQLite (better-sqlite3):
  │   ├── FTS5 keyword index (instant)
  │   ├── ONNX dense embeddings (xenova/transformers)
  │   └── Memory graph (K-means clusters, auto mini-batch every 30min)
  ├── LM Studio SDK (@lmstudio/sdk):
  │   ├── Chat completions
  │   └── Embeddings (no sidecar needed)
  └── Docs store (in-memory Map, 50-entry LRU — no persistence, re-fetches on restart)

Dashboard (Bun, port 3456):
  ├── Model catalog + download/prewarm/unload UI
  ├── Runtime brain plugin status display
  ├── Reindex / Reset brain lifecycle controls
  └── Shared brain.db for bridge communication

Brain plugin hooks:
  - server.start: init SQLite, warm LM Studio connection, start periodic tasks (30s status write, 30min memory graph)
  - message.updated: RAG pipeline (classify → search → rerank → inject)
  - chat.params: skill gap detection / prompt rewriting (NOT speculative decoding)
  - file.watcher.updated: dirty tracking → debounced reindex (3s)
  - tool.execute.after: collect feedback (success/failure)
  - session.compacting: persist decision tree state
  - session.archived: save memory graph, close SQLite, cleanup
```

### Key Design Decisions

| Decision                 | Rationale                                                         |
| ------------------------ | ----------------------------------------------------------------- |
| Node-native SQLite       | Zero sidecar, zero WSL dependency; faster startup, simpler deploy |
| LM Studio SDK            | Direct API access; no HTTP proxy needed                           |
| FTS5 + ONNX hybrid       | Keyword for speed (instant), dense for quality                    |
| ONNX int8 quantization   | 2-4x faster than FP16; ~200ms per query                           |
| K-means memory graph     | Periodic incremental update via miniBatchUpdate(); simple, predictable |
| Reranker on CPU via ONNX | Saves VRAM; ~200ms latency acceptable for 'learn' intent only     |
| Serial model loading     | ~4GB VRAM (M4400) can't hold all models simultaneously            |
| In-memory docs store     | Simple LRU Map; no persistence needed for transient doc cache     |
| Shared brain.db bridge   | Plugin writes runtime state → dashboard reads; settings flow dashboard→plugin |

> **Hardware Limits:** No VRAM guard is implemented. Speculative decoding is not wired —
> the `chat.params` hook performs skill gap detection, not `draft_model` injection.
> Reranker runs on CPU to preserve VRAM. See [Models & LM Studio](#6-models--lm-studio).

---

## 2. How the Brain Plugin Works

### 2.1 Entry Point — `brain.ts`

**Hooks (automatic):**

| Hook                     | What it does                                                    |
| ------------------------ | --------------------------------------------------------------- |
| `server.start`           | Init SQLite DB, warm LM Studio, load decision tree, start periodic tasks |
| `message.updated`        | Classify intent → search → rerank (if 'learn') → inject context |
| `chat.params`            | Detect skill gaps; rewrite prompts with intent context          |
| `tool.execute.after`     | Track success/failure; update tuner weights                     |
| `lsp.client.diagnostics` | Store diagnostics; prewarm "debug" intent                       |
| `file.watcher.updated`   | Mark dirty; batch → 3s debounce → reindex                       |
| `session.compacting`     | Summarize memory; persist decision tree state                   |
| `session.archived`       | Save memory graph, close SQLite, cleanup                        |

**Periodic Tasks (setInterval in server.start):**

| Interval  | Task                                      | Purpose                                      |
| --------- | ----------------------------------------- | -------------------------------------------- |
| 30s       | writePluginStatusToDB()                   | Write runtime state to shared brain.db        |
| 30s       | Poll brain_reindex_request flag           | Trigger reindex from dashboard                |
| 30s       | Poll brain_reset_request flag             | Trigger reset from dashboard                  |
| 30min     | miniBatchUpdate()                         | Incremental memory graph clustering           |

### 2.2 Decision Tree — `tree/engine.ts`

7 intent categories. Scored by `weight × log(visits + 2)`:

| Intent           | Triggers                        | Chunks | Rerank |
| ---------------- | ------------------------------- | ------ | ------ |
| `debug`          | error, exception, fail, panic   | 10     | false  |
| debug+stacktrace | stack traces                    | 5      | true   |
| `refactor`       | refactor, extract, rename       | 20     | true   |
| refactor+single  | "this function" + 1 recent file | 8      | false  |
| `feature`        | add, implement, create          | 15     | true   |
| `test`           | test, spec, jest, pytest        | 12     | false  |
| `learn`          | how does, explain, architecture | 25     | true   |
| `quick_chat`     | default                         | 0      | false  |

Note: `rerank` flag is set per-intent in the decision tree. The actual reranker activation
is gated in the pipeline — fires for `learn`, `refactor`, and `feature` intents with >= 10 results
AND only when the top-3 fusion scores don't already exceed 0.85 (confidence gate).

---

## 3. Lifecycle & Orchestration

### 3.1 Startup

```
server.start:
1. Open SQLite DB (WAL mode)
2. Create tables: files, chunks, fts5, memory_graph, decisions, config
3. Parse opencode.json for LM Studio baseURL
4. Merge settings from brain.db config table (dashboard-persisted settings take precedence)
5. Warm LM Studio connection
6. Auto-index project (background via setImmediate)
7. Start dirty-file watcher
8. Kick off periodic tasks: 30s status write + flag poll, 30min memory graph
```

### 3.2 Message Flow

```
message.updated:
1. Classify intent (decision tree)
2. Skip if 'quick_chat' or low confidence
3. Run retrieval pipeline:
   a. FTS5 keyword search
   b. ONNX dense search
   c. Merge + sort by score
   d. Rerank via ONNX cross-encoder (only if intent='learn' && >=10 results)
4. Inject into prompt as context block
5. If low context (<3 chunks), fallback to context7 + registry docs
```

### 3.3 File Change → Reindex

```
file.watcher.updated:
  → add to dirtyFiles Set
  → if not indexing:
    → 3s debounce
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

### 4.1 Keyword Search (`retrieval/keyword.ts`)

- SQLite FTS5 full-text search (`unicode61` tokenizer)
- `.gitignore`-aware file walk
- Blake3 hash → skip unchanged files
- Speed: <5ms

### 4.2 Dense Search (`retrieval/dense.ts`)

- ONNX runtime via `@xenova/transformers`
- int8 quantized embeddings (~200ms/query)
- Cooldown recovery with automatic reset
- Fallback to keyword-only on failure

### 4.3 Fusion (`retrieval/fusion.ts`)

- Weighted reciprocal-rank fusion of keyword + dense + sparse results
- **Parallel execution** via `Promise.all` — keyword and dense run concurrently
- **Memory-aware boost**: known concepts receive 15% score increase
- Configurable alpha/beta weights per intent (auto-tuned by `feedback.ts`)

### 4.4 Reranker (`retrieval/reranker.ts`)

- Cross-encoder reranking via **local ONNX pipeline** (`Qwen/Qwen3-Reranker-0.6B` on CPU)
- **Not LM Studio** — runs on CPU to preserve VRAM
- Intent-gated: only activates for `learn`, `refactor`, `feature` intents with >= 10 results
- Confidence gate: skips reranking if top-3 scores all exceed 0.85
- Top-20 rescored; remaining chunks appended unmodified
- Graceful fallback: returns raw fusion results on failure

### 4.5 Sparse Retrieval (`retrieval/sparse.ts`)

- Pseudo-SPLADE: IDF-weighted term scoring over FTS5 candidates
- Computes document frequency per query term, re-ranks by TF-IDF
- Complements FTS5 keyword search with learned-sparse-style relevance

### 4.6 Orchestrator (`orchestrator/loop.ts`)

Prompt-based delegation simulation — not real subagent spawning:

- `delegateToAgent(agentName, briefing)` — calls the same LLM with a structured briefing prompt
- `shouldDelegate(intent, complexity)` — simple boolean, only for `'debug'` intent
- Agent names: `"debugger" | "architect" | "tester"` (not `core-factory`/`explore`/`qa-guardian`)
- Uses own `AgentBriefing` interface (unrelated to `PlanState` in plugins/index.ts)
- **Does not** spawn real subagents or inject PlanState into child contexts

**Roadmap (Phase 2):**
Replace prompt simulation with real task-tool routing:

1. Serialize `PlanState` into `tools.task({ agent, briefing })` params
2. Spawn real subagents via OpenCode's agent system
3. Propagate session memory between parent and child
4. Collect results from real tool execution, not simulated chat response

---

## 5. Tool Reference

### Diagnostic & Status

| Tool                      | Purpose                                                   |
| ------------------------- | --------------------------------------------------------- |
| `brain_diagnostic`        | Full pipeline: health → cache → search test → config      |
| `brain_status`            | Backend health, index stats, memory graph, cache hit rate |

### RAG & Search

| Tool                  | Purpose                                  |
| --------------------- | ---------------------------------------- |
| `brain_search`        | Hybrid semantic search (keyword + dense) |
| `brain_embed_test`    | Test query → top-K chunks with scores    |
| `brain_index_project` | Index/re-index current project           |

### Model Management

| Tool                     | Purpose                                                    |
| ------------------------ | ---------------------------------------------------------- |
| `brain_model_load`       | Prewarm a model (chat, embed) via LM Studio                |
| `brain_model_status`     | Check dense embedder, reranker, and provider status        |
| `brain_model_unload`     | Unload ONNX dense/reranker pipelines selectively           |
| `brain_model_provider`   | Switch provider mode (onnx_local \| lmstudio \| download_only) |
| `brain_model_download`   | Download a model from HuggingFace via dashboard API         |

### Lifecycle

| Tool          | Purpose                             |
| ------------- | ----------------------------------- |
| `brain_reset` | Clear index and reset decision tree |

### Tool Details

**brain_model_status** — Returns JSON with:
- `dense`: pipeline state (active/loading/unloaded/failed), model info, lastError
- `reranker`: same structure as dense
- `loadedModels`: list from LM Studio provider
- `vramUsageGB`: current VRAM from provider
- `modelLoadStatus`: per-model load state from LM Studio

**brain_model_unload** — Accepts `target: "dense" | "reranker" | "all"`.
Graceful degradation: unloads ONNX pipelines; LM Studio models unaffected.

**brain_model_provider** — Accepts `mode: "onnx_local" | "lmstudio" | "download_only"`:
- `onnx_local`: enables ONNX dense + reranker auto-init on next call
- `lmstudio`: ONNX auto-init on demand, LM Studio fallback available
- `download_only`: blocks ONNX pipelines entirely, LM Studio only

**brain_model_download** — Accepts `modelId` from catalog. Calls `POST /api/model/download` on dashboard at localhost:3456.
Returns job ID for progress tracking. Handles timeout (dashboard not running), cached models, and API errors.

---

## 6. Models & LM Studio

### Provider (`provider/lmstudio.ts`)

Full LM Studio SDK integration. Provides chat completions and embeddings.
**No speculative decoding support** — `draft_model` parameter is accepted by the SDK
but the `chat.params` hook is used for skill gap detection instead.

### Models

| Model                | Size    | Dims | Speed       | Use              |
| -------------------- | ------- | ---- | ----------- | ---------------- |
| nomic-embed-v1.5     | 84MB    | 768  | ~1s/batch   | Indexing, search |
| qwen3-embedding-0.6b | 320MB   | 1024 | ~359ms/4emb | Indexing, search |
| qwen3-embedding-4b   | 2,458MB | 2560 | ~39s/batch  | Quality only     |

### VRAM Analysis (Reference Only — No Guard Implemented)

16GB RAM / M4400 ~4GB VRAM — theoretical analysis:

| Model                | Offload   | VRAM        |
| -------------------- | --------- | ----------- |
| qwen3.5-4b (chat)    | 20 layers | ~3.0 GB     |
| qwen3.5-0.8b (draft) | 24 layers | ~1.5 GB     |
| qwen3-0.6b (embed)   | 15 layers | ~0.5 GB     |
| **Total**            |           | **~5.0 GB** |

No runtime VRAM guard exists. The reranker runs on CPU (`device: "cpu"`) to avoid VRAM pressure.
Dense embeddings default to CPU as well.

---

## 7. Provider Modes & Download Flow

### Provider Modes

The brain plugin supports three provider modes, switched via `brain_model_provider` tool:

| Mode            | ONNX Dense | ONNX Reranker | LM Studio | Use Case                             |
| --------------- | ---------- | ------------- | --------- | ------------------------------------ |
| `onnx_local`    | Auto-init   | Auto-init     | Available | Highest quality hybrid search        |
| `lmstudio`      | Auto-init   | Auto-init     | Available | Balanced (default, recommended)      |
| `download_only` | Blocked     | Blocked       | Available | VRAM-constrained or download focus   |

### Model Download Flow

```
brain_model_download("nomic-embed-text-v1.5")
  → POST http://localhost:3456/api/model/download { modelId }
  → Dashboard checks if model is already cached (.downloaded marker)
  → If cached: returns { success: true, cached: true }
  → If new: creates download job, streams from HuggingFace
  → Returns { success: true, jobId, modelId }
  → Progress tracked via GET /api/model/jobs in dashboard UI
  → On completion: .downloaded marker file written
  → Brain plugin picks up downloaded model on next pipeline init
```

**Requirements:**
- Dashboard server must be running on port 3456 (`bun run brain-dashboard/server.js`)
- Model must exist in the catalog (model-catalog.json)
- Download uses Content-Length for progress percentage

---

## 8. Dashboard Bridge

### Architecture

The brain plugin and dashboard communicate through a **shared `brain.db` SQLite file**
at `<project-root>/.opencode/brain.db`. No HTTP endpoints between them — the config table
acts as a message bus.

```
┌─────────────────────┐                     ┌──────────────────────┐
│   Brain Plugin      │                     │   Dashboard (Bun)    │
│   (inside OpenCode) │                     │   (port 3456)        │
│                     │    ┌────────────┐   │                      │
│  writePluginStatus  │───→│ brain.db   │←──│  GET /plugin-status  │
│  every 30s          │    │ config tbl │   │                      │
│                     │    └────────────┘   │  POST /reindex       │
│  poll for flags     │←───────────────────→│  POST /reset         │
│  brain_reindex_request│                   │                      │
│  brain_reset_request │                     │  Settings page →     │
│                     │                     │  write to config tbl │
│  read settings on   │←────────────────────│  (model selection,   │
│  startup            │                     │   provider mode)     │
└─────────────────────┘                     └──────────────────────┘
```

### Bridge Communication Channels

| Direction | Data              | Mechanism                                  | Frequency        |
| --------- | ----------------- | ------------------------------------------ | ---------------- |
| Plugin →  | Runtime status    | writePluginStatusToDB() writes JSON blob   | Every 30s        |
| Dashboard |                   | to config key `brain_plugin_status`        |                  |
| Dashboard→ | Model settings   | Dashboard writes to config table           | Startup (one-way)|
| Plugin     |                   | Plugin reads on server.start               |                  |
| Dashboard→ | Reindex request  | Dashboard writes `brain_reindex_request=true` | On button click |
| Plugin     |                   | Plugin polls, runs indexProject(), clears flag | Within 30s      |
| Dashboard→ | Reset request    | Dashboard writes `brain_reset_request=true`  | On button click |
| Plugin     |                   | Plugin polls, clears DB + session, clears flag | Within 30s      |

### Settings Propagation

Dashboard-persisted settings that override opencode.json at startup:

| Config Key                  | Maps To                         |
| --------------------------- | ------------------------------- |
| `selected_chat_model`       | config.lmStudio.chatModel       |
| `selected_embedding_model`  | config.lmStudio.preferredEmbedding |
| `selected_reranker_model`   | config.lmStudio.preferredReranker |
| `provider_mode`             | config.provider.mode            |

### Plugin Status Payload

The `brain_plugin_status` JSON blob contains:

```json
{
  "dense": { "state": "active", "model": "nomic-embed", "lastError": null },
  "reranker": { "intentsRequiringRerank": ["learn", "refactor", "feature"] },
  "tokenBudget": { "total": 24000, "used": 4200, "percent": 17.5, "reserved": 8192 },
  "decisionTree": { "totalNodes": 12, "intents": { "debug": 5, "refactor": 3 } },
  "sessionMemory": { "decisions": 8, "successes": 6, "failures": 2, "recentFiles": 4 },
  "loadedModels": ["nomic-embed", "qwen3.5-4b"],
  "lastUpdated": 1712345678901
}
```

---

## 9. Memory & Learning

### 9.1 Memory Graph (`memory/graph.ts`)

- K-means clustering of code chunks by embedding similarity
- **Full recompute** via `clusterConceptChunks()` — on-demand, splits a concept's chunks into sub-clusters
- **Mini-batch update** via `miniBatchUpdate()` — runs automatically every 30 minutes, incrementally adjusts centroids for recently active concepts
- Incremental tracking: concept visit counts and relationship strengths update in real-time
- SQLite-backed persistence of concepts and chunk links

### Ownership Boundaries

| Module        | Owns                    | Mechanism                                                                                                      |
| ------------- | ----------------------- | -------------------------------------------------------------------------------------------------------------- |
| `tuner.ts`    | Context budget tuning   | Monitors `context_efficiency`; reduces `max_context_tokens` if < 0.8. Contains absorbed eval scoring formulas. |
| `feedback.ts` | Retrieval weight tuning | Adjusts RRF alpha/beta per intent based on `tool.execute.after` signals.                                       |
| `tracer.ts`   | Internal analytics      | Read-only session metrics aggregator.                                                                          |

### 9.2 Tuner (`learn/tuner.ts`)

- Evaluates context efficiency: `used_chunks / retrieved_chunks`
- If efficiency < 0.8 across 3 consecutive sessions: reduces `max_context_tokens` by 20%
- Absorbs scoring formulas from the removed external eval system
- Tunes context budget, not retrieval weights (weight tuning is in `feedback.ts`)

### 9.3 Feedback (`learn/feedback.ts`)

- Collects `tool.execute.after` signals
- `autoTuneRRFParameters()` adjusts fusion weights per intent
- Marks chunks as helpful/unhelpful

### 9.4 Context Compression (`context/compression.ts`)

- **Token-based** compression using `estimateTokens()` (not character-based)
- Intent-aware token thresholds: debug/refactor/feature: 500 tokens, learn/quick_chat: 150 tokens
- Uses LM Studio to summarize when content exceeds threshold, with fallback to `content.slice(0, threshold)`
- Falls back to heuristic estimation if LM Studio unavailable

### 9.5 Reasoning Compressor (`context/reasoning-compressor.ts`)

- Extracts `<thought>...</thought>` tags from assistant messages
- Summarizes reasoning via LM Studio; injects `[Thought: ...]` summary
- Formerly named `breadcrumb.ts` (renamed because it's a thought summarizer, not a navigation trail)
- Actual navigation tracking (recent files, decisions) lives in `PlanState` / `state/session.ts`

---

## 10. Session Memory

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

The `chat.message` hook detects task completion keywords ("done", "completed", "fixed")
and appends a follow-up suggestion to continue the multi-step plan.

---

## 11. Internal Tracing

### Tracer (`learn/tracer.ts`)

Internal-only analytics aggregator (replaced the external eval bridge):

- `getTraceData()` — returns decision records with intent, strategy, context count
- `getTraceMetrics()` — aggregates: total decisions, success/failure rates, avg context chunks, intents distribution
- Reads from session memory and docs store — purely internal, no external dependencies
- Renamed from `eval/bridge.ts` to remove the "bridge" pattern

No external eval system. Scoring formulas for context_efficiency and token_economy
were absorbed into `learn/tuner.ts`. The separate eval plugin and Python framework
were removed.

---

## 12. File Structure

```
brain-plugin/
├── index.ts                    # Plugin re-exports
├── brain.ts                    # Hooks + tools + lifecycle + periodic tasks + dashboard bridge
├── package.json
├── provider/
│   └── lmstudio.ts             # @lmstudio/sdk wrapper
├── retrieval/
│   ├── searcher.ts             # Combined search (FTS5 + dense + fusion + rerank)
│   ├── indexer.ts              # Semantic chunking + FTS5 + embeddings
│   ├── dense.ts                # ONNX dense embeddings (xenova)
│   ├── fusion.ts               # Reciprocal-rank fusion
│   ├── keyword.ts              # FTS5 keyword search
│   ├── sparse.ts               # Pseudo-SPLADE (IDF-weighted sparse retrieval)
│   ├── reranker.ts             # ONNX cross-encoder (CPU, 'learn'/'refactor'/'feature')
│   └── cache.ts                # LRU embedding cache (500 entries)
├── orchestrator/
│   └── loop.ts                 # Prompt-based delegation simulation
├── context/
│   ├── injector.ts             # Prompt augmentation
│   ├── reasoning-compressor.ts # Thought tag summarizer (was breadcrumb.ts)
│   └── compression.ts          # Token-based truncation (500/150 tokens per intent)
├── store/                      # SQLite storage layer
├── memory/
│   └── graph.ts                # K-means memory graph (auto mini-batch every 30min)
├── learn/
│   ├── tuner.ts                # Context budget auto-tuning
│   ├── tracer.ts               # Internal session analytics
│   └── feedback.ts             # Success/failure tracking
├── state/
│   └── session.ts              # Session state management
├── tree/
│   └── engine.ts               # Intent decision tree
└── docs-store.ts               # In-memory doc cache (50-entry LRU)

brain-dashboard/                # Bun-based management UI (port 3456)
├── server.js                   # Express-like server with REST API endpoints
├── index.html                  # Single-page UI with tabs: Indexing, Models, Settings
├── model-catalog.json          # Available models for download (5 entries)
└── package.json
```

---

## 13. Usage & Commands

### Quick Start

- [ ] LM Studio running at `http://127.0.0.1:1234`
- [ ] Models loaded: qwen3.5-4b (chat), qwen3-0.6b-embed (embed)
- [ ] `"brain-plugin/brain.ts"` in opencode.json plugin array
- [ ] Run `brain_diagnostic` to verify
- [ ] Run `brain_index_project` to index
- [ ] Test: `brain_search "auth"`

### Dashboard

```bash
# Start dashboard server
bun run brain-dashboard/server.js

# Open in browser
start http://localhost:3456

# Dashboard has 4 tabs:
#  1. Indexing — project index stats, download pipeline progress
#  2. Models — catalog, download/prewarm/unload, LM Studio state
#  3. Settings — provider config, model selection, plugin runtime status, brain management
#  4. Diagnostics — health checks, logs, debug info
```

### Provider Mode Switching

```
# Agent can use:
brain_model_provider mode:"download_only"   # Block ONNX, LM Studio only
brain_model_provider mode:"onnx_local"      # Enable ONNX pipelines
brain_model_provider mode:"lmstudio"        # Hybrid (default)
```

### Model Management

```
brain_model_download modelId:"nomic-embed-text-v1.5"   # Queue download via dashboard
brain_model_load modelId:"qwen3.5-4b"                   # Prewarm in LM Studio
brain_model_unload target:"dense"                        # Unload ONNX dense only
brain_model_status                                       # Check all pipeline states
```

### Brain Lifecycle from Dashboard

```
# UI Buttons on Settings tab:
#   "Trigger Reindex" → writes brain_reindex_request flag → plugin reindexes within 30s
#   "Reset Brain"     → writes brain_reset_request flag → plugin resets within 30s
#   Plugin Status card → live runtime state refresh
```
