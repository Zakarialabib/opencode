import { parseJsonc } from "./jsonc-utils";
import { type Plugin, tool } from "@opencode-ai/plugin";
import { readFileSync, accessSync } from "node:fs";
import { join, dirname, parse } from "node:path";
import { debug, info, warn, error, SKILL_CATEGORIES } from "./debug-logger";

// Debug: trace skill execution
function traceSkillExecution(skillName: string, args: any, result: any, err?: any) {
  debug(
    SKILL_CATEGORIES.SKILL_EXECUTE,
    `Skill "${skillName}" execution ${err ? "FAILED" : "completed"}`,
    {
      skillName,
      args: JSON.stringify(args).slice(0, 200),
      hasError: !!err,
      errorMessage: err?.message || err?.toString(),
      resultPreview: typeof result === "string" ? result.slice(0, 100) : typeof result,
    }
  );
}

interface SkillEntry {
  name: string;
  displayName?: string;
  description: string;
  version?: string;
  category: string;
  tags?: string[];
  agents?: string[];
  triggers?: string[];
  entryPoint: string;
  _loadedAt?: number;
}

interface SkillExecutionTrace {
  skillName: string;
  startedAt: number;
  duration?: number;
  status: "loading" | "executing" | "completed" | "error";
  error?: string;
}

const skillExecutionTraces = new Map<string, SkillExecutionTrace>();
const MAX_TRACES = 100;

function findProjectRoot(startDir: string): string | null {
  let current = startDir;
  const root = parse(current).root;

  while (current !== root) {
    try {
      accessSync(join(current, "opencode.json"));
      return current;
    } catch {
      current = dirname(current);
    }
  }

  try {
    accessSync(join(root, "opencode.json"));
    return root;
  } catch {
    return null;
  }
}

function resolveConfigRoot(startDir: string): string | null {
  const explicitDir = process.env.OPENCODE_CONFIG_DIR;
  if (explicitDir) {
    try {
      accessSync(join(explicitDir, "opencode.json"));
      return explicitDir;
    } catch {
      // Fall back to directory search.
    }
  }

  const explicitConfig = process.env.OPENCODE_CONFIG;
  if (explicitConfig) {
    try {
      accessSync(explicitConfig);
      return dirname(explicitConfig);
    } catch {
      // Fall back to directory search.
    }
  }

  return findProjectRoot(startDir);
}

export function getSkillExecutionTrace(
  skillName?: string
): SkillExecutionTrace | SkillExecutionTrace[] {
  if (skillName) {
    return (
      skillExecutionTraces.get(skillName) || {
        skillName,
        startedAt: 0,
        status: "completed" as const,
        error: "Not found in trace",
      }
    );
  }
  return Array.from(skillExecutionTraces.values());
}

export function clearSkillTraces() {
  skillExecutionTraces.clear();
}

function recordSkillStart(skillName: string): void {
  const trace: SkillExecutionTrace = {
    skillName,
    startedAt: Date.now(),
    status: "loading",
  };
  skillExecutionTraces.set(skillName, trace);
  debug(SKILL_CATEGORIES.SKILL_LOAD, `Skill "${skillName}" loading started`, {
    existingTraces: skillExecutionTraces.size,
  });
}

function recordSkillComplete(skillName: string, status: "completed" | "error", err?: string): void {
  const trace = skillExecutionTraces.get(skillName);
  if (trace) {
    trace.duration = Date.now() - trace.startedAt;
    trace.status = status;
    trace.error = err;
    debug(
      SKILL_CATEGORIES.SKILL_EXECUTE,
      `Skill "${skillName}" ${status} in ${trace.duration}ms`,
      err ? { error: err } : undefined
    );
  }

  if (skillExecutionTraces.size > MAX_TRACES) {
    const oldest = Array.from(skillExecutionTraces.entries())
      .sort((a, b) => a[1].startedAt - b[1].startedAt)
      .slice(0, 10);
    for (const [key] of oldest) {
      skillExecutionTraces.delete(key);
    }
  }
}

const SkillManagerPlugin: Plugin = async ({ directory }) => {
  const projectRoot = resolveConfigRoot(directory);
  let skillsIndexPath: string | null = null;
  let skills: SkillEntry[] = [];

  debug(SKILL_CATEGORIES.SKILL_LOAD, "SkillManager initializing", { projectRoot, directory });

  if (projectRoot) {
    const candidate = join(projectRoot, "skills", "index.json");
    try {
      readFileSync(candidate, "utf8");
      skillsIndexPath = candidate;
      debug(SKILL_CATEGORIES.SKILL_LOAD, `Found skills index at ${candidate}`);
    } catch (e) {
      debug(SKILL_CATEGORIES.SKILL_LOAD, `No skills index found at ${candidate}`, {
        error: (e as Error).message,
      });
    }
  } else {
    debug(SKILL_CATEGORIES.SKILL_LOAD, `No opencode project root found for ${directory}`);
  }

  if (skillsIndexPath) {
    try {
      const skillsIndex = parseJsonc(readFileSync(skillsIndexPath, "utf8"));
      skills = (skillsIndex.skills || []).map((s: SkillEntry) => ({
        ...s,
        _loadedAt: Date.now(),
      }));
      debug(SKILL_CATEGORIES.SKILL_LOAD, `Loaded ${skills.length} skills from index`);
    } catch (e) {
      error(SKILL_CATEGORIES.SKILL_LOAD, "Failed to parse skills index", {
        error: (e as Error).message,
      });
    }
  } else {
    debug(SKILL_CATEGORIES.SKILL_LOAD, "SkillManager running without local skills index", {
      directory,
    });
  }

  return {
    tool: {
      skill_list: tool({
        description: "List all registered skills and their assigned agents",
        args: {
          category: tool.schema
            .string()
            .optional()
            .describe("Filter by category (e.g., frontend, backend, testing)"),
        },
        async execute({ category }: { category?: string }, _context: any) {
          const startTime = Date.now();
          debug(SKILL_CATEGORIES.SKILL_EXECUTE, "skill_list called", { category });

          let filtered = skills;
          if (category) {
            filtered = skills.filter((s) => s.category === category);
          }

          const result =
            filtered.length === 0
              ? "No skills found."
              : JSON.stringify(filtered.map((s) => ({
                  name: s.name,
                  displayName: s.displayName,
                  category: s.category,
                  description: s.description,
                  agents: s.agents,
                  tags: s.tags,
                })));

          recordSkillComplete("skill_list", "completed");
          debug(
            SKILL_CATEGORIES.SKILL_EXECUTE,
            `skill_list completed in ${Date.now() - startTime}ms`,
            {
              count: filtered.length,
              category,
            }
          );

          return result;
        },
      }),

      skill_info: tool({
        description: "Get detailed information about a specific skill",
        args: {
          skillName: tool.schema.string().describe("Name or display name of the skill to look up"),
        },
        async execute({ skillName }: { skillName: string }, _context: any) {
          const startTime = Date.now();
          recordSkillStart(`skill_info:${skillName}`);
          debug(SKILL_CATEGORIES.SKILL_EXECUTE, `skill_info called for "${skillName}"`);

          const skill = skills.find((s) => s.name === skillName || s.displayName === skillName);
          if (!skill) {
            recordSkillComplete(
              `skill_info:${skillName}`,
              "error",
              `Skill not found: ${skillName}`
            );
            return `❌ Skill "${skillName}" not found.`;
          }

          const result = {
            name: skill.name,
            displayName: skill.displayName,
            version: skill.version,
            category: skill.category,
            description: skill.description,
            agents: skill.agents,
            entryPoint: skill.entryPoint,
            tags: skill.tags,
            triggers: skill.triggers,
          };

          recordSkillComplete(`skill_info:${skillName}`, "completed");
          debug(
            SKILL_CATEGORIES.SKILL_EXECUTE,
            `skill_info completed in ${Date.now() - startTime}ms`
          );

          return JSON.stringify(result);
        },
      }),

      skill_search: tool({
        description: "Search for skills by keyword or tag",
        args: {
          query: tool.schema.string().describe("Search term (searches name, description, tags)"),
        },
        async execute({ query }: { query: string }, _context: any) {
          const startTime = Date.now();
          debug(SKILL_CATEGORIES.SKILL_EXECUTE, `skill_search called with "${query}"`);

          const queryLower = query.toLowerCase();
          const matches = skills.filter(
            (s) =>
              s.name.toLowerCase().includes(queryLower) ||
              (s.displayName && s.displayName.toLowerCase().includes(queryLower)) ||
              s.description.toLowerCase().includes(queryLower) ||
              (s.tags && s.tags.some((tag) => tag.toLowerCase().includes(queryLower)))
          );

          const result =
            matches.length === 0
              ? `No skills found matching "${query}".`
              : JSON.stringify(matches.map((s) => ({
                  name: s.name,
                  displayName: s.displayName,
                  description: s.description,
                })));

          debug(
            SKILL_CATEGORIES.SKILL_EXECUTE,
            `skill_search completed in ${Date.now() - startTime}ms`,
            {
              query,
              matches: matches.length,
            }
          );

          return result;
        },
      }),

      skill_debug_status: tool({
        description: "Debug: Get skill system status and traces",
        args: {},
        async execute(_args: {}, _context: any) {
          const traces = getSkillExecutionTrace();
          const traceArray = Array.isArray(traces) ? traces : [traces];
          return JSON.stringify({
            totalSkillsLoaded: skills.length,
            activeTraces: traceArray.length,
            recentTraces: traceArray.slice(-10),
            projectRoot,
            skillsIndexPath,
          });
        },
      }),
    },
  };
};

export default SkillManagerPlugin;
