import * as fs from "fs";
import * as path from "path";
import * as yaml from "yaml";

export class SkillRegistry {
  private skillsDir: string;
  private skills: Map<string, any>;
  private index: any;

  constructor(skillsDir: string) {
    this.skillsDir = skillsDir;
    this.skills = new Map();
    this.index = null;
  }

  async loadIndex(): Promise<boolean> {
    try {
      const indexPath = path.join(this.skillsDir, "index.json");
      if (fs.existsSync(indexPath)) {
        const indexData = fs.readFileSync(indexPath, "utf8");
        this.index = JSON.parse(indexData);
        await this.loadSkills();
        return true;
      }
    } catch (error) {
      console.error("Failed to load skill index:", error);
    }
    return false;
  }

  async loadSkills(): Promise<void> {
    if (!this.index || !this.index.skills) return;

    for (const skillInfo of this.index.skills) {
      try {
        await this.loadSkill(skillInfo.name, skillInfo.path || skillInfo.entryPoint);
      } catch (error) {
        console.error(`Failed to load skill ${skillInfo.name}:`, error);
      }
    }
  }

  resolveSkillPath(skillName: string, skillPath?: string): string {
    if (skillPath) {
      const normalized = skillPath.startsWith("skills/")
        ? skillPath.slice("skills/".length)
        : skillPath;
      return path.isAbsolute(normalized)
        ? normalized
        : path.join(this.skillsDir, normalized);
    }

    return path.join(this.skillsDir, skillName, "SKILL.md");
  }

  async loadSkill(skillName: string, skillPath?: string): Promise<any> {
    if (this.skills.has(skillName)) {
      return this.skills.get(skillName);
    }

    const resolvedSkillPath = this.resolveSkillPath(skillName, skillPath);
    const skillDir = path.dirname(resolvedSkillPath);

    if (!fs.existsSync(resolvedSkillPath)) {
      throw new Error(`Skill ${skillName} not found at ${resolvedSkillPath}`);
    }

    const content = fs.readFileSync(resolvedSkillPath, "utf8");
    const skill = {
      name: skillName,
      path: skillDir,
      content: content,
      metadata: this.extractMetadata(content, skillName),
    };

    // Load metadata from index if available
    const indexSkill = this.index?.skills?.find((s: any) => s.name === skillName);
    if (indexSkill) {
      skill.metadata = { ...skill.metadata, ...indexSkill };
    }

    this.skills.set(skillName, skill);
    return skill;
  }

  extractMetadata(content: string, skillName: string): any {
    const metadata: any = {};
    const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!match) {
      return metadata;
    }

    try {
      const parsed = yaml.parse(match[1]);
      if (parsed && typeof parsed === "object") {
        return parsed;
      }
    } catch (error: any) {
      console.warn(`Failed to parse SKILL.md frontmatter for ${skillName}:`, error.message);
    }

    return metadata;
  }

  getSkill(skillName: string): any {
    return this.skills.get(skillName) || null;
  }

  listSkills(): string[] {
    return Array.from(this.skills.keys());
  }

  searchSkills(query: string): string[] {
    const lowerQuery = query.toLowerCase();
    return this.listSkills().filter((skillName) => {
      const skill = this.getSkill(skillName);
      if (!skill) return false;

      return (
        skill.name.toLowerCase().includes(lowerQuery) ||
        (skill.metadata.displayName &&
          skill.metadata.displayName.toLowerCase().includes(lowerQuery)) ||
        (skill.metadata.description &&
          skill.metadata.description.toLowerCase().includes(lowerQuery)) ||
        (skill.metadata.tags &&
          skill.metadata.tags.some((tag: string) => tag.toLowerCase().includes(lowerQuery)))
      );
    });
  }

  getSkillsByAgent(agentName: string): string[] {
    return this.listSkills().filter((skillName) => {
      const skill = this.getSkill(skillName);
      if (!skill) return false;
      return skill.metadata.agents && skill.metadata.agents.includes(agentName);
    });
  }

  getSkillsByCategory(category: string): string[] {
    return this.listSkills().filter((skillName) => {
      const skill = this.getSkill(skillName);
      if (!skill) return false;
      return skill.metadata.category === category;
    });
  }

  async reload(): Promise<boolean> {
    this.skills.clear();
    this.index = null;
    return await this.loadIndex();
  }
}

export default SkillRegistry;

