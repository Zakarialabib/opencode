# 🧠 Brain RAG System - Complete Overview

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [RAG Pipeline Flow](#rag-pipeline-flow)
3. [Model Configuration](#model-configuration)
4. [LM Studio Integration](#lm-studio-integration)
5. [Embedding Models](#embedding-models)
6. [Reranker](#reranker)
7. [Fusion Strategy](#fusion-strategy)
8. [Database Schema](#database-schema)
9. [Configuration Guide](#configuration-guide)
10. [Troubleshooting](#troubleshooting)

---

## Architecture Overview

The Brain plugin implements a **hybrid RAG (Retrieval-Augmented Generation)** system with three main components:

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

---

## RAG Pipeline Flow

### 1. **Query Processing**
```
User Query → Intent Classification → Adaptive Chunk Limit
```

### 2. **Parallel Retrieval**
```
Dense Search (Embeddings) ─┬─→ Reciprocal Rank Fusion ─→ Reranker ─→ Final Results
Keyword Search (FTS5)  ────┘
```

### 3. **Memory Boost**
```
Known Concepts → 15% Score Boost → Better Retrieval
```

### 4. **Reranking** (Optional)
```
Only for: learn, refactor, feature intents
Condition: ≥10 results AND confidence < 0.85
Output: Cross-encoder re-scored results
```

---

## Model Configuration

### Current Setup (From `opencode.json`)

```json
{
  "provider": {
    "lmstudio": {
      "options": {
        "baseURL": "http://192.168.1.12:1234/v1"
      },
      "models": {
        "gemma-4-e2b-it": { "tool_call": true, "reasoning": true },
        "gemma-4-e4b-it": { "tool_call": true, "reasoning": true },
        "qwen3.5-4b-claude-4.6-opus-reasoning-distilled-v2": { "tool_call": true, "reasoning": true }
      }
    }
  }
}
```

### Missing Models for RAG

The brain plugin requires these models for full RAG functionality:

| Model Type | Purpose | Default Name | Dimensions |
|------------|---------|--------------|------------|
| **Embedding** | Text → Vector | `nomic-embed-text-v1.5` | 768 |
| **Embedding (Alt)** | Text → Vector (CPU) | `Qwen/Qwen3-Embedding-0.6B` | 1024 |
| **Reranker** | Cross-encoder scoring | `Qwen/Qwen3-Reranker-0.6B` | N/A |

---

## LM Studio Integration

### Model Loading Order

The brain plugin loads models in this order:

```
1. Embedding Model (for indexing/retrieval) - HIGH PRIORITY
2. Reranker Model (on-demand) - MEDIUM PRIORITY  
3. Chat Model (for generation) - LOW PRIORITY (only when needed)
```

### How Brain Uses LM Studio

#### For Embeddings:
```typescript
// dense.ts - Embedding retrieval
const vectors = await provider.embed("nomic-embed-text-v1.5", texts);
// OR fallback to local ONNX if LM Studio fails
```

#### For Reranking:
```typescript
// reranker.ts - Cross-encoder scoring
const reranker = await provider.load("qwen3-reranker-0.6B");
// Used for high-quality re-ranking of results
```

### Automatic Loading Strategy

Brain tries to load models in this priority:

1. **Local ONNX (transformers.js)** - Free, CPU-based
2. **LM Studio Embedding** - Fast, GPU-accelerated
3. **Fallback to Keyword Only** - If both fail

---

## Embedding Models

### Option 1: LM Studio (Recommended)

Load in LM Studio:
- **Model ID**: `nomic-embed-text-v1.5`
- **Port**: `1234`
- **Context Length**: 8192

### Option 2: Local ONNX (No LM Studio needed)

Brain auto-downloads from Hugging Face:
- **Model**: `Qwen/Qwen3-Embedding-0.6B`
- **Location**: `project/.opencode/models/`
- **Device**: CPU (VRAM conserved)

### Embedding Dimensions

| Model | Dimensions | Use Case |
|-------|------------|----------|
| `nomic-embed-text-v1.5` | 768 | Primary (LM Studio) |
| `Qwen3-Embedding-0.6B` | 1024 | Fallback (Local) |

---

## Reranker

### Purpose
Cross-encoder that re-scores the top results using the full query-chunk context.

### Configuration
```typescript
// reranker.ts defaults
confidenceGate = 0.85      // Skip if top-3 scores > 85%
rerankMinResults = 10      // Only rerank if ≥10 results
rerankIntents = ["learn", "refactor", "feature"]  // Active intents
rerankerMaxChunks = 20     // Max chunks to rerank (CPU control)
```

### When Reranking Triggers
1. Intent is `learn`, `refactor`, or `feature`
2. At least 10 results available
3. Top-3 scores < 85% confidence

### Reranking Strategy by Intent

| Intent | Prioritize | Weight Adjustment |
|--------|------------|-------------------|
| `learn` | Documentation, comments | High weight on explanations |
| `refactor` | Functions, classes | High weight on patterns |
| `feature` | APIs, interfaces | High weight on implementations |
| `debug` | Error handling, tests | High weight on try/catch |
| `test` | Test files, assertions | High weight on test patterns |

---

## Fusion Strategy

### Reciprocal Rank Fusion (RRF)

```
RRF(d) = α × (1/(K + rank_dense)) + β × (1/(K + rank_keyword))
```

### Default Weights
- **α (Keyword/FTS5)**: 0.4
- **β (Dense/Embeddings)**: 0.4
- **K (Smoothing)**: 60

### Memory Boost
Known concepts get a **15% score boost** to improve session continuity.

---

## Database Schema

### Tables

```
files          - Indexed file metadata
chunks         - Code chunks with content
chunk_embeddings    - Qwen embeddings (1024d)
chunk_embeddings_nomic - Nomic embeddings (768d)
fts_chunks     - Full-text search index
concepts       - Learned concepts
concept_chunks - Concept-chunk mappings
sessions       - Session metrics
config         - RRF weights, thresholds
```

### Location
```
<project>/.opencode/brain.db
```

---

## Configuration Guide

### 1. LM Studio Setup

1. **Download LM Studio**: https://lmstudio.ai
2. **Download Models**:
   - Embedding: `nomic-embed-text-v1.5`
   - Reranker: `qwen3-reranker-0.6B` (if available)
   - Chat: Any model you prefer
3. **Configure Server**:
   - Enable "Local Server" in settings
   - Set port (default: 1234)
   - Enable CORS if needed

### 2. OpenCode Config Update

Add to `opencode.json`:

```json
{
  "provider": {
    "lmstudio": {
      "options": {
        "baseURL": "http://localhost:1234/v1"
      },
      "models": {
        "nomic-embed-text-v1.5": {
          "type": "embedding"
        },
        "qwen3-reranker-0.6b": {
          "type": "reranker"
        }
      }
    }
  }
}
```

### 3. Brain Reranking Config

```json
{
  "brain": {
    "reranking": {
      "enabled": true,
      "minResults": 10,
      "intents": ["learn", "refactor", "feature"],
      "confidenceThreshold": 0.7,
      "maxChunksBeforeRerank": 20,
      "adaptiveLimit": true
    }
  }
}
```

---

## Troubleshooting

### No Embeddings Generated

1. **Check LM Studio connection**:
   ```bash
   curl http://localhost:1234/v1/models
   ```

2. **Check local ONNX**:
   - Models should download to `.opencode/models/`

3. **Run diagnostic**:
   ```bash
   brain_diagnostic
   ```

### Poor Retrieval Quality

1. **Check indexing**:
   ```bash
   brain_status
   ```
   Ensure files/chunks > 0

2. **Re-index**:
   ```bash
   brain_index_project
   ```

3. **Adjust fusion weights**:
   - Increase `denseWeight` for semantic similarity
   - Increase `keywordWeight` for exact matches

### Reranking Not Working

1. **Check reranker model loaded**:
   ```bash
   brain_speculative_status
   ```

2. **Verify intent**:
   - Reranking only for: `learn`, `refactor`, `feature`

3. **Check confidence threshold**:
   - Increase `confidenceThreshold` if too strict

### Memory Issues

1. **Use Nomic instead of Qwen**:
   ```json
   {
     "embeddingModel": "nomic-embed-text-v1.5"
   }
   ```

2. **Reduce reranker max chunks**:
   ```json
   {
     "maxChunksBeforeRerank": 10
   }
   ```

---

## Performance Targets

| Metric | Target | Acceptable |
|--------|--------|------------|
| Embedding Latency | <100ms | <500ms |
| Search Latency | <200ms | <1s |
| Reranking Latency | <500ms | <2s |
| Indexing Speed | 100 files/s | 10 files/s |

---

## Quick Reference

### Brain Tools
```
brain_status          - Check brain health
brain_diagnostic      - Full system check
brain_search          - Semantic search
brain_embed_test      - Test embeddings
brain_index_project   - Re-index project
brain_config          - View/change config
brain_benchmark       - Run performance test
brain_metrics        - View performance metrics
```

### Configuration Keys
```
rrf_k                 - Fusion smoothing (default: 60)
rrf_dense_weight     - Dense weight (default: 0.5)
rrf_sparse_weight     - Sparse weight (default: 0.3)
rerank_top_k          - Reranker top-k (default: 20)
relevance_threshold   - Minimum score (default: 0.6)
```

---

## Summary

The Brain RAG system provides:

1. **Hybrid Retrieval** - Combines semantic (embeddings) + lexical (FTS5)
2. **Adaptive Chunking** - Adjusts chunk size based on intent
3. **Memory-Aware** - Boosts known concepts
4. **Smart Reranking** - Cross-encoder for high-quality results
5. **VRAM Conservation** - CPU fallback for embeddings/reranker

For best results:
- Load `nomic-embed-text-v1.5` in LM Studio
- Keep Qwen models as fallback
- Monitor with the Brain Dashboard
