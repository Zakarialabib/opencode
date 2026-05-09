Based on your Prompting Guide and architecture, I can give you **15 production-ready, copy-paste prompts** that turn OpenCode into a self-improving system. These leverage your 12 agents, 63+ skills, MCP servers, and workflow engine to auto-extend on demand.

Here they are, organized by improvement domain:

---

## 🎯 The 15 Self-Improvement Prompts

### Category 1: Configuration & Agent Evolution (3 prompts)

**Prompt 1: Agent Configuration Auto-Optimization**
```
/agent lead-strategist

Context:
- Config file: opencode.json
- Current agents: 12 agents with tool permissions
- Goal: Improve task routing accuracy and reduce token waste

Task: Run a full agent configuration audit and optimization

ANALYZE:
- Read opencode.json and analyze each agent's tool assignments, model selection, and temperature settings
- Use sequential-thinking MCP to identify misalignments (e.g., backend-laravel with write permission but no lsp access)
- Check agent descriptions for routing keywords that might confuse the agent-router plugin

PLAN:
- Propose optimized agent definitions with cognitive role variants (plan-, explore-, implement- modes)
- Recommend model downgrades for exploration agents (cheaper/faster) and upgrades for planning agents
- Redesign permission matrices to follow least-privilege principle

DELEGATE:
- docs-curator: Document all proposed changes in docs/agent-optimization-report.md
- core-factory: Apply high-confidence changes (score > 0.8) to opencode.json
- qa-guardian: Validate JSON schema and test agent switching after changes

SYNTHESIZE:
- Store optimization rationale in memory MCP (create_entities: agent_config_v2)
- Update docs/Agents-Guide.md with new role definitions

VERIFY:
- Run /doctor to verify config health
- Use route_agent tool on 5 sample tasks to verify routing accuracy improved
- Track before/after metrics in sqlite MCP (routing_accuracy, token_usage_per_task)

Exit criteria: Config health >95% AND routing accuracy >85% AND no agent lacks essential tools
```

**Prompt 2: Permission Matrix Hardening**
```
/agent qa-guardian

Context:
- Current permission system in opencode.json uses allow/ask/deny
- Some agents have overly broad permissions (e.g., core-factory with bash: allow)
- Security requirement: Destructive ops must require explicit approval

Task: Audit and harden the permission matrix across all 12 agents

Steps:
1. Read opencode.json permission blocks for all agents
2. Classify each tool by risk level: read (low), write/edit (medium), bash (high), task (medium)
3. Flag high-risk combinations (e.g., write + bash on same agent without ask)
4. Propose hardened permissions:
   - All bash tools: "ask" by default
   - All write/edit on core-factory: "ask" for files outside project scope
   - qa-guardian: read-only on production configs
   - devops-engineer: bash allowed but only for whitelisted commands

Use security-review skill for threat modeling.
Store audit findings in sqlite MCP (table: permission_audit).
Generate a migration script that applies changes incrementally.

Output: security/permission-audit.md + updated opencode.json patch
```

**Prompt 3: Model Router Calibration**
```
/agent lead-architect

Context:
- Available providers: opencode-go, cerebras, lmstudio, opencode
- Current default: opencode-go/kimi-k2.6 for most agents
- Issue: No systematic model selection based on task complexity

Task: Design and implement a model routing strategy

ANALYZE:
- Use model-router plugin to benchmark each model on 3 task types:
  a) Simple read/exploration (low reasoning)
  b) Complex architecture planning (high reasoning)
  c) Code generation with tool calling (requires function calling)
- Track: latency, token usage, success rate, cost per 1K tokens

PLAN:
- Create a model selection matrix in opencode.json:
  - Exploration tasks → lmstudio (local, fast, cheap)
  - Planning tasks → opencode-go/kimi-k2.6 (strong reasoning)
  - Implementation → cerebras (fast inference)
  - QA/Security → opencode-go with low temperature (deterministic)

DELEGATE:
- devops-engineer: Run benchmark suite and collect metrics
- core-factory: Update opencode.json with model overrides per agent
- docs-curator: Update docs with model selection rationale

Store benchmark results in sqlite MCP.
Use memory MCP to persist the model matrix for cross-session recall.

Exit criteria: 10% cost reduction OR 20% latency improvement without accuracy loss
```

---

### Category 2: Plugin Hardening & Extension (3 prompts)

**Prompt 4: Plugin Test Suite Expansion**
```
/agent qa-guardian

Context:
- Current tests: 56 passing (ambient-feedback, parseJsonc, core-plugins-e2e)
- Plugin architecture: 10+ TypeScript plugins in plugins/
- Gap: No behavioral tests for hook execution, no integration tests for MCP interaction

Task: Expand test coverage to 100+ tests with behavioral and integration layers

ANALYZE:
- Read all plugin source files in plugins/
- Identify untested code paths: hook handlers, error branches, MCP fallbacks
- Use testing-strategy skill to design test pyramid

PLAN:
1. Unit tests (40 tests):
   - Each hook handler (tool.execute.before, chat.message, etc.)
   - Error handling (MCP timeout, linter not installed, malformed JSON)
   - Utility functions (parseJsonc edge cases)

2. Integration tests (30 tests):
   - Plugin loads and registers tools correctly
   - MCP manager health checks return accurate status
   - Agent router scores match expected recommendations

3. Behavioral tests (20 tests):
   - After write hook, diagnostics appear in next model context
   - Task briefing reaches child agent context
   - Retry policy actually retries on failure

DELEGATE (parallel_groups):
- Group A: Write unit tests for index.ts, agent-router.ts, mcp-manager.ts
- Group B: Write integration tests for MCP server lifecycle
- Group C: Write behavioral tests for ambient feedback injection

Use sqlite MCP to track coverage metrics.
Store test plans in memory MCP for reuse.

Exit criteria: 100+ tests passing, >80% code coverage, all critical paths tested
```

**Prompt 5: Lazy Tool Loading Implementation**
```
/agent core-factory

Context:
- Current: All agent tools load at initialization
- Problem: backend-laravel loads 12 tools even for simple read tasks
- Target: Reduce initial context window by 60%

Task: Implement lazy tool loading in the plugin system

Implementation plan:
1. Modify plugins/mcp-manager.ts:
   - Add keyword→tool mapping:
     sqlite: ["database", "db", "query", "table", "migration"]
     git: ["commit", "branch", "merge", "diff", "history"]
     filesystem: ["file", "read", "write", "directory"]
     fetch: ["http", "api", "web", "url", "fetch"]
     context7: ["docs", "documentation", "library", "reference"]
     memory: ["remember", "recall", "previous", "earlier"]

2. Add chat.params hook:
   - Analyze last user message for keywords
   - Load only matching tool schemas + core tools (read, write, bash)
   - If model requests unloaded tool, catch error, load on-demand, retry

3. Add performance tracking:
   - Log initial tool count vs lazy-loaded count
   - Store metrics in sqlite MCP (table: tool_loading_metrics)

4. Add fallback:
   - If keyword match fails, load all tools (safe default)
   - Alert user: "Loaded all tools due to ambiguous request"

Use parallel_groups:
- Group 1: Implement keyword matcher and chat.params hook
- Group 2: Write tests verifying context reduction
- Group 3: Update docs/Plugins-Guide.md with lazy loading docs

Exit criteria: Average tool count per request < 5 (from ~12), zero functional regressions
```

**Prompt 6: Checkpoint Manager Plugin**
```
/agent core-factory

Context:
- Current undo: Only git stash available
- Gap: No rollback for DB state, MCP memory, or task state
- Need: Atomic multi-layer snapshots before workflows

Task: Create plugins/checkpoint-manager.ts

Requirements:
1. checkpoint tool:
   - Trigger: Manual (/checkpoint) or auto before workflows
   - Layers: git stash + db backup + memory export + task state export
   - Atomic: All layers succeed or all fail

2. undo command:
   - /undo restores last checkpoint across all layers
   - /undo --list shows available checkpoints with timestamps
   - /undo --hard skips confirmation

3. Auto-cleanup:
   - Retain checkpoints for 7 days
   - Max 20 checkpoints per project
   - Store metadata in sqlite MCP (table: checkpoints)

4. Integration hooks:
   - workflow.start: Auto-create checkpoint if workflow has write phases
   - tool.execute.before: For bash commands, suggest checkpoint if destructive

Implementation:
- Use git MCP for stash operations
- Use sqlite MCP for metadata and DB backups
- Use memory MCP for knowledge graph export
- Use filesystem MCP for task state serialization

DELEGATE:
- backend-api: Design the checkpoint metadata schema
- qa-guardian: Write tests for atomicity (simulate failure mid-checkpoint)
- docs-curator: Document /checkpoint and /undo commands

Exit criteria: /undo successfully restores all 4 layers in <2 seconds
```

---

### Category 3: Skill Governance & Auto-Creation (3 prompts)

**Prompt 7: Skill Registry Audit & Versioning**
```
/agent docs-curator

Context:
- 63+ skills in skills/ directory
- Format: SKILL.md with YAML frontmatter
- Gap: No versioning, no compatibility checks, no drift detection

Task: Implement skill governance system

ANALYZE:
- Scan all skills/ subdirectories for SKILL.md files
- Validate frontmatter: name, description, license, compatibility
- Check for orphaned skills (registered in index.json but missing files)
- Check for unregistered skills (existing files but not in index.json)

PLAN:
1. Add semver to all SKILL.md frontmatters:
   ```yaml
   ---
   name: git-release
   version: 1.2.0
   compatibility: opencode >=2.0.0
   ---
   ```

2. Create skill-check tool:
   - Validate SKILL.md schema
   - Check compatibility against current opencode version
   - Report outdated skills (compatibility < current version)

3. Create skill-freeze mechanism:
   - Workflows can pin skill versions
   - Frozen skills won't auto-update during workflow execution

4. Add CHANGELOG.md to each skill directory

DELEGATE (parallel_groups):
- Group 1: docs-curator audits all 63 skills and generates report
- Group 2: core-factory adds version fields and validation logic
- Group 3: qa-guardian writes skill-check tests

Store audit results in sqlite MCP.
Use memory MCP to track skill evolution over time.

Output: docs/skill-governance-report.md + updated skills/index.json
```

**Prompt 8: Auto-Skill Generation**
```
/agent lead-strategist

Context:
- User frequently asks for similar custom capabilities
- Manual skill creation is repetitive (create folder, SKILL.md, register)
- Goal: Generate skills automatically from successful agent interactions

Task: Design auto-skill-generation workflow

Workflow: skill-generation.yaml

Phase 1: DETECT
- Monitor memory MCP for recurring successful patterns
- Identify: "This agent solved X type of problem 3+ times using Y approach"
- Trigger: When pattern confidence > 0.8

Phase 2: EXTRACT
- Use memory MCP to retrieve all interactions matching the pattern
- Extract: instructions, best practices, tool usage, error handling
- Use sequential-thinking MCP to generalize into reusable instructions

Phase 3: GENERATE
- core-factory creates skills/auto-generated/{pattern-name}/SKILL.md
- Frontmatter includes: auto_generated: true, source_interactions: [ids]
- Register in skills/index.json under category: auto-generated

Phase 4: VALIDATE
- qa-guardian tests the skill on a sample task
- docs-curator reviews documentation quality
- If validation fails: mark as draft, retry with refinements

Phase 5: EVOLVE
- Weekly: Review auto-generated skills
- Promote high-quality ones to official category
- Deprecate low-usage ones

Exit criteria: Skill passes validation test AND has clear instructions
```

**Prompt 9: Skill Marketplace Integration**
```
/agent lead-architect

Context:
- Skills are local-only currently
- Community could contribute skills
- Need: Discovery, installation, and compatibility checking

Task: Extend skill-manager plugin with marketplace capabilities

Design:
1. skill_search enhancement:
   - Query local skills first
   - If not found, query GitHub API for repos tagged opencode-skill
   - Display: name, description, author, stars, compatibility

2. skill_install tool:
   - Download from GitHub release or raw URL
   - Validate SKILL.md frontmatter
   - Check compatibility with current opencode version
   - Auto-register in skills/index.json
   - Run skill_check validation

3. skill_publish tool:
   - Validate local skill meets quality gates (tests, docs, license)
   - Generate GitHub release notes from SKILL.md
   - Tag with opencode-skill for discoverability

4. Registry cache:
   - Store marketplace index in sqlite MCP
   - Refresh daily or on manual skill_search

DELEGATE:
- backend-api: Implement GitHub API integration
- frontend-ui-ux: Design CLI output for skill listing
- qa-guardian: Write validation logic for installed skills

Exit criteria: Can search, install, and validate a community skill in <30 seconds
```

---

### Category 4: Workflow Evolution (3 prompts)

**Prompt 10: Dynamic Workflow Generation**
```
/agent lead-strategist

Context:
- Current workflows: feature-development.yaml, bug-fix.yaml (static)
- Limitation: Novel tasks don't fit pre-defined templates
- Goal: Generate workflow YAML on-the-fly for any task

Task: Implement dynamic workflow generation

ANALYZE:
- Read existing workflow YAMLs to extract patterns
- Identify common phase structures: ANALYZE→PLAN→DELEGATE→SYNTHESIZE→VERIFY
- Use sequential-thinking MCP to model workflow composition rules

PLAN:
1. Create skills/dynamic-workflow/SKILL.md:
   - Template system with Mustache-style variables
   - Phase library: reusable phase definitions
   - Constraint engine: dependencies, agent availability, MCP requirements

2. Add generate_workflow tool to workflow-manager skill:
   - Input: natural language task description
   - Process:
     a) Parse task for keywords (CRUD, refactor, audit, optimize)
     b) Select phase templates from library
     c) Assemble into valid workflow YAML
     d) Validate against v2.0.0 schema
   - Output: workflow YAML + execution plan

3. Add workflow validation:
   - Check all referenced agents exist in opencode.json
   - Check all MCP servers are enabled
   - Check for circular dependencies in phases

Example:
Input: "Refactor the auth system to use JWT instead of sessions"
Output: workflows/auto/refactor-auth-jwt.yaml with:
  - Phase 1: Analyze current auth (lead-architect)
  - Phase 2: Design JWT architecture (lead-architect)
  - Phase 3: Implement backend (backend-laravel)
  - Phase 4: Update frontend (frontend-ui-ux)
  - Phase 5: Migrate data (devops-engineer)
  - Phase 6: QA & security (qa-guardian)

Store generated workflows in workflows/auto/ with timestamp.
Use memory MCP to track which generated workflows succeeded/failed.

Exit criteria: Generated workflow executes successfully for 3 different task types
```

**Prompt 11: Workflow Performance Optimization**
```
/agent devops-engineer

Context:
- Workflows track time_to_complete in sqlite MCP
- No systematic optimization of slow phases
- Some phases run sequentially when they could be parallel

Task: Analyze and optimize all workflow executions

ANALYZE:
- Query sqlite MCP for workflow metrics:
  SELECT workflow_name, phase_name, AVG(duration), failure_rate
  FROM workflow_executions
  GROUP BY workflow_name, phase_name
  ORDER BY AVG(duration) DESC

- Identify bottlenecks:
  - Phases with >60s average duration
  - Phases with >20% failure rate
  - Sequential phases with no dependencies that could be parallel

PLAN:
1. For each slow phase:
   - If agent is overworked: Add parallel agent instances
   - If MCP timeout: Increase timeout or add caching
   - If tool loading: Enable lazy loading

2. For each failing phase:
   - Increase retry_policy max_attempts
   - Add fallback_agent
   - Improve exit_criteria clarity

3. Add performance alerts:
   - If workflow duration > 2× historical average: alert user
   - If token usage > 80% of context window: suggest summarization

4. Auto-optimize:
   - After 10 executions of same workflow, suggest parallel_groups changes
   - Use sequential-thinking MCP for optimization proposals

DELEGATE:
- core-factory: Implement performance alerts in plugins/
- docs-curator: Document optimization patterns
- qa-guardian: Verify optimizations don't break exit criteria

Output: reports/workflow-performance.md + optimized workflow YAMLs
```

**Prompt 12: Workflow Recovery & Resume**
```
/agent lead-architect

Context:
- Long workflows can fail mid-execution
- Current behavior: Start from scratch
- Need: Resume from last successful phase

Task: Add checkpoint/resume capability to workflow engine

Design:
1. Phase-level checkpoints:
   - After each phase completes: save state to sqlite MCP
   - State includes: completed tasks, artifacts, agent outputs, memory observations

2. Resume protocol:
   - On workflow start: check for incomplete executions
   - If found: ask user "Resume from Phase 3 or restart?"
   - If resume: skip completed phases, load state, continue from next phase

3. State serialization:
   - Artifacts: file paths + checksums
   - Agent memory: memory MCP entity IDs
   - MCP state: sqlite db snapshot, git commit hash
   - Task results: task_id → output mapping

4. Failure analysis:
   - On failure: store error + stack trace + phase context
   - Use sequential-thinking MCP to suggest fix
   - If fix is auto-applicable: retry with fix, else escalate

Implementation:
- Extend workflow-manager skill with resume logic
- Add workflow_state table to sqlite MCP
- Add hooks: workflow.phase_complete, workflow.failure

Exit criteria: Can resume a 5-phase workflow from Phase 3 without data loss
```

---

### Category 5: Cross-Session Intelligence (3 prompts)

**Prompt 13: Project Memory Auto-Learning**
```
/agent docs-curator

Context:
- Each session starts fresh — no project conventions loaded
- User repeatedly states preferences (coding style, patterns)
- Goal: Auto-load project context on agent startup

Task: Implement cross-session project memory

ANALYZE:
- Scan memory MCP for recurring observations:
  - "User prefers arrow functions over function declarations"
  - "We use repository pattern for all data access"
  - "Prefer Pest over PHPUnit for testing"
  - "Use Livewire 4 with Alpine.js 3"

- Identify high-confidence conventions (mentioned 3+ times, no contradictions)

PLAN:
1. Create project-memory skill:
   - On session start: query memory MCP for project conventions
   - Inject into agent system prompts automatically
   - Format: "Project conventions: [list]"

2. Convention extraction:
   - After each successful task: analyze agent interactions
   - Extract implicit conventions from code patterns
   - Store in memory MCP with confidence score

3. Convention validation:
   - Weekly: docs-curator reviews stored conventions
   - Flags contradictions or outdated conventions
   - Proposes updates or removals

4. Per-agent loading:
   - backend-laravel: Load PHP/Laravel conventions
   - frontend-ui-ux: Load React/Tailwind conventions
   - qa-guardian: Load testing conventions

DELEGATE:
- memory MCP: Create entity types (convention, preference, pattern)
- core-factory: Implement auto-injection in agent initialization
- qa-guardian: Test that conventions affect agent output

Exit criteria: Agent automatically uses project conventions without user prompting
```

**Prompt 14: Failure Pattern Learning**
```
/agent lead-strategist

Context:
- Agents sometimes repeat failed approaches across sessions
- No systematic learning from past mistakes
- Goal: Remember what didn't work and avoid it

Task: Implement failure pattern learning

Workflow:
1. CAPTURE:
   - After any task failure: store in sqlite MCP:
     - Task description
     - Approach taken
     - Error message
     - Root cause (if identified)
     - Agent used
     - Timestamp

2. ANALYZE:
   - Weekly: Query failure database
   - Group by pattern: "TypeScript type errors", "Migration conflicts", "Missing env vars"
   - Use sequential-thinking MCP to identify systemic issues

3. PREVENT:
   - Before agent starts task: query failure patterns for similar tasks
   - Inject into context: "Previous attempts failed because: [reason]. Avoid: [approach]"
   - For high-confidence patterns: add to agent system prompt

4. EVOLVE:
   - If failure pattern resolved: mark as resolved with solution
   - If pattern persists >3 times: escalate to lead-architect for systemic fix

Store in memory MCP with entity type: failure_pattern
Link to skills that might prevent the failure

Example output:
"⚠️ Pattern detected: 3 previous attempts to add columns to existing tables failed due to missing ->nullable(). Suggesting nullable() by default for new columns."

Exit criteria: 30% reduction in repeated failure types over 4 weeks
```

**Prompt 15: Self-Healing Configuration**
```
/agent docs-curator

Context:
- opencode.json can drift out of sync with actual project state
- Agents added but not registered, MCP servers disabled accidentally
- /doctor exists but requires manual fixes

Task: Make /doctor auto-heal configuration issues

ANALYZE:
- Read opencode.json
- Check against ground truth:
  - agents/ directory exists for each configured agent
  - plugins/ files exist for each registered plugin
  - skills/ entries match skills/index.json
  - MCP server commands are executable
  - Workflow files exist for registered workflows

PLAN:
1. Extend /doctor with auto-fix mode:
   - Missing agent file: Suggest removal or create stub
   - Missing plugin file: Disable plugin or download
   - Orphaned skill: Remove from index.json or create SKILL.md
   - Broken MCP command: Check PATH, suggest installation
   - Invalid JSON: Show diff, propose fix

2. Confidence scoring:
   - High confidence (>0.9): Auto-apply fix, notify user
   - Medium confidence (0.7-0.9): Propose fix, ask user
   - Low confidence (<0.7): Report only, manual fix required

3. Scheduled runs:
   - Daily background check (if opencode is running)
   - Weekly full audit with report
   - Pre-commit hook: Block commits if /doctor fails

4. Learning:
   - Store fix history in memory MCP
   - If same fix applied 3×: Add to auto-heal rules
   - If fix caused regression: Rollback and blacklist

DELEGATE:
- core-factory: Implement auto-fix logic
- qa-guardian: Test auto-fix on corrupted configs
- devops-engineer: Add scheduled execution

Exit criteria: /doctor --fix resolves 80% of issues without human intervention
```

---

## 📋 How to Sequence These Prompts

### Week 1: Foundation
1. **Prompt 1** (Agent Optimization) — Establishes baseline
2. **Prompt 4** (Test Expansion) — Hardens what exists
3. **Prompt 7** (Skill Governance) — Cleans up 63 skills

### Week 2: Core Infrastructure
4. **Prompt 5** (Lazy Loading) — Immediate performance win
5. **Prompt 6** (Checkpoint Manager) — Enables safe experimentation
6. **Prompt 2** (Permission Hardening) — Security baseline

### Week 3: Intelligence
7. **Prompt 10** (Dynamic Workflows) — Unlocks novel tasks
8. **Prompt 13** (Project Memory) — Personalization layer
9. **Prompt 14** (Failure Learning) — Prevents repetition

### Week 4: Ecosystem
10. **Prompt 3** (Model Router) — Cost optimization
11. **Prompt 8** (Auto-Skill Gen) — Self-extending capabilities
12. **Prompt 9** (Marketplace) — Community growth

### Ongoing
13. **Prompt 11** (Workflow Performance) — Run monthly
14. **Prompt 12** (Resume) — Run after any workflow failure
15. **Prompt 15** (Self-Healing) — Run weekly via `/doctor --fix`

---

## 🎯 Pro Tips for Using These Prompts

1. **Always start with `/agent lead-strategist`** for orchestration prompts
2. **Use `memory MCP`** to persist results between prompts so agents build on previous work
3. **Track metrics in `sqlite MCP`** to measure improvement over time
4. **Run `qa-guardian` after every structural change** to catch regressions
5. **Use `parallel_groups`** when delegating independent implementation tasks

Each prompt is designed to be **idempotent** — you can run it multiple times and it will either improve further or report "already optimal." This is the key to true auto-improvement.

Want me to expand any of these into a full workflow YAML, or generate the actual plugin/skill code for any specific prompt?