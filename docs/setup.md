# OpenCode Setup Guide

## Quick Start

OpenCode now includes a **single-launch setup script** that handles everything automatically.

### Windows (PowerShell)

```powershell
# Full setup (checks dependencies, installs packages, launches)
.\setup.ps1

# Development setup (includes self-improver)
.\setup.ps1 -Dev

# Skip dependency checks (faster for repeated runs)
.\setup.ps1 -SkipDeps
```

### What the Setup Script Does

1. **Checks Prerequisites**: Node.js, npm, PHP 8.3+, Composer
2. **Installs Node Dependencies**: Runs `npm install`
3. **Sets Up Database**: Creates SQLite database if needed
4. **Checks Configuration**: Verifies `opencode.json` exists
5. **Runs Self-Improver** (optional): Analyzes and improves the project
6. **Launches OpenCode**: Starts the application

---

## Manual Setup

If you prefer to run steps manually:

### 1. Install Dependencies

```bash
# Node.js packages
npm install

# PHP packages (if using Laravel features)
composer install
```

### 2. Initialize Database

```bash
# Create SQLite database
New-Item -Path "C:\opencode\database.sqlite" -ItemType File -Force

# Initialize schema
node tools/db-init.js
```

### 3. Launch OpenCode

```bash
node opencode-launch.js
```

---

## Database Initialization

OpenCode now uses an improved database schema with proper relationships.

### Run Database Initialization

```bash
node tools/db-init.js
```

This script will:

- Create the `database.sqlite` file if it doesn't exist
- Apply the schema from `database/schema.sql`
- Insert default data from `opencode.json` (agents, MCP servers)
- Insert workflow definitions from `workflows/` directory

### Database Schema

The new schema includes:

- `projects` - Project tracking
- `agents` - AI agent configurations
- `workflows` - Workflow definitions
- `executions` - Workflow execution tracking
- `skills` - Available skills
- `mcp_servers` - MCP server configurations

### Backup Database

```powershell
.\scripts\db-backup.ps1
```

Backups are stored in `C:\opencode\backups\` with timestamps.

---

## Package Updates

### Check for Updates

```powershell
.\scripts\check-updates.ps1
```

### Update Node.js Packages

```bash
npm update
```

### Update PHP Packages (if applicable)

```bash
composer update
```

---

## Laravel 13 + Livewire 4 Scaffolding

### Create New Laravel 13 Project

```powershell
.\templates\laravel\create-project.ps1 -ProjectName "my-app" -WithLivewire -WithPest -PublishStubs
```

This creates a new Laravel 13 project with:

- Livewire 4 (single-file components)
- Pest PHP 4.x for testing
- SQLite database setup
- Published stubs for customization (Laravel 13 feature)
- Example Counter component (if Livewire installed)

### Customizing Stubs (Laravel 13)

Laravel 13 allows you to publish and customize stubs:

```bash
cd your-laravel-project
php artisan stub:publish
```

This creates a `/stubs` directory with customizable templates:

- `model.stub` - Eloquent model template
- `controller.stub` - Controller template
- `migration.stub` - Migration template
- `livewire.stub` - Livewire component template (if Livewire installed)
- And more...

After publishing, Laravel will use your customized stubs when generating files.

### Laravel 13 Features Available

- **First-party AI SDK**: `laravel/ai` package
- **JSON:API Resources**: Native JSON:API compliance
- **PHP 8.3 Attributes**: `#[Table]`, `#[Fillable]` on models
- **Native Vector Search**: `pgvector` support
- **Queue Routing**: `Queue::route()` method
- **Stub Publishing**: Customize generated file templates

### Livewire 4 Features Available

- **Single-file components**: PHP + Blade + JS + CSS in one file
- **Parallel live updates**: Faster typing experience
- **wire:transition**: Hardware-accelerated animations
- **$js actions**: Client-side only actions

---

## Verification

After setup, verify everything works:

```bash
# Check Node dependencies
npm list

# Check database
# (if sqlite3 CLI is installed)
sqlite3 database.sqlite ".tables"

# Launch OpenCode
node opencode-launch.js
```

---

## Troubleshooting

### Node.js not found

- Install Node.js 18+ from https://nodejs.org/

### PHP 8.3+ not found

- Install PHP 8.3+ from https://windows.php.net/
- Or use Laragon: https://laragon.org/

### Composer not found

- Install Composer from https://getcomposer.org/

### sqlite3 CLI not found

- The database will still work with PHP's PDO
- Schema initialization may be skipped
- You can manually import `database/schema.sql`

### Permission errors

- Run PowerShell as Administrator
- Or adjust execution policy: `Set-ExecutionPolicy RemoteSigned`

---

## Next Steps

1. Read `rules/laravel.md` for Laravel 13 + Livewire 4 best practices
2. Check `agents/laravel-expert.md` for expert agent capabilities
3. Explore `templates/laravel/` for example files
4. Review `docs/laravel-scaffolding.md` for detailed guides

---

## Support

- OpenCode Docs: https://opencode.ai/docs
- Laravel 13 Docs: https://laravel.com/docs/13.x
- Livewire 4 Docs: https://livewire.laravel.com/docs/4.x
