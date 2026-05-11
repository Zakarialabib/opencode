/**
 * Debug logging utility for opencode plugins
 * Enable by setting DEBUG=opencode:* or specific categories
 */

const DEBUG_ENABLED = process.env.DEBUG || "";
const LOG_PREFIX = "[DEBUG]";

export type LogLevel = "debug" | "info" | "warn" | "error";

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  category: string;
  message: string;
  data?: any;
}

// In-memory log buffer (last 1000 entries)
const logBuffer: LogEntry[] = [];
const MAX_LOG_ENTRIES = 1000;

export function shouldLog(category: string, level: LogLevel): boolean {
  // Always log errors
  if (level === "error") return true;
  if (!DEBUG_ENABLED) return false;
  if (DEBUG_ENABLED === "*") return true;

  const patterns = DEBUG_ENABLED.split(",").map((p) => p.trim());
  const fullCategory = `${category}:${level}`;

  return patterns.some((pattern) => {
    if (pattern.includes("*")) {
      const regex = new RegExp("^" + pattern.replace(/\*/g, ".*") + "$");
      return regex.test(category) || regex.test(fullCategory);
    }
    return pattern === category || pattern === fullCategory;
  });
}

export function log(level: LogLevel, category: string, message: string, data?: any) {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    category,
    message,
    data,
  };

  // Add to buffer
  logBuffer.push(entry);
  if (logBuffer.length > MAX_LOG_ENTRIES) {
    logBuffer.shift();
  }

  // Console output
  const prefix = `${LOG_PREFIX} [${level.toUpperCase()}] [${category}]`;
  const dataStr = data ? ` ${JSON.stringify(data, null, 2)}` : "";

  switch (level) {
    case "debug":
      console.debug(`${prefix} ${message}${dataStr}`);
      break;
    case "info":
      console.info(`${prefix} ${message}${dataStr}`);
      break;
    case "warn":
      console.warn(`${prefix} ${message}${dataStr}`);
      break;
    case "error":
      console.error(`${prefix} ${message}${dataStr}`);
      break;
  }
}

export function getLogs(category?: string, level?: LogLevel, limit = 100): LogEntry[] {
  let filtered = logBuffer;

  if (category) {
    filtered = filtered.filter((e) => e.category === category);
  }
  if (level) {
    filtered = filtered.filter((e) => e.level === level);
  }

  return filtered.slice(-limit);
}

export function clearLogs() {
  logBuffer.length = 0;
}

export function exportLogs(): string {
  return JSON.stringify(logBuffer, null, 2);
}

// Convenience functions
export const debug = (category: string, message: string, data?: any) =>
  log("debug", category, message, data);

export const info = (category: string, message: string, data?: any) =>
  log("info", category, message, data);

export const warn = (category: string, message: string, data?: any) =>
  log("warn", category, message, data);

export const error = (category: string, message: string, data?: any) =>
  log("error", category, message, data);

// Skill-specific logging categories
export const SKILL_CATEGORIES = {
  SKILL_LOAD: "skill:load",
  SKILL_EXECUTE: "skill:execute",
  SKILL_ERROR: "skill:error",
  TOOL_REGISTER: "tool:register",
  TOOL_LOAD: "tool:load",
  TOOL_EXECUTE: "tool:execute",
  MCP_CONNECT: "mcp:connect",
  MCP_ERROR: "mcp:error",
  LSP_CONTEXT: "lsp:context",
  LSP_ERROR: "lsp:error",
  AGENT_ROUTE: "agent:route",
  CONFIG_LOAD: "config:load",
  HOOK_INVOKE: "hook:invoke",
} as const;

export default {
  log,
  shouldLog,
  getLogs,
  clearLogs,
  exportLogs,
  debug,
  info,
  warn,
  error,
  SKILL_CATEGORIES,
};
