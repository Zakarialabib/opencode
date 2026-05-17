#!/usr/bin/env npx tsx
/**
 * RAG Improvement Agent CLI
 *
 * Usage:
 *   npx tsx scripts/rag-agent-cli.ts analyze
 *   npx tsx scripts/rag-agent-cli.ts improve --alpha=0.35 --beta=0.45 --gate=0.80
 *   npx tsx scripts/rag-agent-cli.ts query "How does authentication work?"
 *   npx tsx scripts/rag-agent-cli.ts diagnose
 */

import { fileLog } from "../meta-harness/utils/logger";
import {
  getIndexStatus,
  queryIndexedDocs,
  analyzeRAGPipeline,
  improveRAG,
  diagnoseBrainPlugin,
  type ImprovementTask,
} from "../brain-plugin/rag-agent";

const args = process.argv.slice(2);
const command = args[0] || "help";

// Parse key-value args
const kvArgs: Record<string, string> = {};
for (const arg of args.slice(1)) {
  const [key, value] = arg.split("=");
  if (key && value) kvArgs[key] = value;
}

async function run() {
  console.log("╔════════════════════════════════════════════════════════════╗");
  console.log("║          RAG & Brain Plugin Improvement Agent              ║");
  console.log("╚════════════════════════════════════════════════════════════╝");

  fileLog(`=== RAG Agent started: ${command} ===`);

  switch (command) {
    case "status":
    case "diagnose": {
      console.log("\n🔍 Diagnosing Brain Plugin...\n");
      const diag = await diagnoseBrainPlugin();

      console.log("📊 Index Status:");
      console.log(`   Total chunks: ${diag.indexStatus.totalChunks}`);
      console.log(`   FTS records: ${diag.indexStatus.ftsRecords}`);
      console.log(`   Qwen embeddings: ${diag.indexStatus.qwenEmbeddings}`);
      console.log(`   Nomic embeddings: ${diag.indexStatus.nomicEmbeddings}`);
      console.log(`   Vector active: ${diag.indexStatus.vectorActive ? "✅" : "❌"}`);

      console.log("\n🔧 Current Config:");
      console.log(
        `   Fusion: α=${diag.config.fusion.alpha.toFixed(2)}, β=${diag.config.fusion.beta.toFixed(2)}, γ=${diag.config.fusion.gamma.toFixed(2)}`
      );
      console.log(
        `   Reranker: gate=${diag.config.reranker.confidenceGate}, min=${diag.config.reranker.rerankMinResults}`
      );
      console.log(`   Tree: ${Object.keys(diag.config.tree.intentThresholds).length} intents`);

      console.log("\n💡 LM Studio Models:");
      for (const m of diag.lmStudioModels) {
        console.log(`   - ${m}`);
      }

      console.log("\n⚠️  Issues:");
      if (diag.issues.length === 0) {
        console.log("   None detected ✅");
      } else {
        for (const issue of diag.issues) {
          console.log(`   - ${issue}`);
        }
      }
      break;
    }

    case "query": {
      const question = args.slice(1).join(" ") || kvArgs["q"] || kvArgs["question"];
      if (!question) {
        console.log('❌ Please provide a query: rag-agent-cli.ts query "your question"');
        break;
      }

      console.log(`\n🔍 Query: "${question}"\n`);
      const result = await queryIndexedDocs(question);

      console.log("📚 Relevant Documents:");
      for (const chunk of result.chunks) {
        console.log(`   [${chunk.filepath}:${chunk.start_line}]`);
        console.log(`   ${chunk.content?.slice(0, 100)}...\n`);
      }

      console.log("💬 Answer:");
      console.log(`   ${result.answer}`);
      break;
    }

    case "analyze": {
      console.log("\n📊 Analyzing RAG Pipeline...\n");
      const analysis = await analyzeRAGPipeline();

      console.log("🔧 Current Configuration:");
      console.log(
        `   Fusion: α=${analysis.currentConfig.fusion.alpha.toFixed(2)}, β=${analysis.currentConfig.fusion.beta.toFixed(2)}, γ=${analysis.currentConfig.fusion.gamma.toFixed(2)}, boost=${analysis.currentConfig.fusion.memoryBoost}`
      );
      console.log(
        `   Reranker: gate=${analysis.currentConfig.reranker.confidenceGate}, min=${analysis.currentConfig.reranker.rerankMinResults}, intents=${analysis.currentConfig.reranker.rerankIntents.join(", ")}`
      );

      console.log("\n💡 Recommendations:");
      if (analysis.recommendations.length === 0) {
        console.log("   No improvements needed ✅");
      } else {
        for (const rec of analysis.recommendations) {
          console.log(`   - ${rec}`);
        }
      }
      break;
    }

    case "improve": {
      console.log("\n🚀 Applying RAG Improvements...\n");

      const settings: any = {};
      if (kvArgs["alpha"]) settings.fusionAlpha = parseFloat(kvArgs["alpha"]);
      if (kvArgs["beta"]) settings.fusionBeta = parseFloat(kvArgs["beta"]);
      if (kvArgs["gate"]) settings.confidenceGate = parseFloat(kvArgs["gate"]);
      if (kvArgs["min"]) settings.rerankMinResults = parseInt(kvArgs["min"]);
      if (kvArgs["learnChunks"]) settings.learnChunks = parseInt(kvArgs["learnChunks"]);

      console.log("Settings to apply:", settings);

      const result = await improveRAG(settings);

      console.log("\n✅ Applied changes:");
      for (const change of result.applied) {
        console.log(`   - ${change}`);
      }

      console.log("\n📋 New Configuration:");
      console.log(
        `   Fusion: α=${result.config.fusion.alpha.toFixed(2)}, β=${result.config.fusion.beta.toFixed(2)}, γ=${result.config.fusion.gamma.toFixed(2)}`
      );
      console.log(`   Reranker: gate=${result.config.reranker.confidenceGate}`);
      break;
    }

    case "test": {
      console.log("\n🧪 Testing RAG Pipeline...\n");

      // Run a test query
      const testQueries = [
        "How does the brain plugin classify intents?",
        "What is the meta-harness configuration structure?",
        "How are embeddings stored in the database?",
      ];

      for (const query of testQueries) {
        console.log(`\n📝 Test: "${query}"`);
        const result = await queryIndexedDocs(query);
        console.log(`   Chunks found: ${result.chunks.length}`);
        console.log(`   Answer: ${result.answer.slice(0, 100)}...`);
      }
      break;
    }

    default:
      console.log(`
╔════════════════════════════════════════════════════════════╗
║                     RAG Agent Commands                     ║
╚════════════════════════════════════════════════════════════╝

  npx tsx scripts/rag-agent-cli.ts diagnose
    - Show index status, config, and any issues

  npx tsx scripts/rag-agent-cli.ts query "your question"
    - Query the indexed documentation

  npx tsx scripts/rag-agent-cli.ts analyze
    - Analyze RAG pipeline and suggest improvements

  npx tsx scripts/rag-agent-cli.ts improve alpha=0.35 beta=0.45
    - Apply RAG improvements
    - Options: alpha, beta, gate, min, learnChunks

  npx tsx scripts/rag-agent-cli.ts test
    - Run test queries against RAG pipeline

  Examples:
    npx tsx scripts/rag-agent-cli.ts query "How does auth work?"
    npx tsx scripts/rag-agent-cli.ts improve gate=0.80 learnChunks=20
`);
  }

  fileLog(`=== RAG Agent completed: ${command} ===`);
}

run().catch((err) => {
  console.error("RAG Agent error:", err);
  process.exit(1);
});
