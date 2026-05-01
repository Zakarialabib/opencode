# OpenCode Project Improvement Plan

## Overview

Comprehensive improvements to OpenCode project focusing on:

1. Latest package updates (Laravel 11.x, Livewire 3.x/4.x)
2. Single-launch setup script
3. Enhanced database architecture
4. Improved Laravel scaffolding with Livewire
5. Better scripts and documentation

---

## 1. PACKAGE UPDATES

### Node.js Dependencies (package.json)

Current versions need updating to:

- `ajv`: ^8.17.1 (from ^8.20.0 - check latest)
- `opencode-background-agents`: ^0.1.1 (check for newer)
- `opencode-notify`: ^0.3.1 (check for newer)
- `yaml`: ^2.8.3 (latest)

DevDependencies:

- `@biomejs/biome`: ^2.4.8 (latest)
- `prettier`: ^3.8.1 (latest)
- Add: `laravel-echo` (if adding real-time features)

### PHP/Laravel Dependencies (if creating Laravel scaffold)

```json
{
  "require": {
    "php": "^8.2",
    "laravel/framework": "^11.0",
    "livewire/livewire": "^3.7",
    "nunomaduro/collision": "^8.1"
  },
  "require-dev": {
    "pestphp/pest": "^3.0",
    "laravel/pint": "^1.18"
  }
}
```

---

## 2. SINGLE-LAUNCH SETUP SCRIPT

### File: `C:\opencode\setup.ps1`

```powershell
# OpenCode Setup Script - Single Launch Setup
# Requirements: Node.js, PHP 8.2+, Composer, SQLite

param(
    [string]$ProjectRoot = "C:\opencode",
    [switch]$Dev,
    [switch]$SkipDeps
)

$ErrorActionPreference = "Stop"

Write-Host "🚀 OpenCode Setup Script" -ForegroundColor Cyan
Write-Host "=========================" -ForegroundColor Cyan

# Function to check if command exists
function Test-CommandExists {
    param($Command)
    try { Get-Command $Command -ErrorAction Stop; return $true }
    catch { return $false }
}

# Step 1: Check Prerequisites
Write-Host "`n📋 Checking prerequisites..." -ForegroundColor Yellow

if (-not (Test-CommandExists "node")) {
    Write-Host "❌ Node.js not found. Please install Node.js 18+" -ForegroundColor Red
    exit 1
}
$nodeVersion = (node --version)
Write-Host "  ✅ Node.js: $nodeVersion" -ForegroundColor Green

if (-not (Test-CommandExists "npm")) {
    Write-Host "❌ npm not found" -ForegroundColor Red
    exit 1
}
Write-Host "  ✅ npm: $(npm --version)" -ForegroundColor Green

if (-not $SkipDeps) {
    if (-not (Test-CommandExists "php")) {
        Write-Host "⚠️  PHP not found. Install PHP 8.2+ for Laravel features" -ForegroundColor Yellow
    } else {
        Write-Host "  ✅ PHP: $(php --version | Select-Object -First 1)" -ForegroundColor Green
    }

    if (-not (Test-CommandExists "composer")) {
        Write-Host "⚠️  Composer not found. Install for PHP dependencies" -ForegroundColor Yellow
    } else {
        Write-Host "  ✅ Composer: $(composer --version)" -ForegroundColor Green
    }
}

# Step 2: Install Node Dependencies
Write-Host "`n📦 Installing Node dependencies..." -ForegroundColor Yellow
Set-Location $ProjectRoot
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ npm install failed" -ForegroundColor Red
    exit 1
}
Write-Host "  ✅ Node dependencies installed" -ForegroundColor Green

# Step 3: Setup Database
Write-Host "`n🗄️  Setting up database..." -ForegroundColor Yellow
$dbPath = Join-Path $ProjectRoot "database.sqlite"
if (-not (Test-Path $dbPath)) {
    New-Item -Path $dbPath -ItemType File -Force | Out-Null
    Write-Host "  ✅ Created SQLite database: $dbPath" -ForegroundColor Green
} else {
    Write-Host "  ✅ SQLite database exists" -ForegroundColor Green
}

# Step 4: Initialize OpenCode Config (if needed)
Write-Host "`n⚙️  Checking OpenCode configuration..." -ForegroundColor Yellow
$configPath = Join-Path $ProjectRoot "opencode.json"
if (-not (Test-Path $configPath)) {
    Write-Host "  ⚠️  opencode.json not found. Creating default..." -ForegroundColor Yellow
    # Would create default config here
} else {
    Write-Host "  ✅ opencode.json found" -ForegroundColor Green
}

# Step 5: Run Self-Improver (optional)
if ($Dev) {
    Write-Host "`n🔧 Running self-improver..." -ForegroundColor Yellow
    node $ProjectRoot\self-improver.js $ProjectRoot
}

# Step 6: Launch OpenCode
Write-Host "`n🚀 Launching OpenCode..." -ForegroundColor Cyan
$launchScript = Join-Path $ProjectRoot "opencode-launch.js"
if (Test-Path $launchScript) {
    node $launchScript
} else {
    Write-Host "  ❌ Launch script not found: $launchScript" -ForegroundColor Red
    exit 1
}

Write-Host "`n✅ Setup complete!" -ForegroundColor Green
```

---

## 3. DATABASE ARCHITECTURE IMPROVEMENTS

### Current: SQLite database (database.sqlite)

### Improved Schema:

Create `C:\opencode\database\schema.sql`:

```sql
-- OpenCode Database Schema (SQLite)
-- Improved architecture with proper relationships

-- Projects table
CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    path TEXT UNIQUE NOT NULL,
    type TEXT DEFAULT 'laravel', -- laravel, react, tauri, etc.
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Agents table
CREATE TABLE IF NOT EXISTS agents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    type TEXT NOT NULL, -- build, test, review, etc.
    model TEXT,
    temperature REAL DEFAULT 0.3,
    instructions TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Workflows table
CREATE TABLE IF NOT EXISTS workflows (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    description TEXT,
    version TEXT DEFAULT '1.0.0',
    yaml_config TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Executions table (for workflow engine)
CREATE TABLE IF NOT EXISTS executions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    workflow_id INTEGER,
    execution_id TEXT UNIQUE NOT NULL,
    status TEXT DEFAULT 'pending', -- pending, running, completed, failed
    context TEXT, -- JSON
    start_time DATETIME,
    end_time DATETIME,
    FOREIGN KEY (workflow_id) REFERENCES workflows(id)
);

-- Skills table
CREATE TABLE IF NOT EXISTS skills (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    description TEXT,
    path TEXT NOT NULL,
    enabled BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- MCP Servers table
CREATE TABLE IF NOT EXISTS mcp_servers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    type TEXT NOT NULL, -- local, remote
    command TEXT NOT NULL, -- JSON array
    enabled BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_projects_type ON projects(type);
CREATE INDEX IF NOT EXISTS idx_executions_status ON executions(status);
CREATE INDEX IF NOT EXISTS idx_executions_workflow ON executions(workflow_id);
CREATE INDEX IF NOT EXISTS idx_agents_type ON agents(type);

-- Triggers for updated_at
CREATE TRIGGER IF NOT EXISTS update_projects_timestamp
AFTER UPDATE ON projects
BEGIN
    UPDATE projects SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;
```

**New file:** `C:\opencode\tools\db-init.js` - Script to initialize database

---

## 4. LARAVEL SCAFFOLDING IMPROVEMENTS

### Update `C:\opencode\rules\laravel.md`

Add latest best practices:

- Laravel 11 minimal structure
- Livewire 3.x/4.x features
- Pest PHP for testing
- Laravel Essentials package

### Enhanced Laravel Expert Agent

Update `C:\opencode\agents\laravel-expert.md` with:

- Livewire single-file components (v4)
- JSON:API resources (Laravel 13)
- Native vector search (pgvector)
- PHP 8.3+ attributes

### New Laravel Starter Template

Create `C:\opencode\templates\laravel\` with:

- `create-project.ps1` - Script to create new Laravel project
- `livewire-example.blade.php` - Sample Livewire component
- `model-example.php` - Sample Eloquent model with relationships
- `migration-example.php` - Sample migration

---

## 5. SCRIPTS IMPROVEMENTS

### Enhanced `opencode-launch.js`

Add features:

- Auto-detect project type (Laravel, React, Tauri)
- Check for updates
- Better error messages
- Colored output

### New Utility Scripts

1. **`C:\opencode\scripts\check-updates.ps1`** - Check for package updates
2. **`C:\opencode\scripts\db-backup.ps1`** - Backup SQLite database
3. **`C:\opencode\scripts\lint-all.ps1`** - Run all linters
4. **`C:\opencode\scripts\test-all.ps1`** - Run all tests

---

## 6. DOCUMENTATION UPDATES

### Update `C:\opencode\readme.md`

Add sections:

- Quick start with setup script
- Database architecture diagram
- Laravel + Livewire examples
- Troubleshooting guide

### New Documentation Files

1. **`C:\opencode\docs\setup.md`** - Detailed setup guide
2. **`C:\opencode\docs\database.md`** - Database architecture
3. **`C:\opencode\docs\laravel-scaffolding.md`** - Laravel + Livewire guide
4. **`C:\opencode\docs\best-practices.md`** - Latest best practices

---

## Implementation Order

1. Create setup script (`setup.ps1`)
2. Improve database schema (`database/schema.sql`)
3. Update `package.json` with latest versions
4. Enhance `laravel.md` rules
5. Update `laravel-expert.md` agent
6. Create Laravel starter template
7. Add utility scripts
8. Update documentation

---

## Files to Create/Modify

### New Files:

- `C:\opencode\setup.ps1`
- `C:\opencode\database\schema.sql`
- `C:\opencode\tools\db-init.js`
- `C:\opencode\scripts\check-updates.ps1`
- `C:\opencode\scripts\db-backup.ps1`
- `C:\opencode\templates\laravel\create-project.ps1`
- `C:\opencode\templates\laravel\livewire-example.blade.php`
- `C:\opencode\docs\setup.md`
- `C:\opencode\docs\database.md`
- `C:\opencode\docs\laravel-scaffolding.md`

### Modify Files:

- `C:\opencode\package.json` - Update dependencies
- `C:\opencode\opencode-launch.js` - Enhance with better features
- `C:\opencode\rules\laravel.md` - Add latest best practices
- `C:\opencode\agents\laravel-expert.md` - Update with Livewire 4.x features
- `C:\opencode\readme.md` - Add setup instructions

---

## Verification Steps

After implementation:

1. Run `.\setup.ps1` - Should set up everything
2. Run `node opencode-launch.js` - Should launch successfully
3. Check database: `sqlite3 database.sqlite ".tables"` - Should show new tables
4. Test Laravel scaffold: Create test Laravel project
5. Run linters: `npm run lint`
6. Run tests: `npm test`
