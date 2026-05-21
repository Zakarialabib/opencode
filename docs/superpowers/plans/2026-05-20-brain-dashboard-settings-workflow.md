# Brain Dashboard Settings + Workflow Tabs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a dedicated Settings tab for model selection + runtime settings, merge Benchmarks/Index/Memory/Tracer into a single Workflow tab, and introduce Settings API endpoints while keeping all existing `/api/*` routes working.

**Architecture:** Keep the backend as a single Express server ([app.ts](file:///c:/opencode/brain-dashboard/app.ts)) and keep the legacy routes as wrappers. Add new `/api/settings/*` endpoints that share the same underlying in-memory state + SQLite-backed persistence already used by `/api/models`, `/api/tuning`, `/api/budget`. Frontend remains a single static [index.html](file:///c:/opencode/brain-dashboard/index.html) with tab switching; only the DOM structure and tab logic changes.

**Tech Stack:** Node + Express, TypeScript (tsx runtime), SQLite via `better-sqlite3` (through `brain-plugin/store`), plain HTML/CSS/JS.

---

### Task 1: Add Settings Endpoints (Backend)

**Files:**
- Modify: [app.ts](file:///c:/opencode/brain-dashboard/app.ts)

- [ ] **Step 1: Extract shared “models selection apply” logic into a function**

Create a helper that both `/api/models` and `/api/settings/models` can call, so we keep behavior identical:

```ts
async function applyModelSelection(body: { chat?: string; embed?: string; rerank?: string }): Promise<void> {
  if (typeof body.chat === 'string' && body.chat.trim()) {
    chatModelId = body.chat.trim();
    dbSet('chat_model_id', chatModelId);
  }

  if (typeof body.embed === 'string' && body.embed.trim()) {
    const raw = body.embed.trim();
    if (raw.startsWith('local:')) {
      const modelId = raw.slice('local:'.length).trim();
      setEmbeddingConfig({ backend: 'local', localModelId: modelId });
      dbSet('embed_backend', 'local');
      dbSet('embed_model_id', modelId);
    } else {
      const modelId = raw.startsWith('lmstudio:') ? raw.slice('lmstudio:'.length).trim() : raw;
      setEmbeddingConfig({ backend: 'lmstudio', lmstudioModelId: modelId });
      dbSet('embed_backend', 'lmstudio');
      dbSet('embed_model_id', modelId);
    }
  }

  if (typeof body.rerank === 'string' && body.rerank.trim()) {
    const raw = body.rerank.trim();
    if (raw === 'off') {
      setRerankerEnabled(false);
      dbSet('rerank_enabled', 'false');
    } else if (raw.startsWith('local:')) {
      const modelId = raw.slice('local:'.length).trim();
      setRerankerEnabled(true);
      setRerankerModelId(modelId);
      dbSet('rerank_enabled', 'true');
      dbSet('rerank_model_id', modelId);
    } else {
      const modelId = raw.startsWith('lmstudio:') ? raw.slice('lmstudio:'.length).trim() : raw;
      setRerankerEnabled(true);
      setRerankerModelId(modelId);
      dbSet('rerank_enabled', 'true');
      dbSet('rerank_model_id', modelId);
    }
  }

  await ensureChatModelId();
}
```

- [ ] **Step 2: Extract “available/selected models” response building into a function**

This keeps `/api/models` and `/api/settings/models` responses in sync and ensures chat models continue to come from LM Studio `/v1/models`:

```ts
async function buildModelsPayload(): Promise<{
  ok: true;
  available: { chat: string[]; embed: string[]; rerank: string[] };
  selected: { chat: string; embed: string; rerank: string };
}> {
  const ids = await fetchLmStudioModels();
  const chat = ids.filter((id) => !/(embed|embedding|rerank|reranker)/i.test(String(id)));
  const embed = ids.filter((id) => /(embed|embedding)/i.test(String(id)));
  const rerank = ids.filter((id) => /(rerank|reranker)/i.test(String(id)));

  const embedCfg = getEmbeddingConfig();
  const embedSelected =
    embedCfg.backend === 'lmstudio'
      ? `lmstudio:${embedCfg.lmstudioModelId}`
      : `local:${embedCfg.localModelId}`;

  const rerankStatus = getRerankerStatus();
  const rerankSelected = rerankStatus.enabled ? `local:${rerankStatus.modelId}` : 'off';

  return {
    ok: true,
    available: {
      chat,
      embed: [`local:${embedCfg.localModelId}`, ...embed.map((m) => `lmstudio:${m}`)],
      rerank: ['off', `local:${rerankStatus.modelId}`, ...rerank.map((m) => `lmstudio:${m}`)]
    },
    selected: {
      chat: chatModelId,
      embed: embedSelected,
      rerank: rerankSelected
    }
  };
}
```

- [ ] **Step 3: Add `/api/settings` and `/api/settings/models` endpoints**

Add:
- `GET /api/settings`: returns the same runtime settings you already expose via `/api/config`, but nested and with an `ok: true` wrapper.
- `GET /api/settings/models`: returns the same payload as `/api/models`.
- `POST /api/settings/models`: applies model changes via `applyModelSelection`.

```ts
app.get('/api/settings', (_req, res) => {
  const maxContextTokens = Number(dbGet('max_context_tokens') ?? '3000');
  res.json({
    ok: true,
    env: config,
    runtime: {
      chat_model_id: chatModelId,
      embedding: getEmbeddingConfig(),
      reranker: getRerankerStatus(),
      fusion: getFusionWeights(),
      max_context_tokens: Number.isFinite(maxContextTokens) ? maxContextTokens : 3000
    }
  });
});

app.get('/api/settings/models', async (_req, res) => {
  try {
    res.json(await buildModelsPayload());
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message ?? String(e) });
  }
});

app.post('/api/settings/models', async (req, res) => {
  try {
    await applyModelSelection(req.body ?? {});
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message ?? String(e) });
  }
});
```

- [ ] **Step 4: Rewire existing `/api/models` handlers to use the shared helpers**

Replace the implementation bodies of:
- `GET /api/models` → `res.json(await buildModelsPayload())`
- `POST /api/models` → `await applyModelSelection(req.body ?? {})`

This keeps the old API stable but ensures no behavior drift.

- [ ] **Step 5: Sanity-check server still boots**

Run from repo root:

```bash
npm run --prefix brain-dashboard start
```

Expected: server prints `Brain dashboard server running on http://localhost:3456`.

---

### Task 2: Merge UI Tabs and Move Model Selection into Settings (Frontend)

**Files:**
- Modify: [index.html](file:///c:/opencode/brain-dashboard/index.html)

- [ ] **Step 1: Update the tab bar to introduce Settings + Workflow and remove old tabs**

Replace the tab buttons block with:

```html
<div class="tabs-container">
  <button class="tab-btn active" onclick="switchTab('search')">Search</button>
  <button class="tab-btn" onclick="switchTab('intent')">Intent</button>
  <button class="tab-btn" onclick="switchTab('tuning')">Tuning</button>
  <button class="tab-btn" onclick="switchTab('budget')">Budget</button>
  <button class="tab-btn" onclick="switchTab('chat')">Chat</button>
  <button class="tab-btn" onclick="switchTab('workflow')">Workflow</button>
  <button class="tab-btn" onclick="switchTab('settings')">Settings</button>
</div>
```

- [ ] **Step 2: Add a new Settings tab, moving the model selection card into it**

Create:
- `div#tab-settings.tab-content`

Move the existing “Model Selection / Status” card (currently in `#tab-benchmarks`) into `#tab-settings` unchanged, including all existing IDs:
- `bench-config`
- `bench-lmstudio-models`
- `bench-select-chat`
- `bench-select-embed`
- `bench-select-rerank`
- `bench-apply-status`

This keeps the JS functions (`benchRefreshModelOptions`, `benchApplyModels`, etc.) working without renaming.

- [ ] **Step 3: Create a new Workflow tab and move Benchmark Buttons + Index Controls + Memory + Tracer into it**

Create:
- `div#tab-workflow.tab-content`

Then move these card sections into Workflow (preserve internal element IDs so existing JS keeps working):
- From old `#tab-benchmarks`: “Benchmark Buttons”, “Index Controls”, “Dashboard Features → Plugin Modules Mapping”.
- From old `#tab-index`: the “Index Health” + “Dirty File Queue” cards.
- From old `#tab-memory`: “Memory Clusters”, “Top Concepts”, and “Concept Details”.
- From old `#tab-tracer`: all tracer cards.

After moving, delete the old `#tab-benchmarks`, `#tab-index`, `#tab-memory`, `#tab-tracer` containers so they no longer exist as separate tabs.

- [ ] **Step 4: Update `switchTab()` to support Settings + Workflow**

Update the `switch(tabName)` branch so that:
- `workflow` triggers: `getMemory(); getIndexStatus(); getTracer(); refreshBenchmarks();`
- `settings` triggers: `benchRefreshConfig(); benchRefreshLmStudioModels(); benchRefreshModelOptions();`

Example:

```js
switch (tabName) {
  case 'tuning': getTuning(); break;
  case 'budget': getBudget(); break;
  case 'workflow':
    getMemory();
    getIndexStatus();
    getTracer();
    refreshBenchmarks();
    break;
  case 'settings':
    benchRefreshConfig();
    benchRefreshLmStudioModels();
    benchRefreshModelOptions();
    break;
}
```

- [ ] **Step 5: Smoke test the dashboard in a browser**

1) Start the server:

```bash
npm run --prefix brain-dashboard start
```

2) Open: `http://localhost:3456`

Expected:
- Tab bar shows Search/Intent/Tuning/Budget/Chat/Workflow/Settings.
- Settings contains model dropdowns and “Apply” still works.
- Workflow contains benchmark test buttons + index controls + memory + tracer content.
- No console errors when switching tabs.

---

### Task 3: Preserve Backwards Compatibility (Quick Checks)

**Files:**
- Modify: [app.ts](file:///c:/opencode/brain-dashboard/app.ts)

- [ ] **Step 1: Confirm old endpoints still respond**

With server running, run:

```bash
curl http://localhost:3456/api/models
curl http://localhost:3456/api/config
curl http://localhost:3456/api/settings
curl http://localhost:3456/api/settings/models
```

Expected:
- `/api/models` returns `{ ok: true, available: ..., selected: ... }`
- `/api/settings` returns `{ ok: true, env: ..., runtime: ... }`

