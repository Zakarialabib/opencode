const { Database } = require('bun:sqlite');
const db = new Database('.opencode/brain.db');
const data = {
  "dense": {"pipelineLoaded": false, "importFailed": true, "cooldownActive": true, "cooldownRemainingMs": 120000, "activeModel": "nomic (LM Studio fallback)"},
  "reranker": {"pipelineLoaded": false, "importFailed": false, "confidenceGate": 0.85, "rerankMinResults": 10, "rerankIntents": ["learn","refactor","feature"], "maxChunks": 20},
  "tokenBudget": {"total": 24000, "used": 1250, "reserved": 8192, "availableForContext": 14558, "percent": 5.21},
  "decisionTree": {"totalNodes": 7, "pendingMutations": 0, "intents": {"debug": {"weight": 1.2, "visits": 15}, "refactor": {"weight": 1.0, "visits": 8}}},
  "sessionMemory": {"decisions": 55, "successes": 48, "failures": 7, "recentFiles": 12, "contextUsed": 89},
  "loadedModels": ["qwen3.5-4b","nomic-embed-text-v1.5","qwen3-reranker-0.6b"],
  "lastUpdated": 1779328000000
};
db.prepare("INSERT OR REPLACE INTO config (key, value, updated_at) VALUES ('brain_plugin_status', ?, ?)").run(JSON.stringify(data), Date.now());
db.close();
console.log('Written:', JSON.stringify(data).substring(0, 100));
