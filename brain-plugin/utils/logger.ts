import * as fs from "fs";
import * as pathModule from "path";

const BRAIN_LOG_FILE = ".opencode/brain-plugin.log";

export function brainLog(msg: string, level: "info" | "warn" | "error" = "info"): void {
  const timestamp = new Date().toISOString();
  const entry = `[${timestamp}] [${level.toUpperCase()}] [Brain] ${msg}\n`;
  
  if (process.env.NODE_ENV !== "test") {
    try {
      const logDir = pathModule.join(process.cwd(), ".opencode");
      const logFile = pathModule.join(logDir, "brain-plugin.log");
      
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }
      fs.appendFileSync(logFile, entry);
    } catch {
      console.error("[Brain] Failed to write to log file:", msg);
    }
  }
  
  if (level === "error") {
    console.error("[Brain]", msg);
  } else if (level === "warn") {
    console.warn("[Brain]", msg);
  } else {
    console.log("[Brain]", msg);
  }
}
