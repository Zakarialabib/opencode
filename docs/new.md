Based on my research of the OpenCode ecosystem [^11^1^][^11^2^] and your project docs, here is the **complete enhancement plan** for your brain plugin. This goes beyond what you have and addresses the real gaps in orchestration, quality, and developer experience.

---

## The 4 Pillars of Enhancement

| Pillar | What It Means | Current State | Target |
|---|---|---|---|
| **Orchestration** | When to load what, how to parallelize, when to fallback | Basic model swap via v1 API | Predictive pre-warming, adaptive concurrency, multi-provider |
| **Quality** | Is the retrieved context actually helping? | Blind injection | Relevance feedback, A/B testing, token attribution |
| **Memory** | What persists across sessions | Per-session JSON | Long-term project memory, cross-session learning |
| **Ergonomics** | How the developer experiences it | Manual tools, no visibility | Auto-triggered, transparent, observable |

---

## Phase 0: Critical Fixes (Do This Week)

### 0.1 Windows Build — Three Options

| Option | Effort | Result |
|---|---|---|
| **A. WSL2** | 30 min | Run `cargo build` inside WSL2, copy binary to Windows. LM Studio on Windows talks to Rust sidecar on WSL2 via `localhost`. |
| **B. Cross-compile from Linux CI** | 2 hours | GitHub Actions builds `x86_64-pc-windows-gnu` target, releases `.exe` |
| **C. Strip dependencies** | 1 day | Remove `tree-sitter-*` crates, use regex-based chunking as fallback. Smaller binary, faster compile. |

**Recommended:** Option A for immediate relief, Option B for distribution.

### 0.2 Incremental Indexing

Your docs say "not yet implemented." This is the #1 user pain point.

**`src/indexer.rs` — Add state tracking:**
```rust
use blake3::Hash;
use serde::{Serialize, Deserialize};
use std::collections::HashMap;

#[derive(Serialize, Deserialize)]
struct IndexState {
    version: u32,
    last_run: u64,          // epoch ms
    file_hashes: HashMap<String, Hash>,  // path → blake3(content)
    chunk_count: usize,
}

impl IndexState {
    fn is_fresh(&self, path: &str, mtime: u64, content: &str) -> bool {
        let hash = blake3::hash(content.as_bytes());
        match self.file_hashes.get(path) {
            Some(old) => *old == hash,
            None => false,
        }
    }
}
```

**Flow:**
1. Load `state.json` from `~/.brain/<project-id>/`
2. Walk files with `ignore` crate (respects `.gitignore`)
3. For each file: check `mtime` → if changed, compute `blake3` → if hash differs, re-chunk + re-embed
4. Merge new chunks into existing HNSW index (don't rebuild from scratch)
5. Save updated state

**Expected result:** Re-index drops from 22 min → **<5 seconds** for unchanged projects.

### 0.3 Query Result Cache

```rust
use std::sync::Arc;
use tokio::sync::RwLock;
use lru::LruCache;

struct QueryCache {
    cache: Arc<RwLock<LruCache<String, Vec<SearchResult>>>>,
}

impl QueryCache {
    async fn get(&self, query: &str) -> Option<Vec<SearchResult>> {
        let cache = self.cache.read().await;
        cache.get(query).cloned()
    }
    
    async fn put(&self, query: String, results: Vec<SearchResult>) {
        let mut cache = self.cache.write().await;
        cache.put(query, results);
    }
}
```

Invalidate on file watcher events. Cache hit rate should be **60–80%** for repetitive queries.

---

## Phase 1: Orchestration Intelligence (Next 2 Weeks)

### 1.1 Predictive Model Pre-warming

Currently you load the embed model **after** classifying intent. The user waits 2–3 seconds.

**Better:** Use `lsp.client.diagnostics` + `file.watcher.updated` to predict intent:

```typescript
// brain.ts — predictive pre-warming
"lsp.client.diagnostics": async (input, output) => {
  const errors = input.diagnostics.filter(d => d.severity === "error");
  if (errors.length > 0) {
    // User is about to ask about errors. Pre-warm embed model.
    await rustSidecar.prewarm("embed");
    memory.predictedIntent = "debug";
  }
}
```

The Rust sidecar loads the model in background. When the user types "fix this," the model is already warm.

### 1.2 Adaptive Concurrency Based on GPU Memory

```rust
// lmstudio.rs — query GPU memory before deciding concurrency
pub async fn get_gpu_memory(&self) -> anyhow::Result<u64> {
    // LM Studio doesn't expose this directly, but we can infer from model load response
    // Or: use nvidia-smi via shell if local
    let output = tokio::process::Command::new("nvidia-smi")
        .args(&["--query-gpu=memory.free", "--format=csv,noheader,nounits"])
        .output()
        .await?;
    let free_mb = String::from_utf8(output.stdout)?.trim().parse::<u64>()?;
    Ok(free_mb * 1024 * 1024) // bytes
}

pub fn optimal_concurrency(free_vram: u64, model_size: u64) -> usize {
    // Leave 20% headroom
    let usable = (free_vram as f64 * 0.8) as u64;
    let slots = usable / model_size;
    slots.min(8).max(1) as usize
}
```

### 1.3 Multi-Provider Abstraction

Your current `lmstudio.rs` is hardcoded. Abstract it:

```rust
pub trait EmbedProvider: Send + Sync {
    async fn embed(&self, texts: &[String]) -> anyhow::Result<Vec<Vec<f32>>>;
    async fn load(&self, model: &str) -> anyhow::Result<ModelHandle>;
    async fn unload(&self, handle: ModelHandle) -> anyhow::Result<()>;
}

pub struct LMStudioProvider { base_url: String }
pub struct OllamaProvider { base_url: String }
pub struct VLLMProvider { base_url: String }

// Factory
pub fn create_provider(config: &ProviderConfig) -> Box<dyn EmbedProvider> {
    match config.kind {
        ProviderKind::LMStudio => Box::new(LMStudioProvider::new(config.url)),
        ProviderKind::Ollama => Box::new(OllamaProvider::new(config.url)),
        ProviderKind::VLLM => Box::new(VLLMProvider::new(config.url)),
    }
}
```

This lets users with Ollama or vLLM use your plugin without LM Studio.

---

## Phase 2: Advanced RAG (Next 2–3 Weeks)

### 2.1 Hybrid Search: Vector + BM25

Pure vector search misses exact keyword matches (e.g., function names). Add a lightweight inverted index:

```rust
use tantivy::{Index, Schema, Document, Term};
use tantivy::schema::{TEXT, STORED};

pub struct HybridSearcher {
    hnsw: HnswStore,
    tantivy: Index,
}

impl HybridSearcher {
    pub async fn search(&self, query: &str, query_vec: &[f32], top_k: usize) -> Vec<SearchResult> {
        // 1. Vector search
        let vector_results = self.hnsw.search(query_vec, top_k);
        
        // 2. Keyword search
        let keyword_results = self.tantivy_search(query, top_k);
        
        // 3. Reciprocal Rank Fusion (RRF)
        let fused = reciprocal_rank_fusion(vector_results, keyword_results, k: 60);
        fused.into_iter().take(top_k).collect()
    }
}
```

`tantivy` is pure Rust, no extra dependencies. RRF formula: `score = Σ 1/(k + rank)` for each result's rank in each list.

### 2.2 Query Expansion with Interrogator

You have the 0.8B interrogator model. Use it:

```rust
pub async fn expand_query(&self, raw: &str) -> anyhow::Result<String> {
    let handle = self.load("catlilface/Qwen3.5-0.8B-interrogator-GGUF").await?;
    
    let expanded = self.chat(&handle, &[
        ("system", "You are a code search assistant. Expand the user's query into specific technical keywords."),
        ("user", &format!("Query: {}\n\nExpanded search terms:", raw))
    ], max_tokens: 64).await?;
    
    self.unload(handle).await?;
    Ok(expanded)
}
```

**When to expand:** `shouldExpandQuery()` from your decision tree — short queries (< 5 words) or no code symbols detected.

### 2.3 Multi-Hop Retrieval (Follow Dependencies)

For "how does auth work?", find `auth.ts` → extract imports → search those too:

```rust
pub async fn multi_hop_search(&self, query: &str, hops: usize) -> Vec<SearchResult> {
    let mut all_results = vec![];
    let mut frontier = vec![query.to_string()];
    
    for hop in 0..hops {
        let mut next_frontier = vec![];
        for q in frontier {
            let results = self.hybrid_search(&q, &self.embed(&[&q]).await?[0], top_k: 5).await;
            for r in &results {
                // Extract imports from the chunk
                let imports = extract_imports(&r.text);
                next_frontier.extend(imports);
                all_results.push(r.clone());
            }
        }
        frontier = next_frontier;
    }
    
    // Deduplicate by path
    all_results.sort_by_key(|r| r.path.clone());
    all_results.dedup_by_key(|r| r.path.clone());
    all_results
}
```

**When to use:** `feature` and `learn` intents with broad depth.

---

## Phase 3: Quality & Feedback Loop (Critical for Learning)

### 3.1 Token Attribution — Did the LLM Use Our Context?

OpenCode's `message.updated` hook lets you inject context. But did the LLM actually reference it?

**Heuristic:** After the LLM responds, scan its output for:
- File paths from injected chunks
- Function names from injected chunks
- Similar code patterns

```typescript
// brain.ts — feedback loop
"message.updated": async (input, output) => {
    // ... inject context as before ...
    
    // Store what we injected for later attribution
    memory.lastInjectedChunks = context.chunks;
}

// NEW HOOK: After LLM responds
"message.part.updated": async (input, output) => {
    const response = input.part.content;
    const usedChunks = memory.lastInjectedChunks.filter(chunk => 
        response.includes(chunk.path) || 
        response.includes(extract_function_name(chunk.text))
    );
    
    // Record feedback
    tree.recordFeedback({
        intent: memory.lastIntent,
        strategy: memory.lastStrategy,
        chunksInjected: memory.lastInjectedChunks.length,
        chunksUsed: usedChunks.length,
        responseLength: response.length
    });
}
```

### 3.2 Decision Tree Growth

Currently your tree updates weights. Make it smarter:

```rust
pub struct DecisionTree {
    root: ScenarioNode,
    feedback_log: Vec<FeedbackRecord>,
}

impl DecisionTree {
    pub fn grow(&mut self, feedback: FeedbackRecord) {
        let node = self.find_node(&feedback.intent, &feedback.strategy);
        
        if feedback.chunks_used == 0 && feedback.chunks_injected > 0 {
            // Total miss: context was irrelevant
            node.weight *= 0.7;
            
            // Spawn child with stricter condition
            if node.children.len() < 3 {
                let child = ScenarioNode {
                    condition: refine_condition(&node.condition, feedback),
                    weight: 0.5,
                    visits: 1,
                    strategy: Strategy {
                        depth: go_deeper(&node.strategy.depth),
                        ..node.strategy.clone()
                    },
                    ..Default::default()
                };
                node.children.push(child);
            }
        } else if feedback.chunks_used >= feedback.chunks_injected / 2 {
            // Good hit: context was useful
            node.weight = (node.weight * (node.visits as f64) + 1.0) / ((node.visits + 1) as f64);
        }
        
        node.visits += 1;
    }
}
```

### 3.3 A/B Testing for Strategies

Run two strategies in parallel, compare:

```rust
pub async fn ab_test_search(&self, query: &str, strategy_a: Strategy, strategy_b: Strategy) -> (Vec<SearchResult>, Vec<SearchResult>) {
    let (a, b) = tokio::join!(
        self.search_with_strategy(query, strategy_a),
        self.search_with_strategy(query, strategy_b)
    );
    (a, b)
}
```

Store both results. After the LLM responds, the user (or a heuristic) picks which context was better. Update tree weights accordingly.

---

## Phase 4: Cross-Session Memory (The Real Brain)

This is where your plugin becomes truly unique. OpenCode sessions are stateless by default [^11^8^]. Your plugin can fix that.

### 4.1 Project Memory Bank

```rust
#[derive(Serialize, Deserialize)]
struct ProjectMemory {
    project_id: String,
    conventions: Vec<String>,      // "We use kebab-case for files"
    decisions: Vec<Decision>,      // "Chose X over Y because Z"
    common_queries: LruCache<String, Vec<SearchResult>>,  // Frequently asked
    last_session_summary: String,
}

impl ProjectMemory {
    async fn load(project_id: &str) -> anyhow::Result<Self> {
        let path = dirs::config_dir()
            .unwrap()
            .join("opencode")
            .join("brain-memory")
            .join(format!("{}.json", project_id));
        let content = tokio::fs::read_to_string(path).await?;
        Ok(serde_json::from_str(&content)?)
    }
}
```

### 4.2 Session Start Hook — Inject Memory

```typescript
// brain.ts — session start
"session.created": async (input, output) => {
    const memory = await rustSidecar.loadProjectMemory(project.id);
    
    // Inject into system prompt
    output.additionalContext = `
## Project Memory (from previous sessions)
${memory.conventions.map(c => `- ${c}`).join('\n')}

## Recent Decisions
${memory.decisions.slice(-5).map(d => `- ${d.summary}`).join('\n')}

## Current Status
${memory.last_session_summary}
`;
}
```

### 4.3 Session End — Persist Memory

```typescript
"session.idle": async (input, output) => {
    const summary = await client.chat({
        model: "qwen3.5-4b",
        messages: [
            { role: "system", content: "Summarize this session in 3 bullet points: what was done, what was decided, what's next." },
            { role: "user", content: JSON.stringify(memory.decisions) }
        ]
    });
    
    await rustSidecar.saveProjectMemory({
        project_id: project.id,
        last_session_summary: summary,
        conventions: extract_conventions(summary),
        decisions: memory.decisions
    });
}
```

This is inspired by `@vectorize-io/opencode-hindsight` [^11^8^], but entirely local via your Rust sidecar.

---

## Phase 5: Observable & Debuggable

### 5.1 Decision Log UI

Add a tool that dumps the brain's internal state:

```typescript
tool: {
    brain_debug: tool({
        description: "Show the brain's decision log for this session",
        args: {},
        async execute() {
            return JSON.stringify({
                decisions: memory.decisions,
                tree_weights: tree.get_weights(),
                cache_stats: cache.stats(),
                last_index_time: indexer.last_run()
            }, null, 2);
        }
    })
}
```

### 5.2 Metrics Endpoint

```rust
// main.rs — add /metrics endpoint
.route("/metrics", get(metrics))

async fn metrics() -> String {
    format!(
        "brain_decisions_total {}\n\
         brain_cache_hits {}\n\
         brain_cache_misses {}\n\
         brain_index_chunks {}\n\
         brain_search_duration_ms {}\n",
        METRICS.decisions.load(Ordering::Relaxed),
        METRICS.cache_hits.load(Ordering::Relaxed),
        METRICS.cache_misses.load(Ordering::Relaxed),
        METRICS.index_chunks.load(Ordering::Relaxed),
        METRICS.search_duration_ms.load(Ordering::Relaxed),
    )
}
```

---

## The Implementation Priority

| Priority | Feature | Effort | Impact |
|---|---|---|---|
| **P0** | Incremental indexing | 1 day | **10× faster re-index** |
| **P0** | Windows build (WSL2) | 30 min | Unblocks development |
| **P0** | Query cache | 2 hours | **60% cache hits** |
| **P1** | Predictive pre-warming | 1 day | Eliminates 2s load delay |
| **P1** | Hybrid search (BM25) | 2 days | Better exact matches |
| **P1** | Token attribution | 2 days | Enables learning loop |
| **P2** | Cross-session memory | 3 days | Unique differentiator |
| **P2** | Multi-provider | 2 days | Broader adoption |
| **P3** | Multi-hop retrieval | 2 days | Better architecture queries |
| **P3** | Metrics endpoint | 1 day | Production readiness |

---

## The "Super Hidden Brain" Concept

You asked for a hidden brain that works as a growing tree. Here is the refined architecture:

```
┌─────────────────────────────────────────────────────────────┐
│                    USER INTERFACE                            │
│  User sees: normal OpenCode chat                             │
│                                                             │
│  Hidden layer:                                               │
│  ┌─────────────────────────────────────────────────────┐  │
│  │  1. SIGNAL GATHERING (silent)                        │  │
│  │     • LSP diagnostics → predict "debug" intent      │  │
│  │     • File watcher → mark dirty, trigger re-index   │  │
│  │     • Git status → detect branch, recent commits      │  │
│  │     • Session history → load project memory           │  │
│  │                                                      │  │
│  │  2. DECISION ENGINE (growing tree)                     │  │
│  │     • Classify intent (7 categories)                 │  │
│  │     • Select strategy (depth, rerank, provider)       │  │
│  │     • A/B test when uncertain                         │  │
│  │     • Spawn children on failure                       │  │
│  │                                                      │  │
│  │  3. ORCHESTRATION (invisible)                        │  │
│  │     • Pre-warm models before user asks               │  │
│  │     • Swap provider if primary fails                   │  │
│  │     • Parallel embed + search                         │  │
│  │     • Cache results transparently                     │  │
│  │                                                      │  │
│  │  4. INJECTION (seamless)                             │  │
│  │     • Format context as natural code blocks           │  │
│  │     • Compress if too long                            │  │
│  │     • Inject into system prompt, not user message     │  │
│  │                                                      │  │
│  │  5. FEEDBACK (background)                              │  │
│  │     • Track if LLM used injected context             │  │
│  │     • Record success/failure                         │  │
│  │     • Grow tree weights                               │  │
│  │     • Persist to project memory                       │  │
│  └─────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

The user never sees "Brain is thinking..." or "Loading model..." It just feels like OpenCode **knows** their codebase better every day.

---

## Next Steps for You

1. **Today:** Fix Windows build via WSL2, verify Rust sidecar compiles
2. **This week:** Implement incremental indexing + query cache
3. **Next week:** Add token attribution + feedback loop
4. **Following week:** Cross-session memory + predictive pre-warming

The core insight: **Your Rust sidecar is the competitive advantage.** Keep it lean, fast, and invisible. The TS plugin is the orchestrator. Together they create an experience no other OpenCode plugin has — a brain that actually learns.