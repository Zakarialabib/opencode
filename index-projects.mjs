#!/usr/bin/env node
import { lancadb } from "./brain-plugin/retrieval/lancadb.js";
import { defaultProvider } from "./brain-plugin/provider/lmstudio.js";
import { searcher } from "./brain-plugin/retrieval/searcher.js";

const PROJECTS = [
  { path: "C:/laragon/www/Simple-Signage", name: "Simple-Signage" },
  // { path: "C:/laragon/www/CamControl", name: "CamControl" },
  // { path: "C:/laragon/www/myStockMaster", name: "myStockMaster" }
];

const IGNORE_PATTERNS = [
  "node_modules", ".git", "vendor", "target", "dist", "build",
  ".next", "__pycache__", ".cache", "*.log", ".env*"
];

const EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".py", ".php", ".java", ".go", ".rs", ".vue", ".svelte"];

function log(message, type = "info") {
  const prefix = {
    info: "[INFO]",
    success: "[OK]",
    error: "[ERROR]",
    progress: "[>>>]"
  };
  console.log(`${prefix[type] || "[INFO]"} ${message}`);
}

function formatBytes(bytes) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

async function fileExists(path) {
  try {
    const fs = await import("fs");
    return fs.existsSync(path);
  } catch {
    return false;
  }
}

async function countFiles(dirPath) {
  let count = 0;
  const fs = await import("fs");
  const path = await import("path");

  async function walk(dir) {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (!IGNORE_PATTERNS.some(p => entry.name.includes(p)) && !entry.name.startsWith(".")) {
            await walk(fullPath);
          }
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase();
          if (EXTENSIONS.includes(ext)) {
            count++;
          }
        }
      }
    } catch {
      // Skip directories we can't read
    }
  }

  await walk(dirPath);
  return count;
}

async function indexProject(project) {
  log(`Starting indexing: ${project.name}`, "progress");
  log(`Path: ${project.path}`, "info");

  const fs = await import("fs");
  const path = await import("path");

  if (!await fileExists(project.path)) {
    log(`Project not found: ${project.path}`, "error");
    return { status: "error", name: project.name, chunks: 0, message: "Project not found" };
  }

  const dbPath = `${project.path}/.opencode/brain.lance`;
  log(`Initializing LanceDB at: ${dbPath}`, "info");

  await lancadb.initialize(dbPath);

  const totalFiles = await countFiles(project.path);
  log(`Discovered ${totalFiles} code files`, "info");

  if (totalFiles === 0) {
    log(`No code files found in ${project.name}`, "error");
    return { status: "error", name: project.name, chunks: 0 };
  }

  const allChunks = [];
  let processedFiles = 0;
  let totalSize = 0;

  async function walkDir(dir) {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          if (!IGNORE_PATTERNS.some(p => entry.name.includes(p)) && !entry.name.startsWith(".")) {
            await walkDir(fullPath);
          }
          continue;
        }

        if (!entry.isFile()) continue;

        const ext = path.extname(entry.name).toLowerCase();
        if (!EXTENSIONS.includes(ext)) continue;

        try {
          const content = fs.readFileSync(fullPath, "utf-8");
          const stats = fs.statSync(fullPath);
          totalSize += stats.size;

          const lines = content.split("\n");
          const chunkSize = 40;
          const overlap = 10;

          for (let i = 0; i < lines.length; i += chunkSize - overlap) {
            const chunkLines = lines.slice(i, i + chunkSize);
            const chunkText = chunkLines.join("\n").trim();

            if (chunkText.length > 20) {
              allChunks.push({
                text: chunkText,
                path: fullPath,
                startLine: i + 1,
                endLine: Math.min(i + chunkSize, lines.length),
                mtime: stats.mtimeMs
              });
            }
          }
        } catch {
          // Skip files we can't read
        }

        processedFiles++;
        if (processedFiles % 50 === 0) {
          const progress = ((processedFiles / totalFiles) * 100).toFixed(1);
          process.stdout.write(`\r      Progress: ${progress}% (${processedFiles}/${totalFiles} files, ${allChunks.length} chunks)`);
        }
      }
    } catch {
      // Skip directories we can't read
    }
  }

  await walkDir(project.path);
  console.log(`\r      Progress: 100% (${processedFiles}/${totalFiles} files, ${allChunks.length} chunks)    `);

  log(`Generated ${allChunks.length} chunks from ${processedFiles} files (${formatBytes(totalSize)})`, "success");

  if (allChunks.length > 0) {
    log("Loading embedding model...", "info");
    const embedHandle = await defaultProvider.load("text-embedding-nomic-embed-text-v1.5");

    log("Generating embeddings...", "info");
    const batchSize = 32;
    const embeddings = [];

    for (let i = 0; i < allChunks.length; i += batchSize) {
      const batch = allChunks.slice(i, i + batchSize);
      const texts = batch.map(c => c.text.replace(/\n/g, " "));

      const res = await fetch("http://192.168.1.12:1234/v1/embeddings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "text-embedding-nomic-embed-text-v1.5",
          input: texts
        })
      });

      if (res.ok) {
        const data = await res.json();
        embeddings.push(...data.data.map(d => d.embedding));
      }

      const progress = (((i + batchSize) / allChunks.length) * 100).toFixed(1);
      process.stdout.write(`\r      Embedding progress: ${progress}%`);
    }
    console.log("\r      Embedding progress: 100%                      ");

    await defaultProvider.unload(embedHandle);

    log("Storing chunks with embeddings in LanceDB...", "info");
    const records = allChunks.map((chunk, i) => ({
      id: `${chunk.path}:${chunk.startLine}-${Date.now()}-${i}`,
      text: chunk.text,
      path: chunk.path,
      startLine: chunk.startLine,
      endLine: chunk.endLine,
      mtime: chunk.mtime,
      vector: embeddings[i] || new Array(768).fill(0)
    }));

    await lancadb.addChunksFromRecords(records);
  }

  const stats = await lancadb.getStats();
  log(`Indexed ${stats.totalChunks} chunks into LanceDB`, "success");

  return {
    status: "indexed",
    name: project.name,
    chunks: stats.totalChunks,
    files: processedFiles,
    size: formatBytes(totalSize)
  };
}

async function testSearch(project) {
  log(`\nTesting search on ${project.name}...`, "info");

  const testQueries = [
    "authentication login user",
    "database query select",
    "API endpoint controller"
  ];

  for (const query of testQueries) {
    process.stdout.write(`  Query: "${query}"... `);

    const result = await searcher.search(
      query,
      { strategy: "test", depth: "broad", maxChunks: 3, rerank: true },
      project.path
    );

    if (result.chunks.length > 0) {
      log(`Found ${result.chunks.length} results`, "success");
      result.chunks.slice(0, 2).forEach((c, i) => {
        console.log(`    ${i + 1}. ${c.path}:${c.startLine} - "${c.text.substring(0, 60)}..."`);
      });
    } else {
      console.log("No results found");
    }
  }
}

async function main() {
  console.log("=".repeat(60));
  console.log("Brain Plugin - Project Indexer");
  console.log("=".repeat(60));
  console.log("");
  console.log("Projects to index:");
  PROJECTS.forEach((p, i) => console.log(`  ${i + 1}. ${p.name}`));
  console.log("");
  console.log("=".repeat(60));

  const results = [];

  for (const project of PROJECTS) {
    console.log("");
    const result = await indexProject(project);
    results.push(result);

    if (result.status === "indexed") {
      await testSearch(project);
    }
    console.log("");
  }

  console.log("=".repeat(60));
  console.log("Indexing Complete!");
  console.log("=".repeat(60));

  console.log("\nSummary:");
  results.forEach(r => {
    if (r.status === "indexed") {
      console.log(`  ${r.name}: ${r.chunks} chunks (${r.files} files, ${r.size})`);
    } else {
      console.log(`  ${r.name}: FAILED - ${r.message || "unknown error"}`);
    }
  });

  console.log("\nProjects are now indexed for semantic search!");
  console.log("Restart OpenCode to use brain_index_project tool.");
}

main().catch(console.error);
