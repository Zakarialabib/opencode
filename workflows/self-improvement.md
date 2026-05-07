# OpenCode Self-Improvement Workflow

## Trigger Conditions

- **Manual**: User types `/improve-opencode` or `/fix-tools`
- **Automatic**: 3+ tool errors in 1 hour window
- **Scheduled**: Weekly scan (every Sunday 02:00 via cron)

## Pre-Flight Checks

1. Verify OpenCode config directory is accessible: `C:\opencode`
2. Load valid tool list and valid subagent type list
3. Confirm skill-vetter is available for security scans
4. Check context7 is enabled for design/system docs

---

## Workflow Steps

### Step 1: Scan Configuration

- **Agent**: @opencode-self-healer
- **Context Level**: Level 3 (full system context)
- **Pass Data**:
  - `config_path`: `C:\opencode`
  - `valid_tools`: [bash, read, glob, grep, edit, write, task, webfetch, todowrite, websearch, codesearch, skill, skill_use, context7_*, etc.]
  - `valid_subagents`: [ADRManager, AgentGenerator, frontend-ui-ux, core-builder, etc.]
- **Expected Return**: Raw configuration scan results (agent tools, subagent refs, skill deps)
- **Integration**: Parse results to categorize errors by severity (critical/high/medium/low)

---

### Step 2: Validate References

- **Agent**: @opencode-self-healer
- **Context Level**: Level 2 (standards + rules)
- **Pass Data**: Scan results from Step 1
- **Expected Return**: List of invalid references (tools, subagents, skills)
- **Integration**: Categorize errors:
  - **Critical**: Invalid tools in agent configs (e.g., "file", "command")
  - **High**: Missing agent definitions
  - **Medium**: Broken skill dependencies
  - **Low**: Outdated version references (e.g., Laravel 10 vs 13)

---

### Step 3: Generate Fixes

- **Agent**: @AgentGenerator (this agent)
- **Context Level**: Level 3 (full system context)
- **Pass Data**: Invalid reference list, valid tool/subagent lists, existing agent/skill templates
- **Expected Return**:
  - Updated agent files (frontend-ui-ux.md, core-builder.md, etc.)
  - New agent files (opencode-self-healer.md, ui-ux-pattern-matcher.md)
  - Fixed skill files (laravel-feature-scaffold/SKILL.md, etc.)
  - Updated opencode.json with corrected tool lists
- **Integration**: Prepare files for user approval

---

### Step 4: User Approval

- **Action**: Present fix report to user
- **Output Files**:
  - `C:\opencode\docs\opencode-errors.md` (error report)
  - `C:\opencode\docs\opencode-fixes.md` (fix documentation)
- **Checkpoint**: Proceed only if user approves ≥80% of fixes
- **Fallback**: If user rejects, generate alternative fix options

---

### Step 5: Apply Fixes

- **Action**: Write updated agent files to `C:\opencode\agents\`
- **Action**: Update skill files in `C:\opencode\skills\`
- **Action**: Update `opencode.json` with corrected agent tool lists
- **Validation**: Re-run @opencode-self-healer scan to confirm no remaining errors
- **Rollback**: If validation fails, revert to previous config and alert user

---

### Step 6: Verify

- **Action**: Test all previously broken tools (e.g., replace "command" with "bash")
- **Action**: Run agent validation checks via @qa-reviewer
- **Output**: `C:\opencode\docs\opencode-verification.md`
- **Checkpoint**: All tests pass with ≥8/10 score

---

## Post-Flight Checks

1. ✅ No invalid tool references remain in opencode.json
2. ✅ All agent files in `C:\opencode\agents\` are present and valid
3. ✅ All skills pass security check via @skill-vetter
4. ✅ opencode.json passes JSON syntax check
5. ✅ All new agent files score ≥8/10 on AgentGenerator quality criteria

---

## Error Handling

- **Scan fails**: Retry with reduced scope (scan agents only first)
- **User rejects fixes**: Generate 2 alternative fix options
- **Verification fails**: Roll back to previous config, alert user via IDE notification
- **Tool errors**: Log to `C:\opencode\docs\tool-errors.log` and retry once

---

## Output Artifacts

| File Path                                     | Description                                  |
| --------------------------------------------- | -------------------------------------------- |
| `C:\opencode\docs\opencode-errors.md`         | Detailed error report with tables            |
| `C:\opencode\docs\opencode-fixes.md`          | Fix documentation with before/after examples |
| `C:\opencode\docs\opencode-verification.md`   | Post-fix validation report                   |
| `C:\opencode\agents\opencode-self-healer.md`  | New self-healer agent                        |
| `C:\opencode\agents\ui-ux-pattern-matcher.md` | New pattern matcher agent                    |
| `C:\opencode\agents\frontend-ui-ux.md`        | Fixed UI/UX agent                            |
| `C:\opencode\agents\core-builder.md`          | Updated core builder agent                   |
