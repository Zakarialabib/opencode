# Brain Plugin — Complete Documentation

> Cognitive layer for OpenCode: auto-classifies developer intent, retrieves
> relevant codebase context via local embeddings, and augments LLM prompts
> with RAG — all running 100% locally through LM Studio and Rust sidecar.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [How the Brain Plugin Works](#2-how-the-brain-plugin-works)
3. [Lifecycle & Orchestration](#3-lifecycle--orchestration)
4. [Tool Reference](#4-tool-reference)
5. [Embedding System](#5-embedding-system)
6. [Speculative Decoding](#6-speculative-decoding)
7. [Model Loading Strategy](#7-model-loading-strategy)
8. [Why & How to Improve](#8-why--how-to-improve)
9. [File Structure](#9-file-structure)
10. [Usage & Commands](#10-usage--commands)

---

## 1. Architecture Overview

```
User types → message.updated hook
  → Decision Tree (classify intent)
  → Model Prewarmer (pre-load embed)
  → Context Searcher (HTTP → Rust sidecar → LM Studio embed → HNSW search)
  → Context Injector (prepend chunks to prompt)
  → Augmented prompt sent to LLM

Rust sidecar (:7878):
  ├── /health /metrics /config /models /gpu
  ├── /index (Tree-sitter chunk → embed → HNSW store)
  ├── /search (vector + BM25 hybrid)
  ├── /chat (speculative decoding)
  ├── /cache/stats /cache/invalidate
  └── /prewarm

Brain plugin hooks:
  - server.start: spawn sidecar, health check, auto-index
  - message.updated: RAG pipeline
  - chat.params: inject draft_model
  - file.watcher.updated: dirty tracking → debounced reindex
  - session.archived: kill sidecar
```

### Key Design Decisions

| Decision              | Rationale                                                        |
| --------------------- | ---------------------------------------------------------------- |
| Rust sidecar not JS   | Faster vector ops, Tree-sitter parsing; no Node.js memory limits |
| HTTP API separation   | Independent scaling, testing, deployment                         |
| HNSW vector storage   | Fast approximate nearest neighbor; in-memory with persistence    |
| Tree-sitter chunking  | AST-aware code splits; preserves semantics                       |
| LM Studio integration | 100% local; no cloud dependencies                                |
| Serial model loading  | ~4GB VRAM (M4400) can't hold all 3 models simultaneously         |

---

## 2. How the Brain Plugin Works

### 2.1 Entry Point — `brain.ts`

**Hooks (automatic):**

| Hook                     | What it does                                                            |
| ------------------------ | ----------------------------------------------------------------------- |
| `server.start`           | Spawn Rust sidecar (WSL), 30s health-check, sync config, auto-index     |
| `message.updated`        | Classify intent → prewarm embed → retrieve context → inject into prompt |
| `chat.params`            | Inject `draft_model` into LM Studio calls when speculative enabled      |
| `tool.execute.after`     | Track success/failure                                                   |
| `lsp.client.diagnostics` | Store diagnostics; prewarm "debug" intent                               |
| `file.watcher.updated`   | Mark dirty; batch 5 → 5s debounce → reindex                             |
| `session.compacting`     | Summarize memory; persist decision tree                                 |
| `session.archived`       | Kill sidecar                                                            |

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

### 2.3 Rust Sidecar Endpoints

| Endpoint            | Method   | Purpose                                |
| ------------------- | -------- | -------------------------------------- |
| `/health`           | GET      | Version, uptime, loaded models, GPU    |
| `/metrics`          | GET      | Searches, cache stats, prewarm count   |
| `/config`           | GET/POST | Full configuration                     |
| `/models`           | GET      | LM Studio model list                   |
| `/gpu`              | GET      | GPU memory info                        |
| `/index`            | POST     | Tree-sitter chunk → embed → HNSW store |
| `/search`           | POST     | Vector + BM25 hybrid search            |
| `/embed`            | POST     | Raw embeddings                         |
| `/chat`             | POST     | Chat with speculative decoding         |
| `/cache/stats`      | GET      | Cache hit/miss rates                   |
| `/cache/invalidate` | POST     | Clear cache                            |
| `/feedback`         | POST     | Token attribution                      |
| `/prewarm`          | POST     | Pre-warm embed model                   |

---

## 3. Lifecycle & Orchestration

### 3.1 Startup

```
server.start:
1. Load decision tree
2. Check /health (already running?)
3. If not: spawn wsl.exe → brain-embed
4. Poll /health every 1s (max 30s)
5. POST /config (sync models)
6. POST /index (auto-index current directory)
```

### 3.2 File Change → Reindex

```
file.watcher.updated:
  → add to dirtyFiles Set
  → if ≥5 dirty && not indexing:
    → 5s debounce
    → POST /index force
    → clear dirtyFiles
```

### 3.3 Session Teardown

```
session.archived:
  → SIGTERM sidecar
  → save decision tree
  → clear memory
```

---

## 4. Tool Reference

### Diagnostic & Status

| Tool                       | Purpose                                                   |
| -------------------------- | --------------------------------------------------------- |
| `brain_diagnostic`         | Full pipeline: health → cache → search test → config      |
| `brain_status`             | Sidecar health, GPU, models, cache, decision tree, memory |
| `brain_metrics`            | Prometheus metrics: searches, hit rate, prewarm count     |
| `brain_sidecar_status`     | Detailed health: version, uptime, GPU, all 3 models       |
| `brain_speculative_status` | Speculative decoding config                               |

### RAG & Search

| Tool                  | Purpose                                   |
| --------------------- | ----------------------------------------- |
| `brain_search`        | Semantic search (Rust /search)            |
| `brain_embed_test`    | Test query → top-K chunks with scores     |
| `brain_index_project` | Index/re-index (Rust /index, Tree-sitter) |

### Model Management

| Tool                 | Purpose                              |
| -------------------- | ------------------------------------ |
| `brain_model_load`   | Prewarm a model (chat, embed, draft) |
| `brain_model_unload` | Free VRAM by unloading               |

### Lifecycle

| Tool                    | Purpose                              |
| ----------------------- | ------------------------------------ |
| `brain_sidecar_restart` | Kill and restart sidecar             |
| `brain_reset`           | Clear memory and reset decision tree |

---

## 5. Embedding System

### Models

| Model                | Size    | Dims | Speed       | Use              |
| -------------------- | ------- | ---- | ----------- | ---------------- |
| nomic-embed-v1.5     | 84MB    | 768  | ~1s/batch   | Indexing, search |
| qwen3-embedding-0.6b | 320MB   | 1024 | ~359ms/4emb | Indexing, search |
| qwen3-embedding-4b   | 2,458MB | 2560 | ~39s/batch  | Quality only     |

### Indexing

1. `.gitignore`-aware file walk
2. Tree-sitter AST chunking (8 languages)
3. Blake3 hash → skip unchanged files
4. Batch embed via LM Studio (batch 32)
5. Store in HNSW index (binary, cosine similarity)

### Search

- Embed query → HNSW top-K → BM25 fusion (optional) → LRU cache
- Speed: <1ms per query

---

## 6. Speculative Decoding

### Wiring

The `chat.params` hook in `brain.ts` injects `draft_model` into LM Studio calls:

```typescript
"chat.params": async (params: any) => {
  if (!sidecar.healthy) return params;
  const cfg = await fetchConfig();
  if (cfg?.speculative_enabled && cfg?.draft_model) {
    params.draft_model = cfg.draft_model;
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

## 7. Model Loading Strategy

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

## 8. Why & How to Improve

### Status

| Bottleneck        | Status                       |
| ----------------- | ---------------------------- |
| Incremental index | ✅ Hash-based, seconds       |
| Embedding batch   | ✅ 32                        |
| Search            | ✅ HNSW O(log n)             |
| VRAM              | ⚠️ Serial loading (hardware) |
| Speculative       | ⚠️ Draft pair compatibility  |

### Roadmap

| Pri | Feature               | Impact              |
| --- | --------------------- | ------------------- |
| P0  | ONNX int8 embedding   | 2-4x faster         |
| P1  | Compatible draft pair | 1.2-1.5x faster     |
| P1  | Vector quantization   | 2x memory reduction |

---

## 9. File Structure

```
brain-plugin/
├── index.ts              # Plugin entry
├── brain.ts              # Hooks + tools + lifecycle
├── package.json
├── provider/lmstudio.ts  # LM Studio wrapper
├── retrieval/
│   ├── searcher.ts       # HTTP /search client
│   ├── indexer.ts        # HTTP /index client
│   └── lancadb.ts        # [DEPRECATED]
├── context/injector.ts   # Prompt augmentation
├── state/session.ts      # Session memory
└── tree/engine.ts        # Decision tree

brain-plugin/rust/
├── Cargo.toml
└── src/
    ├── main.rs           # Server (15 endpoints)
    ├── lmstudio.rs       # LM Studio client
    ├── chunk.rs          # Tree-sitter chunking
    ├── indexer.rs        # File indexing
    ├── store_hnsw.rs     # HNSV vectors
    ├── bm25.rs           # BM25 search
    ├── cache.rs          # LRU cache
    ├── state.rs          # Index state
    ├── config.rs         # App config
    ├── orchestrator.rs   # Intent prediction
    ├── multihop.rs       # Import-following retrieval
    ├── feedback.rs       # Token attribution
    └── project_memory.rs # Cross-session memory
```

---

## 10. Usage & Commands

### Build

```bash
wsl -d Ubuntu bash -c ". /root/.cargo/env && cd /mnt/c/rust-brain-sidecar && cargo build --release"
```

### Run

Auto-started by brain plugin. Manual:

```bash
wsl -d Ubuntu bash -c "RUST_LOG=info /mnt/c/rust-brain-sidecar/target/release/brain-embed"
```

### Quick Start

- [ ] LM Studio running at `http://192.168.1.12:1234`
- [ ] 3 models loaded: qwen3.5-4b, qwen3.5-0.8b, qwen3-0.6b-embed
- [ ] Rust sidecar built in WSL
- [ ] `"brain-plugin/brain.ts"` in opencode.json plugin array
- [ ] Run `brain_diagnostic` to verify
- [ ] Run `brain_index_project` to index
- [ ] Test: `brain_search "auth"`
