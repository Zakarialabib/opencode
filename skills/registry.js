// Skill Registry for OpenCode
// Provides discovery, loading, and management of skills

const fs = require("fs");
const path = require("path");
const yaml = require("yaml");

class SkillRegistry {
  constructor(skillsDir) {
    this.skillsDir = skillsDir;
    this.skills = new Map();
    this.index = null;
  }

  async loadIndex() {
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

  async loadSkills() {
    if (!this.index || !this.index.skills) return;

    for (const skillInfo of this.index.skills) {
      try {
        await this.loadSkill(skillInfo.name);
      } catch (error) {
        console.error(`Failed to load skill ${skillInfo.name}:`, error);
      }
    }
  }

  async loadSkill(skillName) {
    if (this.skills.has(skillName)) {
      return this.skills.get(skillName);
    }

    const skillDir = path.join(this.skillsDir, skillName);
    const skillPath = path.join(skillDir, "SKILL.md");

    if (!fs.existsSync(skillPath)) {
      throw new Error(`Skill ${skillName} not found at ${skillPath}`);
    }

    const content = fs.readFileSync(skillPath, "utf8");
    const skill = {
      name: skillName,
      path: skillDir,
      content: content,
      metadata: this.extractMetadata(content),
    };

    // Load metadata from index if available
    const indexSkill = this.index.skills.find((s) => s.name === skillName);
    if (indexSkill) {
      skill.metadata = { ...skill.metadata, ...indexSkill };
    }

    this.skills.set(skillName, skill);
    return skill;
  }

  extractMetadata(content) {
    const metadata = {};
    const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!match) {
      return metadata;
    }

    try {
      const parsed = yaml.parse(match[1]);
      if (parsed && typeof parsed === "object") {
        return parsed;
      }
    } catch (error) {
      console.warn("Failed to parse SKILL.md frontmatter:", error.message);
    }

    return metadata;
  }

  getSkill(skillName) {
    return this.skills.get(skillName) || null;
  }

  listSkills() {
    return Array.from(this.skills.keys());
  }

  searchSkills(query) {
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
          skill.metadata.tags.some((tag) => tag.toLowerCase().includes(lowerQuery)))
      );
    });
  }

  getSkillsByAgent(agentName) {
    return this.listSkills().filter((skillName) => {
      const skill = this.getSkill(skillName);
      if (!skill) return false;
      return skill.metadata.agents && skill.metadata.agents.includes(agentName);
    });
  }

  getSkillsByCategory(category) {
    return this.listSkills().filter((skillName) => {
      const skill = this.getSkill(skillName);
      if (!skill) return false;
      return skill.metadata.category === category;
    });
  }

  async reload() {
    this.skills.clear();
    this.index = null;
    return await this.loadIndex();
  }
}

module.exports = SkillRegistry;
