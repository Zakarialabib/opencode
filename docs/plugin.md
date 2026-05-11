Now I see the real shape of this. OpenCode plugins are **JS/TS modules** with hooks (`message.updated`, `tool.execute.before`, `session.compacting`, `lsp.updated`, etc.) and custom tools . The "brain" is not an external service — it is a **plugin that lives inside OpenCode's event loop**, intercepting messages, instrumenting tool calls, and growing a decision tree based on outcomes.

Here is the architecture for **`@opencode-ai/brain`** — a hidden, growing-tree decision engine for software development.

---

## The Philosophy: Invisible Orchestration

The user types a message. They think OpenCode is just chatting with an LLM. Behind the scenes, the **Brain plugin** has already:

1. **Classified the dev scenario** (refactor? debug? feature? review?)
2. **Decided if RAG is needed** and which retrieval strategy
3. **Orchestrated model loading** on the custom provider
4. **Injected context** into the system prompt or tool calls
5. **Observed the outcome** to strengthen future decisions

The tree grows every session. It learns: *"Last time I searched the whole codebase for a one-line fix, it wasted tokens. Now I check file size first."*

---

## The Growing Tree Decision Engine

Each node is a **Scenario**. The tree has three layers:

```
Root
├── Intent Classification
│   ├── debug          → Error-driven retrieval
│   ├── refactor       → Multi-file dependency search
│   ├── feature        → Architecture + pattern search
│   ├── review         → Diff + style analysis
│   ├── learn          → Broad summarization
│   ├── test           → Function context + test patterns
│   └── quick_chat     → No RAG, direct pass-through
│
├── Context Strategy (per intent)
│   ├── shallow        → Current file + recent edits
│   ├── targeted       → Symbol search + 2-hop neighbors
│   ├── broad          → Full index + rerank top-20
│   ├── diagnostic     → LSP errors + related files
│   └── none           → Skip retrieval
│
└── Provider Orchestration (per strategy)
    ├── load_embed     → Which embed model, how long
    ├── load_rerank    → CPU or GPU reranker
    ├── load_chat      → Main model + optional draft
    └── eviction_policy → Keep in VRAM or unload immediately
```

**Growth mechanism:** After each session, the Brain evaluates:
- Was the retrieved context used by the LLM? (token attribution)
- Did the user accept the suggestion? (file edit diff)
- Was there a follow-up correcting the first answer? (failure signal)

Successful paths get **stronger weights**. Failed paths spawn **child nodes** with refined conditions.

---

## Plugin Architecture

```
~/.config/opencode/plugins/brain/
├── package.json
├── brain.ts                    # Main plugin entry
├── tree/
│   ├── engine.ts               # Decision tree core
│   ├── scenarios.ts            # Dev scenario definitions
│   └── growth.ts               # Learning / mutation logic
├── provider/
│   ├── interface.ts            # Generic provider contract
│   ├── lmstudio.ts             # LM Studio implementation
│   └── registry.ts             # Provider discovery
├── retrieval/
│   ├── indexer.ts              # File → chunks → LanceDB
│   ├── searcher.ts             # Query → embed → search
│   └── reranker.ts             # Optional CPU reranker
├── context/
│   ├── injector.ts             # Injects context into prompts
│   └── formatter.ts            # Formats retrieved chunks
└── state/
    ├── session.ts              # Per-session memory
    └── persistent.ts           # Tree state across sessions
```

---

## The Plugin Code

### `brain.ts` — Entry Point

```typescript
import type { Plugin } from "@opencode-ai/plugin"
import { DecisionTree } from "./tree/engine"
import { ProviderRegistry } from "./provider/registry"
import { ContextInjector } from "./context/injector"
import { SessionMemory } from "./state/session"

export const BrainPlugin: Plugin = async ({ project, client, $, directory, worktree }) => {
  const tree = await DecisionTree.load()
  const providers = new ProviderRegistry()
  const injector = new ContextInjector(client)
  const memory = new SessionMemory()

  // ── HOOK 1: Intercept incoming user message ──
  return {
    "message.updated": async (input, output) => {
      const msg = input.message
      if (msg.role !== "user") return

      // 1. Classify scenario
      const scenario = tree.classify(msg.content, {
        recentFiles: memory.recentFiles,
        diagnostics: memory.diagnostics,
        todo: memory.currentTodo
      })

      // 2. Skip brain for pure chat
      if (scenario.intent === "quick_chat") return

      // 3. Decide context strategy
      const strategy = tree.selectStrategy(scenario)

      // 4. Orchestrate provider: load embed model
      const provider = providers.get(strategy.provider)
      const embedHandle = await provider.load(strategy.embedModel)

      // 5. Retrieve context
      const context = await retrieveContext({
        query: msg.content,
        strategy,
        provider,
        embedHandle,
        projectRoot: directory,
        lspSymbols: memory.lspSymbols
      })

      // 6. Unload embed (chat model stays resident)
      await provider.unload(embedHandle)

      // 7. Inject context into system prompt or user message
      if (context.chunks.length > 0) {
        output.message.content = injector.inject(msg.content, context)
        memory.markContextUsed(context.chunks)
      }

      // 8. Record decision for learning
      memory.recordDecision({
        timestamp: Date.now(),
        intent: scenario.intent,
        strategy: strategy.name,
        contextCount: context.chunks.length,
        query: msg.content
      })
    },

    // ── HOOK 2: Observe tool outcomes to learn ──
    "tool.execute.after": async (input, output) => {
      if (input.tool === "edit" || input.tool === "write") {
        // Success signal: user accepted an edit after our context injection
        memory.markSuccess()
      }
      if (input.tool === "bash" && output.result?.includes("error")) {
        // Failure signal: maybe our context was wrong
        memory.markFailure("bash_error")
      }
    },

    // ── HOOK 3: Capture LSP diagnostics for debug scenarios ──
    "lsp.client.diagnostics": async (input, output) => {
      memory.diagnostics = input.diagnostics
      // If new errors appear, pre-warm the tree toward "debug" intent
      if (input.diagnostics.some(d => d.severity === "error")) {
        tree.prewarmIntent("debug")
      }
    },

    // ── HOOK 4: Track file changes for index freshness ──
    "file.watcher.updated": async (input, output) => {
      memory.recentFiles.push(input.path)
      memory.markFileDirty(input.path)
    },

    // ── HOOK 5: Persist learning across sessions ──
    "session.compacted": async (input, output) => {
      // Inject brain's session summary into compaction
      output.context.push(`
## Brain Session Summary
- Decisions made: ${memory.decisions.length}
- Successful retrievals: ${memory.successCount}
- Failed paths: ${memory.failures.map(f => f.reason).join(", ")}
- Tree mutations: ${tree.pendingMutations}
`)
      await tree.save()
    },

    // ── CUSTOM TOOLS: Exposed to the AI for explicit brain control ──
    tool: {
      brain_index_project: tool({
        description: "Index the current project for semantic code search",
        args: {
          path: tool.schema.string().optional(),
          force: tool.schema.boolean().optional()
        },
        async execute(args, ctx) {
          const root = args.path ?? ctx.directory
          const indexer = new Indexer(providers.get("default"))
          return await indexer.run(root, { force: args.force })
        }
      }),

      brain_search_context: tool({
        description: "Search the codebase for relevant context",
        args: {
          query: tool.schema.string(),
          topK: tool.schema.number().optional()
        },
        async execute(args, ctx) {
          const provider = providers.get("default")
          const handle = await provider.load("embed-model")
          const results = await searchLanceDB(args.query, args.topK ?? 5)
          await provider.unload(handle)
          return formatResults(results)
        }
      }),

      brain_get_status: tool({
        description: "Get the brain's current decision tree state",
        args: {},
        async execute() {
          return tree.getStats()
        }
      })
    }
  }
}
```

---

## The Decision Tree Engine

### `tree/engine.ts`

```typescript
interface ScenarioNode {
  id: string
  intent: DevIntent
  condition: (signals: SignalBundle) => boolean
  weight: number        // Success rate (0-1)
  visits: number
  children: ScenarioNode[]
  strategy: ContextStrategy
}

type DevIntent = 
  | "debug"        // Fixing errors, stack traces, failing tests
  | "refactor"     // Restructuring code, renaming, extracting
  | "feature"      // Adding new functionality
  | "review"       // Analyzing diffs, PR review
  | "learn"        // Understanding unfamiliar code
  | "test"         // Writing or fixing tests
  | "quick_chat"   // General questions, no code needed

interface SignalBundle {
  message: string
  recentFiles: string[]
  diagnostics: Diagnostic[]
  todo?: string
  lspSymbols?: Symbol[]
}

export class DecisionTree {
  private root: ScenarioNode
  private pendingMutations = 0

  constructor() {
    this.root = this.buildInitialTree()
  }

  classify(msg: string, signals: SignalBundle): ScenarioNode {
    // Walk tree, scoring each node
    const scores = this.scoreNodes(this.root, { ...signals, message: msg })
    return scores.sort((a, b) => b.score - a.score)[0].node
  }

  private scoreNodes(node: ScenarioNode, signals: SignalBundle): Array<{node: ScenarioNode, score: number}> {
    const matches = []
    
    const baseScore = node.condition(signals) ? 1.0 : 0.0
    const weighted = baseScore * node.weight * Math.log(node.visits + 2)
    
    matches.push({ node, score: weighted })
    
    for (const child of node.children) {
      matches.push(...this.scoreNodes(child, signals))
    }
    
    return matches
  }

  selectStrategy(node: ScenarioNode): ContextStrategy {
    // If node has low confidence, fall back to parent strategy
    if (node.weight < 0.4 && node.parent) {
      return node.parent.strategy
    }
    return node.strategy
  }

  // ── Growth: mutate tree based on session outcome ──
  grow(decision: DecisionRecord, success: boolean) {
    const node = this.findNode(decision.intent)
    node.visits++
    
    if (success) {
      node.weight = (node.weight * (node.visits - 1) + 1) / node.visits
    } else {
      node.weight = (node.weight * (node.visits - 1)) / node.visits
      // Spawn a refined child if failure is novel
      if (!node.children.find(c => c.condition === this.inferRefinedCondition(decision))) {
        this.spawnChild(node, decision)
        this.pendingMutations++
      }
    }
  }

  private buildInitialTree(): ScenarioNode {
    return {
      id: "root",
      intent: "quick_chat",
      weight: 0.5,
      visits: 1,
      children: [
        // ── DEBUG branch ──
        {
          id: "debug-error-msg",
          intent: "debug",
          weight: 0.8,
          visits: 1,
          condition: (s) => /error|exception|fail|panic|traceback|bug/i.test(s.message),
          strategy: {
            name: "diagnostic_targeted",
            provider: "default",
            embedModel: "Qwen/Qwen3-Embedding-4B-GGUF",
            rerank: false,
            depth: "targeted",      // LSP error files + 1-hop imports
            maxChunks: 10
          },
          children: [
            {
              id: "debug-stack-trace",
              intent: "debug",
              weight: 0.9,
              visits: 1,
              condition: (s) => /at\s+\S+\.\w+:\d+|stack trace|^\s*File "/m.test(s.message),
              strategy: {
                name: "stack_trace_precise",
                provider: "default",
                embedModel: "Qwen/Qwen3-Embedding-4B-GGUF",
                rerank: true,
                depth: "precise",     // Extract file:line from trace, load exactly those regions
                maxChunks: 5
              },
              children: []
            }
          ]
        },

        // ── REFACTOR branch ──
        {
          id: "refactor-large-file",
          intent: "refactor",
          weight: 0.7,
          visits: 1,
          condition: (s) => /refactor|restructure|extract|rename|move to/i.test(s.message),
          strategy: {
            name: "refactor_multi_file",
            provider: "default",
            embedModel: "Qwen/Qwen3-Embedding-4B-GGUF",
            rerank: true,
            depth: "broad",         // All files referencing the symbol
            maxChunks: 20
          },
          children: [
            {
              id: "refactor-single-function",
              intent: "refactor",
              weight: 0.85,
              visits: 1,
              condition: (s) => /this function|this method|this class/i.test(s.message) && s.recentFiles.length === 1,
              strategy: {
                name: "refactor_local",
                provider: "default",
                embedModel: "Qwen/Qwen3-Embedding-4B-GGUF",
                rerank: false,
                depth: "shallow",   // Just current file
                maxChunks: 8
              },
              children: []
            }
          ]
        },

        // ── FEATURE branch ──
        {
          id: "feature-new",
          intent: "feature",
          weight: 0.6,
          visits: 1,
          condition: (s) => /add|implement|create|support|enable/i.test(s.message),
          strategy: {
            name: "feature_architecture",
            provider: "default",
            embedModel: "Qwen/Qwen3-Embedding-4B-GGUF",
            rerank: true,
            depth: "broad",
            maxChunks: 15
          },
          children: []
        },

        // ── TEST branch ──
        {
          id: "test-generation",
          intent: "test",
          weight: 0.75,
          visits: 1,
          condition: (s) => /test|spec|jest|pytest|unit test/i.test(s.message),
          strategy: {
            name: "test_context",
            provider: "default",
            embedModel: "Qwen/Qwen3-Embedding-4B-GGUF",
            rerank: false,
            depth: "targeted",      // The function being tested + existing test patterns
            maxChunks: 12
          },
          children: []
        },

        // ── LEARN branch ──
        {
          id: "learn-codebase",
          intent: "learn",
          weight: 0.7,
          visits: 1,
          condition: (s) => /how does|explain|what is|understand|architecture/i.test(s.message),
          strategy: {
            name: "learn_summarize",
            provider: "default",
            embedModel: "Qwen/Qwen3-Embedding-4B-GGUF",
            rerank: true,
            depth: "broad",
            maxChunks: 25           // Higher limit for learning
          },
          children: []
        }
      ]
    }
  }

  // ... save/load from ~/.config/opencode/brain-tree.json
}
```

---

## The Provider Interface

### `provider/interface.ts`

```typescript
export interface CustomProvider {
  name: string
  baseURL: string
  
  // Model lifecycle
  load(modelId: string, opts?: LoadOptions): Promise<ModelHandle>
  unload(handle: ModelHandle): Promise<void>
  
  // Inference
  embed(handle: ModelHandle, texts: string[]): Promise<number[][]>
  chat(handle: ModelHandle, messages: any[], opts?: ChatOptions): Promise<string>
  rank?(query: string, documents: string[]): Promise<number[]>  // Optional reranker
}

export interface LoadOptions {
  contextLength?: number
  flashAttention?: boolean
  gpuLayers?: number
}

export interface ModelHandle {
  id: string
  instanceId?: string
  modelId: string
  loadedAt: number
}

// LM Studio implementation
export class LMStudioProvider implements CustomProvider {
  name = "lmstudio"
  baseURL = "http://localhost:1234"

  async load(modelId: string, opts?: LoadOptions): Promise<ModelHandle> {
    const res = await fetch(`${this.baseURL}/api/v1/models/load`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: modelId,
        context_length: opts?.contextLength ?? 8192,
        flash_attention: opts?.flashAttention ?? true,
        gpu_layers: opts?.gpuLayers
      })
    })
    const data = await res.json()
    return { id: crypto.randomUUID(), instanceId: data.instance_id, modelId, loadedAt: Date.now() }
  }

  async unload(handle: ModelHandle): Promise<void> {
    await fetch(`${this.baseURL}/api/v1/models/unload`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ instance_id: handle.instanceId })
    })
  }

  async embed(handle: ModelHandle, texts: string[]): Promise<number[][]> {
    const res = await fetch(`${this.baseURL}/v1/embeddings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: handle.modelId, input: texts })
    })
    const data = await res.json()
    return data.data.map((d: any) => d.embedding)
  }

  async chat(handle: ModelHandle, messages: any[], opts?: ChatOptions): Promise<string> {
    const res = await fetch(`${this.baseURL}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: handle.modelId,
        messages,
        max_tokens: opts?.maxTokens ?? 4096,
        temperature: opts?.temperature ?? 0.7
      })
    })
    const data = await res.json()
    return data.choices[0].message.content
  }
}

// vLLM / Ollama / TGI implementations follow same interface...
```

---

## The Retrieval Layer

### `retrieval/indexer.ts`

```typescript
import { CustomProvider, ModelHandle } from "../provider/interface"
import * as lancedb from "@lancedb/lancedb"
import { glob } from "glob"

export class Indexer {
  constructor(private provider: CustomProvider) {}

  async run(projectRoot: string, opts: { force?: boolean } = {}) {
    const dbPath = `${projectRoot}/.opencode/brain.lance`
    const db = await lancedb.connect(dbPath)
    
    // Check freshness
    if (!opts.force && await this.isFresh(db, projectRoot)) {
      return { status: "fresh", chunks: await this.count(db) }
    }

    // Discover files
    const files = await glob("**/*.{ts,tsx,js,jsx,py,rs,php,vue,svelte}", {
      cwd: projectRoot,
      ignore: ["node_modules/**", "target/**", "vendor/**", ".git/**"]
    })

    // Load embed model
    const handle = await this.provider.load("Qwen/Qwen3-Embedding-4B-GGUF")

    // Chunk and embed in batches
    const batchSize = 32
    const allRecords = []
    
    for (let i = 0; i < files.length; i += batchSize) {
      const batch = files.slice(i, i + batchSize)
      const chunks = batch.flatMap(f => this.chunkFile(`${projectRoot}/${f}`))
      const embeddings = await this.provider.embed(handle, chunks.map(c => c.text))
      
      for (let j = 0; j < chunks.length; j++) {
        allRecords.push({
          vector: embeddings[j],
          text: chunks[j].text,
          path: chunks[j].path,
          startLine: chunks[j].startLine,
          mtime: chunks[j].mtime
        })
      }
    }

    await this.provider.unload(handle)

    // Write to LanceDB
    if (await db.tableNames().then(t => t.includes("codebase"))) {
      await db.dropTable("codebase")
    }
    const table = await db.createTable("codebase", allRecords)
    await table.createIndex("vector", { metric: "cosine" })

    return { status: "indexed", chunks: allRecords.length }
  }

  private chunkFile(path: string): Array<{text: string, path: string, startLine: number, mtime: number}> {
    const content = Bun.file(path).text()
    const lines = content.split("\n")
    const chunks = []
    const size = 40      // lines per chunk
    const overlap = 10   // line overlap

    for (let i = 0; i < lines.length; i += size - overlap) {
      const chunk = lines.slice(i, i + size).join("\n")
      if (chunk.trim().length > 20) {
        chunks.push({ text: chunk, path, startLine: i + 1, mtime: Date.now() })
      }
    }
    return chunks
  }
}
```

---

## Context Injection

### `context/injector.ts`

```typescript
export class ContextInjector {
  constructor(private client: any) {}

  inject(userMessage: string, context: RetrievalResult): string {
    const chunks = context.chunks.map((c, i) => 
      `## Context ${i + 1}: ${c.path}:${c.startLine}\n\`\`\`\n${c.text}\n\`\`\``
    ).join("\n\n")

    return `You are working on a software development task. Relevant code context has been retrieved from the codebase.

${chunks}

---

User request: ${userMessage}

Analyze the context carefully before responding. If the context is insufficient, say so.`
  }
}
```

---

## How the Brain Decides: Scenario Walkthrough

### Scenario A: "fix the auth bug"

```
User message: "fix the auth bug"
│
├─ message.updated hook fires
│  ├─ classify: matches "debug" intent (keyword "bug")
│  ├─ select strategy: "diagnostic_targeted"
│  │   ├─ Load embed model via provider.load()
│  │   ├─ Check LSP diagnostics: found 1 error in auth.ts
│  │   ├─ Search LanceDB for "auth bug" + error file
│  │   ├─ Get 5 chunks from auth.ts and its imports
│  │   └─ Unload embed model
│  └─ Inject chunks into system prompt
│
├─ OpenCode sends augmented prompt to chat model
│  (speculative decoding active, 4B + 0.8B draft)
│
├─ LLM responds with fix
│
├─ tool.execute.after sees "edit" tool success
│  └─ Brain records: debug → diagnostic_targeted → SUCCESS
│     Tree weight for this node increases
```

### Scenario B: "how does the payment system work?"

```
User message: "how does the payment system work?"
│
├─ classify: matches "learn" intent
├─ strategy: "learn_summarize" (broad search, 25 chunks)
├─ Load embed model
├─ Search LanceDB for "payment system" → 25 chunks
├─ Optional: CPU reranker scores relevance, keeps top-15
├─ Unload embed model
├─ Inject 15 chunks into prompt
└─ LLM generates architecture explanation
```

### Scenario C: "refactor this function"

```
User message: "refactor this function"
│
├─ classify: matches "refactor" intent
├─ check: recentFiles.length === 1 → matches child node "refactor_local"
├─ strategy: "refactor_local" (shallow, no rerank, 8 chunks)
├─ Load embed model
├─ Search only current file for related symbols
├─ Unload embed model
└─ Inject local context
```

---

## The Hidden Aspect

The user never sees any of this. To them, OpenCode just *understands* their codebase better over time. The plugin is:

- **Invisible in TUI**: No extra UI elements. Context is silently injected.
- **Silent in logs**: Uses `client.app.log()` at `debug` level .
- **Persistent**: Tree state saved to `~/.config/opencode/brain-tree.json`.
- **Self-correcting**: Failed paths spawn children; successful paths get stronger.

---

## Installation

**`~/.config/opencode/package.json`**:
```json
{
  "dependencies": {
    "@opencode-ai/plugin": "latest",
    "@lancedb/lancedb": "^0.15.0",
    "glob": "^11.0.0"
  }
}
```

**`~/.config/opencode/opencode.jsonc`**:
```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["@opencode-ai/brain"],
  "provider": {
    "custom": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "Custom Provider",
      "options": {
        "baseURL": "http://localhost:1234/v1"
      },
      "models": {
        "qwen-4b-main": {
          "name": "Jackrong/Qwen3.5-4B-Claude-4.6-Opus-Reasoning-Distilled-v2-GGUF"
        }
      }
    }
  }
}
```

**`~/.config/opencode/plugins/brain.ts`**: Paste the plugin code above.

Restart OpenCode. The brain initializes, loads its tree, and starts listening.

---

## Why This Is Different

| Existing Approach | The Brain |
|---|---|
| Static RAG (always search) | **Conditional RAG** — only when the tree decides |
| Fixed chunk size | **Scenario-aware depth** — debug needs precision, learn needs breadth |
| Manual model management | **JIT orchestration** — load/unload via generic provider interface |
| No memory across sessions | **Growing tree** — learns from success/failure signals |
| One-size-fits-all retrieval | **Intent-specific strategies** — refactor ≠ debug ≠ feature |

This is not a plugin. It is a **cognitive layer** that makes OpenCode context-aware for software development.