/**
 * Simple file logger for Meta-Harness operations.
 * Logs to .opencode/logs/meta-harness.log
 */

import { appendFileSync, mkdirSync, existsSync } from "fs";
import { dirname, join } from "path";

// Use process.cwd() for proper working directory resolution
const LOG_DIR = join(process.cwd(), ".opencode", "logs");
const LOG_FILE = join(LOG_DIR, "meta-harness.log");

function ensureLogDir() {
  if (!existsSync(LOG_DIR)) {
    mkdirSync(LOG_DIR, { recursive: true });
  }
}

export function fileLog(message: string, level: "info" | "warn" | "error" = "info"): void {
  ensureLogDir();
  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] [${level.toUpperCase()}] ${message}
`;

  try {
    appendFileSync(LOG_FILE, line);
  } catch {
    // Silent fail - logging is best-effort
  }

  // Also console output for visibility during development
  if (level === "error") {
    console.error(line.trim());
  } else if (level === "warn") {
    console.warn(line.trim());
  } else {
    console.log(line.trim());
  }
}

export function clearLog(): void {
  ensureLogDir();
  try {
    const { writeFileSync } = require("fs");
    writeFileSync(LOG_FILE, "");
  } catch {
    // Ignore
  }
}
