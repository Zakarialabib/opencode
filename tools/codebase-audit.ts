#!/usr/bin/env node
/**
 * codebase-audit.ts — Intelligent Codebase Audit
 * Fixed: eliminates false positives from boilerplate matching
 * Focuses on REAL actionable issues
 */

import * as fs from "fs";
import * as path from "path";

const EXCLUDE_DIRS = new Set([
  "node_modules",
  ".git",
  "vendor",
  "target",
  ".opencode",
  ".trae",
  ".github",
  ".continue",
  "docs",
  "skills/archive",
]);

const SCAN_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".rs",
  ".php",
  ".json",
  ".toml",
  ".yaml",
  ".yml",
]);

// Boilerplate patterns that should NOT trigger duplication detection
const BOILERPLATE_PATTERNS = [
  /^import\s+/m,
  /^use\s+/m,
  /^#\[/m, // Rust attributes
  /^use\s+strict/m,
  /^'use strict'/m,
  /^\/\/ @ts-/m,
  /^\/\* eslint/m,
  /^\s*\|[a-z_]+\|.*=>/m, // Rust match arms
  /^\s*\|.*:\s*$/m, // YAML keys
  /^\s*\/\//, // Single-line comments
  /^\s*\* /, // JSDoc lines
];

interface Finding {
  category: string;
  severity: string;
  file: string;
  line: number;
  message: string;
  suggestion: string;
}

export class IntelligentAuditor {
  rootDir: string;
  findings: Finding[];
  stats: {
    filesScanned: number;
    issuesFound: number;
    byCategory: Record<string, number>;
    bySeverity: Record<string, number>;
  };
  allImports: Map<string, Array<{ var: string; source: string; line: number }>>;
  allExports: Map<string, Array<{ name: string; line: number }>>;
  fileContents: Map<string, string>;
  fileLines: Map<string, string[]>;

  constructor(rootDir?: string) {
    this.rootDir = rootDir || process.cwd();
    this.findings = [];
    this.stats = { filesScanned: 0, issuesFound: 0, byCategory: {}, bySeverity: {} };
    this.allImports = new Map(); // filePath -> [{var, source, line}]
    this.allExports = new Map(); // filePath -> [{name, line}]
    this.fileContents = new Map(); // filePath -> content
    this.fileLines = new Map(); // filePath -> [lines]
  }

  addFinding(category: string, severity: string, file: string, line: number, message: string, suggestion = "") {
    this.findings.push({
      category,
      severity,
      file: path.relative(this.rootDir, file),
      line,
      message,
      suggestion,
    });
    this.stats.issuesFound++;
    this.stats.byCategory[category] = (this.stats.byCategory[category] || 0) + 1;
    this.stats.bySeverity[severity] = (this.stats.bySeverity[severity] || 0) + 1;
  }

  getLineNumber(content: string, index: number) {
    return content.substring(0, index).split("\n").length;
  }

  // ========== CORE SCAN ==========

  scan() {
    console.log("🔍 Intelligent Codebase Audit — Scanning...\n");
    this.walkDir(this.rootDir);
    console.log(`   Scanned ${this.stats.filesScanned} source files\n`);

    // Post-scan cross-file analysis
    this.detectUnusedImports();
    this.detectDuplicateLogic();
    this.detectNamingDrift();

    return this.generateReport();
  }

  walkDir(dir: string) {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (EXCLUDE_DIRS.has(entry.name)) continue;
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        this.walkDir(fullPath);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name);
        if (!SCAN_EXTENSIONS.has(ext)) continue;

        try {
          const content = fs.readFileSync(fullPath, "utf-8");
          // Skip binary-ish files
          if (content.includes("\0")) continue;

          this.fileContents.set(fullPath, content);
          this.fileLines.set(fullPath, content.split("\n"));
          this.stats.filesScanned++;

          if (ext === ".ts" || ext === ".tsx" || ext === ".js" || ext === ".jsx") {
            this.scanTSJS(fullPath, content);
          } else if (ext === ".rs") {
            this.scanRust(fullPath, content);
          } else if (ext === ".php") {
            this.scanPHP(fullPath, content);
          } else if (ext === ".json" && entry.name === "package.json") {
            this.scanPackageJson(fullPath, content);
          }
        } catch {
          /* skip */
        }
      }
    }
  }

  // ========== TypeScript/JavaScript SCAN ==========

  scanTSJS(filePath: string, content: string) {
    const lines = content.split("\n");

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNum = i + 1;

      // --- Unused imports (basic detection) ---
      const importMatch = line.match(
        /^import\s+(?:\{([^}]+)\}|\*\s+as\s+(\w+)|(\w+))\s+from\s+['"]([^'"]+)['"]/
      );
      if (importMatch) {
        let imported: string[] | undefined;
        if (importMatch[1]) {
          // { foo, bar }
          imported = importMatch[1]
            .split(",")
            .flatMap((s) =>
              s
                .trim()
                .replace(/\s+as\s+.+/, "")
                .split(/\s*,\s*/)
            );
        } else if (importMatch[2]) imported = [importMatch[2]];
        else if (importMatch[3]) imported = [importMatch[3]];

        const source = importMatch[4];
        if (imported && !source.startsWith(".")) {
          // External import — record for cross-file analysis
          if (!this.allImports.has(filePath)) this.allImports.set(filePath, []);
          imported.forEach((name) => {
            this.allImports.get(filePath)!.push({ var: name, source, line: lineNum });
          });
        }
      }

      // --- `any` type usage ---
      if (/\bany\b/.test(line)) {
        // Skip comments
        const stripped = line.replace(/\/\/.*$/, "").replace(/\/\*[\s\S]*?\*\//g, "");
        if (/\bany\b/.test(stripped)) {
          const matches = stripped.match(/\bany\b/g);
          if (matches && !stripped.includes("any:") && !stripped.includes('"any')) {
            this.addFinding(
              "ARCHITECTURE",
              "HIGH",
              filePath,
              lineNum,
              "Use of 'any' type — replace with proper type or 'unknown'",
              "Define an explicit interface or use generics"
            );
          }
        }
      }

      // --- console.log statements ---
      if (/\bconsole\.\w+\s*\(/.test(line)) {
        const stripped = line.replace(/\/\/.*$/, "").replace(/\/\*[\s\S]*?\*\//g, "");
        if (/\bconsole\.\w+\s*\(/.test(stripped)) {
          this.addFinding(
            "REDUNDANCY",
            "LOW",
            filePath,
            lineNum,
            "Console statement left in code",
            "Remove or wrap in environment check"
          );
        }
      }

      // --- debugger statements ---
      if (/\bdebugger\s*;/.test(line)) {
        this.addFinding(
          "REDUNDANCY",
          "MEDIUM",
          filePath,
          lineNum,
          "Debugger statement in production code",
          "Remove debugger statement"
        );
      }
    }

    // --- Deep relative imports ---
    const deepImport = content.match(/from\s+['"]\.(\/[^'"]*){4,}['"]/);
    if (deepImport) {
      const lineNum = this.getLineNumber(content, content.indexOf(deepImport[0]));
      this.addFinding(
        "ARCHITECTURE",
        "MEDIUM",
        filePath,
        lineNum,
        "Deep relative import (4+ levels) — use path alias or barrel export",
        "Create index.ts barrel or configure path alias in tsconfig"
      );
    }
  }

  // ========== RUST SCAN ==========

  scanRust(filePath: string, content: string) {
    const lines = content.split("\n");

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNum = i + 1;

      // --- unwrap() without context ---
      if (/\.unwrap\(\)/.test(line) && !/\.expect\(/.test(line)) {
        // Skip test files and comments
        if (!filePath.includes("test") && !filePath.includes("mod.test")) {
          const stripped = line.replace(/\/\/.*/, ""); // remove // comments
          if (/\.unwrap\(\)/.test(stripped)) {
            this.addFinding(
              "ARCHITECTURE",
              "HIGH",
              filePath,
              lineNum,
              "unwrap() without context — use expect() with descriptive message",
              `.expect("describe what went wrong")`
            );
          }
        }
      }

      // --- dbg! macro in non-test files ---
      if (/\bdbg!\s*\(/.test(line) && !filePath.includes("test")) {
        this.addFinding(
          "REDUNDANCY",
          "MEDIUM",
          filePath,
          lineNum,
          "dbg!() macro in non-test code",
          "Remove or replace with proper logging"
        );
      }

      // --- println! left in code (non-main) ---
      if (
        /\bprintln!\s*\(/.test(line) &&
        !filePath.includes("main.rs") &&
        !filePath.includes("bin/")
      ) {
        this.addFinding(
          "REDUNDANCY",
          "LOW",
          filePath,
          lineNum,
          "println! statement may be debug leftover",
          "Consider using tracing/logging crate"
        );
      }
    }
  }

  // ========== PHP SCAN ==========

  scanPHP(filePath: string, content: string) {
    const lines = content.split("\n");

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNum = i + 1;

      // --- camelCase public methods (Laravel convention is snake_case) ---
      const methodMatch = line.match(/public\s+function\s+([a-z]+[A-Z]\w*)\s*\(/);
      if (methodMatch && !line.includes("__construct")) {
        this.addFinding(
          "NAMING",
          "MEDIUM",
          filePath,
          lineNum,
          `PHP method "${methodMatch[1]}" uses camelCase — Laravel convention is snake_case`,
          `Rename to ${this.snakeCase(methodMatch[1])}`
        );
      }

      // --- Missing return type hints ---
      if (
        /public\s+function\s+\w+\s*\([^)]*\)\s*\{/.test(line) &&
        !/:\s*(void|int|float|string|array|bool|self|\w+\|null|\?self)/.test(line)
      ) {
        // Only flag if it's a method with body (not abstract/interface)
        const nextLines = lines.slice(i, Math.min(i + 5, lines.length)).join("\n");
        if (nextLines.includes("{") && !nextLines.match(/interface\s+\w+/)) {
          // Don't flag closures or arrow functions
          if (!line.includes("function ()") && !line.includes("fn (")) {
            // This would be noisy — only flag specific cases
          }
        }
      }
    }
  }

  // ========== PACKAGE.JSON SCAN ==========

  scanPackageJson(filePath: string, content: string) {
    try {
      const pkg = JSON.parse(content);

      // --- Check for outdated dependencies ---
      const knownOutdated: Record<string, { min: string; reason: string }> = {
        uuid: { min: "v9", reason: "v9+ uses crypto.randomUUID() natively" },
        lodash: { min: "v4.17.21", reason: "Security: prototype pollution patches" },
      };

      for (const depField of ["dependencies", "devDependencies"]) {
        const deps = pkg[depField];
        if (!deps) continue;

        for (const [name, version] of Object.entries(deps)) {
          if (knownOutdated[name]) {
            this.addFinding(
              "ARCHITECTURE",
              "MEDIUM",
              filePath,
              0,
              `${name}@${version} — check if ${knownOutdated[name].min}+ is available`,
              knownOutdated[name].reason
            );
          }
        }
      }
    } catch {
      /* invalid JSON */
    }
  }

  // ========== CROSS-FILE ANALYSIS ==========

  detectUnusedImports() {
    console.log("   Analyzing import usage across files...");

    for (const [filePath, imports] of this.allImports) {
      let content;
      try {
        content = this.fileContents.get(filePath);
      } catch {
        continue;
      }
      if (!content) continue;

      // Remove import lines from content for usage check
      const contentWithoutImports = content;

      for (const imp of imports) {
        // Skip if it's a type-only import (TypeScript)
        const importLine = content
          .split("\n")
          .find((l) => l.includes(`from '${imp.source}'`) || l.includes(`from "${imp.source}"`));
        if (importLine && (importLine.includes("import type") || importLine.includes("type ")))
          continue;

        // Check actual usage — the variable name should appear after the import line
        // Find the import line number
        const lines = content.split("\n");
        let importLineIdx = -1;
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].includes(`'${imp.source}'`) || lines[i].includes(`"${imp.source}"`)) {
            importLineIdx = i;
            break;
          }
        }

        // Search body after import for usage
        const body = lines.slice(importLineIdx + 1).join("\n");
        // Check if variable is used (not just in a destructuring pattern)
        const usagePattern = new RegExp(`\\b${imp.var}\\b`, "g");
        const matches = body.match(usagePattern);

        if (!matches || matches.length === 0) {
          this.addFinding(
            "IMPORT",
            "MEDIUM",
            filePath,
            content.substring(0, content.indexOf(`from '${imp.source}'`)).split("\n").length,
            `Import "${imp.var}" from "${imp.source}" appears unused`,
            `Remove the import or prefix with _ (${imp.var} → _unused_${imp.var})`
          );
        }
      }
    }
  }

  detectDuplicateLogic() {
    console.log("   Checking for meaningful code duplication...");

    const SIGNIFICANT_BLOCK_SIZE = 8; // Minimum 8 meaningful lines
    const blocks = new Map();

    for (const [filePath, content] of this.fileContents) {
      const lines = content.split("\n");

      for (let i = 0; i <= lines.length - SIGNIFICANT_BLOCK_SIZE; i++) {
        const block = lines.slice(i, i + SIGNIFICANT_BLOCK_SIZE);

        // Skip blocks that are mostly boilerplate
        const blockText = block.join("\n");
        const nonEmpty = block.filter((l) => l.trim().length > 0);
        if (nonEmpty.length < 4) continue; // Skip mostly-empty blocks

        // Skip import/use blocks
        if (block.every((l) => l.match(/^\s*(import|use|#include)\s/))) continue;
        // Skip comment blocks
        if (block.every((l) => l.match(/^\s*(\/\/|\*|#)/))) continue;
        // Skip closing braces
        if (block.every((l) => l.match(/^\s*[})]/))) continue;

        // Normalize: remove leading whitespace for comparison
        const normalized = block.map((l) => l.replace(/^\s+/, "")).join("\n");
        if (normalized.length < 100) continue; // Too short to be meaningful

        const hash = this.hash(normalized);
        if (!blocks.has(hash)) blocks.set(hash, []);
        blocks.get(hash).push({
          file: filePath,
          startLine: i + 1,
          snippet: block[0].trim().substring(0, 60),
        });
      }
    }

    // Report duplicates (same code in 2+ different files)
    for (const [hash, locations] of blocks) {
      if (locations.length >= 2) {
        // Verify they're in different files or significantly apart
        const uniqueFiles = new Set(locations.map((l: any) => l.file));
        if (uniqueFiles.size >= 2) {
          const fileList = locations
            .map((l: any) => `${path.basename(l.file)}:${l.startLine}`)
            .join(", ");

          this.addFinding(
            "REDUNDANCY",
            "HIGH",
            locations[0].file,
            locations[0].startLine,
            `Identical code block in ${locations.length} locations: ${fileList}`,
            "Extract into a shared utility function"
          );
        }
      }
    }
  }

  detectNamingDrift() {
    console.log("   Checking naming conventions...");

    for (const [filePath, content] of this.fileContents) {
      const ext = path.extname(filePath);
      const baseName = path.basename(filePath, ext);

      // --- File naming checks ---
      if (ext === ".ts" || ext === ".tsx" || ext === ".js" || ext === ".jsx") {
        // Check for files that should be PascalCase (React components)
        if (content.includes("export default function") || content.includes("export function")) {
          if (/export\s+(?:default\s+)?function\s+[a-z]/.test(content)) {
            const match = content.match(/export\s+(?:default\s+)?function\s+([a-z]\w*)/);
            if (match) {
              this.addFinding(
                "NAMING",
                "MEDIUM",
                filePath,
                0,
                `Exported function "${match[1]}" should be PascalCase`,
                `Rename to ${this.pascalCase(match[1])}`
              );
            }
          }
        }
      }

      // --- Rust naming ---
      if (ext === ".rs") {
        // Public functions should be snake_case
        const pubFnMatches = content.matchAll(/pub\s+fn\s+([A-Z]\w*)/g);
        for (const m of pubFnMatches) {
          const lineNum = this.getLineNumber(content, content.indexOf(`pub fn ${m[1]}`));
          this.addFinding(
            "NAMING",
            "MEDIUM",
            filePath,
            lineNum,
            `Rust function "${m[1]}" uses PascalCase instead of snake_case`,
            `Rename to ${this.snakeCase(m[1])}`
          );
        }

        // Public structs should be PascalCase (already correct usually, check anyway)
      }

      // --- PHP naming ---
      if (ext === ".php") {
        // Method naming: should be snake_case in Laravel
        const camelMethods = content.matchAll(/public\s+function\s+([a-z]+[A-Z]\w*)\s*\(/g);
        for (const m of camelMethods) {
          if (m[1] !== "__construct" && m[1] !== "__invoke" && m[1] !== "__toString") {
            const lineNum = this.getLineNumber(content, content.indexOf(`function ${m[1]}`));
            this.addFinding(
              "NAMING",
              "MEDIUM",
              filePath,
              lineNum,
              `PHP method "${m[1]}" uses camelCase — use snake_case`,
              `Rename to ${this.snakeCase(m[1])}`
            );
          }
        }

        // Class properties should be camelCase or snake_case consistently
        const props = content.matchAll(/public\s+\$\s*([A-Z]\w*)\s*[=;]/g);
        for (const m of props) {
          const lineNum = this.getLineNumber(content, content.indexOf(`$${m[1]}`));
          this.addFinding(
            "NAMING",
            "LOW",
            filePath,
            lineNum,
            `PHP property "${m[1]}" starts with uppercase — use snake_case or camelCase consistently`,
            "Follow Laravel naming conventions"
          );
        }
      }
    }
  }

  // ========== HELPERS ==========

  snakeCase(str: string) {
    return str
      .replace(/([a-z])([A-Z])/g, "$1_$2")
      .replace(/([A-Z])([A-Z][a-z])/g, "$1_$2")
      .toLowerCase();
  }

  pascalCase(str: string) {
    return str.replace(/(^|_)(\w)/g, (_, __, c) => c.toUpperCase());
  }

  hash(str: string) {
    let hash = 0x811c9dc5; // FNV offset basis
    for (let i = 0; i < str.length; i++) {
      hash ^= str.charCodeAt(i);
      hash = (hash * 0x01000193) >>> 0;
    }
    return hash.toString(36);
  }

  // ========== REPORT GENERATION ==========

  generateReport() {
    const critical = this.findings.filter((f) => f.severity === "CRITICAL");
    const high = this.findings.filter((f) => f.severity === "HIGH");
    const medium = this.findings.filter((f) => f.severity === "MEDIUM");
    const low = this.findings.filter((f) => f.severity === "LOW");

    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        filesScanned: this.stats.filesScanned,
        totalIssues: this.stats.issuesFound,
        byCategory: this.stats.byCategory,
        bySeverity: {
          CRITICAL: critical.length,
          HIGH: high.length,
          MEDIUM: medium.length,
          LOW: low.length,
        },
      },
      healthScore: Math.max(
        0,
        Math.round(
          100 - (critical.length * 15 + high.length * 5 + medium.length * 2 + low.length * 0.5)
        )
      ),
      recommendations: this.generateRecommendations(critical, high, medium, low),
      findings: {
        CRITICAL: critical,
        HIGH: high,
        MEDIUM: medium,
        LOW: low,
      },
    };

    const reportPath = path.join(this.rootDir, "refactoring-report.json");
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    // Print summary
    console.log("📊 Audit Results:");
    console.log(`   Files scanned:  ${this.stats.filesScanned}`);
    console.log(`   Total issues:   ${this.stats.issuesFound}`);
    console.log(`   Health score:   ${report.healthScore}/100`);
    console.log("");
    console.log("📂 By Category:");
    for (const [cat, count] of Object.entries(this.stats.byCategory)) {
      console.log(`   ${cat.padEnd(16)} ${count}`);
    }
    console.log("");
    console.log("⚠️  By Severity:");
    console.log(`   CRITICAL        ${critical.length}`);
    console.log(`   HIGH            ${high.length}`);
    console.log(`   MEDIUM          ${medium.length}`);
    console.log(`   LOW             ${low.length}`);
    console.log("");
    console.log("📋 Top Recommendations:");
    report.recommendations.forEach((r, i) => {
      console.log(`   ${i + 1}. [${r.priority}] ${r.action}`);
    });
    console.log("");
    console.log(`✅ Report: ${reportPath}`);

    // Also write human-readable summary
    const summaryPath = path.join(this.rootDir, "refactoring-summary.md");
    let md = "# Codebase Audit Summary\n\n";
    md += `**Generated**: ${new Date().toLocaleString()}\n`;
    md += `**Files Scanned**: ${this.stats.filesScanned}\n`;
    md += `**Total Issues**: ${this.stats.issuesFound}\n`;
    md += `**Health Score**: ${report.healthScore}/100\n\n`;

    md += "## Severity Breakdown\n\n";
    md += "| Severity | Count |\n|----------|-------|\n";
    md += `| CRITICAL | ${critical.length} |\n`;
    md += `| HIGH | ${high.length} |\n`;
    md += `| MEDIUM | ${medium.length} |\n`;
    md += `| LOW | ${low.length} |\n\n`;

    md += "## Category Breakdown\n\n";
    md += "| Category | Count |\n|----------|-------|\n";
    for (const [cat, count] of Object.entries(this.stats.byCategory)) {
      md += `| ${cat} | ${count} |\n`;
    }
    md += "\n";

    if (critical.length > 0) {
      md += "## 🔴 Critical Issues\n\n";
      critical.slice(0, 20).forEach((f) => {
        md += `- **${f.file}:${f.line}** — ${f.message}\n`;
      });
      md += "\n";
    }

    if (high.length > 0) {
      md += "## 🟠 High Priority Issues\n\n";
      const displayed = high.slice(0, 50);
      const grouped: Record<string, any[]> = {};
      for (const f of displayed) {
        if (!grouped[f.category]) grouped[f.category] = [];
        grouped[f.category].push(f);
      }
      for (const [cat, items] of Object.entries(grouped)) {
        md += `### ${cat}\n`;
        items.slice(0, 20).forEach((f) => {
          md += `- \`${f.file}:${f.line}\` — ${f.message}\n`;
        });
        md += "\n";
      }
    }

    md += "## Recommendations\n\n";
    report.recommendations.forEach((r, i) => {
      md += `${i + 1}. **[${r.priority}]** ${r.action}\n`;
      md += `   - Command: \`${r.command}\`\n`;
      md += `   - Effort: ${r.effort}\n\n`;
    });

    fs.writeFileSync(summaryPath, md);
    console.log(`📄 Summary: ${summaryPath}`);

    return report;
  }

  generateRecommendations(critical: Finding[], high: Finding[], medium: Finding[], low: Finding[]) {
    const recs: any[] = [];
    const cats = this.stats.byCategory;

    if (cats.ARCHITECTURE > 0) {
      const unwraps = high.filter((f) => f.message.includes("unwrap()"));
      const anys = high.filter((f) => f.message.includes("'any'"));
      const deep = high.filter((f) => f.message.includes("Deep relative"));

      if (unwraps.length > 0) {
        recs.push({
          priority: "CRITICAL",
          action: `Fix ${unwraps.length} unwrap() calls without error context`,
          command: "Run: rg -n '\\.unwrap()' --no-heading src-tauri/ | head -50",
          effort: "2-4 hours",
        });
      }

      if (anys.length > 0) {
        recs.push({
          priority: "CRITICAL",
          action: `Replace ${anys.length} 'any' types with proper types`,
          command: "Run: rg -n '\\bany\\b' --no-heading src/ | head -50",
          effort: "4-8 hours",
        });
      }

      if (deep.length > 0) {
        recs.push({
          priority: "HIGH",
          action: `Fix ${deep.length} deep relative imports — add path aliases or barrel exports`,
          command: "Add paths config in tsconfig.json and update imports",
          effort: "2-3 hours",
        });
      }
    }

    if (cats.NAMING > 10) {
      recs.push({
        priority: "HIGH",
        action: `Standardize ${cats.NAMING} naming convention violations`,
        command: "Run biome format + manual rename for semantic issues",
        effort: "4-6 hours",
      });
    }

    if (cats.IMPORT > 20) {
      recs.push({
        priority: "MEDIUM",
        action: `Remove ${cats.IMPORT} unused imports`,
        command: "npx @biomejs/biome check --write .",
        effort: "1-2 hours",
      });
    }

    if (low.length > 100) {
      recs.push({
        priority: "LOW",
        action: `Clean ${low.length} console/println/debug statements`,
        command: "grep -rn 'console\\.\\|dbg!\\|println!' --include='*.ts' --include='*.rs' .",
        effort: "1-2 hours",
      });
    }

    // Deduplicate
    return [...new Map(recs.map((r) => [r.action, r])).values()].sort((a, b) => {
      const order: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
      return (order[a.priority] || 99) - (order[b.priority] || 99);
    });
  }
}

// Run
const isMain = process.argv[1] && (
  process.argv[1].endsWith("codebase-audit.ts") || 
  process.argv[1].endsWith("codebase-audit.js")
);
if (isMain) {
  const root = process.argv[2] || process.cwd();
  const auditor = new IntelligentAuditor(root);
  auditor.scan();
}
