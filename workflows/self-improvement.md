# OpenCode Self-Improvement Workflow

## Trigger Conditions

- **Manual**: User types `/improve` or `/reflect`
- **Tool**: `skill:self-reflection` for config analysis
- **Scheduled**: Via improvement cycle (see `docs/the-improvement-cycle.md`)

## Pre-Flight Checks

1. Verify opencode.json exists and is valid JSON
2. Ensure skill:self-reflection is available
3. Run `project_detect` to confirm stack detection

---

## Workflow Steps

### Step 1: Run Config Doctor

- **Agent**: @lead-strategist
- **Skill**: `skill:self-reflection`
- **Action**: Analyze current configuration for:
  - Missing agents vs opencode.json
  - Stale tool references
  - Permission consistency
  - Skill availability
- **Output**: List of findings with severity (CRITICAL/HIGH/MEDIUM/LOW)

---

### Step 2: Research Improvements

- **Agent**: @research-analyst
- **Context**: Findings from Step 1
- **Action**: Compare current patterns against:
  - Official OpenCode docs (context7)
  - Project conventions (memory)
  - Best practices (web search)
- **Output**: Recommendations with before/after

---

### Step 3: Apply Fixes

- **Agent**: @core-factory
- **Context**: Recommendations + current config
- **Action**: Apply approved fixes to:
  - `opencode.json` (agent/permission/plugin entries)
  - Agent `.md` files (frontmatter reconciliation)
  - Skill definitions (SKILL.md updates)
- **Validation**: Re-run config-doctor after each fix

---

### Step 4: Verify

- **Agent**: @qa-guardian
- **Action**: Run validation checks:
  - `opencode debug config` (if available)
  - Verify all agents have matching `permission` blocks
  - Check skill index consistency
- **Output**: Pass/fail per check

---

## Post-Flight Checks

1. All agents in `opencode.json` have matching `.md` files
2. No stale tool names in permission blocks
3. Skills count matches actual `skills/` directory
4. opencode.json parses as valid JSON

---

## Related Documents

- `docs/the-improvement-cycle.md` — Full playbook for self-improvement
- `skills/self-improver/SKILL.md` — Self-improver skill
- `skills/self-reflection/SKILL.md` — Self-reflection skill
- `AGENT.md` §16 — Auto-harness documentation
