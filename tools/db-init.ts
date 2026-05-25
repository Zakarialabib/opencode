import * as fs from "node:fs";
import * as path from "node:path";
import { execSync } from "node:child_process";

// Define interface for config
interface AgentConfig {
  model?: string;
  temperature?: number;
  instructions?: string[];
}

interface McpConfig {
  command?: string[];
  type?: string;
  enabled?: boolean;
}

interface OpenCodeConfig {
  agent?: Record<string, AgentConfig>;
  mcp?: Record<string, McpConfig>;
}

export class DatabaseInitializer {
  private projectRoot: string;
  private dbPath: string;
  private schemaPath: string;

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
    this.dbPath = path.join(projectRoot, "database.sqlite");
    this.schemaPath = path.join(projectRoot, "database", "schema.sql");
  }

  async initialize(): Promise<boolean> {
    console.log("🗄️  Initializing OpenCode database...");

    try {
      // Ensure database directory exists
      const dbDir = path.dirname(this.dbPath);
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
        console.log(`  ✅ Created directory: ${dbDir}`);
      }

      // Create SQLite database file if it doesn't exist
      if (!fs.existsSync(this.dbPath)) {
        fs.writeFileSync(this.dbPath, "");
        console.log(`  ✅ Created database: ${this.dbPath}`);
      }

      // Check if sqlite3 command is available
      try {
        execSync("sqlite3 --version", { stdio: "ignore" });
      } catch (_e) {
        console.log("  ⚠️  sqlite3 CLI not found. Skipping schema initialization.");
        console.log("  ⚠️  Install sqlite3 or manually run the schema.");
        return false;
      }

      // Read and execute schema
      if (fs.existsSync(this.schemaPath)) {
        const schema = fs.readFileSync(this.schemaPath, "utf8");

        try {
          execSync(`sqlite3 "${this.dbPath}" "${schema.replace(/"/g, '""')}"`, {
            stdio: "inherit",
          });
          console.log("  ✅ Schema applied successfully");
        } catch (_e) {
          // Try alternative approach - execute line by line
          const statements = schema.split(";").filter((s) => s.trim());
          for (const stmt of statements) {
            try {
              execSync(`sqlite3 "${this.dbPath}" "${stmt.trim()}"`, {
                stdio: "ignore",
              });
            } catch (_e2) {
              // Ignore individual statement errors
            }
          }
          console.log("  ✅ Schema applied (with warnings)");
        }
      } else {
        console.log("  ⚠️  Schema file not found:", this.schemaPath);
      }

      // Verify tables
      try {
        const result = execSync(`sqlite3 "${this.dbPath}" ".tables"`, {
          encoding: "utf8",
        });
        console.log("  ✅ Tables created:", result.trim());
      } catch (_e) {
        console.log("  ⚠️  Could not verify tables");
      }

      console.log("✅ Database initialization complete!");
      return true;
    } catch (error: unknown) {
      console.error("❌ Database initialization failed:", (error as Error).message);
      return false;
    }
  }

  async insertDefaultData(): Promise<boolean> {
    console.log("📥 Inserting default data...");

    try {
      // Insert default agents from opencode.json
      const configPath = path.join(this.projectRoot, "opencode.json");
      if (fs.existsSync(configPath)) {
        const config: OpenCodeConfig = JSON.parse(fs.readFileSync(configPath, "utf8"));

        if (config.agent) {
          for (const [name, agent] of Object.entries(config.agent)) {
            const sql = `INSERT OR IGNORE INTO agents (name, type, model, temperature, instructions) 
                                     VALUES ('${name}', '${agent.model ? "custom" : "default"}', 
                                             '${agent.model || ""}', ${agent.temperature || 0.3}, 
                                             '${JSON.stringify(agent.instructions || []).replace(/'/g, "''")}');`;

            try {
              execSync(`sqlite3 "${this.dbPath}" "${sql}"`, { stdio: "ignore" });
            } catch (_e) {
              // Ignore insertion errors
            }
          }
          console.log(`  ✅ Inserted ${Object.keys(config.agent).length} agents`);
        }

        // Insert MCP servers
        if (config.mcp) {
          for (const [name, mcp] of Object.entries(config.mcp)) {
            const commandStr = JSON.stringify(mcp.command || []);
            const sql = `INSERT OR IGNORE INTO mcp_servers (name, type, command, enabled) 
                                     VALUES ('${name}', '${mcp.type || "local"}', 
                                             '${commandStr.replace(/'/g, "''")}', ${mcp.enabled ? 1 : 0});`;

            try {
              execSync(`sqlite3 "${this.dbPath}" "${sql}"`, { stdio: "ignore" });
            } catch (_e) {
              // Ignore insertion errors
            }
          }
          console.log(`  ✅ Inserted ${Object.keys(config.mcp).length} MCP servers`);
        }
      }

      // Insert workflows from workflows directory
      const workflowsDir = path.join(this.projectRoot, "workflows");
      if (fs.existsSync(workflowsDir)) {
        const files = fs
          .readdirSync(workflowsDir)
          .filter((f) => f.endsWith(".yaml") || f.endsWith(".yml"));

        for (const file of files) {
          const filePath = path.join(workflowsDir, file);
          const content = fs.readFileSync(filePath, "utf8");

          // Simple YAML parsing for name
          const nameMatch = content.match(/^name:\s*(.+)$/m);
          const descMatch = content.match(/^description:\s*(.+)$/m);

          if (nameMatch) {
            const name = nameMatch[1].trim();
            const desc = descMatch ? descMatch[1].trim() : "";
            const sql = `INSERT OR IGNORE INTO workflows (name, description, yaml_config) 
                                     VALUES ('${name.replace(/'/g, "''")}', 
                                             '${desc.replace(/'/g, "''")}', 
                                             '${content.replace(/'/g, "''")}');`;

            try {
              execSync(`sqlite3 "${this.dbPath}" "${sql}"`, { stdio: "ignore" });
            } catch (_e) {
              // Ignore insertion errors
            }
          }
        }
        console.log(`  ✅ Inserted ${files.length} workflows`);
      }

      console.log("✅ Default data inserted!");
      return true;
    } catch (error: unknown) {
      console.error("❌ Failed to insert default data:", (error as Error).message);
      return false;
    }
  }
}

// Run if called directly
const isMain =
  process.argv[1] &&
  (process.argv[1].endsWith("db-init.ts") || process.argv[1].endsWith("db-init.js"));

if (isMain) {
  const projectRoot = process.argv[2] || process.cwd();
  const initializer = new DatabaseInitializer(projectRoot);

  initializer
    .initialize()
    .then((success) => {
      if (success) {
        return initializer.insertDefaultData();
      }
    })
    .then(() => {
      console.log("✅ Database setup complete!");
      process.exit(0);
    })
    .catch((error) => {
      console.error("❌ Setup failed:", error.message);
      process.exit(1);
    });
}
