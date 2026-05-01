# OpenCode Database Architecture

## Overview

OpenCode uses **SQLite** as its database engine for simplicity and portability. The database architecture has been improved with proper relationships, indexes, and triggers.

---

## Database Location

- **File**: `C:\opencode\database.sqlite`
- **Schema**: `C:\opencode\database\schema.sql`
- **Initialization Script**: `C:\opencode\tools\db-init.js`

---

## Schema Design

### Tables

#### 1. `projects`

Stores information about projects being worked on.

| Column     | Type                   | Description                                      |
| ---------- | ---------------------- | ------------------------------------------------ |
| id         | INTEGER PK             | Auto-increment ID                                |
| name       | TEXT                   | Project name                                     |
| path       | TEXT UNIQUE            | Project root path                                |
| type       | TEXT DEFAULT 'laravel' | Project type (laravel, react, tauri, etc.)       |
| created_at | DATETIME               | Creation timestamp                               |
| updated_at | DATETIME               | Last update timestamp (auto-updated via trigger) |

#### 2. `agents`

Stores AI agent configurations from `opencode.json`.

| Column       | Type             | Description                            |
| ------------ | ---------------- | -------------------------------------- |
| id           | INTEGER PK       | Auto-increment ID                      |
| name         | TEXT UNIQUE      | Agent name                             |
| type         | TEXT             | Agent type (build, test, review, etc.) |
| model        | TEXT             | Model assigned to agent                |
| temperature  | REAL DEFAULT 0.3 | Temperature setting                    |
| instructions | TEXT             | Agent instructions (JSON)              |
| created_at   | DATETIME         | Creation timestamp                     |

#### 3. `workflows`

Stores workflow definitions from YAML files.

| Column      | Type                 | Description             |
| ----------- | -------------------- | ----------------------- |
| id          | INTEGER PK           | Auto-increment ID       |
| name        | TEXT UNIQUE          | Workflow name           |
| description | TEXT                 | Workflow description    |
| version     | TEXT DEFAULT '1.0.0' | Workflow version        |
| yaml_config | TEXT                 | Full YAML configuration |
| created_at  | DATETIME             | Creation timestamp      |

#### 4. `executions`

Tracks workflow execution instances.

| Column       | Type                   | Description                                 |
| ------------ | ---------------------- | ------------------------------------------- |
| id           | INTEGER PK             | Auto-increment ID                           |
| workflow_id  | INTEGER FK             | References `workflows(id)`                  |
| execution_id | TEXT UNIQUE            | Unique execution identifier                 |
| status       | TEXT DEFAULT 'pending' | Status: pending, running, completed, failed |
| context      | TEXT                   | Execution context (JSON)                    |
| start_time   | DATETIME               | Execution start time                        |
| end_time     | DATETIME               | Execution end time                          |

#### 5. `skills`

Stores available skills information.

| Column      | Type              | Description              |
| ----------- | ----------------- | ------------------------ |
| id          | INTEGER PK        | Auto-increment ID        |
| name        | TEXT UNIQUE       | Skill name               |
| description | TEXT              | Skill description        |
| path        | TEXT              | Path to skill files      |
| enabled     | BOOLEAN DEFAULT 1 | Whether skill is enabled |
| created_at  | DATETIME          | Creation timestamp       |

#### 6. `mcp_servers`

Stores MCP server configurations.

| Column     | Type              | Description               |
| ---------- | ----------------- | ------------------------- |
| id         | INTEGER PK        | Auto-increment ID         |
| name       | TEXT UNIQUE       | Server name               |
| type       | TEXT              | Type: local or remote     |
| command    | TEXT              | Command array (JSON)      |
| enabled    | BOOLEAN DEFAULT 1 | Whether server is enabled |
| created_at | DATETIME          | Creation timestamp        |

---

## Indexes

Performance indexes are created automatically:

```sql
CREATE INDEX idx_projects_type ON projects(type);
CREATE INDEX idx_executions_status ON executions(status);
CREATE INDEX idx_executions_workflow ON executions(workflow_id);
CREATE INDEX idx_agents_type ON agents(type);
```

---

## Triggers

Automatic timestamp updates:

```sql
CREATE TRIGGER update_projects_timestamp
AFTER UPDATE ON projects
BEGIN
    UPDATE projects SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;
```

---

## Initialization

### Automatic Initialization

Run the initialization script:

```bash
node tools/db-init.js
```

This script will:

1. Create `database.sqlite` if it doesn't exist
2. Apply the schema from `database/schema.sql`
3. Insert default data from configuration files
4. Verify table creation

### Manual Initialization

If you have the `sqlite3` CLI:

```bash
sqlite3 database.sqlite < database/schema.sql
```

Or from within `sqlite3` prompt:

```sql
.read database/schema.sql
```

---

## Backup & Restore

### Backup

Use the backup script:

```powershell
.\scripts\db-backup.ps1
```

This creates timestamped backups in `C:\opencode\backups\`:

- `database_2026-04-30_14-50-00.sqlite`
- `database_2026-04-30_15-00-00.sqlite`
- `database_latest.sqlite` (always points to most recent)

### Restore

To restore from a backup:

```powershell
Copy-Item "C:\opencode\backups\database_2026-04-30_14-50-00.sqlite" "C:\opencode\database.sqlite"
```

---

## Querying the Database

### Using sqlite3 CLI

```bash
# List all tables
sqlite3 database.sqlite ".tables"

# Query agents
sqlite3 database.sqlite "SELECT * FROM agents;"

# Check workflow executions
sqlite3 database.sqlite "SELECT execution_id, status, start_time FROM executions;"
```

### Using Node.js

```javascript
const Database = require("better-sqlite3");
const db = new Database("database.sqlite");

const agents = db.prepare("SELECT * FROM agents").all();
console.log(agents);
```

---

## Migration & Updates

When the schema changes:

1. Backup the database: `.\scripts\db-backup.ps1`
2. Apply new schema: `node tools/db-init.js`
3. The script will skip existing tables (uses `CREATE TABLE IF NOT EXISTS`)

---

## Best Practices

1. **Always backup** before schema changes
2. **Use transactions** for batch operations
3. **Index frequently queried columns** (already done for common cases)
4. **Avoid storing large objects** in `context` fields (use references instead)
5. **Regular cleanup** of old executions:
   ```sql
   DELETE FROM executions WHERE status = 'completed' AND end_time < datetime('now', '-30 days');
   ```

---

## Troubleshooting

### Database is locked

- Close any open sqlite3 sessions
- Check if another process is using the database

### Schema initialization fails

- Ensure `sqlite3` CLI is installed (or skip schema init)
- Check file permissions on `database.sqlite`

### Tables not created

- Run `node tools/db-init.js` manually
- Check `database/schema.sql` exists

---

## Future Enhancements

Planned improvements:

- PostgreSQL support (for production deployments)
- Vector embeddings storage (for AI features)
- Automatic migration system
- Database connection pooling
- Query logging and performance analysis
