# OpenCode Improvement Roadmap

## Strategy

Expand OpenCode within its existing plugin architecture. No new engine, no second system, no Tandem-style agent teams. The brain plugin stays as the central RAG layer. Everything else is consolidation, configuration, and targeted enhancement.

## Key Decisions

| Decision | Rationale |
|----------|-----------|
| **Keep brain plugin as central RAG** | Enhance it — don't replace. It already handles context injection and hooks. |
| **Option B: LM Studio HTTP endpoint for embeddings** | Remote HTTP call to LM Studio, not local model loading. Simpler, faster iteration. |
| **Stay inside plugin architecture** | Avoid second-system effect. All work is plugin/tool changes, not engine rewrites. |
| **Drop 5-tier memory store** | Session → Project is sufficient. No global/user/session/project/ephemeral tiers. |
| **sqlite-vec as HNSW fallback** | If HNSW is problematic on Windows, swap it into the sidecar. No architecture change. |

## Skill Consolidation

**Target:** ~25-30 skills (down from 63).

| Merged Skill | Absorbs | Reason |
|---|---|---|
| `stack-context` | `fullstack-dev`, `project-orchestration` | Stack detection and environment guidance cover both. |
| `docs-curator` | `project-memory`, `docs-governance-audit` | Knowledge curation and project conventions are one concern. |
| `self-improver` | `autoresearch`, `self-evolver` | Self-improvement workflows belong together. |
| `contentanalysis` | `marketing-mode`, `blog-writer`, `writing-plans` | Content analysis pipeline covers all three. |
| `creative` | `dream-interpreter`, `anti-pua`, `interview-designer` | Single creative/analysis entry point. |

### Kept Separate

| Skill | Reason |
|---|---|
| `web-search` | Distinct external API, independent tool signature |
| `web-reader` | Distinct external API, independent tool signature |
| `security-review` | High-risk scope, kept isolated |
| `laravel-feature-scaffold` | Domain-specific, narrow tooling |

## MCP Health-Checking

Lightweight addition to `mcp-manager`: before task execution, verify configured MCP servers respond and report availability. Prevents mid-task failure from down servers (filesystem, memory, sqlite sidecar). No full MCP catalog — just readiness validation.

## Remaining Work

- [ ] Update brain plugin for LM Studio HTTP embedding (replace local embedding call with configurable HTTP endpoint)
- [ ] Update brain plugin pipeline for targeted memory/context injection
- [ ] Validate all skill frontmatter and tool metadata via `tools/generate-skill-index.js` / `scripts/validate-fix.js`
- [ ] Run full test suite to confirm no regressions from consolidation

## Expected Improvements

- **Better memory usage** — Session → Project only, sqlite-vec or HNSW, no over-engineered tiers
- **Stronger skill design** — Fewer, sharper skills with clear boundaries
- **Smarter context curation** — Brain plugin coordinates with `context-manager` and `skill-manager` instead of duplicating them
- **Efficient MCP health checks** — Lightweight readiness checks, no catalog sprawl
- **Brain-aware workflow integration** — Context injection and memory retrieval wired through existing plugin hooks

### 2.2 Unify LSP Bridge with CLI Fallbacks

**Problem:** You maintain two diagnostic pipelines:

- `language-context-bridge.ts` with live LSP connections
- `index.ts` shelling out to `php -l`, `npx tsc`, `cargo check`

**Fix:** Make the LSP bridge the primary source, CLI the fallback.

```typescript
// language-context-bridge.ts
export async function getLspDiagnostics(filePath: string): Promise<Diagnostic[]> {
  const ext = path.extname(filePath);
  const lspClient = getLspClientForExtension(ext);

  if (lspClient && lspClient.isConnected()) {
    return await lspClient.requestDiagnostics(filePath);
  }

  // Fallback to CLI
  return await runCliDiagnostic(filePath);
}
```

### 2.3 Add Deduplication & Race Safety

**Problem:** Same error emitted multiple times; race between async linter and next message.

**Fix:**

```typescript
const pendingChecks = new Map<string, Promise<void>>();
const seenDiagnostics = new Map<string, number>(); // hash -> timestamp

async function runQuickCheck(filePath: string, sessionId: string) {
  const promise = (async () => {
    const diagnostics = await getDiagnostics(filePath);
    const now = Date.now();

    for (const d of diagnostics) {
      const hash = `${d.file}:${d.line}:${d.message}`;
      const lastSeen = seenDiagnostics.get(hash);

      if (!lastSeen || now - lastSeen > 30000) {
        seenDiagnostics.set(hash, now);
        storeDiagnostic(sessionId, d);
      }
    }
  })();

  pendingChecks.set(sessionId, promise);
  await promise;
  pendingChecks.delete(sessionId);
}

// In chat.message hook:
if (pendingChecks.has(sessionId)) {
  await pendingChecks.get(sessionId);
}
```

---

## 3. Architecture Improvements

### 3.1 Task Briefing Inheritance (Sprint 1)

**Problem:** Every `Task` delegation burns 2-3 seconds re-hydrating context. Child agents reconstruct everything from scratch.

**Solution:** Compress and pass parent context.

```typescript
// Extend the Task tool payload
interface TaskBriefing {
  recentFiles: string[]; // Last 5 read/edit operations
  activeDecisions: string[]; // Key architectural decisions
  failedApproaches: string[]; // What didn't work (prevents repetition)
  contextWindow: number; // Remaining tokens
  parentAgent: string; // Who delegated
}

// In lead-strategist before delegation:
const briefing: TaskBriefing = {
  recentFiles: getRecentFileOperations(5),
  activeDecisions: extractDecisionsFromMemory(),
  failedApproaches: getFailedApproaches(),
  contextWindow: estimateRemainingTokens(),
  parentAgent: "lead-strategist",
};

// Child agent prepends to system prompt:
const systemPrompt =
  `\n[Briefing from ${briefing.parentAgent}]\n` +
  `Recent files: ${briefing.recentFiles.join(", ")}\n` +
  `Decisions: ${briefing.activeDecisions.join("\n")}\n` +
  `Avoid: ${briefing.failedApproaches.join("\n")}\n`;
```

**Implementation:**

1. Add `briefing` field to Task tool schema
2. Modify `lead-strategist` to auto-generate briefings before delegation
3. Child agents check for briefing and prepend to context

### 3.2 Clarification Gate (Sprint 1)

**Problem:** Agents don't ask clarifying questions before building. They assume requirements and often build the wrong thing.

**Solution:** Add confidence scoring to `lead-strategist`.

```typescript
// In lead-strategist system prompt:
"Before planning, assess requirement clarity on a scale of 0-1.
If confidence < 0.7, use the clarify tool to ask the user.
Never proceed with planning when requirements are ambiguous."

// Add clarify tool:
const clarifyTool = {
  name: "clarify",
  description: "Ask user for clarification before proceeding",
  args: {
    question: z.string(),
    options: z.array(z.string()).optional(),
    blocking: z.boolean().default(true)
  },
  execute: async ({ question, options, blocking }) => {
    // Emit to user via chat interface
    await client.emit('clarification_needed', { question, options });

    if (blocking) {
      // Halt workflow until user responds
      return await waitForUserResponse();
    }
  }
};
```

**When to trigger:**

- Requirements mention "etc." or "and so on"
- No acceptance criteria provided
- Multiple valid interpretations exist
- User asks for "improvements" without specifying what

### 3.3 Unified Checkpointing (Sprint 2)

**Problem:** `/undo` only rolls back git. DB state, MCP caches, and Memory MCP observations persist.

**Solution:** Atomic multi-layer snapshots.

```typescript
// plugins/index.ts - checkpoint tool
const checkpointTool = {
  name: "checkpoint",
  description: "Create atomic snapshot before destructive operations",
  execute: async () => {
    const checkpointId = `cp-${Date.now()}`;

    await Promise.all([
      // Layer 1: Filesystem
      gitStashCreate(checkpointId),

      // Layer 2: Database
      dbBackupCreate(`${checkpointId}.sql`),

      // Layer 3: MCP State
      memoryExport(`${checkpointId}-memory.json`),
      sqliteExport(`${checkpointId}-sqlite.db`),

      // Layer 4: Task State
      taskStateExport(`${checkpointId}-tasks.json`)
    ]);

    return { checkpointId, layers: 4 };
  }
};

// Auto-trigger before workflows:
"workflow.start": async (input) => {
  if (input.workflow.phases.some(p => p.agents.includes('core-factory'))) {
    const cp = await checkpointTool.execute();
    input.workflow.checkpointId = cp.checkpointId;
  }
}

// /undo command:
"command.undo": async () => {
  const lastCheckpoint = await getLastCheckpoint();
  await Promise.all([
    gitStashPop(lastCheckpoint.id),
    dbRestore(lastCheckpoint.dbPath),
    memoryImport(lastCheckpoint.memoryPath),
    taskStateImport(lastCheckpoint.taskPath)
  ]);
}
```

### 3.4 Lazy Tool Loading (Sprint 2)

**Problem:** All tools load at agent initialization. A `backend-laravel` agent with 12 tools burns ~8K tokens before doing anything.

**Solution:** Load tool schemas only when the model's utterance suggests they're needed.

```typescript
// plugins/mcp-manager.ts
const toolKeywords: Record<string, string[]> = {
  sqlite: ['database', 'db', 'query', 'table', 'migration', 'seed'],
  git: ['commit', 'branch', 'merge', 'stash', 'diff', 'history'],
  filesystem: ['file', 'read', 'write', 'directory', 'path'],
  fetch: ['http', 'api', 'web', 'url', 'fetch', 'request'],
  context7: ['docs', 'documentation', 'library', 'reference'],
  memory: ['remember', 'recall', 'previous', 'last time', 'earlier']
};

async function getLazyTools(agentId: string, conversation: string): Promise<Tool[]> {
  const allTools = await getAgentTools(agentId);
  const neededTools: Tool[] = [];

  for (const [server, tools] of Object.entries(allTools)) {
    const keywords = toolKeywords[server] || [];
    const isNeeded = keywords.some(kw =>
      conversation.toLowerCase().includes(kw)
    );

    if (isNeeded) {
      neededTools.push(...tools);
    }
  }

  // Always load core tools (read, write, bash)
  neededTools.push(...getCoreTools());

  return neededTools;
}

// In chat.params hook:
"chat.params": async (input) => {
  const lastUserMessage = getLastUserMessage(input.messages);
  const lazyTools = await getLazyTools(input.agent, lastUserMessage);
  input.tools = lazyTools;
}
```

**Fallback:** If the model requests a tool that wasn't loaded, catch the error, load the missing tool, and retry.

### 3.5 Browser MCP Server (Sprint 2)

**Problem:** `qa-guardian` reviews code but can't verify UI behavior. `frontend-ui-ux` builds blind.

**Solution:** Integrate Playwright as an MCP server.

```yaml
# mcp-servers/browser-mcp.yaml
name: browser
command: npx @anthropic-ai/playwright-mcp-server
tools:
  - browser_navigate
  - browser_screenshot
  - browser_click
  - browser_type
  - browser_assert_text
  - browser_assert_visible
```

**Usage in workflow:**

```yaml
phases:
  - name: Visual Verification
    agents: [qa-guardian]
    mcp_tools:
      browser: [browser_navigate, browser_screenshot, browser_assert_visible]
    tasks: [verify_ui_components]
```

**Implementation:**

1. Install `@anthropic-ai/playwright-mcp-server` or build custom
2. Add to `opencode.json` MCP servers
3. Give `qa-guardian` and `frontend-ui-ux` browser tool permissions
4. Add screenshot comparison (pixel diff) for regression detection

---

## 4. Feature Roadmap

### Sprint 1: Velocity (This Week)

| #   | Feature                     | Effort | Impact      |
| --- | --------------------------- | ------ | ----------- |
| 1   | Fix diagnostic injection    | 2h     | 🔴 Critical |
| 2   | Unify LSP bridge            | 4h     | 🔴 Critical |
| 3   | Deduplication + race safety | 3h     | 🟡 High     |
| 4   | Task briefing inheritance   | 6h     | 🟡 High     |
| 5   | Clarification gate          | 4h     | 🟡 High     |

### Sprint 2: Resilience (Next 2 Weeks)

| #   | Feature               | Effort | Impact    |
| --- | --------------------- | ------ | --------- |
| 6   | Unified checkpointing | 8h     | 🟡 High   |
| 7   | Lazy tool loading     | 6h     | 🟡 High   |
| 8   | Browser MCP server    | 8h     | 🟡 High   |
| 9   | Token budget tracking | 4h     | 🟢 Medium |
| 10  | Skill versioning      | 6h     | 🟢 Medium |

### Sprint 3: Intelligence (Next Month)

| #   | Feature                     | Effort | Impact    |
| --- | --------------------------- | ------ | --------- |
| 11  | Dynamic workflow generation | 12h    | 🟡 High   |
| 12  | Cognitive role sub-agents   | 10h    | 🟡 High   |
| 13  | Cross-session memory        | 8h     | 🟢 Medium |
| 14  | Inner TDD loop              | 8h     | 🟢 Medium |
| 15  | Agent team dashboard        | 10h    | 🟢 Medium |

### Sprint 4: Ecosystem (Quarter)

| #   | Feature                    | Effort | Impact    |
| --- | -------------------------- | ------ | --------- |
| 16  | Plugin marketplace         | 16h    | 🟢 Medium |
| 17  | Community skill registry   | 12h    | 🟢 Medium |
| 18  | Multi-repo orchestration   | 14h    | 🟢 Medium |
| 19  | Self-healing configuration | 10h    | 🟢 Medium |

---

## 5. Developer Experience

### 5.1 Agent Team Dashboard

Add a web dashboard at `http://127.0.0.1:59596/dashboard` showing:

```
┌─────────────────────────────────────────────────────────┐
│  OpenCode Agent Dashboard                               │
├─────────────────────────────────────────────────────────┤
│  Active Agents: 3        Token Burn: 12.4K / 128K      │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │
│  │lead-strateg │  │backend-lara │  │qa-guardian  │    │
│  │  Status: 🟢 │  │  Status: 🟡 │  │  Status: ⏳ │    │
│  │  Task: Plan │  │  Task: Impl │  │  Task: Test │    │
│  │  Tokens: 2K │  │  Tokens: 8K │  │  Tokens: 2K │    │
│  └─────────────┘  └─────────────┘  └─────────────┘    │
│                                                         │
│  Message Throughput: 45 msg/min                         │
│  Bottleneck: backend-laravel (waiting on db)            │
│                                                         │
│  Recent Diagnostics:                                    │
│  ⚠️  test.ts:5 - Type error                             │
│  ✅  auth.php:12 - No issues                            │
└─────────────────────────────────────────────────────────┘
```

**Implementation:**

- Extend existing web server (`opencode web`)
- WebSocket connection for real-time updates
- Store metrics in sqlite MCP, stream to dashboard

### 5.2 `/doctor` Command Enhancement

Current `/doctor` likely checks config health. Expand it:

```bash
/doctor
├── Config Health: 95%
│   ├── opencode.json: valid
│   ├── Agent configs: 12/12 valid
│   └── Plugin configs: 10/10 valid
├── MCP Health: 7/8 online
│   ├── context7: ✅ (30ms)
│   ├── sqlite: ✅ (5ms)
│   └── language-server: ❌ (timeout)
├── Skill Registry: 63 skills
│   ├── Valid: 60
│   └── Invalid: 3 (missing SKILL.md frontmatter)
├── Test Suite: 56/56 passing
├── Disk Space: 12GB free
└── Recommendations:
    1. Restart language-server MCP (timeout)
    2. Fix skills: pdf, ppt, xlsx (missing frontmatter)
    3. Update context7 timeout to 45s (slow responses)
```

### 5.3 Interactive Workflow Visualization

When a workflow runs, show live progress:

```bash
$ /workflow feature-development

🚀 Feature Development Workflow
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Phase 1: Strategy & Analysis        ✅ 2m 34s
  ├── lead-strategist: Requirements  ✅
  └── lead-architect: Architecture   ✅

Phase 2: Design & Planning          ⏳ 1m 12s
  ├── frontend-ui-ux: UI Mockups     🔄
  └── backend-laravel: API Design    ⏳

Phase 3: Implementation             ⬜
Phase 4: QA & Security              ⬜
Phase 5: Documentation              ⬜

Token Usage: 8,432 / 128,000
Estimated Completion: 12m
```

---

## 6. Testing & Quality

### 6.1 Testing Pyramid

```
        ┌─────────────┐
        │   E2E Tests │  (Workflow execution)
        │    20 tests │
        ├─────────────┤
        │  Integration│  (Agent delegation, MCP)
        │    40 tests │
        ├─────────────┤
        │    Unit     │  (Plugins, skills, utils)
        │   100 tests │
        └─────────────┘
```

### 6.2 Tests to Add Immediately

| Test Category   | What to Test                                | Priority    |
| --------------- | ------------------------------------------- | ----------- |
| **Behavioral**  | Model receives diagnostics after write      | 🔴 Critical |
| **Behavioral**  | Task briefing reaches child agent           | 🔴 Critical |
| **Behavioral**  | Clarification gate blocks on low confidence | 🟡 High     |
| **Integration** | Workflow checkpoint creates 4 layers        | 🟡 High     |
| **Integration** | Lazy tool loading reduces context by 60%    | 🟡 High     |
| **Integration** | Browser MCP captures screenshot             | 🟢 Medium   |
| **E2E**         | Full feature-development workflow           | 🟢 Medium   |
| **E2E**         | Bug-fix workflow with retry policy          | 🟢 Medium   |

### 6.3 Test Infrastructure

```typescript
// tests/helpers/workflow-runner.ts
export async function runWorkflow(
  workflowName: string,
  inputs: Record<string, any>
): Promise<WorkflowResult> {
  const workflow = loadWorkflow(workflowName);
  const runner = new WorkflowRunner(workflow);

  // Mock MCP servers for isolation
  runner.mockMcp("sqlite", mockSqlite);
  runner.mockMcp("memory", mockMemory);

  // Track all delegations
  const delegations: TaskDelegation[] = [];
  runner.on("delegate", (d) => delegations.push(d));

  const result = await runner.execute(inputs);

  return { result, delegations, metrics: runner.metrics };
}
```

---

## 7. Community & Ecosystem

### 7.1 Plugin Marketplace

**Structure:**

```
marketplace/
├── plugins/
│   ├── @zakarialabib/agent-router/
│   ├── @community/browser-mcp/
│   └── @community/slack-notifications/
├── skills/
│   ├── @zakarialabib/laravel-feature-scaffold/
│   └── @community/react-native-scaffold/
└── workflows/
    ├── @zakarialabib/feature-development/
    └── @community/security-audit/
```

**Discovery:**

```bash
# Search marketplace
opencode marketplace search "browser"
→ @community/browser-mcp - Visual testing via Playwright
→ @community/puppeteer-mcp - Alternative browser automation

# Install
opencode marketplace install @community/browser-mcp
→ Downloads to plugins/@community/browser-mcp/
→ Auto-registers in opencode.json
→ Runs compatibility check
```

### 7.2 Contribution Templates

Add to `.github/`:

**Plugin template:**

```typescript
// .github/templates/plugin.ts
import { Plugin, tool } from "@opencode-ai/plugin";

const {{name}}: Plugin = async ({ client, project, directory }) => {
  return {
    tool: {
      {{tool_name}}: tool({
        description: "What this tool does",
        args: {
          param: tool.schema.string().describe("A parameter"),
        },
        async execute({ param }) {
          await client.app.log({
            body: { service: "{{name}}", level: "info", message: "Executed" }
          });
          return `Result: ${param}`;
        },
      }),
    },
  };
};

export default {{name}};
```

**Skill template:**

```markdown
---
name: { { name } }
description: { { description } }
license: MIT
compatibility: opencode >=2.0.0
metadata:
  audience: developers
  category: { { category } }
---

## What I do

- Capability 1
- Capability 2

## When to use me

Use this skill when...

## MCP Integration

- `context7`: Fetch docs
- `sqlite`: Store data
```

### 7.3 Documentation Site

Convert your `docs/` folder into a proper documentation site:

```bash
# Using VitePress or Docusaurus
npm install -D vitepress

# Structure:
docs/
├── .vitepress/
│   └── config.ts
├── guide/
│   ├── getting-started.md
│   ├── agents.md
│   ├── plugins.md
│   └── workflows.md
├── api/
│   ├── plugin-api.md
│   └── skill-format.md
└── examples/
    ├── feature-development.md
    └── bug-fix.md
```

**Deploy to GitHub Pages:**

```yaml
# .github/workflows/docs.yml
name: Deploy Docs
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm install
      - run: npm run docs:build
      - uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./docs/.vitepress/dist
```

---

## 8. Implementation Playbooks

### 8.1 Playbook: Adding a New MCP Server

```bash
# 1. Create server definition
mkdir mcp-servers/my-server
cat > mcp-servers/my-server/config.yaml << 'EOF'
name: my-server
type: stdio
command: node ./mcp-servers/my-server/index.js
env:
  API_KEY: ${MY_API_KEY}
timeout: 15000
EOF

# 2. Implement server
# Follow MCP protocol: https://modelcontextprotocol.io

# 3. Register in opencode.json
jq '.mcp_servers.my-server = {
  "command": "node mcp-servers/my-server/index.js",
  "timeout": 15000
}' opencode.json > opencode.json.tmp && mv opencode.json.tmp opencode.json

# 4. Add health check
# In plugins/mcp-manager.ts, add:
const healthChecks = {
  ...existingChecks,
  'my-server': async () => {
    const result = await fetch('http://localhost:my-server-port/health');
    return result.ok;
  }
};

# 5. Test
npm test -- --grep "mcp-manager"
```

### 8.2 Playbook: Creating a Dynamic Workflow

````typescript
// skills/dynamic-workflow/SKILL.md
---
name: dynamic-workflow
description: Generate workflows on-the-fly for novel tasks
---

## Workflow Generation Protocol

1. **Analyze** the request for novelty
2. **Check** existing workflows for partial matches
3. **Synthesize** a new workflow YAML
4. **Validate** against schema
5. **Execute** with monitoring

## Template

```yaml
name: {{workflow_name}}
version: 2.0.0
description: {{description}}
phases:
  {{#phases}}
  - name: {{name}}
    agents: [{{agents}}]
    {{#use_agent_router}}use_agent_router: true{{/use_agent_router}}
    tasks: [{{tasks}}]
    {{#parallel_groups}}
    parallel_groups:
      {{#groups}}
      - [{{tasks}}]
      {{/groups}}
    {{/parallel_groups}}
    exit_criteria:
      {{#criteria}}
      - {{.}}
      {{/criteria}}
  {{/phases}}
````

````

### 8.3 Playbook: Adding Cognitive Role Sub-Agents

```json
// opencode.json additions
{
  "agent": {
    "plan-backend-laravel": {
      "description": "Planning mode for Laravel tasks",
      "model": "opencode-go/kimi-k2.6",
      "temperature": 0.1,
      "instructions": [
        "You are a planner. Do not write code.",
        "Analyze requirements and produce a detailed implementation plan.",
        "Identify files to modify, dependencies, and potential risks.",
        "Output: Markdown plan with checkboxes."
      ],
      "permission": {
        "read": "allow",
        "write": "deny",
        "edit": "deny",
        "bash": "deny"
      }
    },
    "explore-backend-laravel": {
      "description": "Exploration mode for Laravel tasks",
      "model": "opencode/hy3-preview-free",
      "temperature": 0.2,
      "instructions": [
        "You are an explorer. Do not write code.",
        "Read files, understand patterns, and report findings.",
        "Use codesearch and grep extensively."
      ],
      "permission": {
        "read": "allow",
        "write": "deny",
        "edit": "deny",
        "bash": "deny"
      }
    },
    "implement-backend-laravel": {
      "description": "Implementation mode for Laravel tasks",
      "model": "opencode-go/kimi-k2.6",
      "temperature": 0.3,
      "instructions": [
        "You are an implementer. Execute plans precisely.",
        "Follow the provided plan from plan-backend-laravel.",
        "Write clean, tested code following PSR-12."
      ],
      "permission": {
        "read": "allow",
        "write": "allow",
        "edit": "allow",
        "bash": "ask"
      }
    }
  }
}
````

**Usage in workflow:**

```yaml
phases:
  - name: Plan
    agents: [plan-backend-laravel]
    tasks: [create_implementation_plan]

  - name: Explore
    agents: [explore-backend-laravel]
    tasks: [analyze_codebase_patterns]

  - name: Implement
    agents: [implement-backend-laravel]
    tasks: [execute_plan]
    dependencies: [Plan, Explore]
```

---

## 9. Metrics & Success Criteria

### 9.1 Key Performance Indicators

| Metric                       | Current | Target        | Measurement                  |
| ---------------------------- | ------- | ------------- | ---------------------------- |
| Test pass rate               | 56/56   | 100/100       | CI/CD                        |
| Workflow success rate        | ?       | >90%          | sqlite MCP tracking          |
| Average task completion time | ?       | <5 min        | Performance plugin           |
| Token efficiency             | ?       | <50K per task | Token budget plugin          |
| Agent routing accuracy       | ?       | >85%          | User feedback + auto-scoring |
| User clarification rate      | ?       | <20%          | Clarification gate tracking  |
| Plugin load time             | ?       | <2s           | Process monitor              |
| MCP health uptime            | ?       | >99%          | Health check logs            |

### 9.2 Success Criteria by Sprint

**Sprint 1 (Velocity):**

- [ ] All diagnostics reach model context (verified by behavioral test)
- [ ] LSP bridge unified with CLI fallback
- [ ] No duplicate diagnostics within 30s window
- [ ] Task briefing reduces delegation latency by 30%
- [ ] Clarification gate triggers on <0.7 confidence

**Sprint 2 (Resilience):**

- [ ] `/undo` rolls back git + db + memory + task state
- [ ] Lazy tool loading reduces initial context by 60%
- [ ] Browser MCP captures and compares screenshots
- [ ] Token budget alerts at 80% usage
- [ ] All skills have semver in frontmatter

**Sprint 3 (Intelligence):**

- [ ] Dynamic workflow generation for 5 novel task types
- [ ] Cognitive roles reduce token usage by 25%
- [ ] Cross-session memory loads user preferences
- [ ] Inner TDD loop: red→green→refactor in <3 turns
- [ ] Dashboard shows real-time agent status

**Sprint 4 (Ecosystem):**

- [ ] 10+ community plugins in marketplace
- [ ] Documentation site deployed to GitHub Pages
- [ ] Multi-repo orchestration works across 3+ repos
- [ ] Self-healing config fixes 80% of `/doctor` issues automatically

---

## Appendix A: Configuration Reference

### Recommended opencode.json Structure (v2.1)

```json
{
  "version": "2.1.0",
  "model": "opencode-go/kimi-k2.6",
  "agents": {
    "lead-strategist": {
      "description": "Strategic orchestrator",
      "model": "opencode-go/kimi-k2.6",
      "temperature": 0.2,
      "instructions": ["..."],
      "permission": {
        "task": "allow",
        "skill": "allow",
        "bash": "allow",
        "clarify": "allow"
      }
    }
  },
  "mcp_servers": {
    "context7": { "command": "...", "timeout": 30000 },
    "sqlite": { "command": "...", "timeout": 10000 },
    "memory": { "command": "...", "timeout": 10000 },
    "browser": { "command": "...", "timeout": 30000 }
  },
  "plugins": [
    "plugins/index.ts",
    "plugins/agent-router.ts",
    "plugins/mcp-manager.ts",
    "plugins/skill-manager.ts",
    "plugins/context-manager.ts",
    "plugins/language-context-bridge.ts",
    "plugins/checkpoint-manager.ts"
  ],
  "workflows": {
    "feature-development": "workflows/feature-development.yaml",
    "bug-fix": "workflows/bug-fix.yaml",
    "dynamic": "workflows/dynamic-workflow.yaml"
  },
  "performance": {
    "track_metrics": ["time_to_complete", "token_usage", "success_rate"],
    "store_metrics_in": "sqlite",
    "alert_thresholds": {
      "token_usage": 0.8,
      "time_to_complete": 300000
    }
  },
  "checkpoints": {
    "auto_create_before_workflows": true,
    "layers": ["git", "db", "memory", "task_state"],
    "retention": "7d"
  }
}
```

### Appendix B: File Structure (Target)

```
opencode/
├── opencode.json              # Main config
├── package.json
├── tsconfig.json
├── vitest.config.ts
│
├── agents/                    # 12 agents + cognitive roles
│   ├── core-factory.json
│   ├── lead-strategist.json
│   ├── backend-laravel.json
│   ├── plan-backend-laravel.json      # NEW
│   ├── explore-backend-laravel.json   # NEW
│   ├── implement-backend-laravel.json # NEW
│   └── ...
│
├── skills/                    # 63+ skills with semver
│   ├── index.json
│   ├── git-release/
│   │   ├── SKILL.md
│   │   └── CHANGELOG.md       # NEW
│   └── ...
│
├── plugins/                   # 10+ plugins + tests
│   ├── index.ts
│   ├── agent-router.ts
│   ├── mcp-manager.ts
│   ├── checkpoint-manager.ts  # NEW
│   ├── token-budget.ts        # NEW
│   ├── browser-mcp-bridge.ts  # NEW
│   └── tests/
│       ├── ambient-feedback.test.js
│       ├── core-plugins-e2e.test.js
│       ├── checkpoint.test.js # NEW
│       └── ...
│
├── workflows/                 # Static + dynamic
│   ├── feature-development.yaml
│   ├── bug-fix.yaml
│   └── dynamic-workflow-generator.yaml  # NEW
│
├── mcp-servers/               # MCP server configs
│   ├── context7.yaml
│   ├── browser-mcp.yaml       # NEW
│   └── ...
│
├── docs/                      # Documentation site
│   ├── .vitepress/            # NEW
│   ├── guide/
│   ├── api/
│   └── examples/
│
├── rules/                     # Code style guidelines
├── tools/                     # Utility scripts
├── scripts/                   # Build & deployment
├── .github/                   # CI/CD + templates
│   ├── workflows/
│   │   ├── test.yml
│   │   ├── docs.yml           # NEW
│   │   └── release.yml        # NEW
│   ├── templates/             # NEW
│   │   ├── plugin.ts
│   │   ├── skill.md
│   │   └── workflow.yaml
│   └── ISSUE_TEMPLATE/
│
└── marketplace/               # NEW (local cache)
    ├── plugins/
    └── skills/
```

---

## Appendix C: Quick Reference Card

### Commands

| Command            | Purpose             | Agent           |
| ------------------ | ------------------- | --------------- |
| `/agent <name>`    | Switch agent        | Any             |
| `/build`           | Run build           | core-factory    |
| `/test`            | Run tests           | qa-guardian     |
| `/lint`            | Run linter          | qa-guardian     |
| `/undo`            | Rollback checkpoint | devops-engineer |
| `/doctor`          | Health check        | devops-engineer |
| `/reflect`         | Self-improvement    | docs-curator    |
| `/workflow <name>` | Run workflow        | lead-strategist |
| `/checkpoint`      | Manual snapshot     | devops-engineer |

### Plugin Hooks

| Hook                  | When                      | Use Case                        |
| --------------------- | ------------------------- | ------------------------------- |
| `tool.execute.before` | Before tool runs          | Validation, logging             |
| `tool.execute.after`  | After tool runs           | LSP feedback, checkpointing     |
| `chat.message`        | Before model sees message | Inject diagnostics, briefing    |
| `chat.params`         | Before API call           | Lazy tool loading, budget check |
| `workflow.start`      | Workflow begins           | Auto-checkpoint                 |
| `workflow.end`        | Workflow completes        | Metrics, cleanup                |

### Workflow Features

| Feature            | YAML Key          | Description                 |
| ------------------ | ----------------- | --------------------------- |
| Parallel execution | `parallel_groups` | Run tasks concurrently      |
| Retry policy       | `retry_policy`    | Exponential/linear backoff  |
| MCP tools          | `mcp_tools`       | Per-phase tool scoping      |
| Exit criteria      | `exit_criteria`   | Phase completion conditions |
| Notifications      | `notifications`   | Slack/webhook alerts        |
| Performance        | `performance`     | Metrics tracking            |
| Security           | `security`        | Vulnerability scanning      |

---

_Generated for OpenCode v2.0.0 by strategic analysis of current architecture vs. state-of-the-art agentic frameworks (Claude Code, OpenCode SST, OpenClaude, Cline, Roo Code)._

_Last updated: 2026-05-08_
