#!/usr/bin/env node
/**
 * Convention Extractor
 * Analyzes code to extract project conventions and stores in memory MCP
 *
 * Run after successful tasks to build project convention database
 *
 * Usage: node scripts/extract-conventions.js [agent-name]
 */

const fs = require("node:fs");
const path = require("node:path");

// Convention patterns to detect in code
const CONVENTION_PATTERNS = [
  // PHP/Laravel
  { pattern: /function\s+\w+\(\):\s*\?/, type: "typing", convention: "Use strict return types" },
  { pattern: /:\s*\?(\w+)\s*\|/, type: "typing", convention: "Use PHP union types" },
  {
    pattern: /RepositoryPattern|repository\s*\(/i,
    type: "pattern",
    convention: "Use Repository pattern",
  },
  { pattern: /Livewire/i, type: "framework", convention: "Use Livewire" },
  { pattern: /Alpine\./i, type: "framework", convention: "Use Alpine.js" },

  // JavaScript/TypeScript
  {
    pattern: /const\s+\w+\s*=\s*\(/,
    type: "style",
    convention: "Prefer arrow functions over function declarations",
  },
  {
    pattern: /interface\s+\w+/,
    type: "typing",
    convention: "Use TypeScript interfaces over types",
  },
  { pattern: /type\s+\w+\s*=/, type: "typing", convention: "Use TypeScript type aliases" },
  {
    pattern: /React\.(FC|Component)/,
    type: "framework",
    convention: "Use React functional components",
  },
  { pattern: /clsx\(|classnames\(/, type: "style", convention: "Use clsx for conditional classes" },

  // Testing
  { pattern: /test\(|it\(/, type: "testing", convention: "Use test/it blocks" },
  { pattern: /describe\(/, type: "testing", convention: "Use describe blocks for grouping" },
  { pattern: /expect\(/, type: "testing", convention: "Use expect assertions" },
  { pattern: /Pest/i, type: "testing", convention: "Use Pest testing framework" },
  { pattern: /PHPUnit/i, type: "testing", convention: "Use PHPUnit testing framework" },

  // CSS
  { pattern: /@apply\(/, type: "css", convention: "Use Tailwind @apply for repetitive styles" },
  { pattern: /tailwind\.config/i, type: "css", convention: "Extend Tailwind config" },
  { pattern: /cn\(|clsx\(/, type: "css", convention: "Use cn/clsx utility for classes" },

  // General patterns
  {
    pattern: /async\s+function/,
    type: "async",
    convention: "Use async/await for asynchronous code",
  },
  { pattern: /await\s+fetch/, type: "api", convention: "Use fetch for HTTP requests" },
  { pattern: /useState|useEffect/, type: "react", convention: "Use React hooks" },
  { pattern: /useReducer/, type: "react", convention: "Use useReducer for complex state" },
  { pattern: /JSON\.parse/, type: "api", convention: "Use JSON.parse for response parsing" },
];

// File extensions to scan
const SCAN_EXTENSIONS = [".php", ".ts", ".tsx", ".js", ".jsx", ".css", ".blade.php"];

// Directories to scan
const SCAN_DIRS = ["app", "src", "tests", "database"];

function scanForConventions(rootDir) {
  const conventions = {};

  function scanDir(dir) {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        // Skip non-scan directories
        if (entry.isDirectory()) {
          if (
            entry.name.startsWith(".") ||
            entry.name === "node_modules" ||
            entry.name === "vendor" ||
            entry.name === "dist" ||
            entry.name === "build"
          ) {
            continue;
          }
          scanDir(fullPath);
          continue;
        }

        // Check extension
        const ext = path.extname(entry.name);
        if (!SCAN_EXTENSIONS.includes(ext)) continue;

        // Scan file for conventions
        try {
          const content = fs.readFileSync(fullPath, "utf8");

          for (const { pattern, type, convention } of CONVENTION_PATTERNS) {
            if (pattern.test(content)) {
              if (!conventions[convention]) {
                conventions[convention] = { type, count: 0 };
              }
              conventions[convention].count++;
            }
          }
        } catch (_e) {
          // Skip unreadable files
        }
      }
    } catch (_e) {
      // Skip inaccessible directories
    }
  }

  // Scan each target directory
  for (const dir of SCAN_DIRS) {
    const targetPath = path.join(rootDir, dir);
    if (fs.existsSync(targetPath)) {
      scanDir(targetPath);
    }
  }

  return conventions;
}

function calculateConfidence(count, maxCount) {
  // Score based on frequency and capped at 0.9
  return Math.min(0.9, (count / maxCount) * 0.9 + 0.1);
}

function extractConventions(rootDir = ".") {
  console.log(`\n🔍 Scanning for conventions in: ${rootDir}`);

  const conventions = scanForConventions(rootDir);

  const sorted = Object.entries(conventions).sort((a, b) => b[1].count - a[1].count);

  if (sorted.length === 0) {
    console.log("No conventions found.");
    return [];
  }

  const maxCount = sorted[0]?.[1]?.count || 1;

  const results = sorted.map(([convention, data]) => ({
    convention,
    type: data.type,
    count: data.count,
    confidence: calculateConfidence(data.count, maxCount),
  }));

  console.log(`\n📊 Found ${sorted.length} conventions:`);
  results.slice(0, 10).forEach(({ convention, count, confidence }) => {
    console.log(`  [${confidence.toFixed(1)}] ${convention} (${count}x)`);
  });

  return results.filter((r) => r.confidence >= 0.3);
}

// Auto-run if run directly
const _agentName = process.argv[2] || "auto";
const results = extractConventions(".");

if (results.length > 0) {
  console.log(`\n💾 Conventions ready for memory MCP`);
  console.log(`Sample: "${results[0].convention}"`);
}
