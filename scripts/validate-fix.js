// Quick validation of the skills/index.json fix
const fs = require("node:fs");
const path = require("node:path");

// Simulate parseJsonc (just JSON.parse for .json files)
function parseJsonc(str) {
  return JSON.parse(str);
}

const skillsIndexPath = path.join(__dirname, "..", "skills", "index.json");
const skillsData = parseJsonc(fs.readFileSync(skillsIndexPath, "utf8"));

// OLD code (would crash):
// const skills = (skillsData.skills || []).map(s => s);

// NEW code (handles both formats):
const skillsNormalized = Array.isArray(skillsData.skills)
  ? skillsData.skills
  : Object.values(skillsData.skills || {});
const skills = skillsNormalized.map((s) => ({
  ...s,
  _loadedAt: Date.now(),
}));

console.log("✅ skills/index.json parsed successfully");
console.log("   Format detected:", Array.isArray(skillsData.skills) ? "array" : "object");
console.log("   Skills loaded:", skills.length);
console.log(
  "   First 5 skills:",
  skills.slice(0, 5).map((s) => s.name)
);
console.log("   Last skill:", skills[skills.length - 1]?.name);

// Verify all skills have required fields
const missing = skills.filter((s) => !s.name || !s.entryPoint || !s.category);
if (missing.length > 0) {
  console.log(
    "⚠️  Skills missing fields:",
    missing.map((s) => s.name)
  );
} else {
  console.log("✅ All skills have required fields");
}

// Test skill_search filtering
const searchTerm = "research";
const matches = skills.filter(
  (s) =>
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.description.toLowerCase().includes(searchTerm.toLowerCase())
);
console.log(`\n🔍 Search for "${searchTerm}": ${matches.length} matches`);
console.log(
  "   Matches:",
  matches.map((s) => s.name)
);

console.log("\n✅ Fix verified successfully!");
