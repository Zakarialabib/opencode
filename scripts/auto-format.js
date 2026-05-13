#!/usr/bin/env node
/**
 * auto-format.js - Auto-formats files based on language detection
 * Uses rules/auto-format.md for formatter selection
 */

const fs = require("fs").promises;
const path = require("path");
const { execSync, spawnSync } = require("child_process");

// Formatter mappings from rules/auto-format.md
const FORMATTERS = {
  ".rs": {
    name: "rustfmt",
    command: "cargo",
    args: ["fmt"],
    checkCommand: "cargo fmt -- --check",
  },
  ".ts": {
    name: "biome",
    command: "npx",
    args: ["biome", "format", "--write"],
    checkCommand: "npx biome check",
  },
  ".tsx": {
    name: "biome",
    command: "npx",
    args: ["biome", "format", "--write"],
    checkCommand: "npx biome check",
  },
  ".js": {
    name: "biome",
    command: "npx",
    args: ["biome", "format", "--write"],
    checkCommand: "npx biome check",
  },
  ".jsx": {
    name: "biome",
    command: "npx",
    args: ["biome", "format", "--write"],
    checkCommand: "npx biome check",
  },
  ".json": {
    name: "biome",
    command: "npx",
    args: ["biome", "format", "--write"],
    checkCommand: "npx biome check",
  },
  ".css": {
    name: "prettier",
    command: "npx",
    args: ["prettier", "--write"],
    checkCommand: "npx prettier --check",
  },
  ".scss": {
    name: "prettier",
    command: "npx",
    args: ["prettier", "--write"],
    checkCommand: "npx prettier --check",
  },
  ".html": {
    name: "prettier",
    command: "npx",
    args: ["prettier", "--write"],
    checkCommand: "npx prettier --check",
  },
  ".md": {
    name: "prettier",
    command: "npx",
    args: ["prettier", "--write"],
    checkCommand: "npx prettier --check",
  },
  ".yaml": {
    name: "prettier",
    command: "npx",
    args: ["prettier", "--write"],
    checkCommand: "npx prettier --check",
  },
  ".yml": {
    name: "prettier",
    command: "npx",
    args: ["prettier", "--write"],
    checkCommand: "npx prettier --check",
  },
  ".php": {
    name: "pint",
    command: "php",
    args: ["vendor/bin/pint"],
    checkCommand: "php vendor/bin/pint --test",
  },
  ".py": {
    name: "black",
    command: "black",
    args: [],
    checkCommand: "black --check",
  },
};

class AutoFormatter {
  constructor() {
    this.formatted = 0;
    this.errors = 0;
    this.skipped = 0;
  }

  getExtension(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    return ext;
  }

  getFormatter(ext) {
    return FORMATTERS[ext] || null;
  }

  async formatFile(filePath) {
    const ext = this.getExtension(filePath);
    const formatter = this.getFormatter(ext);

    if (!formatter) {
      console.log(`  ⏭  Skipped: ${filePath} (no formatter for ${ext})`);
      this.skipped++;
      return;
    }

    try {
      // Check if file exists
      await fs.access(filePath);

      // Build command
      const args = [...formatter.args, filePath];

      console.log(`  🎨 Formatting: ${filePath} (${formatter.name})`);

      // Execute formatter
      const result = spawnSync(formatter.command, args, {
        stdio: "pipe",
        timeout: 30000,
      });

      if (result.status === 0 || result.status === null) {
        console.log(`  ✅ Formatted: ${filePath}`);
        this.formatted++;
      } else {
        console.log(
          `  ❌ Error formatting ${filePath}: ${result.stderr?.toString() || "Unknown error"}`
        );
        this.errors++;
      }
    } catch (e) {
      if (e.code === "ENOENT") {
        console.log(`  ❌ Formatter not found: ${formatter.name}`);
      } else {
        console.log(`  ❌ Error: ${e.message}`);
      }
      this.errors++;
    }
  }

  async formatDirectory(dirPath, recursive = true) {
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);

        if (
          entry.isDirectory() &&
          recursive &&
          !entry.name.startsWith(".") &&
          entry.name !== "node_modules"
        ) {
          await this.formatDirectory(fullPath, recursive);
        } else if (entry.isFile()) {
          await this.formatFile(fullPath);
        }
      }
    } catch (e) {
      console.error(`Error reading directory ${dirPath}:`, e.message);
    }
  }

  printSummary() {
    console.log("\n" + "=".repeat(50));
    console.log("Auto-Format Summary:");
    console.log(`  ✅ Formatted: ${this.formatted} files`);
    console.log(`  ❌ Errors: ${this.errors} files`);
    console.log(`  ⏭  Skipped: ${this.skipped} files`);
    console.log("=".repeat(50));
  }
}

// CLI usage
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log("Usage: node auto-format.js <file-or-directory> [--recursive]");
    console.log("\nSupported extensions:");
    Object.keys(FORMATTERS).forEach((ext) => {
      console.log(`  ${ext} → ${FORMATTERS[ext].name}`);
    });
    process.exit(1);
  }

  const formatter = new AutoFormatter();
  const target = args[0];
  const recursive = args.includes("--recursive");

  (async () => {
    try {
      const stat = await fs.stat(target);

      console.log(`🎨 Auto-Formatting: ${target}`);
      console.log("=".repeat(50));

      if (stat.isDirectory()) {
        await formatter.formatDirectory(target, recursive);
      } else {
        await formatter.formatFile(target);
      }

      formatter.printSummary();
    } catch (e) {
      console.error(`❌ Error: ${e.message}`);
      process.exit(1);
    }
  })();
}

module.exports = AutoFormatter;
