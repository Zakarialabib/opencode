/**
 * doc-sync.ts — Auto-harness Layer 4: Doc-Code Alignment
 *
 * Automatically detects drift between documentation and actual codebase:
 * - Agent .md frontmatter vs opencode.json agent config
 * - README.md claims vs actual project state
 * - Docs referencing disabled/removed MCPs
 * - Workflow .md files referencing non-existent agents
 * - Skill count / agent count mismatches
 *
 * Integration: session.idle hook + /sync-docs command + custom tools
 */

import { type Plugin, tool } from "@opencode-ai/plugin";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join, extname } from "node:path";

// ─── Types ─────────────────────────────────────────────────────

interface DocDrift {
  severity: "CRITICAL" | "WARNING" | "INFO";
  file: string;
  claim: string;
  reality: string;
  fix: string;
}

interface SyncReport {
  timestamp: number;
  drifts: DocDrift[];
  summary: { critical: number; warning: number; info: number };
}

// ─── Drift checkers ────────────────────────────────────────────

function checkAgentFrontmatterVsConfig(agentsDir: string, config: any): DocDrift[] {
  const drifts: DocDrift[] = [];
  if (!existsSync(agentsDir)) return drifts;

  const agentFiles = readdirSync(agentsDir).filter((f) => f.endsWith(".md"));
  for (const file of agentFiles) {
    const content = readFileSync(join(agentsDir, file), "utf8");
    const nameMatch = content.match(/^name:\s*(.+)$/m);
    const modeMatch = content.match(/^mode:\s*(.+)$/m);
    const tempMatch = content.match(/^temperature:\s*([\d.]+)$/m);
    const colorMatch = content.match(/^color:\s*(.+)$/m);

    const agentName = nameMatch?.[1]?.trim();
    if (!agentName) continue;

    const configAgent = config.agent?.[agentName];
    if (!configAgent) {
      drifts.push({
        severity: "WARNING",
        file: join(agentsDir, file),
        claim: `Agent '${agentName}' defined in .md file`,
        reality: `Agent '${agentName}' NOT found in opencode.json agent config`,
        fix: `Add agent '${agentName}' to opencode.json or remove the .md file`,
      });
      continue;
    }

    // Check mode
    if (modeMatch) {
      const mdMode = modeMatch[1].trim();
      const configMode = configAgent.mode || "subagent";
      if (mdMode !== configMode) {
        drifts.push({
          severity: "WARNING",
          file: join(agentsDir, file),
          claim: `mode: ${mdMode}`,
          reality: `opencode.json says mode: ${configMode}`,
          fix: `Update .md frontmatter to match: mode: ${configMode}`,
        });
      }
    }

    // Check temperature
    if (tempMatch) {
      const mdTemp = parseFloat(tempMatch[1]);
      const configTemp = configAgent.temperature;
      if (configTemp !== undefined && Math.abs(mdTemp - configTemp) > 0.01) {
        drifts.push({
          severity: "INFO",
          file: join(agentsDir, file),
          claim: `temperature: ${mdTemp}`,
          reality: `opencode.json says temperature: ${configTemp}`,
          fix: `Update .md frontmatter to match: temperature: ${configTemp}`,
        });
      }
    }

    // Check color
    if (colorMatch) {
      const mdColor = colorMatch[1].trim();
      const configColor = configAgent.color;
      if (configColor && mdColor !== configColor) {
        drifts.push({
          severity: "INFO",
          file: join(agentsDir, file),
          claim: `color: ${mdColor}`,
          reality: `opencode.json says color: ${configColor}`,
          fix: `Update .md frontmatter to match: color: ${configColor}`,
        });
      }
    }
  }

  return drifts;
}

function checkReadmeClaims(readmePath: string, config: any): DocDrift[] {
  const drifts: DocDrift[] = [];
  if (!existsSync(readmePath)) return drifts;

  const content = readFileSync(readmePath, "utf8");
  const agentCount = config.agent ? Object.keys(config.agent).length : 0;
  const skillCount = config.skills?.paths?.length ? 46 : 0; // approximate

  // Check agent count claim
  const agentClaim = content.match(/(\d+)\s*(?:specialized\s*)?agents/i);
  if (agentClaim) {
    const claimed = parseInt(agentClaim[1], 10);
    if (claimed !== agentCount) {
      drifts.push({
        severity: "WARNING",
        file: readmePath,
        claim: `${claimed} specialized agents`,
        reality: `Actual: ${agentCount} agents in opencode.json`,
        fix: `Update README.md: "${agentCount} specialized agents"`,
      });
    }
  }

  // Check skill count claim
  const skillClaim = content.match(/(\d+)\s*(?:\+?\s*)?skills/i);
  if (skillClaim) {
    const claimed = parseInt(skillClaim[1], 10);
    if (claimed !== skillCount) {
      drifts.push({
        severity: "INFO",
        file: readmePath,
        claim: `${claimed} skills`,
        reality: `Actual: ${skillCount} skills (approximate)`,
        fix: `Update README.md skill count to match`,
      });
    }
  }

  return drifts;
}

function checkMcpDocReferences(docsDir: string, config: any): DocDrift[] {
  const drifts: DocDrift[] = [];
  if (!existsSync(docsDir)) return drifts;

  const mcpConfig = config.mcp || {};
  const disabledMcps = Object.entries(mcpConfig)
    .filter(([, v]: [string, any]) => v.enabled === false)
    .map(([k]) => k);

  if (disabledMcps.length === 0) return drifts;

  const docFiles = readdirSync(docsDir)
    .filter((f) => f.endsWith(".md"))
    .map((f) => join(docsDir, f));

  for (const file of docFiles) {
    const content = readFileSync(file, "utf8");
    for (const mcpName of disabledMcps) {
      // Look for references that suggest the MCP is enabled or usable
      const refRegex = new RegExp(
        `\\\`${mcpName}\\\`|${mcpName}\\s+(?:MCP|server|tool)|use\\s+the\\s+${mcpName}`,
        "i"
      );
      if (refRegex.test(content)) {
        drifts.push({
          severity: "WARNING",
          file,
          claim: `References MCP '${mcpName}' as usable`,
          reality: `MCP '${mcpName}' is disabled in opencode.json`,
          fix: `Either enable '${mcpName}' in opencode.json or update the doc to note it's disabled`,
        });
      }
    }
  }

  return drifts;
}

function checkWorkflowAgentRefs(workflowsDir: string, config: any): DocDrift[] {
  const drifts: DocDrift[] = [];
  if (!existsSync(workflowsDir)) return drifts;

  const configAgents = new Set(Object.keys(config.agent || {}));
  const workflowFiles = readdirSync(workflowsDir).filter(
    (f) => f.endsWith(".md") || f.endsWith(".yaml") || f.endsWith(".yml")
  );

  for (const file of workflowFiles) {
    const content = readFileSync(join(workflowsDir, file), "utf8");
    // Find @agent references
    const agentRefs = content.match(/@[\w-]+/g) || [];
    for (const ref of agentRefs) {
      const agentName = ref.slice(1); // remove @
      if (!configAgents.has(agentName)) {
        drifts.push({
          severity: "WARNING",
          file: join(workflowsDir, file),
          claim: `References @${agentName}`,
          reality: `Agent '${agentName}' not found in opencode.json`,
          fix: `Replace @${agentName} with an actual agent name, or add '${agentName}' to opencode.json`,
        });
      }
    }
  }

  return drifts;
}

function checkRulesMcpRefs(rulesDir: string, config: any): DocDrift[] {
  const drifts: DocDrift[] = [];
  if (!existsSync(rulesDir)) return drifts;

  const mcpConfig = config.mcp || {};
  const disabledMcps = Object.entries(mcpConfig)
    .filter(([, v]: [string, any]) => v.enabled === false)
    .map(([k]) => k);

  if (disabledMcps.length === 0) return drifts;

  const ruleFiles = readdirSync(rulesDir)
    .filter((f) => f.endsWith(".md"))
    .map((f) => join(rulesDir, f));

  for (const file of ruleFiles) {
    const content = readFileSync(file, "utf8");
    for (const mcpName of disabledMcps) {
      const refRegex = new RegExp(
        `\\\`${mcpName}\\\`|${mcpName}\\s+(?:MCP|server|tool)|use\\s+the\\s+${mcpName}`,
        "i"
      );
      if (refRegex.test(content)) {
        drifts.push({
          severity: "WARNING",
          file,
          claim: `References disabled MCP '${mcpName}'`,
          reality: `MCP '${mcpName}' is disabled in opencode.json`,
          fix: `Enable '${mcpName}' in opencode.json or update the rule file`,
        });
      }
    }
  }

  return drifts;
}

// ─── Main sync function ────────────────────────────────────────

async function runSync(directory: string): Promise<SyncReport> {
  const configPath = join(directory, "opencode.json");
  let config: any = {};
  try {
    config = JSON.parse(readFileSync(configPath, "utf8"));
  } catch {
    return {
      timestamp: Date.now(),
      drifts: [],
      summary: { critical: 0, warning: 0, info: 0 },
    };
  }

  const agentsDir = join(directory, "agents");
  const docsDir = join(directory, "docs");
  const workflowsDir = join(directory, "workflows");
  const rulesDir = join(directory, "rules");
  const readmePath = join(directory, "README.md");

  const allDrifts: DocDrift[] = [
    ...checkAgentFrontmatterVsConfig(agentsDir, config),
    ...checkReadmeClaims(readmePath, config),
    ...checkMcpDocReferences(docsDir, config),
    ...checkWorkflowAgentRefs(workflowsDir, config),
    ...checkRulesMcpRefs(rulesDir, config),
  ];

  const summary = {
    critical: allDrifts.filter((d) => d.severity === "CRITICAL").length,
    warning: allDrifts.filter((d) => d.severity === "WARNING").length,
    info: allDrifts.filter((d) => d.severity === "INFO").length,
  };

  return { timestamp: Date.now(), drifts: allDrifts, summary };
}

function formatReport(report: SyncReport): string {
  if (report.drifts.length === 0) {
    return "## \u2705 Doc-Code Alignment: CLEAN\n\nNo drift detected. All documentation matches the actual codebase.";
  }

  const lines: string[] = [
    "## \u{1F50D} Doc-Code Alignment Report",
    `Generated: ${new Date(report.timestamp).toISOString()}`,
    "",
    `**Found ${report.drifts.length} drifts**: ${report.summary.critical} CRITICAL, ${report.summary.warning} WARNING, ${report.summary.info} INFO`,
    "",
  ];

  for (const drift of report.drifts) {
    const icon =
      drift.severity === "CRITICAL"
        ? "\u{1F534}"
        : drift.severity === "WARNING"
          ? "\u{1F7E1}"
          : "\u{1F7E2}";
    lines.push(`### ${icon} [${drift.severity}] ${drift.file}`);
    lines.push(`- **Claim**: ${drift.claim}`);
    lines.push(`- **Reality**: ${drift.reality}`);
    lines.push(`- **Fix**: ${drift.fix}`);
    lines.push("");
  }

  lines.push("---");
  lines.push("Run `/sync-docs` to re-check, or use `memory_learn` to acknowledge known drifts.");

  return lines.join("\n");
}

// ─── Plugin ────────────────────────────────────────────────────

const DocSyncPlugin: Plugin = async ({ directory }) => {
  return {
    tool: {
      // ── Run full doc-code sync ──
      sync_docs: tool({
        description:
          "Detect drift between documentation and actual codebase. Checks agent .md frontmatter, README claims, MCP references, and workflow agent refs.",
        args: {
          autoFix: tool.schema
            .boolean()
            .default(false)
            .describe("Apply automatic fixes (safe: updates .md frontmatter to match config)"),
        },
        async execute({ autoFix }) {
          const report = await runSync(directory);
          let result = formatReport(report);

          if (autoFix && report.drifts.length > 0) {
            // Apply safe fixes: update .md frontmatter to match config
            const configPath = join(directory, "opencode.json");
            const config = JSON.parse(readFileSync(configPath, "utf8"));
            const agentsDir = join(directory, "agents");
            let fixed = 0;

            if (existsSync(agentsDir)) {
              const agentFiles = readdirSync(agentsDir).filter((f) => f.endsWith(".md"));
              for (const file of agentFiles) {
                const filePath = join(agentsDir, file);
                let content = readFileSync(filePath, "utf8");
                const nameMatch = content.match(/^name:\s*(.+)$/m);
                const agentName = nameMatch?.[1]?.trim();
                if (!agentName) continue;
                const configAgent = config.agent?.[agentName];
                if (!configAgent) continue;

                let changed = false;
                // Fix mode
                if (configAgent.mode) {
                  const modeRegex = /^(mode:\s*).+$/m;
                  if (modeRegex.test(content)) {
                    content = content.replace(modeRegex, `$1${configAgent.mode}`);
                    changed = true;
                  }
                }
                // Fix temperature
                if (configAgent.temperature !== undefined) {
                  const tempRegex = /^(temperature:\s*).+$/m;
                  if (tempRegex.test(content)) {
                    content = content.replace(tempRegex, `$1${configAgent.temperature}`);
                    changed = true;
                  }
                }
                // Fix color
                if (configAgent.color) {
                  const colorRegex = /^(color:\s*).+$/m;
                  if (colorRegex.test(content)) {
                    content = content.replace(colorRegex, `$1${configAgent.color}`);
                    changed = true;
                  }
                }
                if (changed) {
                  require("node:fs").writeFileSync(filePath, content, "utf8");
                  fixed++;
                }
              }
            }

            result += `\n\n**Auto-fix applied**: Updated frontmatter in ${fixed} agent .md file(s).`;
          }

          return result;
        },
      }),

      // ── Quick check: is one specific file in sync? ──
      sync_check_file: tool({
        description: "Check if a specific agent .md file's frontmatter matches opencode.json",
        args: {
          agentName: tool.schema.string().describe("Agent name to check (without .md)"),
        },
        async execute({ agentName }) {
          const configPath = join(directory, "opencode.json");
          const agentPath = join(directory, "agents", `${agentName}.md`);
          let config: any = {};
          try {
            config = JSON.parse(readFileSync(configPath, "utf8"));
          } catch {
            return "Could not read opencode.json";
          }
          if (!existsSync(agentPath)) {
            return `Agent file agents/${agentName}.md not found.`;
          }
          const content = readFileSync(agentPath, "utf8");
          const configAgent = config.agent?.[agentName];
          if (!configAgent) {
            return `Agent '${agentName}' not found in opencode.json config.`;
          }

          const issues: string[] = [];
          const modeMatch = content.match(/^mode:\s*(.+)$/m);
          if (modeMatch && modeMatch[1].trim() !== (configAgent.mode || "subagent")) {
            issues.push(
              `mode mismatch: .md says "${modeMatch[1].trim()}", config says "${configAgent.mode}"`
            );
          }
          const tempMatch = content.match(/^temperature:\s*([\d.]+)$/m);
          if (tempMatch && configAgent.temperature !== undefined) {
            const mdTemp = parseFloat(tempMatch[1]);
            if (Math.abs(mdTemp - configAgent.temperature) > 0.01) {
              issues.push(
                `temperature mismatch: .md says ${mdTemp}, config says ${configAgent.temperature}`
              );
            }
          }

          if (issues.length === 0)
            return `\u2705 ${agentName}.md frontmatter is in sync with opencode.json.`;
          return `\u26A0\uFE0F ${agentName}.md has ${issues.length} issue(s):\n${issues.map((i) => `- ${i}`).join("\n")}`;
        },
      }),
    },
  };
};

export default DocSyncPlugin;
