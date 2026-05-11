# Brain Plugin — Complete Documentation

> Cognitive layer for OpenCode: auto-classifies developer intent, retrieves
> relevant codebase context via local embeddings, and augments LLM prompts
> with RAG — all running 100% locally through LM Studio.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [How the Brain Plugin Works](#2-how-the-brain-plugin-works)
3. [Embedding System](#3-embedding-system)
4. [Speculative Decoding](#4-speculative-decoding)
5. [Why & How to Improve](#5-why--how-to-improve)
6. [File Structure](#6-file-structure)
7. [Usage & Commands](#7-usage--commands)

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    OpenCode IDE                          │
│                                                         │
│  User types → message.updated hook fires                │
│                    │                                     │
│                    ▼                                     │
│  ┌───────────────────────────────────┐                  │
│  │         Decision Tree             │                  │
│  │  (classify intent + pick strategy)│                  │
│  └──────────┬────────────────────────┘                  │
│             │                                           │
│             ▼                                           │
│  ┌───────────────────────────────────┐                  │
│  │         Context Searcher          │                  │
│  │  (embed query → cosine search →   │                  │
│  │   optional rerank → top-K chunks) │                  │
│  └──────────┬────────────────────────┘                  │
│             │                                           │
│             ▼                                           │
│  ┌───────────────────────────────────┐                  │
│  │       Context Injector            │                  │
│  │  (prepend retrieved context to    │                  │
│  │   user message as code blocks)    │                  │
│  └──────────┬────────────────────────┘                  │
│             │                                           │
│             ▼                                           │
│  Augmented prompt sent to LM Studio for completion      │
│                                                         │
│  ┌───────────────────────────────────┐                  │
│  │       Session Memory              │                  │
│  │  (tracks decisions, files,        │                  │
│  │   diagnostics, successes/failures)│                  │
│  └───────────────────────────────────┘                  │
│                                                         │
│  Storage: JSON embedding files under C:/opencode/.indexes/│
│  Vector math: pure JS cosine similarity (no native deps)  │
└─────────────────────────────────────────────────────────┘
```

### Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| JSON file storage instead of LanceDB | LanceDB native module hangs on Windows; JSON is portable, debuggable, zero-dep |
| Pure JS cosine similarity | No numpy/tensorflow needed; runs anywhere Node runs |
| nomic-embed for indexing | ~24× faster than qwen3-embed (1s vs 39s per 32 texts), sufficient quality |
| Incremental + hash-based dedup | Skips unchanged files; removes repeated chunks; saves hours on re-index |
| Active-project-only indexing | Default indexes only the project you're working in; `--all` flag for full sweep |

---

## 2. How the Brain Plugin Works

### 2.1 Entry Point — `brain.ts`

The plugin registers OpenCode hooks and tools:

**Hooks (automatic, no user action needed):**

| Hook | What it does |
|------|-------------|
| `message.updated` | On every user message: classify intent → retrieve context → inject into prompt |
| `tool.execute.after` | Track edit/write success; mark bash failures |
| `lsp.client.diagnostics` | Store diagnostics; prewarm "debug" intent when errors detected |
| `file.watcher.updated` | Mark files as dirty so re-indexing picks them up |
| `session.compacting` | Summarize session memory; persist decision tree |

**Tools (user-invocable via chat):**

| Tool | Purpose |
|------|---------|
| `brain_index_project` | Index current or specified project (`--force` to re-index) |
| `brain_search` | Manual semantic search across the codebase |
| `brain_status` | Show decision tree stats, intent weights, session memory |
| `brain_reset` | Clear all memory and reset decision tree |

### 2.2 Decision Tree — `tree/engine.ts`

The decision tree classifies user intent into one of **7 categories**:

| Intent | Trigger Patterns | Retrieval Strategy | Depth | Chunks |
|--------|------------------|--------------------|-------|--------|
| `debug` | "error", "exception", "fail", "bug", "panic" | `diagnostic_targeted` | diagnostic | 10 |
| debug+stacktrace | stack trace patterns, `at file:line` | `stack_trace_precise` | precise | 5 |
| `refactor` | "refactor", "restructure", "extract", "rename" | `refactor_multi_file` | broad | 20 |
| refactor+single | "this function/class" + 1 recent file | `refactor_local` | shallow | 8 |
| `feature` | "add", "implement", "create", "support" | `feature_architecture` | broad | 15 |
| `test` | "test", "spec", "jest", "pytest" | `test_context` | targeted | 12 |
| `learn` | "how does", "explain", "architecture", "understand" | `learn_summarize` | broad | 25 |
| `quick_chat` | default / no specific intent | `direct` | none | 0 (skipped) |

**Scoring mechanism:** Each node computes `weight × log(visits + 2)`. The node with highest score wins. Weights are updated after each interaction — successful retrievals increase weight; failures decrease it and may spawn child nodes with refined conditions.

### 2.3 LM Studio Provider — `provider/lmstudio.ts`

Central wrapper around LM Studio REST API. Provides four operations:

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `load()` | `POST /api/v1/models/load` | Load model into GPU memory; set context_length, flash_attention, KV cache |
| `unload()` | `POST /api/v1/models/unload` | Free GPU memory |
| `embed()` | `POST /v1/embeddings` | Generate embedding vectors for text arrays |
| `chat()` | `POST /v1/chat/completions` | Standard chat completion |
| `chatWithSpeculative()` | `POST /v1/chat/completions` + `draft_model` | Speculative decoding (see §4) |

**Constants:**
- `DEFAULT_EMBED_MODEL = "text-embedding-nomic-embed-text-v1.5"` (768 dims, 84MB, fast)
- `DEFAULT_CHAT_MODEL = "qwen3.5-4b-claude-4.6-opus-reasoning-distilled-v2"`
- `DEFAULT_DRAFT_MODEL = "qwen3.5-0.8b-claude-4.6-opus-reasoning-distilled-v2"`

### 2.4 Context Searcher — `retrieval/searcher.ts`

Retrieves relevant code chunks given a user query:

1. **Embed query** using nomic-embed
2. **Query vector store** — cosine similarity search across all stored chunks
3. **Strategy-specific adjustments:**
   - `diagnostic`: filter to files with LSP errors, merge with symbol context
   - `precise`: extract `file:line` references from query, load exact code windows
   - `shallow/broad/targeted`: pure vector search with different chunk limits
4. **Rerank** (optional): embed top candidates + query again, compute cosine scores, sort

Depth strategies control retrieval breadth:

| Depth | When used | Max chunks | Rerank |
|-------|-----------|------------|--------|
| `none` | quick_chat | 0 | no |
| `shallow` | refactor single function | 8 | no |
| `targeted` | test, debug | 10–12 | no |
| `broad` | feature, learn, refactor multi-file | 15–25 | yes |
| `diagnostic` | error + LSP diagnostics | 10 | no |
| `precise` | stack trace references | 5 | yes |

### 2.5 Context Injector — `context/injector.ts`

Formats retrieved chunks into the LLM prompt:

```
You are working on a software development task. Relevant code context
has been retrieved from the codebase.

## Context 1: `src/auth/login.ts:15-45`
```typescript
// ... matching code chunk ...
```

## Context 2: `src/auth/utils.ts:1-30`
```typescript
// ... matching code chunk ...
```

---

User request: <original user message>

Analyze the context carefully before responding.
```

### 2.6 Session Memory — `state/session.ts`

Tracks conversation-level state:
- `decisions` — every intent classification + strategy + context count
- `successCount` — incremented on successful edit/write tool calls
- `failures` — bash errors, with reason and timestamp
- `recentFiles` — last 50 files touched
- `contextUsed` — which chunks were actually injected
- `diagnostics` — current LSP diagnostics (errors/warnings)

Memory is summarized and appended to the compacted session context on `session.compacting`.

---

## 3. Embedding System

### 3.1 Models Tested

| Model | Size | Dimensions | Load time | 32-text batch | Use case |
|-------|------|------------|-----------|---------------|----------|
| `text-embedding-nomic-embed-text-v1.5` | 84MB | 768 | 2.7s | **~1s** | Indexing, search ✅ |
| `qwen3-embedding-4b` | 2,458MB | 2560 | 9.0s | **~39s** | Quality tasks only |

**Verdict:** Use nomic-embed for everything. qwen3-embedding is 39× slower with no practical quality gain for code search.

### 3.2 Indexing Process

The indexer (`indexer.mjs`) processes each project:

1. **File discovery** — walk project directory, skip `node_modules`, `.git`, `vendor`, `dist`, `build`, `.next`, `__pycache__`
2. **File categorization** — assign chunking strategy by extension:

| Category | Extensions | Chunk size | Overlap |
|----------|-----------|------------|---------|
| code | `.ts`, `.tsx`, `.js`, `.jsx`, `.php`, `.java`, `.go`, `.rs`, `.py`, `.vue`, `.svelte`, `.c`, `.cpp`, `.h` | 30 lines | 8 lines |
| docs | `.md`, `.txt`, `.rst` | 60 lines | 15 lines |
| config | `.json`, `.yaml`, `.yml`, `.toml`, `.ini`, `.env.example` | 20 lines | 5 lines |
| sql | `.sql` | 25 lines | 8 lines |

3. **Hash-based change detection** — each file's `mtime + size` is hashed; unchanged files are skipped on incremental runs
4. **Chunk deduplication** — identical chunks (by content hash) are stored once, references merged
5. **Embedding** — batch size 16, sequential API calls with retry (4 attempts with backoff)
6. **Storage** — JSON file at `C:/opencode/.indexes/<project-id>/embeddings.json`
7. **State file** — `C:/opencode/.indexes/<project-id>/state.json` tracks file hashes, timestamp, model used

### 3.3 Incremental Indexing

Re-running `node indexer.mjs index` from a project directory:
- Reads the state file
- Compares every file's `mtime+size` hash
- Only re-embeds changed/new files
- Merges with existing embeddings
- Typical re-index time: **<5 seconds** for unchanged projects

### 3.4 Search

Search uses pure JS cosine similarity:
1. Embed the query string (same model as indexing)
2. Compute dot-product cosine similarity against every stored chunk vector
3. Sort by score, return top-K
4. Optional rerank: embed top candidates individually, rescore

**Performance:** Search over 12,000 chunks completes in **<1 second** including embedding the query.

---

## 4. Speculative Decoding

### 4.1 How It Works

Speculative decoding uses a smaller "draft" model to generate candidate tokens, then the larger "main" model validates them in a single forward pass. The LM Studio API exposes this via the `draft_model` parameter:

```json
POST /v1/chat/completions
{
  "model": "qwen3.5-4b",
  "draft_model": "qwen3.5-0.8b",
  "messages": [...],
  "max_tokens": 1024
}
```

### 4.2 Benchmark Results

**Previous benchmark (gemma-4-e4b + gemma-4-e2b-it):**
- Without speculative: baseline
- With speculative: **1.23× speedup**

**Qwen3.5 attempt (qwen3.5-4b + qwen3.5-0.8b):**
- ❌ **Incompatible** — the 0.8B draft model produces output that the 4B validator rejects. Returns 0 tokens or garbled text.
- This is a known limitation: speculative decoding requires draft and main models from the **same architecture family**. Qwen3.5 models of different sizes may not be compatible.

### 4.3 The `draft_model` Parameter

Key rules:
1. Both models must be loaded in LM Studio before sending the request
2. The draft model should be the same family as the main model (e.g., Qwen3-4B draft for Qwen3-4B main)
3. Gemma-4-e2b-it is compatible as draft for gemma-4-e4b-it
4. The speedup scales with how much faster the draft model generates vs the main model accepts

### 4.4 Current Status

The `brain-plugin/provider/lmstudio.ts` has `chatWithSpeculative()` fully implemented. The `DEFAULT_DRAFT_MODEL` is set to `"qwen3.5-0.8b-claude-4.6-opus-reasoning-distilled-v2"` but is currently **incompatible**. When compatible draft models become available (or gemma is re-added), speculative decoding will work automatically.

**To fix speculative:** Use matching model pairs from the same architecture:
- `gemma-4-e4b-it` (main) + `gemma-4-e2b-it` (draft) — confirmed working, 1.23× speedup
- Wait for LM Studio to ship compatible qwen3.5 draft/main pairs

---

## 5. Why & How to Improve

### 5.1 Current Bottlenecks

| Bottleneck | Current | Target | Fix |
|-----------|---------|--------|-----|
| Full indexing (all projects) | ~22 min | N/A | Index only active project |
| Incremental re-index | ~22 min | <5 min | ✅ Hash-based change detection → seconds |
| Embedding batch size | 16/chunk | 32/chunk | Increase if GPU memory allows |
| Storage format | JSON (plain) | Binary/compressed | Use msgpack or flatbuffer |
| Search algorithm | O(n) linear scan | O(log n) ANN | Add HNSW index later |
| Vector dimension | 768 (nomic) | 768 is fine | No change needed |

### 5.2 Faster Embedding Alternatives

| Approach | Speedup | Quality | Effort |
|----------|---------|---------|--------|
| **ONNX INT8 quantization** of nomic-embed | 2–4× faster | Slight degradation | Medium — need onnxruntime-node |
| **nomic-embed-v1.5-small** (if available) | 2× faster | Slight degradation | Low — just change model name |
| **BGE-M3** (alternative model) | Comparable to nomic | Better for cross-lingual | Low — change model name in LM Studio |
| **E5-Mistral-7B-instruct** embeddings | Much faster on GPU | Excellent quality | Low — if LM Studio loads it |
| **Sentence-transformers + ONNX** | 5–10× on CPU | Excellent for short text | High — needs custom runtime |
| **GPU-accelerated batch inference** | 3–5× | None | Medium — batching in LM Studio |

### 5.3 Faster Search Alternatives

| Approach | Speedup | Quality | Notes |
|----------|---------|---------|-------|
| **HNSW index** (via lancedb) | 10–100× | Approximate (95%+) | Only if LanceDB works or custom HNSW impl |
| **VAFFT/SIMD** cosine sim | 2–4× | Exact | Use simd.js or wasm |
| **Quantized vectors (int8)** | 2× memory, faster dot | Slight degradation | Store as int8, accumulate in int32 |
| **Clustering + pruning** | 3–5× | Approximate | Cluster embeddings, only search matching cluster |

### 5.4 Practical Short-Term Improvements

1. **Increase batch size to 32** — `embedBatchSequential` → change `BATCH = 32`
2. **Parallelize embedding + saving** — overlap I/O with computation
3. **Cache search results** — save query→results map, invalidate on re-index
4. **Skip re-embedding on search** — store vectors, compute query vector once
5. **Use `qwen3.embedding.0.6b`** if available — middle ground between nomic (768d) and 4B (2560d)

### 5.5 Long-Term Roadmap

| Priority | Feature | Impact |
|----------|---------|--------|
| P0 | Fix LanceDB or use HNSW library | Search speed 10–100× faster |
| P0 | ONNX int8 embedding runtime | Embedding 2–4× faster |
| P1 | Compatible draft model for speculative | Chat 1.2–1.5× faster |
| P1 | Per-file change tracking (not just mtime) | Incremental indexing more accurate |
| P2 | Vector quantization (int8/fp4) | 2–4× memory reduction, faster search |
| P2 | Streaming embeddings from LM Studio | Reduce API roundtrips |
| P3 | Multi-index merging | Cross-project search without full re-index |
| P3 | Adaptive chunk sizing | Larger chunks for docs, smaller for code |

---

## 6. File Structure

```
c:\opencode\
├── indexer.mjs                          # Standalone CLI indexer tool
│
└── brain-plugin/
    ├── index.ts                         # Plugin entry point
    ├── brain.ts                         # Main plugin: hooks + tools + orchestration
    ├── package.json                     # Dependencies: @lancedb/lancedb, glob
    │
    ├── provider/
    │   └── lmstudio.ts                  # LM Studio API wrapper (load/unload/embed/chat)
    │
    ├── retrieval/
    │   ├── indexer.ts                   # File discovery, chunking, embedding
    │   ├── searcher.ts                  # Vector search, reranking, depth strategies
    │   └── lancadb.ts                   # LanceDB client (vector storage/retrieval)
    │
    ├── context/
    │   └── injector.ts                  # Prompt augmentation with retrieved context
    │
    ├── state/
    │   └── session.ts                   # Session memory: decisions, files, diagnostics
    │
    └── tree/
        └── engine.ts                    # Decision tree: intent classification + strategy selection
```

**Index storage:**
```
c:\opencode\.indexes\
├── simple-signage/
│   ├── embeddings.json                 # All chunk embeddings (versioned JSON)
│   └── state.json                      # File hashes, timestamps, model info
├── camcontrol/
│   ├── embeddings.json
│   └── state.json
└── mystockmaster/
    ├── embeddings.json
    └── state.json
```

---

## 7. Usage & Commands

### Indexer CLI

```bash
# Index active project (auto-detected from current directory)
node indexer.mjs index

# Force re-index active project
node indexer.mjs index --force

# Index ALL projects
node indexer.mjs index --all

# Index specific project
node indexer.mjs index-specific Simple-Signage

# Search all indexed projects
node indexer.mjs search "authentication middleware"

# Search specific project
node indexer.mjs search-specific Simple-Signage "login validation"

# Run benchmarks (embedding speed + speculative decoding)
node indexer.mjs benchmark

# Show indexing status
node indexer.mjs status
```

### Brain Plugin (via OpenCode)

| Trigger | Action |
|---------|--------|
| User asks "how does the auth system work?" | → learn intent → broad search → 25 chunks injected |
| User asks "fix this error" with stack trace | → debug+stacktrace intent → precise search → 5 chunks |
| User asks "write tests for auth" | → test intent → targeted search → 12 chunks |
| User asks "refactor this" in single file | → refactor+single intent → shallow search → 8 chunks |
| User asks general chat | → quick_chat intent → no retrieval → direct response |

### Quick Start Checklist

- [ ] LM Studio running at `http://192.168.1.12:1234`
- [ ] `text-embedding-nomic-embed-text-v1.5` available in LM Studio
- [ ] `qwen3.5-4b-claude-4.6-opus-reasoning-distilled-v2` available in LM Studio
- [ ] `opencode.json` configured with brain-plugin
- [ ] Run: `cd /opencode && node indexer.mjs index` from project directory
- [ ] Verify: `node indexer.mjs search "any code concept"` returns results
- [ ] Test in OpenCode: ask a coding question referencing your project

### Recommended Settings

```
# For balanced quality + speed (RECOMMENDED)
- Embed model: nomic-embed-text-v1.5
- Chat model: qwen3.5-4b
- Draft model: (None for now — incompatible with qwen3.5)
- Batch size: 16
- Chunk size: 30 (code), 60 (docs)

# For maximum quality (slower)
- Embed model: qwen3-embedding-4b
- Chat model: qwen3.5-4b
- Chunk size: 40 (all types)
- Expected indexing time: 20-40 minutes

# For maximum speed (lower quality)
- Embed model: nomic-embed-text-v1.5
- Chat model: qwen3.5-0.8b
- Smaller chunks, fewer retrieved results
```

---

## Appendix: Complete Benchmark Results

```
=== EMBEDDING BENCHMARK ===
nomic-embed (84MB, 768d):   1.0s avg (load 2.7s)   ← USE THIS
qwen3-embed (2458MB, 2560d): 38.9s avg (load 9.0s)
Speed ratio: nomic ~39× faster

=== SPECULATIVE DECODING ===
qwen3.5-4B + qwen3.5-0.8B: INCOMPATIBLE ❌
gemma-4-e4B + gemma-4-e2B:  ~1.23× speedup ✅

=== INDEXING PERFORMANCE ===
Simple-Signage: 12,884 chunks → 12,346 unique, ~22 min (full)
CamControl: 7,505 chunks (pending)
myStockMaster: (pending)
Incremental re-index: seconds (not yet measured, expected <5 min)
```