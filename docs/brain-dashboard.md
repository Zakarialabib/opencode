# Brain Dashboard Specification

## Overview

The Brain Dashboard is the web-based control plane for the OpenCode Brain plugin. It runs as an Express application in `brain-dashboard/app.ts`, exposes a JSON API surface, and serves UI assets for managing model settings, search/chat, indexing, health checks, telemetry, and runtime integrations.

## Purpose

- Expose Brain runtime configuration and embedded model state.
- Provide health and pipeline diagnostics for retrieval, embedding, reranking, and index readiness.
- Enable model selection, local model downloads, and LM Studio connectivity checks.
- Support search and chat workflows backed by the Brain plugin.
- Surface telemetry, RAG sessions, feedback, and harness execution records.

## Architecture

### Core components

- `brain-dashboard/app.ts`
  - Main Express server with JSON middleware, CORS, and API route definitions.
  - Reads runtime config from environment variables, brain database state, and `opencode.json` files.
  - Delegates search, chat, indexing, and telemetry operations to `brain-plugin/` helpers.

- `brain-dashboard/package.json`
  - Declares dependencies such as `express`, `cors`, and `better-sqlite3`.
  - Starts dashboard via `tsx` from the workspace.

- `brain-plugin/`
  - Provides the shared Brain runtime implementation: retrieval, embedding, reranking, indexing, session/telemetry storage, and prompt injection.

### Runtime flow

1. Load environment configuration and determine `BRAIN_PROJECT_ROOT`.
2. Initialize Express and attach API routes and static asset serving.
3. Query Brain database state for models, indexing, and telemetry.
4. Route search/chat requests through Brain retrieval, decision-tree intent classification, and LM Studio or local model providers.
5. Record telemetry and session data in SQLite.

## Configuration

### Environment variables

- `BRAIN_PROJECT_ROOT` – OpenCode project path.
- `BRAIN_DB_PATH` – Brain SQLite DB path (usually under `.opencode/brain.db`).
- `LMSTUDIO_BASE_URL` – LM Studio endpoint base URL.
- `CHAT_MODEL_ID` – chat model ID used for the streaming and non-streaming chat endpoints.
- `OPENCODE_SERVER_BASE_URL` – upstream OpenCode server base URL for `/api/opencode/*` proxies.
- `BRAIN_DASHBOARD_PORT` / `PORT` – port the dashboard listens on.

### Runtime defaults and behavior

- Model and index job progress is stored in-memory and exposed via `/api/models/download/job` and `/api/index/job`.
- Chat uses Brain-augmented prompts assembled from retrieved context and injected via the plugin context injector.
- The dashboard supports both LM Studio backends and local model discovery.
- Config sync validation compares `opencode.json` and `brain-plugin/opencode.json` provider/mcp settings.

## API Surface

### Config and settings

- `GET /api/config`
  - Returns runtime config, current `CHAT_MODEL_ID`, embedding backend status, reranker status, fusion weights, and `max_context_tokens`.

- `GET /api/settings`
  - Returns `ok`, environment variables, runtime state, and config sync metadata.
  - Includes `chat_model_id`, embedding/reranker/fusion state, `max_context_tokens`, and whether `opencode.json` and `brain-plugin/opencode.json` are synced.

- `GET /api/settings/models`
  - Builds and returns selectable model metadata for dashboard model settings.

- `POST /api/settings/models`
  - Accepts a model selection payload and applies it to the runtime embedding/reranker configuration.

- `GET /api/models`
  - Alias for the same model inventory payload as `/api/settings/models`.

- `POST /api/models`
  - Also applies model selection; identical to `/api/settings/models`.

- `GET /api/models/local`
  - Returns local model cache directory path and scanned local models.

- `GET /api/models/download/job`
  - Returns the current in-memory model download/prewarm job state.

- `POST /api/models/download`
  - Starts a background download/prewarm job for `kind` = `embed` or `rerank` and a `modelId`.
  - Returns `202 Accepted` with job metadata.

- `GET /api/settings/config-file?path=<relativePath>`
  - Reads a JSON config file under `BRAIN_PROJECT_ROOT` and returns its contents.
  - Rejects paths outside the project root.

### Health and diagnostics

- `GET /api/health/lmstudio`
  - Verifies LM Studio connectivity and available model IDs.
  - Returns loaded model counts and `_has_chat`, `_has_embed`, `_has_rerank` runtime flags.

- `POST /api/health/embed`
  - Validates the embedding backend with a sample query.
  - Returns embedding vector dimensions and status.

- `POST /api/health/rerank`
  - Validates the reranker backend with sample passages.
  - Returns reranker load status and reranked result scores.

- `GET /api/health/brain`
  - Probes Brain plugin health, including DB statistics, LM Studio connection, embedding, reranking, and retrieval test results.

- `GET /api/status`
  - Returns dashboard status metrics, index health, DB counts, LM Studio status, and memory status.

### Smart input, intent, budget, and tuning

- `POST /api/smart/detect`
  - Detects input type from raw text: `url`, `folder`, `file`, `code`, `query`, or `unknown`.
  - Useful for dashboard smart ingest or query UI.

- `GET /api/intent?q=<query>`
  - Classifies a query using the Brain decision tree and returns `intent`, `confidence`, `strategy`, and `maxChunks`.

- `GET /api/budget`
  - Returns the current token budget from `max_context_tokens` plus fixed budget fields.

- `POST /api/budget`
  - Updates the `max_context_tokens` budget.
  - Body: `{ token_budget: <number> }`.

- `GET /api/budget/presets`
  - Returns hard-coded budget presets: Small, Medium, Large, XLarge.

- `GET /api/intent/presets`
  - Returns hard-coded intent presets including `auto`, `learn`, `refactor`, `feature`, `debug`, `test`, and `quick_chat`.

- `GET /api/tuning`
  - Returns fusion weights, reranker status, and embedding status.

- `POST /api/tuning`
  - Updates RRF fusion weights and optional `rrfK`.
  - Accepts `alpha`, `beta`, `gamma`, and `rrfK` in the request body.

### Memory and diagnostic lookup

- `GET /api/memory`
  - Lists top memory concepts and clusters from the Brain DB.

- `GET /api/memory/:conceptId`
  - Returns detail for a memory concept and related chunks.

- `GET /api/tracer`
  - Returns decision trace metrics, success rate, and recent decision history for intent routing.

### Index and pipeline

- `GET /api/rag/pipeline`
  - Returns readiness for extraction, chunking, FTS, embedding, fusion, and reranking stages.
  - Includes counts for files, chunks, FTS rows, and vector embeddings.

- `GET /api/config/sync`
  - Compares `opencode.json` and `brain-plugin/opencode.json` provider/mcp settings.
  - Returns `synced`, diff details, and file paths.

- `POST /api/config/sync`
  - Triggers config sync validation and reconciliation logic.
  - The dashboard can use this endpoint to refresh sync state after config changes.

- `GET /api/status`
  - Returns overall Brain dashboard status including LM Studio availability, DB health, index status, memory status, and raw metrics.

- `GET /api/index`
  - Returns index health and counts for files, chunks, FTS index rows, and vector records.

- `GET /api/index/job`
  - Returns the current indexing job state.

- `POST /api/index`
  - Controls indexing actions: `reindex_full`, `reindex_dirty`, or `clear_queue`.

### Search and chat

- `GET /api/search`
  - Performs a retrieval query using `q` or `query` plus optional `intent`, `topK`, `confidence`, and `debug` flags.

- `POST /api/search`
  - Performs the same search pipeline with a JSON body.

- `POST /api/chat/stream`
  - Performs streamed chat via LM Studio at `LMSTUDIO_BASE_URL/chat/completions`.
  - Uses Brain retrieval, intent classification, prompt injection, and streaming SSE responses.

- `POST /api/chat`
  - Performs non-streaming chat using the same retrieval/augmentation pipeline.
  - Returns `response`, `sessionId`, request `debug` metadata, and context diagnostics.

### Feedback and telemetry

- `POST /api/feedback`
  - Records either chunk-level helpfulness feedback or session rating feedback.
  - Body supports `{ chunk_id, helpful }` or `{ sessionId, rating, usedChunkIds }`.

- `GET /api/telemetry/runs`
  - Returns recent telemetry run records.

- `GET /api/telemetry/run/:id`
  - Returns a single telemetry run by ID.

- `GET /api/telemetry/events`
  - Returns raw telemetry event records filtered by `traceId`, `sessionId`, or `level`.

- `POST /api/telemetry/purge`
  - Purges old telemetry data according to configured retention.

- `GET /api/rag/sessions`
  - Returns recent RAG session records with retrieved and used chunk IDs.

- `GET /api/rag/session/:id`
  - Returns a single RAG session and related chunk snippets.

- `POST /api/rag/session/:id/feedback`
  - Records session feedback with `rating` = `1` or `-1` and optional `usedChunkIds`.

### External integrations

- `GET /api/opencode/health`
  - Proxies an upstream health check to `OPENCODE_SERVER_BASE_URL/global/health`.

- `GET /api/opencode/sessions`
  - Proxies upstream session data from `OPENCODE_SERVER_BASE_URL/session`.

### Harness and benchmarking

- `GET /api/harness/runs`
  - Returns telemetry runs where `kind = 'harness'`.

- `POST /api/harness/run`
  - Runs a benchmark suite in either `full` or `smoke` mode and `live` or `simulated` mode.
  - Uses `meta-harness/runner.ts` and writes results under `.opencode/meta-harness-logs`.

## Important implementation details

- Most runtime state is derived from the Brain SQLite DB and `brain-plugin` helpers.
- `POST /api/models/download` starts a background warmup job and returns an optimistic `job` object.
- `POST /api/index` returns an active index job and supports `reindex_full`, `reindex_dirty`, and `clear_queue`.
- `/api/chat/stream` uses SSE and forwards LM Studio chunked responses to the browser.
- Intent classification is used by both `/api/search` and `/api/chat*` to choose retrieval strategy.

## Startup and deployment

### Install

```bash
cd brain-dashboard
npm install
```

### Run

```bash
npm start
```

### Access

- Dashboard UI: `http://localhost:3456`

### Overrides

```bash
BRAIN_PROJECT_ROOT=c:\opencode \
BRAIN_DB_PATH=c:\opencode\.opencode\brain.db \
LMSTUDIO_BASE_URL=http://localhost:1234/v1 \
CHAT_MODEL_ID=qwen/qwen3-4b-2507 \
OPENCODE_SERVER_BASE_URL=http://127.0.0.1:4096 \
BRAIN_DASHBOARD_PORT=3456 \
npm start
```

## Notes

- The dashboard is intended to run alongside the OpenCode Brain plugin and an LM Studio instance.
- It exposes model, index, health, search/chat, telemetry, and harness controls from the source implementation.
- Health and pipeline readiness are computed from DB counts, FTS rows, local vector state, and configured model backends.
- Config sync validation is sourced from `opencode.json` and `brain-plugin/opencode.json` provider and MCP entries.
