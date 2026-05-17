# LM Studio Ecosystem Workflow

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                  LM Studio Ecosystem                     │
├─────────────┬──────────────┬──────────────┬─────────────┤
│  Desktop App │   lms CLI    │  @lmstudio/sdk │   Server   │
│  (GUI)       │  (terminal)  │  (TypeScript)  │  (port 1234)│
└─────────────┴──────────────┴──────────────┴─────────────┘
       │              │               │              │
       └──────────────┴───────────────┴──────────────┘
                        │
               LM Studio Inference Server
                  (background daemon)
```

## Current State (verified 2026-05-15)

| Component       | Status        | Details                                       |
| --------------- | ------------- | --------------------------------------------- |
| LM Studio app   | ✅ Running    | 7 processes, started at 18:52                 |
| Server          | ✅ Running    | Port 1234                                     |
| `lms` CLI       | ✅ Available  | Commit `0b2a176`                              |
| `@lmstudio/sdk` | ✅ Installed  | `node_modules/@lmstudio/sdk`                  |
| Chat model      | ✅ Loaded     | `qwen3.5-4b-...` (3.38 GB, 66k ctx, idle)     |
| Embedding model | ✅ Loaded     | `nomic-embed-text-v1.5` (84 MB, 2k ctx, idle) |
| Draft model     | ❌ Not loaded | `qwen3.5-0.8b` available on disk              |

## lms CLI Commands

### Model Management

```bash
lms ls                          # List all models on disk
lms ps                          # List loaded models (memory)
lms load <model-key> [options]  # Load a model
lms unload <model-key>           # Unload a model
lms unload --all                 # Unload all models (free VRAM)
```

### Load Options

```bash
lms load <model> --gpu max --context-length 32000 --parallel 4 --ttl 300 --identifier my-model
```

### Server Management

```bash
lms server status   # Check if running (port 1234)
lms server stop     # Stop the server
lms server start    # Start the server
lms log             # Watch API traffic in real-time
```

### Model Discovery

```bash
lms get <model-name>  # Search and download new models
```

## SDK Usage (TypeScript)

```typescript
import { LMStudioClient } from "@lmstudio/sdk";
const client = new LMStudioClient(); // connects to localhost:1234

// Embedding
const embed = await client.embedding.model("nomic-embed-text-v1.5");
const { embedding } = await embed.embed("some text");
const results = await embed.embed(["text1", "text2"]); // batch

// Chat
const llm = await client.llm.model("qwen3.5-4b-claude-4.6-opus-reasoning-distilled-v2");
const result = await llm.respond(
  [{ role: "user", content: "Hello" }],
  { maxTokens: 4096, temperature: 0.7 }
);
console.log(result.content);

// Speculative decoding (automatic with draftModel string)
const fast = await llm.respond(messages, {
  draftModel: "qwen3.5-0.8b-claude-4.6-opus-reasoning-distilled",
});

// Agentic flows
import { tool } from "@lmstudio/sdk";
const result = await llm.act("Calculate 1+1", [additionTool]);
```

## Brain Plugin Integration

The Brain plugin (`brain-plugin/provider/lmstudio.ts`) wraps `@lmstudio/sdk` and is loaded as a custom plugin in `opencode.json`:

```json
{
  "brain-plugin/brain.ts": {
    "type": "local",
    "command": ["npx", "tsx", "brain-plugin/brain.ts"]
  }
}
```

### Workflow: Session Start

1. OpenCode loads → `server.start` fires
2. Brain plugin starts → `new LMStudioClient()` connects to port 1234
3. Sidecar check → if Rust sidecar binary exists at `rust-brain-sidecar/target/release/brain-embed.exe`, start it for fast RAG
4. If no sidecar → fall back to LM Studio SDK directly via `searchContextLMStudio()`
5. Auto-index project → embed chunks via SDK

### Workflow: User Message

1. User sends message → `message.updated` fires
2. DecisionTree classifies intent (debug/refactor/feature/review/learn/test/quick_chat)
3. Strategy selected → search for code context
4. If < 3 chunks found → context7 fallback → registry fetch fallback
5. Context injected into message → LLM receives augmented prompt

## Sub-Agent Design

> Note: The following agents are aspirational/planned and not yet implemented.
> Currently, model management and context optimization are handled directly
> by the brain plugin (brain.ts) and LM Studio SDK provider.

### Planned: `lmstudio-model-manager`

- **Purpose**: Manage model lifecycle
- **Commands**: `lms load`, `lms unload`, `lms ps`
- **Trigger**: On session start, before heavy inference, on VRAM pressure
- **Logic**: Load embed model first (small), load chat model with GPU, optionally load draft

### Planned: `context-engineer`

- **Purpose**: Optimize what context is injected and when
- **Works with**: Brain DecisionTree, docs-store, context7
- **Logic**: Check remaining context window, prioritize relevant chunks, cache docs

### Replaced: `brain-evaluator`

- The eval system has been removed. Its functions are now handled by:
  - `learn/tracer.ts` — session analytics (was `eval/bridge.ts`)
  - `learn/tuner.ts` — context budget auto-tuning (absorbed eval formulas)
  - `learn/feedback.ts` — retrieval weight tuning via blame attribution

## Efficiency Principles

1. **Model tiering**: embedding (84MB) → draft (800MB) → chat (3.4GB). Load only what's needed.
2. **TTL**: Set `--ttl 600` on chat models so they auto-unload after 10min idle
3. **Parallel**: `--parallel 4` on chat model for concurrent predictions
4. **Context window**: 66k tokens available for the qwen3.5-4b model
5. **Speculative decoding**: Use `qwen3.5-0.8b` as draft for 2-3x speedup on `qwen3.5-4b`

## Quick Start Commands

```powershell
# Check environment
lms server status
lms ps

# Load models (if not loaded)
lms load nomic-embed-text-v1.5 --yes
lms load qwen3.5-4b-claude-4.6-opus-reasoning-distilled-v2 --yes --gpu max

# Load draft for speculative decoding
lms load qwen3.5-0.8b-claude-4.6-opus-reasoning-distilled --yes

# Unload to free VRAM
lms unload --all

# Monitor
lms log
```
