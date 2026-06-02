import * as fs from "node:fs";
import * as path from "node:path";

const skillsDir = path.resolve(process.cwd(), "skills");
const indexPath = path.join(skillsDir, "index.json");
const existingIndex = JSON.parse(fs.readFileSync(indexPath, "utf8"));
const existingSkills = Array.isArray(existingIndex.skills)
  ? existingIndex.skills
  : Object.values(existingIndex.skills || {});
const existingNames = new Set(existingSkills.map((s: { name: string }) => s.name));

const allDirs = fs
  .readdirSync(skillsDir, { withFileTypes: true })
  .filter((d) => d.isDirectory() && !d.name.startsWith("_"))
  .map((d) => d.name);

const missing = allDirs.filter((d) => !existingNames.has(d));
console.log(`Missing from index (${missing.length}):`, missing.join(", "));

const categoryMap: Record<string, { category: string; tags: string[]; agents: string[] }> = {
  "ai-news-collectors": {
    category: "research",
    tags: ["ai", "news", "aggregation", "trends"],
    agents: ["docs-curator"],
  },
  "aminer-academic-search": {
    category: "research",
    tags: ["academic", "search", "research", "papers"],
    agents: ["docs-curator"],
  },
  "aminer-daily-paper": {
    category: "research",
    tags: ["academic", "papers", "daily", "research"],
    agents: ["docs-curator"],
  },
  "aminer-open-academic": {
    category: "research",
    tags: ["academic", "open-access", "papers", "research"],
    agents: ["docs-curator"],
  },
  "anti-pua": {
    category: "security",
    tags: ["security", "social-engineering", "protection"],
    agents: ["qa-guardian"],
  },
  ASR: {
    category: "audio",
    tags: ["speech", "recognition", "asr", "audio"],
    agents: ["core-factory"],
  },
  "auto-target-tracker": {
    category: "automation",
    tags: ["tracking", "monitoring", "automation"],
    agents: ["devops-engineer"],
  },
  "blog-writer": {
    category: "content",
    tags: ["blog", "writing", "content", "articles"],
    agents: ["docs-curator"],
  },
  contentanalysis: {
    category: "analysis",
    tags: ["content", "analysis", "nlp", "text"],
    agents: ["core-factory"],
  },
  "dream-interpreter": {
    category: "analysis",
    tags: ["dream", "interpretation", "psychology", "analysis"],
    agents: ["docs-curator"],
  },
  "image-edit": {
    category: "assets",
    tags: ["image", "editing", "manipulation", "graphics"],
    agents: ["frontend-ui-ux"],
  },
  "interview-designer": {
    category: "content",
    tags: ["interview", "questions", "hiring", "recruitment"],
    agents: ["core-factory"],
  },
  LLM: {
    category: "ai",
    tags: ["llm", "language-model", "ai", "prompting"],
    agents: ["software-architect"],
  },
  "marketing-mode": {
    category: "marketing",
    tags: ["marketing", "campaign", "promotion", "brand"],
    agents: ["docs-curator"],
  },
  "multi-search-engine": {
    category: "research",
    tags: ["search", "multi-engine", "research", "aggregation"],
    agents: ["docs-curator"],
  },
  "podcast-generate": {
    category: "media",
    tags: ["podcast", "audio", "generation", "media"],
    agents: ["core-factory"],
  },
  "qingyan-research": {
    category: "research",
    tags: ["qingyan", "research", "analysis", "chinese"],
    agents: ["docs-curator"],
  },
  "seo-content-writer": {
    category: "content",
    tags: ["seo", "content", "writing", "optimization"],
    agents: ["docs-curator"],
  },
  "skill-creator": {
    category: "meta",
    tags: ["skill", "creation", "development", "authoring"],
    agents: ["software-architect"],
  },
  "skill-vetter": {
    category: "security",
    tags: ["skill", "vetting", "security", "review"],
    agents: ["qa-guardian"],
  },
  "storyboard-manager": {
    category: "content",
    tags: ["storyboard", "planning", "content", "script"],
    agents: ["docs-curator"],
  },
  TTS: {
    category: "audio",
    tags: ["tts", "speech", "synthesis", "audio"],
    agents: ["core-factory"],
  },
  "video-generation": {
    category: "media",
    tags: ["video", "generation", "media", "ai"],
    agents: ["core-factory"],
  },
  "video-understand": {
    category: "media",
    tags: ["video", "analysis", "understanding", "media"],
    agents: ["core-factory"],
  },
  VLM: {
    category: "ai",
    tags: ["vlm", "vision", "language-model", "multimodal"],
    agents: ["software-architect"],
  },
  "web-reader": {
    category: "research",
    tags: ["web", "reader", "content", "extraction"],
    agents: ["core-factory"],
  },
  "web-search": {
    category: "research",
    tags: ["web", "search", "research", "information"],
    agents: ["docs-curator"],
  },
  "web-shader-extractor": {
    category: "development",
    tags: ["web", "shader", "extraction", "graphics"],
    agents: ["core-factory"],
  },
  "writing-plans": {
    category: "content",
    tags: ["writing", "plans", "outline", "planning"],
    agents: ["docs-curator"],
  },
};

const displayNameMap: Record<string, string> = {
  ASR: "Automatic Speech Recognition",
  LLM: "Large Language Model",
  TTS: "Text-to-Speech",
  VLM: "Vision Language Model",
  "ai-news-collectors": "AI News Collectors",
  "aminer-academic-search": "Aminer Academic Search",
  "aminer-daily-paper": "Aminer Daily Paper",
  "aminer-open-academic": "Aminer Open Academic",
  "anti-pua": "Anti-PUA Protection",
  "auto-target-tracker": "Auto Target Tracker",
  "blog-writer": "Blog Writer",
  contentanalysis: "Content Analysis",
  "dream-interpreter": "Dream Interpreter",
  "image-edit": "Image Editing",
  "interview-designer": "Interview Designer",
  "marketing-mode": "Marketing Mode",
  "multi-search-engine": "Multi-Search Engine",
  "podcast-generate": "Podcast Generator",
  "qingyan-research": "Qingyan Research",
  "seo-content-writer": "SEO Content Writer",
  "skill-creator": "Skill Creator",
  "skill-vetter": "Skill Vetter",
  "storyboard-manager": "Storyboard Manager",
  "video-generation": "Video Generation",
  "video-understand": "Video Understanding",
  "web-reader": "Web Reader",
  "web-search": "Web Search",
  "web-shader-extractor": "Web Shader Extractor",
  "writing-plans": "Writing Plans",
};

function extractDescription(dir: string): string {
  const skillPath = path.join(skillsDir, dir, "SKILL.md");
  try {
    const content = fs.readFileSync(skillPath, "utf-8");
    const match = content.match(/^description:\s*(.+)$/m);
    if (match) return match[1].replace(/^["']|["']$/g, "");
  } catch (_e) {}
  return "";
}

const newEntries = missing.map((dir) => {
  const meta = categoryMap[dir] || { category: "general", tags: [dir], agents: ["core-factory"] };
  const desc = extractDescription(dir) || `${displayNameMap[dir] || dir} skill for OpenCode`;
  return {
    name: dir,
    displayName: displayNameMap[dir] || dir,
    description: desc,
    version: "1.0.0",
    category: meta.category,
    tags: meta.tags,
    agents: meta.agents,
    entryPoint: "SKILL.md",
  };
});

existingIndex.lastUpdated = new Date().toISOString();
existingIndex.skills = [...existingSkills, ...newEntries].sort((a, b) =>
  a.name.localeCompare(b.name)
);
existingIndex.totalSkills = existingIndex.skills.length;

fs.writeFileSync(indexPath, `${JSON.stringify(existingIndex, null, 2)}\n`, "utf-8");
console.log(`Total skills in index: ${existingIndex.totalSkills}`);
console.log(`Added ${newEntries.length} new entries`);
