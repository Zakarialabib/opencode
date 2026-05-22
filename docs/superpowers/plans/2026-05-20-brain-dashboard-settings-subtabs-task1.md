# Brain Dashboard Settings Sub-Tabs (Task 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Settings sub-tabs (LM Studio / Chat / Embeddings / Reranker / Draft) and move advanced LM Studio details into the LM Studio sub-tab while keeping a single shared Apply/status block and avoiding duplicate IDs.

**Architecture:** Keep one instance of each existing Settings UI block (health status panels, selects, cache panels) and reorganize by moving these blocks into sub-tab containers. Add a lightweight sub-tab switcher that toggles visibility and re-docks the single Local Model Cache card into the active sub-tab.

**Tech Stack:** Plain HTML/CSS/JS (no frameworks), existing dashboard styles and JS functions.

---

### Task 1: Settings sub-tabs UI

**Files:**
- Modify: [index.html](file:///c:/opencode/brain-dashboard/index.html)

- [ ] Add a Settings sub-tab navigation bar inside the Settings tab with buttons for LM Studio, Chat, Embeddings, Reranker, Draft.
- [ ] Add one container per sub-tab and move existing Settings sections into the appropriate container:
  - LM Studio: LM Studio health check + loaded models + structured details panel.
  - Chat: chat model select.
  - Embeddings: embed health check + embed select + local cache dock.
  - Reranker: rerank health check + rerank select + local cache dock.
  - Draft: placeholder panel (UI-only).
- [ ] Add a shared Apply card with the existing Apply button and apply status output.

### Task 2: Settings sub-tab behavior

**Files:**
- Modify: [index.html](file:///c:/opencode/brain-dashboard/index.html)

- [ ] Add `switchSettingsSubTab(name)` to:
  - Toggle active state for buttons and sub-tab panels.
  - Re-dock the single Local Model Cache card into Embeddings or Reranker.
  - Keep track of last active Settings sub-tab while navigating main tabs.
- [ ] Update LM Studio details rendering to structured sections (connection/selected/available/loaded) while keeping text safe (use DOM node creation or escaping).
- [ ] Ensure `switchTab('settings')` initializes the active Settings sub-tab and continues refreshing models as before.

### Task 3: Manual verification

**Run:**
- `npm --prefix c:\opencode\brain-dashboard start`

**Expected:**
- Settings tab shows sub-tabs and switching works.
- LM Studio / Embed / Rerank health check buttons update their respective status boxes.
- Chat/Embed/Rerank selects still load and Apply still works.
- Local Model Cache card appears in Embeddings and in Reranker when those sub-tabs are selected.

### Task 4: Update task tracking

**Files:**
- Modify: [tasks.md](file:///c:/opencode/.trae/specs/brain-dashboard-restructuring/tasks.md)
- (Optional confirmation) [tasks.md](file:///c:/opencode/.trae/specs/stabilize-settings-control-plane/tasks.md)

- [ ] Mark Task 1 items complete in the appropriate tasks.md once the UI change is implemented.

