import path from "node:path";

export function getOpenCodeHome(): string {
  return process.env.OPENCODE_HOME || process.cwd();
}

export function getDatabasePath(): string {
  return path.join(getOpenCodeHome(), "database.sqlite");
}

export function getPluginsPath(): string {
  return path.join(getOpenCodeHome(), "plugins");
}

export function getConfigPath(): string {
  return path.join(getOpenCodeHome(), "opencode.json");
}

export function getCachePath(...segments: string[]): string {
  return path.join(getOpenCodeHome(), ".cache", ...segments);
}

export function getLogsPath(): string {
  return path.join(getOpenCodeHome(), "logs");
}
