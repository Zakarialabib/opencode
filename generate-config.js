const fs = require("fs");

const config = {
  $schema: "https://opencode.ai/config.json",
  model: "qwen3.5-4b-claude-4.6-opus-reasoning-distilled-v2",
  default_agent: "build",
  enabled_providers: ["lmstudio"],
  server: {
    port: 4096,
    hostname: "127.0.0.1",
    mdns: false,
    cors: ["http://127.0.0.1:8080", "http://"],
  },
  tools: {
    write: true,
    edit: true,
    bash: true,
    read: true,
    glob: true,
    grep: true,
    list: true,
    task: true,
    skill: true,
    lsp: true,
    todoread: true,
    todowrite: true,
    webfetch: true,
    websearch: true,
    codesearch: true,
  },
  compaction: {
    auto: true,
    prune: true,
    reserved: 2048,
  },
};

fs.writeFileSync("opencode.json", JSON.stringify(config, null, 4));
console.log("Valid config created successfully");
