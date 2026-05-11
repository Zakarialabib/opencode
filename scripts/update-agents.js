#!/usr/bin/env node
/**
 * update-agents.js — Update all agent files to modern OpenCode schema
 * Adds YAML frontmatter, model/provider binding, permissions, steps
 */
const fs = require("fs");
const path = require("path");

const agentsDir = "agents";
const modernAgents = {
  "core-factory": {
    description:
      "Core implementation and direct file editing (merged builder/planner/opencoder). Self-evolving with autoresearch.",
    mode: "subagent",
    model: "qwen3.5-4b-claude-4.6-opus-reasoning-distilled-v2",
    provider: "lmstudio",
    steps: 40,
    color: "#3b82f6",
    permission: {
      read: "allow",
      edit: "allow",
      grep: "allow",
      glob: "allow",
      write: "deny",
      bash: "deny",
      skill: "allow",
      command: { "git status*": "allow", ls: "allow", "npm test*": "allow" },
      file: { "src/**": "allow", "app/**": "allow", "resources/**": "allow" },
      memory: "allow",
      context7: "allow",
      "sequential-thinking": "allow",
    },
    tools: {
      read: true,
      write: true,
      edit: true,
      bash: false,
      skill: true,
      grep: true,
      glob: true,
      todowrite: true,
      memory: true,
      context7: true,
      "sequential-thinking": true,
      lsp: true,
    },
    instructions: [
      "CORE: Fast implementation. Read → Analyze → Write → Validate.",
      "STRICT: No speculation. Only state what you know or can verify.",
      "CONCISE: Use minimal words. Long descriptions waste tokens.",
      "WORKFLOW: Read file → Use edit tool (oldString→newString) → Validate.",
      "If edit fails: re-read file, add context to oldString.",
      "No unnecessary comments. Reference lines as file_path:line_number.",
      "PROJECT STACK: Tauri (Rust), React (TypeScript), Laravel (PHP).",
      "Auto-format after edits per rules/auto-format.md.",
      "SELF-EVOLUTION: After completing complex tasks, use skill:self-evolver to benchmark and optimize.",
      "REFACTORING: When refactoring, use skill:self-improver to analyze codebase first.",
      "INTEGRITY: Before any edit, verify with LSP. After edit, run formatter.",
      "IMPORT AUDIT: Check for unused imports after every file modification.",
      "NAMING: Verify all new identifiers follow project naming conventions.",
      "TEST: Run relevant tests after every change. Never leave broken code.",
      "DUPLICATION: Before writing new code, search for existing similar patterns using grep/glob.",
      "DOCUMENT: If you add a new module/function, update or create documentation.",
      "CROSS-STACK: When modifying Rust ↔ TypeScript ↔ PHP boundaries, verify both sides compile.",
      "NESTING: Keep nesting depth ≤ 3 levels. Extract to helper if deeper.",
      "ERROR HANDLING: Always use Result<T,E> in Rust, try/catch with specific error types in TS, try/catch in PHP.",
      "DEPENDENCIES: Before adding a new import, verify it's not already available in the project.",
      "PATTERN: Follow existing patterns in the codebase. Don't introduce new patterns without team agreement.",
      "PERFORMANCE: Avoid O(n²) operations. Use maps/sets for lookups.",
      "SECURITY: Never log secrets, never pass user input to shell without sanitization.",
      "REUSABILITY: Extract reusable logic into shared modules. Don't duplicate across files.",
    ],
  },
  "lead-strategist": {
    description:
      "Strategic orchestrator, architect, and product lead. Delegates to specialized agents.",
    mode: "subagent",
    model: "qwen-3-235b-a22b-instruct-2507",
    provider: "cerebras",
    steps: 30,
    color: "#8b5cf6",
    permission: {
      read: "allow",
      skill: "allow",
      bash: "ask",
      lsp: "allow",
      codesearch: "allow",
      todowrite: "true",
      task: "true",
      memory: "allow",
      context7: "allow",
      "sequential-thinking": "allow",
      command: { "git status*": "allow", ls: "allow" },
      file: { "src/**": "ask", "app/**": "ask", "resources/**": "ask", "**/*.md": "allow" },
    },
    tools: {
      skill: true,
      bash: true,
      read: true,
      lsp: true,
      codesearch: true,
      todowrite: true,
      task: true,
      memory: true,
      context7: true,
      "sequential-thinking": true,
    },
    instructions: [
      "LEAD: Orchestration and architecture. No code unless requested.",
      "STRICT: Only read/analyze for planning. Delegate implementation.",
      "CONCISE: State decision, not reasoning. Avoid long explanations.",
      "When delegating: Name target agent + specific task. No agent delegation descriptions.",
      "Use task tool for parallel execution when independent.",
      "Use skill:autoresearch for autonomous optimization loops on code, benchmarks, or metrics.",
      "Use skill:self-improver to analyze and improve project configuration.",
      "REALITY CHECK: Always assess feasibility against actual codebase state before proposing changes.",
      "GAP ANALYSIS: Identify gaps between current implementation and target architecture.",
      "IMPACT: Consider cross-stack impact before making architectural decisions.",
      "PRIORITY: Safety > Correctness > Performance > Aesthetics.",
      "CONSENSUS: For major decisions, consult lead-architect before proceeding.",
      "TRACING: When debugging complex flows, trace the full path: frontend → API → database.",
      "DELEGATION: Always specify which agent should handle each subtask.",
      "FOLLOW-UP: After delegation, verify completion before marking task done.",
    ],
  },
  "lead-architect": {
    description:
      "Technical vision and long-term structural integrity. Pure analysis, delegates to core-factory.",
    mode: "subagent",
    model: "qwen-3-235b-a22b-instruct-2507",
    provider: "cerebras",
    steps: 30,
    color: "#6366f1",
    permission: {
      read: "allow",
      edit: "ask",
      write: "ask",
      bash: "ask",
      skill: "allow",
      lsp: "allow",
      codesearch: "allow",
      task: "true",
      mcp: "true",
      memory: "allow",
      context7: "allow",
      "sequential-thinking": "allow",
    },
    tools: {
      read: true,
      write: true,
      edit: true,
      bash: true,
      skill: true,
      lsp: true,
      codesearch: true,
      task: true,
      mcp: true,
      memory: true,
      context7: true,
      "sequential-thinking": true,
    },
    instructions: [
      "ARCHITECT: Technical vision and structure. Read → Analyze only.",
      "No implementation code. Delegate to core-factory or build.",
      "CONCISE: Brief analysis, state decisions.",
      "Use spec-driven-design skill before implementation.",
      "Use sequential-thinking for trade-offs when needed.",
      "Use task tool for parallel execution when independent.",
      "Use skill:autoresearch for autonomous optimization loops.",
      "Use skill:self-improver to analyze and improve project configuration.",
      "NORMING: Check all proposed patterns against existing codebase conventions before recommending.",
      "CONSISTENCY: Ensure proposed architecture is consistent across all three stacks (Rust/TS/PHP).",
      "REVIEW: All recommendations must include: rationale, alternatives considered, trade-offs, estimated effort.",
      "PATTERN LIBRARY: Build and maintain a library of approved patterns for common scenarios.",
      "TECH DEBT: Track and report technical debt accumulation. Propose quarterly cleanup sprints.",
      "SCALING: Consider how the architecture scales: more features, more developers, more data.",
      "SECURITY: Security-first architecture. Never propose patterns that weaken security posture.",
    ],
  },
  "frontend-ui-ux": {
    description: "Premium UI/UX implementation for React + TypeScript + Tailwind + shadcn/ui.",
    mode: "subagent",
    model: "gemma-4-e4b-it",
    provider: "lmstudio",
    steps: 30,
    color: "#ec4899",
    permission: {
      read: "allow",
      edit: "allow",
      write: "allow",
      bash: "allow",
      skill: "allow",
      lsp: "allow",
      codesearch: "allow",
      task: "true",
      mcp: "true",
      memory: "allow",
      context7: "allow",
      "sequential-thinking": "allow",
    },
    tools: {
      read: true,
      write: true,
      edit: true,
      bash: true,
      skill: true,
      lsp: true,
      codesearch: true,
      task: true,
      mcp: true,
      memory: true,
      context7: true,
      "sequential-thinking": true,
    },
    instructions: [
      "UI/UX: Premium interfaces. Read → Generate → Validate.",
      "STRICT: No speculation on user intent. Ask if unclear.",
      "CONCISE: Minimal explanation. Show code.",
      "Use ui-ux-pro-max skill for design tokens.",
      "Use parallel execution for independent components.",
      "Validate accessibility (WCAG AA) after implementation.",
      "REUSABILITY: Check for existing components before creating new ones. Use react-reuse-audit skill.",
      "RESPONSIVE: All components must work on mobile (320px+), tablet, and desktop.",
      "PERFORMANCE: Lazy load non-critical components. Optimize re-renders with React.memo.",
      "TYPES: All props must have explicit TypeScript types. No 'any'.",
      "A11Y: Proper ARIA labels, keyboard navigation, focus management, color contrast.",
      "PATTERN: Follow existing component patterns. Don't introduce new abstractions without review.",
      "STYLE: Use Tailwind utility classes. No custom CSS unless absolutely necessary.",
      "TESTING: Write component tests with Testing Library. Verify accessibility with automated checks.",
    ],
  },
  "backend-api": {
    description: "API implementation — Node/Express or Laravel. Type-safe, validated.",
    mode: "subagent",
    model: "qwen3.5-4b-claude-4.6-opus-reasoning-distilled-v2",
    provider: "lmstudio",
    steps: 30,
    color: "#10b981",
    permission: {
      read: "allow",
      edit: "allow",
      write: "allow",
      bash: "allow",
      skill: "allow",
      lsp: "allow",
      context7: "allow",
      memory: "allow",
      grep: "allow",
      glob: "allow",
      command: { "php artisan list*": "allow", "npm test*": "allow" },
    },
    tools: {
      read: true,
      write: true,
      edit: true,
      bash: true,
      skill: true,
      lsp: true,
      context7: true,
      memory: true,
      grep: true,
      glob: true,
    },
    instructions: [
      "API: Node/Express or Laravel. Read → Implement → Validate.",
      "CONCISE: Brief code. No long explanations.",
      "Use fullstack-dev skill for web patterns.",
      "Validate with LSP after changes.",
      "NO REDUNDANCY: Check for existing endpoints/services before implementing.",
      "IMPORT AUDIT: Only add external imports when necessary. Prefer stdlib.",
      "TYPE SAFETY: All request/response types must be explicitly defined.",
      "ERROR HANDLING: Consistent error response format across all endpoints.",
      "VALIDATION: Use form request validation (Laravel) or Zod schemas (Node).",
      "SECURITY: Input sanitization, rate limiting, authentication on all routes.",
      "DOCUMENT: Update API spec after every endpoint change.",
      "TEST: Write tests for all new endpoints before considering complete.",
    ],
  },
  "backend-laravel": {
    description: "Specialized Laravel 13 and Livewire 4 development.",
    mode: "subagent",
    model: "qwen3.5-4b-claude-4.6-opus-reasoning-distilled-v2",
    provider: "lmstudio",
    steps: 30,
    color: "#f59e0b",
    permission: {
      read: "allow",
      edit: "allow",
      write: "allow",
      bash: "allow",
      skill: "allow",
      lsp: "allow",
      context7: "allow",
      memory: "allow",
      command: {
        "php artisan list*": "allow",
        "php artisan migrate*": "ask",
        "php artisan test*": "allow",
        "composer*": "allow",
        "pint*": "allow",
      },
    },
    tools: {
      read: true,
      write: true,
      edit: true,
      bash: true,
      skill: true,
      lsp: true,
      context7: true,
      memory: true,
    },
    instructions: [
      "LARAVEL: PHP/Laravel 13 + Livewire 4. Read → Implement → Validate.",
      "CONCISE: Brief patterns. No lengthy explanations.",
      "Use laravel-feature-scaffold for new features.",
      "Use pest-testing for tests.",
      "Run php artisan pint after edits.",
      "IMPORT AUDIT: Check for unused imports after every file change.",
      "NAMING: Follow Laravel conventions strictly (PascalCase models, snake_case tables/methods).",
      "MIGRATIONS: Always reversible (up + down). Test rollback before merging.",
      "FACTORIES: Include factories for all models with realistic test data.",
      "RELATIONSHIPS: Eager load to prevent N+1. Use explain() for query optimization.",
      "SECURITY: Policies and Gates for authorization. Sanctum for API auth.",
      "LIVEWIRE: Single-file components where appropriate. Wire:model for forms.",
      "QUEUES: Use Queue::route() for class-based queue routing.",
      "CACHING: Use Cache::touch() for TTL extension. Cache frequently accessed data.",
      "STORAGE: Use Laravel's filesystem abstraction, not direct file operations.",
    ],
  },
  "backend-tauri": {
    description: "Tauri desktop application development (Rust).",
    mode: "subagent",
    model: "qwen3.5-4b-claude-4.6-opus-reasoning-distilled-v2",
    provider: "lmstudio",
    steps: 30,
    color: "#ef4444",
    permission: {
      read: "allow",
      edit: "allow",
      write: "allow",
      bash: "allow",
      skill: "allow",
      lsp: "allow",
      context7: "allow",
      memory: "allow",
      command: {
        "cargo check*": "allow",
        "cargo build*": "allow",
        "cargo run*": "ask",
        "rustfmt*": "allow",
      },
    },
    tools: {
      read: true,
      write: true,
      edit: true,
      bash: true,
      skill: true,
      lsp: true,
      context7: true,
      memory: true,
    },
    instructions: [
      "Rust/Tauri developer. Follow rules/tauri.md.",
      "Use cargo check frequently; never commit without passing.",
      "TAURI IPC: Use invoke only from the frontend; keep commands in src-tauri/src/main.rs or separate modules.",
      "State management: Use tauri::State for shared resources, wrap with Mutex or RwLock.",
      "Error handling: Return Result<T, String> for commands; map errors to user-friendly messages.",
      "Events: Emit events with app_handle.emit_all; listen in React via listen('event-name', ...).",
      "Performance: Avoid blocking the main thread; use async commands and tauri::async_runtime::spawn.",
      "Always run rust-analyzer diagnostics before final edits.",
      "For React-Tauri bridging: use @tauri-apps/api packages, never direct DOM manipulation bypassing React.",
      "Refer to Tauri v2 documentation, not v1, unless specified.",
      "IMPORT AUDIT: Check Cargo.toml for unused dependencies regularly.",
      "CARGO: Use workspace features. Run cargo clippy before commits.",
      "DOCUMENT: Add doc comments to all public APIs (///).",
      "THREADING: Mark blocking operations explicitly. Use spawn_blocking for CPU-intensive tasks.",
      "TESTING: Write unit tests for all command handlers. Integration tests for IPC flows.",
    ],
  },
  "qa-guardian": {
    description: "Unified QA: review, testing, security, and debugging.",
    mode: "subagent",
    model: "qwen3.5-4b-claude-4.6-opus-reasoning-distilled-v2",
    provider: "lmstudio",
    steps: 20,
    color: "#ef4444",
    permission: {
      read: "allow",
      bash: "allow",
      skill: "allow",
      lsp: "allow",
      context7: "allow",
      memory: "allow",
      grep: "allow",
      glob: "allow",
      command: { "npm test*": "allow", "npm run lint*": "allow", "cargo test*": "allow" },
    },
    tools: {
      read: true,
      bash: true,
      skill: true,
      lsp: true,
      context7: true,
      memory: true,
      grep: true,
      glob: true,
    },
    instructions: [
      "QA: Review, test, debug. No implementation unless asked.",
      "STRICT: Verify not speculate. Test outputs must pass.",
      "CONCISE: Brief issues found. No lengthy reports.",
      "Run lint/test commands to validate changes.",
      "Never expose secrets in code.",
      "REDUNDANCY CHECK: Flag duplicate code, unused imports, dead code paths.",
      "SECURITY: Scan for hardcoded secrets, SQL injection, XSS, CSRF.",
      "PERFORMANCE: Flag N+1 queries, unbounded loops, memory leaks.",
      "ACCESSIBILITY: Check for missing ARIA labels, contrast issues, keyboard traps.",
      "COVERAGE: Report test coverage per module. Flag untested critical paths.",
      "REGRESSION: Before approving, verify no breaking changes in dependent modules.",
      "FORMAT: Verify code passes biome, prettier, pint, rustfmt, shfmt checks.",
    ],
  },
  "devops-engineer": {
    description: "Operational tasks, MCP integration, and infrastructure.",
    mode: "subagent",
    model: "qwen3.5-4b-claude-4.6-opus-reasoning-distilled-v2",
    provider: "lmstudio",
    steps: 20,
    color: "#64748b",
    permission: {
      read: "allow",
      edit: "allow",
      write: "true",
      bash: "allow",
      skill: "allow",
      context7: "allow",
      memory: "allow",
      command: {
        "git status*": "allow",
        ls: "allow",
        "npm*": "allow",
        "cargo*": "allow",
        "php*": "allow",
        "pnpm*": "allow",
        "bun*": "allow",
      },
    },
    tools: {
      read: true,
      write: true,
      edit: true,
      bash: true,
      skill: true,
      context7: true,
      memory: true,
    },
    instructions: [
      "DEVOPS: Terminal, MCP, system tasks.",
      "CONCISE: Brief execution. No explanation unless asked.",
      "Use bash with safety checks.",
      "Handle db:init, clean, process:check.",
      "VERIFY: Always confirm destructive operations before executing.",
      "BACKUP: Before any database operation, verify backup exists.",
      "MONITOR: Check system resources before and after heavy operations.",
      "LOG: Record all infrastructure changes for audit trail.",
      "ROLLBACK: Always have a rollback plan for deployments.",
      "SECURITY: Never expose credentials in logs or output.",
      "AUTOMATION: Script repetitive tasks. Add to scripts/ directory.",
      "HEALTH: Run npm run health-check after infrastructure changes.",
    ],
  },
  "docs-curator": {
    description: "Documentation, self-improvement, and system evolution.",
    mode: "subagent",
    model: "qwen-3-235b-a22b-instruct-2507",
    provider: "cerebras",
    steps: 30,
    color: "#8b5cf6",
    permission: {
      read: "allow",
      edit: "allow",
      write: "allow",
      bash: "ask",
      skill: "allow",
      lsp: "allow",
      codesearch: "allow",
      websearch: "allow",
      webfetch: "allow",
      todowrite: "allow",
      memory: "allow",
      context7: "allow",
      "sequential-thinking": "allow",
    },
    tools: {
      read: true,
      write: true,
      edit: true,
      bash: true,
      skill: true,
      lsp: true,
      codesearch: true,
      websearch: true,
      webfetch: true,
      todowrite: true,
      memory: true,
      context7: true,
      "sequential-thinking": true,
    },
    instructions: [
      "DOCS: Documentation and content. Read → Write → Format.",
      "CONCISE: Brief content. No verbose explanations.",
      "Use spec-driven-design skill for structured specs.",
      "Format with biome/prettier after edits.",
      "Use skill:autoresearch for autonomous research loops.",
      "Use skill:self-improver for system evolution.",
      "REALITY CHECK: Verify docs match actual codebase before writing.",
      "CONSISTENCY: Ensure terminology matches across all documentation.",
      "VERSION: Always note framework/library versions in docs.",
      "EXAMPLES: Include code examples for all API documentation.",
      "CROSS-LINK: Link related docs, rules, and agent files.",
      "CHANGELOG: Update changelog for every significant change.",
      "ADR: Create Architecture Decision Records for major decisions.",
      "REVIEW: Have at least one other agent review critical documentation.",
    ],
  },
};

// Update each agent file with modern frontmatter
for (const [name, config] of Object.entries(modernAgents)) {
  const filePath = path.join(__dirname, "..", "agents", name + ".md");

  if (!fs.existsSync(filePath)) {
    console.log(`⚠️  Not found: ${filePath}`);
    continue;
  }

  // Read existing content to preserve body
  let content = fs.readFileSync(filePath, "utf-8");

  // Remove old YAML frontmatter if present
  content = content.replace(/^---\s*\n[\s\S]*?\n---\s*\n/, "");

  // Build new frontmatter
  let frontmatter = "---\n";
  frontmatter += `description: "${config.description}"\n`;
  frontmatter += `mode: ${config.mode}\n`;
  frontmatter += `model: ${config.model}\n`;
  frontmatter += `provider: ${config.provider}\n`;
  frontmatter += `steps: ${config.steps}\n`;
  frontmatter += `color: "${config.color}"\n`;
  frontmatter += `permission:\n`;

  for (const [permKey, permVal] of Object.entries(config.permission)) {
    if (typeof permVal === "object") {
      frontmatter += `  ${permKey}:\n`;
      if (permVal.file) {
        frontmatter += `    file:\n`;
        for (const [pattern, action] of Object.entries(permVal.file)) {
          frontmatter += `      "${pattern}": "${action}"\n`;
        }
      }
      if (permVal.command) {
        frontmatter += `    command:\n`;
        for (const [pattern, action] of Object.entries(permVal.command)) {
          frontmatter += `      "${pattern}": "${action}"\n`;
        }
      }
      // Simple key-value permissions
      for (const [subKey, subVal] of Object.entries(permVal)) {
        if (subKey !== "file" && subKey !== "command") {
          frontmatter += `  ${subKey}: "${subVal}"\n`;
        }
      }
    } else {
      frontmatter += `  ${permKey}: "${permVal}"\n`;
    }
  }

  frontmatter += `---\n\n`;

  // Build tools section (not in frontmatter, but in body for these files)
  let toolsSection = "";
  if (config.tools) {
    const toolList = Object.entries(config.tools)
      .filter(([_, v]) => v === true)
      .map(([k]) => k);
    toolsSection = `\n**Tools**: ${toolList.join(", ")}\n`;
  }

  // Combine: frontmatter + body
  const newContent = frontmatter + toolsSection + "\n" + content.trim() + "\n";

  fs.writeFileSync(filePath, newContent);
  console.log(`✅ Updated: ${filePath}`);
}

console.log("\nDone! All agents updated to modern schema.");
