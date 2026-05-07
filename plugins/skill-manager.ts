import { parseJsonc } from "./jsonc-utils";
import { Plugin, tool } from "@opencode-ai/plugin";
import { readFileSync } from "fs";
import { join } from "path";

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
}

const SkillManagerPlugin: Plugin = async ({ directory }) => {
  const candidates = [
    join(directory, "opencode", "skills", "index.json"),
    join(directory, "skills", "index.json"),
  ];
  let skillsIndexPath: string | null = null;
  for (const candidate of candidates) {
    try {
      readFileSync(candidate, "utf8");
      skillsIndexPath = candidate;
      break;
    } catch {
      continue;
    }
  }
  let skills: SkillEntry[] = [];

  if (skillsIndexPath) {
    try {
      const skillsIndex = parseJsonc(readFileSync(skillsIndexPath, "utf8"));
      skills = skillsIndex.skills || [];
    } catch (e) {
      console.error("Failed to read skills index:", e);
    }
  } else {
    console.error("Failed to find skills index in:", candidates);
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
        async execute({ category }) {
          let filtered = skills;
          if (category) {
            filtered = skills.filter((s) => s.category === category);
          }

          if (filtered.length === 0) return "No skills found.";

          let result = `## Registered Skills (${filtered.length})\n\n`;
          for (const skill of filtered) {
            result += `### ${skill.displayName || skill.name} (\`${skill.name}\`)\n`;
            result += `- Category: ${skill.category}\n`;
            result += `- Description: ${skill.description}\n`;
            result += `- Agents: ${skill.agents?.join(", ") || "None"}\n`;
            result += `- Tags: ${skill.tags?.join(", ") || "None"}\n\n`;
          }
          return result;
        },
      }),

      skill_info: tool({
        description: "Get detailed information about a specific skill",
        args: {
          skillName: tool.schema.string().describe("Name or display name of the skill to look up"),
        },
        async execute({ skillName }) {
          const skill = skills.find((s) => s.name === skillName || s.displayName === skillName);
          if (!skill) return `❌ Skill "${skillName}" not found.`;

          let result = `## Skill: ${skill.displayName || skill.name}\n\n`;
          result += `- **Name**: \`${skill.name}\`\n`;
          result += `- **Version**: ${skill.version || "N/A"}\n`;
          result += `- **Category**: ${skill.category}\n`;
          result += `- **Description**: ${skill.description}\n`;
          result += `- **Agents**: ${skill.agents?.join(", ") || "None"}\n`;
          result += `- **Entry Point**: \`${skill.entryPoint}\`\n`;
          result += `- **Tags**: ${skill.tags?.join(", ") || "None"}\n`;

          if (skill.triggers && skill.triggers.length > 0) {
            result += `\n### Triggers\n`;
            for (const trigger of skill.triggers) {
              result += `- ${trigger}\n`;
            }
          }
          return result;
        },
      }),

      skill_search: tool({
        description: "Search for skills by keyword or tag",
        args: {
          query: tool.schema.string().describe("Search term (searches name, description, tags)"),
        },
        async execute({ query }) {
          const queryLower = query.toLowerCase();
          const matches = skills.filter(
            (s) =>
              s.name.toLowerCase().includes(queryLower) ||
              (s.displayName && s.displayName.toLowerCase().includes(queryLower)) ||
              s.description.toLowerCase().includes(queryLower) ||
              (s.tags && s.tags.some((tag) => tag.toLowerCase().includes(queryLower)))
          );

          if (matches.length === 0) return `No skills found matching "${query}".`;

          let result = `## Skill Search Results (${matches.length})\n\n`;
          for (const skill of matches) {
            result += `- **${skill.displayName || skill.name}** (\`${skill.name}\`): ${skill.description}\n`;
          }
          return result;
        },
      }),
    },
  };
};

export default SkillManagerPlugin;
