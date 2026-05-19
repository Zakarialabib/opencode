# Brain Harness Visualization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a lightweight visualization and testing system for Brain Harness RAG using enhanced brain tools + MCP sqlite + terminal commands.

**Architecture:** Enhance existing brain plugin tools with formatted output, add benchmark runner, create NPM scripts. No new UI - terminal + chat formatting only.

**Tech Stack:** TypeScript, OpenCode plugin, MCP sqlite, LM Studio SDK, better-sqlite3, sqlite-vec

---

## File Structure

```
brain-plugin/
├── brain.ts                      # Main plugin (enhanced)
├── tools/
│   └── formatter.ts             # Output formatting utilities (NEW)
├── scripts/
│   ├── status.ts                # Health check script (NEW)
│   ├── benchmark.ts             # Benchmark runner (NEW)
│   └── index.ts                # Indexing script (NEW)
└── retrieval/
    └── searcher.ts             # Already exists, ensure output format

meta-harness/
├── runner.ts                    # Already exists, enhance output
└── benchmark/
    └── tasks.ts                # Already exists

opencode.json                    # Add NPM scripts
```

---

## Tasks

### Task 1: Create Output Formatter Utility

**Files:**
- Create: `brain-plugin/tools/formatter.ts`
- Test: None (utility module)

- [ ] **Step 1: Create formatter.ts with output utilities**

```typescript
export interface SearchResult {
  id: string;
  filepath: string;
  start_line: number;
  end_line: number;
  content: string;
  score: number;
}

export interface DiagnosticInfo {
  storage: {
    chunks: number;
    vectors: number;
    concepts: number;
    sessions: number;
  };
  vector: {
    active: boolean;
    version?: string;
  };
  fts: {
    active: boolean;
    records: number;
  };
  lmStudio: {
    connected: boolean;
    models: string[];
  };
}

export function formatSearchResults(results: SearchResult[], query: string, timing: number): string {
  const lines: string[] = [
    `## Brain Search: "${query}"`,
    ``,
    `**Found ${results.length} results in ${timing}ms**`,
    ``,
    ...results.map((r, i) => [
      `### ${i + 1}. ${r.filepath}:${r.start_line}`,
      `Score: ${(r.score * 100).toFixed(1)}%`,
      `\`\`\``,
      r.content.slice(0, 200) + (r.content.length > 200 ? "..." : ""),
      `\`\`\``,
      ``,
    ]).flat(),
  ];
  return lines.join("\n");
}

export function formatDiagnostic(info: DiagnosticInfo): string {
  const sections: string[] = [
    "## Brain Diagnostic",
    ``,
  ];

  sections.push("### Storage");
  sections.push(`- Chunks: ${info.storage.chunks}`);
  sections.push(`- Vectors: ${info.storage.vectors}`);
  sections.push(`- Concepts: ${info.storage.concepts}`);
  sections.push(`- Sessions: ${info.storage.sessions}`);
  sections.push("");

  sections.push("### Vector Store");
  sections.push(`- sqlite-vec: ${info.vector.active ? "✅ Active" : "❌ Inactive"}`);
  if (info.vector.version) sections.push(`- Version: ${info.vector.version}`);
  sections.push("");

  sections.push("### Full-Text Search");
  sections.push(`- FTS5: ${info.fts.active ? "✅ Active" : "❌ Inactive"}`);
  sections.push(`- Records: ${info.fts.records}`);
  sections.push("");

  sections.push("### LM Studio");
  sections.push(`- Connected: ${info.lmStudio.connected ? "✅" : "❌"}`);
  if (info.lmStudio.models.length > 0) {
    sections.push(`- Models: ${info.lmStudio.models.join(", ")}`);
  }

  return sections.join("\n");
}

export function formatMetrics(metrics: {
  precisionAtK: number;
  mrr: number;
  avgLatencyMs: number;
  contextEfficiency: number;
}): string {
  return [
    "## Brain Metrics",
    "",
    `| Metric | Value |`,
    `|--------|-------|`,
    `| Precision@5 | ${(metrics.precisionAtK * 100).toFixed(1)}% |`,
    `| MRR | ${metrics.mrr.toFixed(3)} |`,
    `| Avg Latency | ${metrics.avgLatencyMs.toFixed(0)}ms |`,
    `| Context Efficiency | ${(metrics.contextEfficiency * 100).toFixed(1)}% |`,
    "",
  ].join("\n");
}

export function formatBenchmarkResult(result: {
  score: number;
  tasksRun: number;
  avgLatencyMs: number;
  metrics: Record<string, number>;
}): string {
  const lines: string[] = [
    "## Brain Benchmark Results",
    "",
    `**Overall Score:** ${(result.score * 100).toFixed(1)}%`,
    `**Tasks Run:** ${result.tasksRun}`,
    `**Avg Latency:** ${result.avgLatencyMs.toFixed(0)}ms`,
    "",
    "### Metrics",
    "",
  ];

  for (const [key, value] of Object.entries(result.metrics)) {
    lines.push(`- ${key}: ${(value * 100).toFixed(1)}%`);
  }

  return lines.join("\n");
}
```

- [ ] **Step 2: Commit**

```bash
git add brain-plugin/tools/formatter.ts
git commit -m "feat(brain): add output formatting utilities"
```

---

### Task 2: Enhance brain_search Tool

**Files:**
- Modify: `brain-plugin/brain.ts` - Add timing and formatted output
- Test: Manual test in OpenCode chat

- [ ] **Step 1: Read current brain_search implementation**

Review `brain.ts` lines 446-479 to understand current brain_search tool

- [ ] **Step 2: Update brain_search to use formatter and add timing**

Add timing measurement and use formatter:

```typescript
brain_search: tool({
  description: "Search the codebase for relevant context using unified hybrid dense + FTS5",
  args: {
    query: tool.schema.string().describe("Search query"),
    top_k: tool.schema.number().optional().describe("Number of results (default: 5)"),
  },
  async execute(args: any) {
    const startTime = Date.now();
    const results = await searchProjectContext(
      directory,
      args.query,
      args.top_k ?? 5,
      "learn"
    );

    const mappedChunks = results.map((r) => ({
      id: r.id,
      filepath: r.filepath,
      start_line: r.start_line,
      end_line: r.end_line,
      content: r.content,
      score: r.score ?? 0.5,
    }));

    const timing = Date.now() - startTime;
    return formatSearchResults(mappedChunks, args.query, timing);
  },
}),
```

- [ ] **Step 3: Import formatter at top of brain.ts**

```typescript
import { formatSearchResults, formatDiagnostic, formatMetrics, formatBenchmarkResult } from "./tools/formatter";
```

- [ ] **Step 4: Commit**

```bash
git add brain-plugin/brain.ts
git commit -m "feat(brain): enhance brain_search with timing and formatted output"
```

---

### Task 3: Enhance brain_diagnostic Tool

**Files:**
- Modify: `brain-plugin/brain.ts` - Add detailed storage stats
- Test: Manual test in OpenCode chat

- [ ] **Step 1: Update brain_diagnostic tool**

Replace existing implementation with:

```typescript
brain_diagnostic: tool({
  description: "Run full plugin diagnostic check over the SQLite and LM Studio pipelines",
  args: {},
  async execute() {
    const results: string[] = ["## Brain Diagnostic\n"];

    try {
      const db = getDatabase(directory);
      results.push("✅ SQLite store initialized successfully");

      const chunkCount = (db.prepare("SELECT COUNT(*) as c FROM chunks").get() as any)?.c ?? 0;
      const vectorCount = (db.prepare("SELECT COUNT(*) as c FROM chunk_embeddings").get() as any)?.c ?? 0;
      const conceptCount = (db.prepare("SELECT COUNT(*) as c FROM concepts").get() as any)?.c ?? 0;
      const sessionCount = (db.prepare("SELECT COUNT(*) as c FROM sessions").get() as any)?.c ?? 0;
      const ftsCount = (db.prepare("SELECT COUNT(*) as c FROM fts_chunks").get() as any)?.c ?? 0;

      results.push("\n### Storage");
      results.push(`- Chunks: ${chunkCount}`);
      results.push(`- Vectors: ${vectorCount}`);
      results.push(`- Concepts: ${conceptCount}`);
      results.push(`- Sessions: ${sessionCount}`);
      results.push(`- FTS Records: ${ftsCount}`);

      const vecActive = isVectorActive(db);
      results.push("\n### Vector Store");
      results.push(`- sqlite-vec: ${vecActive ? "✅ Active" : "❌ Inactive"}`);

      results.push("\n### LM Studio");
      try {
        const loaded = await provider.getLoadedModels();
        results.push(`- Connected: ✅`);
        results.push(`- Models: ${loaded.join(", ") || "none"}`);
      } catch {
        results.push("- Connected: ❌ (check LM Studio is running)");
      }

      results.push(`\n### Project: ${directory}`);
      return results.join("\n");
    } catch (err: any) {
      return `❌ Diagnostic failed: ${err.message}`;
    }
  },
}),
```

- [ ] **Step 2: Commit**

```bash
git add brain-plugin/brain.ts
git commit -m "feat(brain): enhance brain_diagnostic with detailed storage stats"
```

---

### Task 4: Enhance brain_metrics Tool

**Files:**
- Modify: `brain-plugin/brain.ts` - Add formatted metrics output
- Test: Manual test in OpenCode chat

- [ ] **Step 1: Update brain_metrics tool**

Replace existing implementation with:

```typescript
brain_metrics: tool({
  description: "Get detailed RAG pipeline metrics and performance data",
  args: {},
  async execute() {
    const db = getDatabase(directory);
    const stats = tree.getStats();
    const memory = sessionMemory.getMemory();

    const metrics: any = {
      decisionTree: stats,
      sessionMemory: {
        decisions: memory.decisions.length,
        successes: memory.successCount,
        failures: memory.failures.length,
        recentFiles: memory.recentFiles.length,
        contextUsed: memory.contextUsed.length,
      },
    };

    try {
      const sessionRows = db.prepare("SELECT COUNT(*) as c FROM sessions").get() as any;
      const avgLatency = (db.prepare("SELECT AVG(latency_ms) as avg FROM sessions").get() as any)?.avg ?? 0;
      metrics.sessions = { total: sessionRows?.c ?? 0, avgLatencyMs: Math.round(avgLatency) };
    } catch {}

    try {
      const chunkRows = db.prepare("SELECT COUNT(*) as c FROM chunks").get() as any;
      const vectorRows = db.prepare("SELECT COUNT(*) as c FROM chunk_embeddings").get() as any;
      const ftsRows = db.prepare("SELECT COUNT(*) as c FROM fts_chunks").get() as any;
      metrics.index = {
        chunks: chunkRows?.c ?? 0,
        vectors: vectorRows?.c ?? 0,
        ftsRecords: ftsRows?.c ?? 0,
        vectorActive: isVectorActive(db),
      };
    } catch {}

    const lines: string[] = [
      "## Brain Metrics",
      "",
      "### Retrieval",
      `- Chunks indexed: ${metrics.index?.chunks ?? 0}`,
      `- Vectors stored: ${metrics.index?.vectors ?? 0}`,
      `- FTS records: ${metrics.index?.ftsRecords ?? 0}`,
      "",
      "### Sessions",
      `- Total sessions: ${metrics.sessions?.total ?? 0}`,
      `- Avg latency: ${metrics.sessions?.avgLatencyMs ?? 0}ms`,
      "",
      "### Decision Tree",
      `- Total nodes: ${stats.totalNodes}`,
      `- Pending mutations: ${stats.pendingMutations}`,
      "",
      "### Intents",
      ...Object.entries(stats.intents).map(
        ([intent, data]: [string, any]) => `- ${intent}: weight=${data.weight.toFixed(2)}, visits=${data.visits}`
      ),
      "",
      "### Session Memory",
      `- Decisions: ${memory.decisions.length}`,
      `- Successes: ${memory.successCount}`,
      `- Failures: ${memory.failures.length}`,
    ];

    return lines.join("\n");
  },
}),
```

- [ ] **Step 2: Commit**

```bash
git add brain-plugin/brain.ts
git commit -m "feat(brain): enhance brain_metrics with formatted output"
```

---

### Task 5: Add brain_benchmark Tool

**Files:**
- Modify: `brain-plugin/brain.ts` - Add benchmark tool
- Modify: `meta-harness/evaluator.ts` - Add benchmark function export
- Test: Manual test in OpenCode chat

- [ ] **Step 1: Add benchmark function to evaluator.ts**

Add at end of evaluator.ts:

```typescript
export async function runQuickBenchmark(
  projectRoot: string,
  suite: "smoke" = "smoke"
): Promise<{ score: number; tasksRun: number; avgLatencyMs: number; metrics: Record<string, number> }> {
  const { loadTasks } = await import("./benchmark/tasks");
  const tasks = loadTasks(suite);
  
  const results: any[] = [];
  let totalLatency = 0;
  
  for (const task of tasks) {
    const startTime = Date.now();
    try {
      const result = await task.run(DEFAULT_HARNESS_CONFIG);
      const latency = Date.now() - startTime;
      totalLatency += latency;
      results.push({
        name: task.name,
        intent: task.intent,
        score: result.llmOutput.length > 0 ? 0.7 : 0.3,
        latency,
      });
    } catch {
      results.push({ name: task.name, score: 0, latency: 0 });
    }
  }
  
  const avgLatency = totalLatency / results.length;
  const avgScore = results.reduce((s, r) => s + r.score, 0) / results.length;
  
  const metrics: Record<string, number> = {};
  const byIntent: Record<string, number[]> = {};
  for (const r of results) {
    if (!byIntent[r.intent]) byIntent[r.intent] = [];
    byIntent[r.intent].push(r.score);
  }
  for (const [intent, scores] of Object.entries(byIntent)) {
    metrics[intent] = scores.reduce((s, v) => s + v, 0) / scores.length;
  }
  
  return { score: avgScore, tasksRun: results.length, avgLatencyMs: avgLatency, metrics };
}
```

- [ ] **Step 2: Add brain_benchmark tool to brain.ts**

Add new tool:

```typescript
brain_benchmark: tool({
  description: "Run quick benchmark suite to test retrieval quality",
  args: {
    suite: tool.schema.enum(["smoke", "full"]).optional().describe("Benchmark suite (smoke=5 tasks, full=21 tasks)"),
  },
  async execute(args: any) {
    const { runQuickBenchmark } = await import("../meta-harness/evaluator");
    const suite = args.suite ?? "smoke";
    
    const result = await runQuickBenchmark(directory, suite);
    
    const lines: string[] = [
      "## Brain Benchmark Results",
      "",
      `**Overall Score:** ${(result.score * 100).toFixed(1)}%`,
      `**Tasks Run:** ${result.tasksRun}`,
      `**Avg Latency:** ${result.avgLatencyMs.toFixed(0)}ms`,
      "",
      "### Per-Intent Scores",
      "",
    ];
    
    for (const [intent, score] of Object.entries(result.metrics)) {
      const bar = "█".repeat(Math.round(score * 10)) + "░".repeat(10 - Math.round(score * 10));
      lines.push(`${intent}: [${bar}] ${(score * 100).toFixed(0)}%`);
    }
    
    return lines.join("\n");
  },
}),
```

- [ ] **Step 3: Commit**

```bash
git add brain-plugin/brain.ts meta-harness/evaluator.ts
git commit -m "feat(brain): add brain_benchmark tool for quick retrieval testing"
```

---

### Task 6: Create Terminal Scripts

**Files:**
- Create: `brain-plugin/scripts/status.ts`
- Create: `brain-plugin/scripts/index.ts`
- Create: `brain-plugin/scripts/benchmark.ts`
- Modify: `opencode.json` - Add NPM scripts

- [ ] **Step 1: Create status.ts**

```typescript
#!/usr/bin/env tsx
import { getDatabase } from "../store/index.js";
import { isVectorActive } from "../store/vec.js";
import { defaultProvider } from "../provider/lmstudio.js";
import * as path from "path";

const projectRoot = process.cwd();
const db = getDatabase(projectRoot);

console.log("\n🧠 Brain Harness Status\n");
console.log("─".repeat(40));

try {
  const chunkCount = (db.prepare("SELECT COUNT(*) as c FROM chunks").get() as any)?.c ?? 0;
  const vectorCount = (db.prepare("SELECT COUNT(*) as c FROM chunk_embeddings").get() as any)?.c ?? 0;
  const conceptCount = (db.prepare("SELECT COUNT(*) as c FROM concepts").get() as any)?.c ?? 0;
  const sessionCount = (db.prepare("SELECT COUNT(*) as c FROM sessions").get() as any)?.c ?? 0;
  const ftsCount = (db.prepare("SELECT COUNT(*) as c FROM fts_chunks").get() as any)?.c ?? 0;
  
  console.log("\n📦 Storage");
  console.log(`  Chunks:     ${chunkCount.toLocaleString()}`);
  console.log(`  Vectors:    ${vectorCount.toLocaleString()}`);
  console.log(`  Concepts:   ${conceptCount.toLocaleString()}`);
  console.log(`  Sessions:   ${sessionCount.toLocaleString()}`);
  console.log(`  FTS Records: ${ftsCount.toLocaleString()}`);
  
  const vecActive = isVectorActive(db);
  console.log(`\n🔢 Vector Store: ${vecActive ? "✅ sqlite-vec active" : "❌ inactive (degraded mode)"}`);
  
  console.log("\n🤖 LM Studio");
  try {
    const models = await defaultProvider.getLoadedModels();
    console.log(`  Status:  ✅ Connected`);
    console.log(`  Models:  ${models.length > 0 ? models.join(", ") : "none loaded"}`);
  } catch {
    console.log("  Status:  ❌ Not connected");
    console.log("  Note:   Start LM Studio with embedding model");
  }
  
  console.log("\n" + "─".repeat(40));
  console.log(`Project: ${projectRoot}\n`);
} catch (err: any) {
  console.error("❌ Error:", err.message);
}
```

- [ ] **Step 2: Create index.ts**

```typescript
#!/usr/bin/env tsx
import { indexProject } from "../retrieval/indexer.js";
import * as path from "path";

const projectRoot = process.cwd();
console.log("\n🔄 Brain Harness Indexer\n");
console.log("─".repeat(40));
console.log(`Project: ${projectRoot}\n`);

const startTime = Date.now();
try {
  const chunks = await indexProject(projectRoot);
  const duration = Date.now() - startTime;
  console.log(`\n✅ Indexed ${chunks.length} chunks in ${duration}ms`);
} catch (err: any) {
  console.error(`\n❌ Indexing failed: ${err.message}`);
}
```

- [ ] **Step 3: Create benchmark.ts**

```typescript
#!/usr/bin/env tsx
import { runQuickBenchmark } from "../../meta-harness/evaluator.js";

const projectRoot = process.cwd();
const suite = process.argv.includes("--full") ? "full" : "smoke";

console.log("\n🏃 Brain Harness Benchmark\n");
console.log("─".repeat(40));
console.log(`Suite: ${suite}\n`);

const startTime = Date.now();
try {
  const result = await runQuickBenchmark(projectRoot, suite);
  const duration = Date.now() - startTime;
  
  console.log(`\n📊 Results (${duration}ms total)`);
  console.log(`  Overall Score:  ${(result.score * 100).toFixed(1)}%`);
  console.log(`  Tasks Run:      ${result.tasksRun}`);
  console.log(`  Avg Latency:    ${result.avgLatencyMs.toFixed(0)}ms`);
  
  console.log("\n  Per-Intent Scores:");
  for (const [intent, score] of Object.entries(result.metrics)) {
    const bar = "█".repeat(Math.round(score * 10)) + "░".repeat(10 - Math.round(score * 10));
    console.log(`    ${intent.padEnd(15)} [${bar}] ${(score * 100).toFixed(0)}%`);
  }
} catch (err: any) {
  console.error(`\n❌ Benchmark failed: ${err.message}`);
}
```

- [ ] **Step 4: Add NPM scripts to package.json**

Add to scripts section:

```json
"brain:status": "tsx brain-plugin/scripts/status.ts",
"brain:index": "tsx brain-plugin/scripts/index.ts",
"brain:benchmark": "tsx brain-plugin/scripts/benchmark.ts",
"brain:benchmark:full": "tsx brain-plugin/scripts/benchmark.ts --full"
```

- [ ] **Step 5: Commit**

```bash
git add brain-plugin/scripts/
git add package.json
git commit -m "feat(brain): add terminal scripts for brain harness"
```

---

### Task 7: Add MCP sqlite Examples to Docs

**Files:**
- Create: `docs/brain-harness-mcp-queries.md`

- [ ] **Step 1: Create MCP queries doc**

```markdown
# Brain Harness MCP SQLite Queries

Use the `sqlite` MCP tool to query `brain.db` directly.

## Connection

```json
{
  "command": "uvx",
  "args": ["mcp-server-sqlite", "--db-path", "./.opencode/brain.db"]
}
```

## Useful Queries

### Storage Stats

```sql
SELECT 'chunks' as table, COUNT(*) as count FROM chunks
UNION ALL SELECT 'vectors', COUNT(*) FROM chunk_embeddings
UNION ALL SELECT 'concepts', COUNT(*) FROM concepts
UNION ALL SELECT 'sessions', COUNT(*) FROM sessions
UNION ALL SELECT 'fts_records', COUNT(*) FROM fts_chunks;
```

### Top Retrieved Chunks

```sql
SELECT c.filepath, c.start_line, c.access_count, c.last_accessed
FROM chunks c
ORDER BY c.access_count DESC
LIMIT 10;
```

### Recent Sessions

```sql
SELECT id, intent, query, retrieved_chunks, user_rating, latency_ms, started_at
FROM sessions
ORDER BY started_at DESC
LIMIT 10;
```

### Concept Strength

```sql
SELECT cc.concept_id, cc.strength, c.filepath
FROM concept_chunks cc
JOIN chunks c ON c.id = cc.chunk_id
WHERE cc.concept_id = 'debug'
ORDER BY cc.strength DESC
LIMIT 10;
```

### Fusion Config

```sql
SELECT key, value FROM config WHERE key LIKE 'rrf_%';
```
```

- [ ] **Step 2: Commit**

```bash
git add docs/brain-harness-mcp-queries.md
git commit -m "docs: add brain harness MCP sqlite queries guide"
```

---

## Self-Review Checklist

- [ ] All brain tools enhanced with formatted output
- [ ] brain_search includes timing
- [ ] brain_diagnostic shows storage stats
- [ ] brain_metrics shows retrieval metrics
- [ ] brain_benchmark runs benchmark suite
- [ ] Terminal scripts work (status, index, benchmark)
- [ ] NPM scripts added to package.json
- [ ] MCP queries documented
- [ ] All commits made

## Testing Plan

```bash
# 1. Test terminal scripts
npm run brain:status
npm run brain:index
npm run brain:benchmark

# 2. Test in OpenCode chat
@brain search "authentication"
@brain diagnostic
@brain metrics
@brain benchmark

# 3. Test MCP sqlite
@sqlite query "SELECT COUNT(*) as chunks FROM chunks"
```
