#!/usr/bin/env node
/**
 * master-improve.js - Master improvement script that ties together:
 * 1. Codebase improvements (async, caching, error handling)
 * 2. Skills validation and enhancement
 * 3. Plugins improvement
 * 4. LSP integration enhancement
 * 5. Auto-format optimization
 */

const fs = require("fs").promises;
const path = require("path");
const { execSync } = require("child_process");

class MasterImprover {
  constructor(projectRoot) {
    this.projectRoot = projectRoot;
    this.improvements = [];
    this.errors = [];
  }

  async run() {
    console.log("🚀 Starting Master Improvement...\n");

    try {
      await this.improveCodebase();
      await this.improveSkills();
      await this.improvePlugins();
      await this.improveLSPs();
      await this.improveAutoFormat();

      this.printSummary();
      await this.saveReport();
    } catch (error) {
      console.error("❌ Error during master improvement:", error.message);
    }
  }

  async improveCodebase() {
    console.log("📝 Phase 1: Improving Codebase");

    // 1. Check workflow-engine.js (already improved to async)
    try {
      const wePath = path.join(this.projectRoot, "workflow-engine.js");
      const content = await fs.readFile(wePath, "utf8");

      if (
        content.includes("promises") ||
        content.includes("readFile") ||
        content.includes("readdir")
      ) {
        console.log("  ✅ workflow-engine.js: Using async fs");
      } else {
        console.log("  📝 workflow-engine.js: Needs async conversion");
      }
    } catch (e) {
      console.log("  ❌ workflow-engine.js: Not found");
    }

    // 2. Check self-improver.js
    try {
      const siPath = path.join(this.projectRoot, "self-improver.js");
      const content = await fs.readFile(siPath, "utf8");

      if (content.includes("web_fetch") || content.includes("fetch(")) {
        console.log("  ✅ self-improver.js: Has web fetching capability");
      } else {
        console.log("  📝 self-improver.js: Could add real web fetching");
      }
    } catch (e) {
      console.log("  ❌ self-improver.js: Not found");
    }

    // 3. Check config files
    try {
      const configPath = path.join(this.projectRoot, "opencode.json");
      const config = JSON.parse(await fs.readFile(configPath, "utf8"));

      console.log(`  ✅ opencode.json: Valid (${Object.keys(config.agent || {}).length} agents)`);

      if (config.compaction?.reserved < 4096) {
        console.log("  📝 opencode.json: Consider increasing compaction.reserved");
      }
    } catch (e) {
      console.log(`  ❌ opencode.json: Invalid or missing`);
    }

    this.improvements.push("Codebase analysis complete");
  }

  async improveSkills() {
    console.log("\n🎯 Phase 2: Improving Skills");

    const skillsDir = path.join(this.projectRoot, "skills");
    const indexJsPath = path.join(skillsDir, "index.json");

    try {
      const index = JSON.parse(await fs.readFile(indexJsPath, "utf8"));
      const skills = index.skills || [];

      console.log(`  ✅ Skills index: ${skills.length} skills registered`);

      // Check for missing skills
      const expectedSkills = [
        "database-design",
        "deep-research",
        "docs-governance-audit",
        "git-release",
        "laravel-feature-scaffold",
        "project-orchestration",
        "react-reuse-audit",
        "security-review",
        "self-reflection",
        "testing-strategy",
        "stack-context",
        "self-improver",
      ];

      const missing = expectedSkills.filter(
        (s) => !skills.some((registered) => registered.name === s)
      );

      if (missing.length > 0) {
        console.log(`  📝 Missing skills: ${missing.join(", ")}`);
      } else {
        console.log("  ✅ All expected skills are registered");
      }

      // Check skill files exist
      let missingFiles = 0;
      for (const skill of skills) {
        const skillPath = path.join(skillsDir, skill.name, "SKILL.md");
        try {
          await fs.access(skillPath);
        } catch {
          console.log(`  ❌ Skill file missing: ${skill.name}/SKILL.md`);
          missingFiles++;
        }
      }

      if (missingFiles === 0) {
        console.log("  ✅ All skill files exist");
      }
    } catch (e) {
      console.log(`  ❌ Skills index error: ${e.message}`);
    }

    this.improvements.push("Skills analysis complete");
  }

  async improvePlugins() {
    console.log("\n🔌 Phase 3: Improving Plugins");

    const pluginsDir = path.join(this.projectRoot, "plugins");

    try {
      const files = await fs.readdir(pluginsDir);
      const tsFiles = files.filter((f) => f.endsWith(".ts"));

      console.log(`  ✅ Plugins found: ${tsFiles.length}`);

      // Check for async/caching improvements
      for (const file of tsFiles) {
        const filePath = path.join(pluginsDir, file);
        const content = await fs.readFile(filePath, "utf8");

        if (content.includes("readFileSync")) {
          console.log(`  📝 ${file}: Uses sync fs (could use async)`);
        } else if (content.includes("readFile") || content.includes("promises")) {
          console.log(`  ✅ ${file}: Uses async fs`);
        }

        if (!content.includes("CACHE_TTL") && content.includes("trae.md")) {
          console.log(`  📝 ${file}: Could add caching for trae.md`);
        }
      }
    } catch (e) {
      console.log(`  ❌ Plugins directory error: ${e.message}`);
    }

    this.improvements.push("Plugins analysis complete");
  }

  async improveLSPs() {
    console.log("\n🔍 Phase 4: Improving LSP Integration");

    const toolsDir = path.join(this.projectRoot, "tools");

    try {
      const files = await fs.readdir(toolsDir);
      const tsFiles = files.filter((f) => f.endsWith(".ts"));

      console.log(`  ✅ LSP tools found: ${tsFiles.length}`);

      // Check for language servers coverage
      const expectedLsps = ["rust-analyzer", "typescript", "yaml", "tailwind"];
      const foundLsps = [];

      for (const file of tsFiles) {
        const filePath = path.join(toolsDir, file);
        const content = await fs.readFile(filePath, "utf8");

        for (const lsp of expectedLsps) {
          if (content.includes(lsp) && !foundLsps.includes(lsp)) {
            foundLsps.push(lsp);
          }
        }
      }

      console.log(`  ✅ LSPs covered: ${foundLsps.join(", ")}`);

      const missingLsps = expectedLsps.filter((l) => !foundLsps.includes(l));
      if (missingLsps.length > 0) {
        console.log(`  📝 Missing LSPs: ${missingLsps.join(", ")}`);
      }
    } catch (e) {
      console.log(`  ❌ Tools directory error: ${e.message}`);
    }

    this.improvements.push("LSP analysis complete");
  }

  async improveAutoFormat() {
    console.log("\n🎨 Phase 5: Improving Auto-Format");

    // Check auto-format.js
    try {
      const afPath = path.join(this.projectRoot, "auto-format.js");
      const content = await fs.readFile(afPath, "utf8");

      console.log("  ✅ auto-format.js: Exists");

      if (content.includes("FORMATTERS")) {
        console.log("  ✅ auto-format.js: Has formatter mappings");
      }

      // Check if it handles all extensions from rules/auto-format.md
      const rulesPath = path.join(this.projectRoot, "rules", "auto-format.md");
      try {
        const rulesContent = await fs.readFile(rulesPath, "utf8");
        const extensions = rulesContent.match(/\`(\.\w+)\`/g) || [];
        console.log(`  ✅ Auto-format rules: ${extensions.length} extensions covered`);
      } catch {
        console.log("  ❌ auto-format.md: Not found");
      }
    } catch (e) {
      console.log("  ❌ auto-format.js: Not found");
    }

    this.improvements.push("Auto-format analysis complete");
  }

  printSummary() {
    console.log("\n" + "=".repeat(50));
    console.log("Master Improvement Summary:");
    console.log("=".repeat(50));
    console.log(`✅ Improvements: ${this.improvements.length}`);
    console.log(`❌ Errors: ${this.errors.length}`);
    console.log("=".repeat(50));

    if (this.improvements.length > 0) {
      console.log("\nCompleted:");
      this.improvements.forEach((imp, i) => {
        console.log(`  ${i + 1}. ${imp}`);
      });
    }
  }

  async saveReport() {
    const reportPath = path.join(this.projectRoot, "master-improvement-report.json");
    const report = {
      timestamp: new Date().toISOString(),
      improvements: this.improvements,
      errors: this.errors,
    };

    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n📊 Report saved to: ${reportPath}`);
  }
}

// Run if called directly
if (require.main === module) {
  const projectRoot = process.argv[2] || __dirname;
  const improver = new MasterImprover(projectRoot);
  improver.run().catch(console.error);
}

module.exports = MasterImprover;
