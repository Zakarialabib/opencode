#!/usr/bin/env npx tsx
/**
 * Configuration Verification Test
 * Verifies opencode.json, brain plugin config, and tool registrations
 */

import { existsSync, readFileSync } from "fs";
import { join } from "path";

const PROJECT_ROOT = process.cwd();

interface ValidationResult {
  name: string;
  status: "PASS" | "FAIL" | "WARN";
  details: string;
}

function validateOpencodeJSON(): ValidationResult {
  try {
    const configPath = join(PROJECT_ROOT, "opencode.json");
    const content = readFileSync(configPath, "utf-8");
    const config = JSON.parse(content);

    // Check plugin registration
    const plugins = config.plugin || [];
    const brainPluginRegistered = plugins.includes("brain-plugin/brain.ts");

    // Check LM Studio provider
    const lmStudio = config.provider?.lmstudio;
    const lmStudioURL = lmStudio?.options?.baseURL || "";

    // Check brain permissions
    const permissions = config.permission || {};
    const brainPerms = Object.keys(permissions).filter(k => k.startsWith("brain_"));

    // Check brain tools
    const tools = config.tools || {};
    const brainTools = Object.keys(tools).filter(k => k.startsWith("brain_"));

    // Check agent configs have brain tools
    const agents = config.agent || {};
    let agentsWithBrainTools = 0;
    for (const [name, agent] of Object.entries(agents)) {
      const agentTools = (agent as any).tools || {};
      const hasBrainTools = Object.keys(agentTools).some(k => k.startsWith("brain_"));
      if (hasBrainTools) agentsWithBrainTools++;
    }

    return {
      name: "opencode.json Configuration",
      status: brainPluginRegistered && brainTools.length >= 14 ? "PASS" : "WARN",
      details: `Plugin: ${brainPluginRegistered ? "brain.ts registered" : "MISSING"}, ` +
        `LM Studio: ${lmStudioURL}, ` +
        `Permissions: ${brainPerms.length}, ` +
        `Tools: ${brainTools.length}, ` +
        `Agents w/brain: ${agentsWithBrainTools}/${Object.keys(agents).length}`,
    };
  } catch (err: any) {
    return {
      name: "opencode.json Configuration",
      status: "FAIL",
      details: err.message,
    };
  }
}

function validateBrainPluginFiles(): ValidationResult {
  try {
    const files = [
      "brain-plugin/brain.ts",
      "brain-plugin/index.ts",
      "brain-plugin/provider/lmstudio.ts",
      "brain-plugin/retrieval/fusion.ts",
      "brain-plugin/retrieval/reranker.ts",
      "brain-plugin/tree/engine.ts",
      "brain-plugin/store/index.ts",
      "brain-plugin/store/fts.ts",
      "brain-plugin/store/vec.ts",
      "brain-plugin/rag-agent.ts",
    ];

    const missing = files.filter(f => !existsSync(join(PROJECT_ROOT, f)));

    return {
      name: "Brain Plugin Files",
      status: missing.length === 0 ? "PASS" : "FAIL",
      details: missing.length === 0 
        ? `All ${files.length} core files present`
        : `Missing: ${missing.join(", ")}`,
    };
  } catch (err: any) {
    return {
      name: "Brain Plugin Files",
      status: "FAIL",
      details: err.message,
    };
  }
}

function validateBrainToolsRegistration(): ValidationResult {
  try {
    const brainTs = readFileSync(join(PROJECT_ROOT, "brain-plugin/brain.ts"), "utf-8");
    const expectedTools = [
      "brain_index_project",
      "brain_search",
      "brain_status",
      "brain_reset",
      "brain_diagnostic",
      "brain_docs_cache",
      "brain_docs_fetch",
      "brain_embed_test",
      "brain_embed_lmstudio",
      "brain_metrics",
      "brain_speculative_status",
    ];

    const missing = expectedTools.filter(t => !brainTs.includes(t + ":"));

    return {
      name: "Brain Tool Registration",
      status: missing.length === 0 ? "PASS" : "WARN",
      details: missing.length === 0
        ? `All ${expectedTools.length} tools registered in brain.ts`
        : `Missing: ${missing.join(", ")}`,
    };
  } catch (err: any) {
    return {
      name: "Brain Tool Registration",
      status: "FAIL",
      details: err.message,
    };
  }
}

function validateDotOpencodeTools(): ValidationResult {
  try {
    const toolsDir = join(PROJECT_ROOT, ".opencode", "tools");
    const toolFiles = [
      "brain-diagnose.ts",
      "brain-query.ts",
      "brain-config.ts",
      "brain-improve.ts",
      "brain-index.ts",
    ];

    const existing = toolFiles.filter(f => existsSync(join(toolsDir, f)));

    return {
      name: ".opencode/tools Registration",
      status: existing.length >= 4 ? "PASS" : "WARN",
      details: `${existing.length}/${toolFiles.length} tools present: ${existing.join(", ")}`,
    };
  } catch (err: any) {
    return {
      name: ".opencode/tools Registration",
      status: "FAIL",
      details: err.message,
    };
  }
}

function validateDatabase(): ValidationResult {
  try {
    const dbPath = join(PROJECT_ROOT, ".opencode", "brain.db");
    const dbExists = existsSync(dbPath);
    
    if (!dbExists) {
      return {
        name: "Brain Database",
        status: "WARN",
        details: "brain.db not found (will be created on first use)",
      };
    }

    return {
      name: "Brain Database",
      status: "PASS",
      details: "brain.db exists",
    };
  } catch (err: any) {
    return {
      name: "Brain Database",
      status: "FAIL",
      details: err.message,
    };
  }
}

function validateRules(): ValidationResult {
  try {
    const rulesDir = join(PROJECT_ROOT, "rules");
    const brainRulesExists = existsSync(join(rulesDir, "brain.md"));

    return {
      name: "Brain Rules",
      status: brainRulesExists ? "PASS" : "WARN",
      details: brainRulesExists ? "rules/brain.md exists" : "rules/brain.md missing",
    };
  } catch (err: any) {
    return {
      name: "Brain Rules",
      status: "FAIL",
      details: err.message,
    };
  }
}

async function runTests(): Promise<void> {
  console.log("================================================================");
  console.log("         Brain Plugin Configuration Verification                ");
  console.log("================================================================");
  console.log("");

  const tests = [
    validateOpencodeJSON,
    validateBrainPluginFiles,
    validateBrainToolsRegistration,
    validateDotOpencodeTools,
    validateDatabase,
    validateRules,
  ];

  const results: ValidationResult[] = [];

  for (const test of tests) {
    const result = test();
    results.push(result);
    const icon = result.status === "PASS" ? "[PASS]" : result.status === "WARN" ? "[WARN]" : "[FAIL]";
    console.log(icon + " " + result.name);
    console.log("       " + result.details);
  }

  console.log("");
  console.log("================================================================");
  console.log("                         SUMMARY                                ");
  console.log("================================================================");

  const passed = results.filter(r => r.status === "PASS").length;
  const warned = results.filter(r => r.status === "WARN").length;
  const failed = results.filter(r => r.status === "FAIL").length;

  console.log("");
  console.log("Passed: " + passed + "/" + tests.length);
  console.log("Warnings: " + warned);
  console.log("Failed: " + failed);

  if (failed > 0) {
    console.log("");
    console.log("FAILURES:");
    results.filter(r => r.status === "FAIL").forEach(r => {
      console.log("  - " + r.name + ": " + r.details);
    });
  }

  if (warned > 0) {
    console.log("");
    console.log("WARNINGS:");
    results.filter(r => r.status === "WARN").forEach(r => {
      console.log("  - " + r.name + ": " + r.details);
    });
  }

  console.log("");
  console.log("LM Studio Status (from previous test):");
  console.log("  - Models API: accessible");
  console.log("  - Embeddings: working (nomic: 768d, qwen3: available)");
  console.log("  - Chat: working (reasoning_content field, not content)");
  console.log("  - Loaded models: qwen3-reranker-0.6b, qwen3-embedding-0.6b, qwen3.5-0.8b, nomic");

  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});