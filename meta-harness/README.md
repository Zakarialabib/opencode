# Meta-Harness for OpenCode Brain Plugin

Automated search over task-specific model harnesses for the [OpenCode](https://opencode.ai) Brain Plugin. This implementation ports the [Stanford IRIS Lab Meta-Harness](https://github.com/stanford-iris-lab/meta-harness) framework to optimize retrieval, fusion, reranking, and context injection parameters using your local LM Studio instance.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Meta-Harness Loop                         │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐                │
│  │ Proposer │───→│ Evaluate │───→│  Select  │                │
│  │ (LM      │    │ (Tasks)  │    │ (Top-K)  │                │
│  │ Studio)  │←───│          │←───│          │                │
│  └──────────┘    └──────────┘    └──────────┘                │
│        ↑________________________________________|              │
└─────────────────────────────────────────────────────────────┘
                              ↓
                    ┌──────────────────┐
                    │  Brain Plugin      │
                    │  - tree/engine    │
                    │  - retrieval/*    │
                    │  - context/*      │
                    └──────────────────┘
```

## Prerequisites

1. **OpenCode** installed and configured
2. **LM Studio** running locally with these models loaded:
   - `qwen3.5-4b-claude-4.6-opus-reasoning-distilled-v2` (chat/proposer)
   - `text-embedding-qwen3-embedding-0.6b` (embeddings)
   - `qwen3-reranker-0.6b` (reranking)

3. **Node.js** ≥ 18 (for `fetch` API)

## Installation

### 1. Copy the plugin to your project

```bash
# From your OpenCode project root
cp -r /path/to/meta-harness-opencode .opencode/plugins/meta-harness
```

### 2. Register in `opencode.json`

```json
{
  "plugins": [
    ".opencode/plugins/meta-harness/meta-harness.ts"
  ]
}
```

### 3. Set environment variables (optional)

```bash
export LM_STUDIO_URL="http://127.0.0.1:1234"
export LM_STUDIO_CHAT_MODEL="qwen3.5-4b-claude-4.6-opus-reasoning-distilled-v2"
export LM_STUDIO_EMBED_MODEL="text-embedding-qwen3-embedding-0.6b"
export LM_STUDIO_RERANKER_MODEL="qwen3-reranker-0.6b"
```

Defaults will use `127.0.0.1:1234` and the model keys above.

## Usage

### Start Optimization

In the OpenCode TUI, run:

```
/brain_optimize_harness iterations=10 suite=smoke
```

Or for a specific intent:

```
/brain_optimize_harness iterations=15 suite=full intent=debug
```

### Check Status

```
/brain_harness_status
```

### Apply Optimized Config

```
/brain_apply_harness config_path=.opencode/meta-harness-logs/best_harness.json
```

## Benchmark Suites

| Suite | Tasks | Intents Covered | Runtime |
|-------|-------|-----------------|---------|
| `smoke` | 5 | debug, refactor, feature, learn, test, quick_chat | ~2-5 min |
| `full` | 21 | 3 per intent + variants | ~10-20 min |

## Parameter Space

The following Brain Plugin parameters are optimized:

| Component | Parameters | Default |
|-----------|-----------|---------|
| Decision Tree | intent thresholds, chunk counts, rerank flags | see `harness-space.ts` |
| Fusion (RRF) | α (keyword), β (dense), γ (sparse), memory boost | 0.4, 0.4, 0.2, 0.15 |
| Reranker | confidence gate, min results, allowed intents | 0.85, 10, [learn, refactor, feature] |
| Compression | token thresholds per intent, strategy | 500/150, hybrid |
| Injector | header template, separator, max tokens | `### Relevant...`, `\n---\n`, 4096 |
| LM Studio | temperature, max tokens, batch sizes | 0.7, 4096, 4 |

## How It Works

1. **Initialize**: Plugin loads, verifies LM Studio models
2. **Evaluate**: Runs benchmark tasks with current harness config
3. **Score**: Aggregate score = 30% retrieval + 35% generation + 20% efficiency + 15% token economy
4. **Propose**: LM Studio (qwen3.5-4b) proposes mutated config based on history
5. **Iterate**: Keep top-K configs, repeat until convergence or max iterations
6. **Persist**: Best config saved to `.opencode/meta-harness-logs/best_harness.json`

## Files

```
meta-harness-opencode/
├── meta-harness.ts          # Main plugin entry (OpenCode hooks)
├── index.ts                 # Barrel exports
├── types.ts                 # TypeScript interfaces
├── harness-space.ts         # Config schema + defaults + apply()
├── lmstudio-client.ts       # LM Studio REST API client
├── evaluator.ts             # Benchmark scoring engine
├── proposer.ts              # LLM-based config mutation
├── loop.ts                  # Meta-Harness optimization loop
├── benchmark/
│   └── tasks.ts             # Smoke + full benchmark suites
└── utils/
    └── logger.ts            # File logging utility
```

## Integration with Brain Plugin

To wire the optimized config into your Brain Plugin, modify these modules to accept dynamic configuration:

```typescript
// tree/engine.ts
export function setThresholds(t: Record<string, number>) { /* ... */ }
export function setChunkCounts(c: Record<string, number>) { /* ... */ }

// retrieval/fusion.ts  
export function setWeights(a: number, b: number, g: number) { /* ... */ }

// retrieval/reranker.ts
export function setGate(g: number) { /* ... */ }
```

Then `applyHarnessConfig()` in `harness-space.ts` will patch them at evaluation time.

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "Missing models in LM Studio" | Load the 3 required models in LM Studio before running |
| "Proposer failed" | Falls back to random mutation; check LM Studio is responding |
| "Evaluation timeout" | Reduce `suite` to `smoke` or decrease `iterations` |
| Low scores on `quick_chat` | Expected — quick_chat has 0 chunks, score is binary on output match |

## License

MIT — Based on Stanford IRIS Lab Meta-Harness research.
