# OpenCode Scripts

Utility scripts for OpenCode configuration, formatting, workflow generation, and operations.

---

## Quick Reference

| Script                   | Purpose                     | Platform       | Run                                                          |
| ------------------------ | --------------------------- | -------------- | ------------------------------------------------------------ |
| `auto-format.js`         | Multi-language formatter    | Cross-platform | `node scripts/auto-format.js <file-or-dir>`                  |
| `config-validator.js`    | Validate opencode.json      | Cross-platform | `node scripts/config-validator.js [config] [schema]`         |
| `validate-fix.js`        | Validate skills/index.json  | Cross-platform | `node scripts/validate-fix.js`                               |
| `extract-conventions.js` | Extract project conventions | Cross-platform | `node scripts/extract-conventions.js`                        |
| `generate-workflow.js`   | Generate workflow YAML      | Cross-platform | `node scripts/generate-workflow.js "task description"`       |
| `workflow-engine.js`     | Execute workflow YAML       | Cross-platform | `node scripts/workflow-engine.js`                            |
| `autoresearch.js`        | Autonomous experiment loops | Cross-platform | `node scripts/autoresearch.js "task" --max-iterations 5`     |
| `opencode-launch.js`     | Launch opencode with config | Cross-platform | `node scripts/opencode-launch.js`                            |
| `debug-launch.js`        | Debug launcher              | Cross-platform | `node scripts/debug-launch.js --debug=skill:*`               |
| `deploy-to-project.ps1`  | Deploy config to project    | PowerShell     | `.\scripts\deploy-to-project.ps1 -TargetPath "C:\MyProject"` |
| `check-updates.ps1`      | Check dependency updates    | PowerShell     | `.\scripts\check-updates.ps1 -All`                           |
| `db-backup.ps1`          | Backup SQLite database      | PowerShell     | `.\scripts\db-backup.ps1`                                    |
| `sync-skills.ps1`        | Sync skills via junctions   | PowerShell     | `.\scripts\sync-skills.ps1`                                  |

---

## JavaScript Scripts

### auto-format.js

Multi-language formatter dispatcher. Routes files to the correct formatter based on extension.

**Supported formatters:**

- **Biome**: `.js`, `.jsx`, `.ts`, `.tsx`, `.json`, `.jsonc`
- **Prettier**: `.css`, `.scss`, `.html`, `.md`, `.yaml`, `.yml`
- **Pint**: `.php`
- **rustfmt**: `.rs`
- **shfmt**: `.sh`, `.bash`
- **black**: `.py`

**Usage:**

```bash
# Format a single file
node scripts/auto-format.js src/components/App.tsx

# Format a directory recursively
node scripts/auto-format.js src/ --recursive
```

**Dependencies:** `npx` (biome, prettier), `php` (pint), `cargo` (rustfmt)

---

### config-validator.js

Validates `opencode.json` against a JSON schema using AJV.

**Usage:**

```bash
# Validate with default schema
node scripts/config-validator.js

# Validate specific config
node scripts/config-validator.js opencode.json config-schema.json
```

**Output:** JSON with `valid: true/false` and `errors` array.

---

### validate-fix.js

Quick validation script for `skills/index.json` format. Verifies skills have required fields and searches work correctly.

**Usage:**

```bash
node scripts/validate-fix.js
```

**Checks:**

- Skills array/object format detection
- Required fields: `name`, `entryPoint`, `category`
- Search functionality test

---

### extract-conventions.js

Scans codebase to extract project conventions using regex patterns. Outputs confidence-scored conventions.

**Usage:**

```bash
node scripts/extract-conventions.js
```

**Detected patterns:**

- PHP/Laravel: strict return types, union types, repository pattern, Livewire
- JavaScript/TypeScript: arrow functions, interfaces, React components, clsx
- Testing: test/it blocks, describe, expect, Pest, PHPUnit
- CSS: Tailwind @apply, cn/clsx utility
- General: async/await, fetch, React hooks, JSON.parse

**Output:** Top 10 conventions with confidence scores (0.0-0.9).

---

### generate-workflow.js

Dynamic workflow YAML generation from task descriptions. Analyzes task keywords to determine type and selects appropriate phases.

**Usage:**

```bash
node scripts/generate-workflow.js "Refactor auth to use JWT"
node scripts/generate-workflow.js "Add user profile page"
node scripts/generate-workflow.js "Fix login button crash"
```

**Task types:** CREATE, UPDATE, DELETE, REFACTOR, FIX, AUDIT, OPTIMIZE, TEST, MIGRATE, DEPLOY

**Output:** `workflows/auto/[slug]-[timestamp].yaml`

**Dependencies:** `yaml` npm package

---

### workflow-engine.js

YAML-based multi-agent workflow execution engine. Loads workflow definitions and executes phases sequentially.

**Usage:**

```javascript
const WorkflowEngine = require("./workflow-engine");
const engine = new WorkflowEngine("workflows/");
await engine.loadWorkflows();
await engine.executeWorkflow("workflow-name", { context: {} });
```

**Features:**

- Phase-based execution with dependencies
- Parallel group support
- Retry policies
- Artifact collection
- Execution tracking

---

### autoresearch.js

Karpathy-style autonomous experiment loops. Runs iterative optimization with git save/revert and prompt self-improvement.

**Usage:**

```bash
node scripts/autoresearch.js "Optimize portal.html load time by 20%" --max-iterations 5 --budget 300
```

**Options:**

- `--max-iterations=N` — Maximum experiment iterations (default: 5)
- `--budget=N` — Time budget in seconds (default: 300)
- `--metric=KEY` — Metric key to optimize (default: load_time_ms)

**Features:**

- Git branch management (creates `autoresearch/*` branches)
- Benchmark execution and measurement
- Prompt self-improvement based on quality feedback
- Result logging to `experiments/results/`

**Dependencies:** Benchmark script (`benchmark.js`)

---

### opencode-launch.js

Project-root-aware launcher for OpenCode. Finds `opencode.json`, manages port 4096, and launches the CLI.

**Usage:**

```bash
node scripts/opencode-launch.js
node scripts/opencode-launch.js --project-root=C:\MyProject
```

**Features:**

- Automatic config discovery (walks up directory tree)
- Port 4096 conflict resolution (kills existing processes)
- Multiple executable detection (root, local bin, bun, global)
- Windows-specific handling (.cmd, .exe, .bat)

---

### debug-launch.js

Debug environment wrapper for `opencode-launch.js`. Sets `DEBUG` environment variable for verbose logging.

**Usage:**

```bash
node scripts/debug-launch.js --debug=skill:*
node scripts/debug-launch.js --debug="skill:*,tool:execute"
node scripts/debug-launch.js --debug=*
```

**Debug categories:**

- `skill:load`, `skill:execute`, `skill:error`
- `tool:execute`, `tool:load`
- `mcp:connect`, `msp:error`
- `lsp:context`, `lsp:error`
- `hook:invoke`

---

## PowerShell Scripts

### deploy-to-project.ps1

Deploys OpenCode configuration to a target project. Copies or symlinks config files.

**Usage:**

```powershell
# Copy config to target
.\scripts\deploy-to-project.ps1 -TargetPath "C:\MyProject"

# Create symlinks (requires admin)
.\scripts\deploy-to-project.ps1 -TargetPath "C:\MyProject" -Symlink

# Configure for web client
.\scripts\deploy-to-project.ps1 -TargetPath "C:\MyProject" -WebClient
```

**Deployed items:**

- `opencode.json` → target root
- `skills/`, `agents/`, `rules/`, `workflows/`, `tools/` → `opencode/` subdirectory

---

### check-updates.ps1

Checks for outdated dependencies across Composer, NPM, and Git.

**Usage:**

```powershell
# Check all
.\scripts\check-updates.ps1 -All

# Check only Composer
.\scripts\check-updates.ps1 -ComposerOnly

# Check only NPM
.\scripts\check-updates.ps1 -NpmOnly
```

**Exit code:** 0 if up to date, 1 if updates available.

---

### db-backup.ps1

Creates timestamped backups of SQLite database with automatic rotation.

**Usage:**

```powershell
# Default backup
.\scripts\db-backup.ps1

# Custom source and keep count
.\scripts\db-backup.ps1 -SourceDB "C:\data\app.sqlite" -KeepCount 20
```

**Features:**

- Timestamped backup files (`database_YYYY-MM-DD_HH-MM-SS.sqlite`)
- `database_latest.sqlite` symlink for easy access
- Automatic cleanup (keeps N most recent backups)

---

### sync-skills.ps1

Bridges two skill systems by creating directory junctions from `~/.agents/skills/` to `C:\opencode\skills/`.

**Usage:**

```powershell
# Sync all skills
.\scripts\sync-skills.ps1

# Dry run (no changes)
.\scripts\sync-skills.ps1 -DryRun

# Verbose output
.\scripts\sync-skills.ps1 -Verbose
```

**Features:**

- Automatic skill discovery (finds all `SKILL.md` files)
- Nested path flattening (`android/compose` → `android-compose`)
- Junction verification and repair
- Write access testing

---

## Dependencies

### Node.js Scripts

- `yaml` — YAML parser/generator (for workflow generation)
- `ajv` — JSON schema validator (for config validation)

### PowerShell Scripts

- No external dependencies (uses built-in cmdlets)

### Formatter Dependencies

- `npx` — Biome, Prettier
- `php` — Pint (Laravel)
- `cargo` — rustfmt (Rust)
- `shfmt` — Shell formatting
- `black` — Python formatting

---

## Integration with OpenCode

These scripts can be invoked via OpenCode commands:

```json
{
  "command": {
    "validate-config": {
      "template": "node scripts/config-validator.js",
      "description": "Validate opencode.json against schema",
      "agent": "devops-engineer"
    },
    "auto-format": {
      "template": "node scripts/auto-format.js $FILE",
      "description": "Format a file using appropriate formatter",
      "agent": "devops-engineer"
    },
    "generate-workflow": {
      "template": "node scripts/generate-workflow.js $TASK",
      "description": "Generate workflow YAML for a task",
      "agent": "lead-strategist"
    }
  }
}
```

---

_Last updated: May 2026_
