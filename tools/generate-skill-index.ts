import * as fs from "node:fs";
import * as path from "node:path";

type SkillFrontmatter = {
  name?: string;
  displayName?: string;
  description?: string;
  category?: string;
  tags?: string[];
  agents?: string[];
  version?: string;
};

const skillsDir = path.resolve(process.cwd(), "skills");
const indexPath = path.join(skillsDir, "index.json");
const existingIndex = JSON.parse(fs.readFileSync(indexPath, "utf8"));
const existingSkills = Array.isArray(existingIndex.skills)
  ? existingIndex.skills
  : Object.values(existingIndex.skills || {});
const existingNames = new Set(existingSkills.map((s: { name: string }) => s.name));

function walkSkillFiles(dir: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const found: string[] = [];

  for (const entry of entries) {
    if (entry.name.startsWith("_") || entry.name === "archive") continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      found.push(...walkSkillFiles(fullPath));
    } else if (entry.isFile() && entry.name === "SKILL.md") {
      found.push(fullPath);
    }
  }

  return found;
}

function parseFrontmatter(filePath: string): SkillFrontmatter {
  try {
    const content = fs.readFileSync(filePath, "utf8");
    const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!match) return {};

    const frontmatter: SkillFrontmatter = {};
    for (const line of match[1].split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const colonIndex = trimmed.indexOf(":");
      if (colonIndex === -1) continue;

      const key = trimmed.slice(0, colonIndex).trim();
      const rawValue = trimmed.slice(colonIndex + 1).trim();
      const value = rawValue.replace(/^["']|["']$/g, "");

      if (key === "name") frontmatter.name = value;
      if (key === "displayName") frontmatter.displayName = value;
      if (key === "description") frontmatter.description = value;
      if (key === "category") frontmatter.category = value;
      if (key === "version") frontmatter.version = value;
      if (key === "agents") {
        const list = rawValue.match(/\[(.*)\]/)?.[1];
        frontmatter.agents = list
          ? list
              .split(",")
              .map((item) => item.trim().replace(/^["']|["']$/g, ""))
              .filter(Boolean)
          : [];
      }
      if (key === "tags") {
        const list = rawValue.match(/\[(.*)\]/)?.[1];
        frontmatter.tags = list
          ? list
              .split(",")
              .map((item) => item.trim().replace(/^["']|["']$/g, ""))
              .filter(Boolean)
          : [];
      }
    }
    return frontmatter;
  } catch {
    return {};
  }
}

const skillFiles = walkSkillFiles(skillsDir);
const discoveredSkills = skillFiles.map((filePath) => {
  const skillDir = path.dirname(filePath);
  const relativePath = path.relative(skillsDir, filePath).replace(/\\/g, "/");
  const relativeDir = path.relative(skillsDir, skillDir).replace(/\\/g, "/");
  const frontmatter = parseFrontmatter(filePath);
  const name = frontmatter.name || relativeDir.replace(/[\\/]/g, "-");

  return {
    path: `skills/${relativePath}`,
    name,
    displayName: frontmatter.displayName || name,
    description: frontmatter.description || `${name} skill for OpenCode`,
    version: frontmatter.version || "1.0.0",
    category: frontmatter.category || "general",
    tags: frontmatter.tags || [name],
    agents: frontmatter.agents || ["core-factory"],
    entryPoint: "SKILL.md",
  };
});

const missing = discoveredSkills.filter((skill) => !existingNames.has(skill.name));
console.log(`Missing from index (${missing.length}):`, missing.map((s) => s.name).join(", "));

const mergedSkills = [...existingSkills];
for (const skill of missing) {
  mergedSkills.push(skill);
}

existingIndex.lastUpdated = new Date().toISOString();
existingIndex.skills = mergedSkills.sort((a, b) => a.name.localeCompare(b.name));
existingIndex.totalSkills = existingIndex.skills.length;

fs.writeFileSync(indexPath, `${JSON.stringify(existingIndex, null, 2)}\n`, "utf-8");
console.log(`Total skills in index: ${existingIndex.totalSkills}`);
console.log(`Added ${missing.length} new entries`);
