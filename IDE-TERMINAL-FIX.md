# OpenCode IDE Terminal Fix

## Problem

When running `opencode` from IDE terminal, it starts in wrong directory → empty project.

## Solution 1: Use Launch Script (Recommended)

```bash
# From any directory:
node C:\opencode\opencode-launch.js

# Or:
bash C:\opencode\opencode-launch.sh
```

## Solution 2: Set IDE Terminal Default Directory

In your IDE settings:

- Set terminal to start in: `C:\opencode`
- Or set `OPENCODE_PROJECT_ROOT=C:\opencode` in IDE environment

## Solution 3: Environment Variable

```bash
# In IDE terminal:
export OPENCODE_PROJECT_ROOT=C:\opencode
opencode
```

## Solution 4: Explicit Project Root

```bash
opencode --project-root C:\opencode
```

## What the Launch Script Does

1. Searches parent directories for `opencode.json`
2. Verifies config is valid (18 agents, 8 MCP servers)
3. Launches `opencode` with explicit `--project-root`
4. Sets `OPENCODE_PROJECT_ROOT` environment variable

## Test It

```bash
# From any directory:
node C:\opencode\opencode-launch.js

# Should output:
# ✅ Found project root: C:\opencode
# ✅ Config: opencode/hy3-preview-free
# ✅ Agents: 18
# ✅ MCP servers: 8 enabled
# 🚀 Launching opencode...
```

## Files Created for This Fix

- `opencode-launch.js` - Node.js launcher
- `opencode-launch.sh` - Bash launcher
- `.opencode/project.json` - Project hint file
- `readme.md` - Updated with launch instructions
