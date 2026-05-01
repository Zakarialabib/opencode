# OpenCode Configuration Repository

A comprehensive OpenCode AI agent configuration with 19 specialized agents, 40+ skills, and 8 MCP servers for full-stack development.

## Quick Start

### Option 1: Use in Current Directory

1. **Install OpenCode**: Follow instructions at https://opencode.ai
2. **Clone this repo**: `git clone <repo-url> C:\opencode`
3. **Deploy to your project**: `.\deploy-to-project.ps1 -TargetPath "C:\YourProject"`
   - Or use symlinks: `.\deploy-to-project.ps1 -TargetPath "C:\YourProject" -Symlink`
4. **Open OpenCode** in your project directory

### Option 2: Manual Setup

Copy these files/directories to your project root:

```
YourProject/
├── opencode.json          (from C:\opencode\opencode.json)
├── skills/               (from C:\opencode\skills/)
├── agents/               (from C:\opencode\agents/)
├── rules/                (from C:\opencode\rules/)
├── plugins/              (from C:\opencode\plugins/)
├── workflows/            (from C:\opencode\workflows/)
└── tools/               (from C:\opencode\tools/)
```

Then open OpenCode in `YourProject/` - it will automatically load the custom config.

## Architecture Overview

### Agents (19 Total)

| Agent                  | Role      | Description                                                       |
| ---------------------- | --------- | ----------------------------------------------------------------- |
| `core-builder`         | CORE      | High-speed implementation and direct file modification            |
| `core-planner`         | CORE      | Read-only strategic planning and architectural discovery          |
| `lead-orchestrator`    | LEAD      | Senior project orchestrator managing complex multi-agent handoffs |
| `lead-architect`       | LEAD      | High-level system design and architectural decisions              |
| `lead-product-manager` | LEAD      | Task prioritization, requirements, project roadmap                |
| `frontend-ui-ux`       | FRONTEND  | Premium UI design and UX implementation                           |
| `backend-api`          | BACKEND   | API design and implementation                                     |
| `backend-laravel`      | BACKEND   | Specialized Laravel 13 and Livewire 4 developer                   |
| `backend-tauri`        | BACKEND   | Specialized Rust and Tauri desktop apps                           |
| `backend-systems`      | BACKEND   | Low-level systems, shell scripting, infrastructure                |
| `qa-reviewer`          | QUALITY   | Senior code reviewer (standards, performance)                     |
| `qa-tester`            | QUALITY   | Test suite generation and automated verification                  |
| `qa-security`          | QUALITY   | Security vulnerability scanning and secret leak prevention        |
| `qa-debugger`          | QUALITY   | Root cause analysis and browser-based troubleshooting             |
| `devops-ops`           | DEVOPS    | Terminal execution and operational task runner                    |
| `devops-mcp`           | DEVOPS    | MCP server research and tool integration expert                   |
| `docs-writer`          | KNOWLEDGE | Technical documentation and content creation                      |
| `docs-governor`        | KNOWLEDGE | Documentation auditing and standard enforcement                   |
| `docs-evolver`         | KNOWLEDGE | System self-improvement and research-driven evolution             |

### Skills (40+ Registered)

All skills are now in the `skills/` directory with proper `SKILL.md` files.

**Core Skills (in skills/):**
| Skill | Category | Description |
|-------|----------|-------------|
| `database-design` | architecture | Database architecture and query optimization |
| `deep-research` | research | Comprehensive technical research |
| `docs-governance-audit` | documentation | Documentation quality audits |
| `git-release` | devops | Git-based release management |
| `laravel-feature-scaffold` | laravel | Laravel feature scaffolding |
| `project-orchestration` | orchestration | Multi-agent workflow coordination |
| `react-reuse-audit` | frontend | React component reuse analysis |
| `security-review` | security | Security assessments and vulnerability scans |
| `self-reflection` | meta | Configuration effectiveness analysis |
| `testing-strategy` | testing | Comprehensive testing strategies |
| `stack-context` | context-engineering | Auto-detect stack and pull Context7 docs |
| `self-improver` | meta | Continuous system improvement |
| `workflow-manager` | orchestration | Qwen Code-inspired task scheduling |

**Extended Skills (in skills/ - migrated from glm-skills):**
| Skill | Category | Description |
|-------|----------|-------------|
| `agent-browser` | testing | Browser automation via Playwright |
| `ai-news-collectors` | research | AI news aggregation |
| `aminer-academic-search` | research | Academic paper search |
| `aminer-daily-paper` | research | Daily paper recommendations |
| `aminer-open-academic` | research | Open academic resources |
| `anti-pua` | security | Anti-PUA protection |
| `asr` | audio | Automatic speech recognition |
| `auto-target-tracker` | project-management | Project milestone tracking |
| `blog-writer` | content | Blog content generation |
| `charts` | visualization | Chart generation and visualization |
| `coding-agent` | development | Advanced multi-step coding workflows |
| `content-strategy` | marketing | Content strategy planning |
| `contentanalysis` | analysis | Deep linguistic and sentiment analysis |
| `docx` | documents | Word document generation and editing |
| `dream-interpreter` | analysis | Dream interpretation and analysis |
| `finance` | finance | Financial analysis and reporting |
| `fullstack-dev` | web-development | Next.js, TypeScript, Prisma patterns |
| `get-fortune-analysis` | fortune | Fortune analysis and predictions |
| `gift-evaluator` | analysis | Gift evaluation and recommendations |
| `image-edit` | image | Image editing capabilities |
| `image-generation` | image | AI image generation |
| `image-understand` | image | Image understanding and analysis |
| `interview-designer` | hr | Interview question design |
| `llm` | llm | LLM interaction and management |
| `market-research-reports` | marketing | Market research report generation |
| `marketing-mode` | marketing | Marketing campaign planning |
| `mindfulness-meditation` | wellness | Mindfulness and meditation guidance |
| `multi-search-engine` | search | Multi-engine search capabilities |
| `pdf` | documents | PDF generation and manipulation |
| `podcast-generate` | audio | Podcast generation and editing |
| `ppt` | presentations | PowerPoint generation |
| `qingyan-research` | research | Deep academic and technical research |
| `seo-content-writer` | marketing | SEO-optimized content writing |
| `skill-creator` | meta | Assists in building new skills |
| `skill-finder-cn` | search | Chinese skill finder |
| `skill-vetter` | meta | Skill evaluation and vetting |
| `stock-analysis-skill` | finance | Stock analysis and recommendations |
| `storyboard-manager` | creative | Storyboard creation and management |
| `tts` | audio | Text-to-speech capabilities |
| `ui-ux-pro-max` | design | Premium design standards and HSL palettes |
| `video-generation` | video | AI video generation |
| `video-understand` | video | Video understanding and analysis |
| `visual-design-foundations` | design | Visual design principles |
| `vlm` | vision | Vision-language model capabilities |
| `web-reader` | web | Web content reading and extraction |
| `web-search` | search | Enhanced web search capabilities |
| `web-shader-extractor` | web | Web shader extraction |
| `writing-plans` | planning | Writing plan generation |
| `xlsx` | documents | Excel spreadsheet generation |

### MCP Servers (8 Enabled)

| Server                | Purpose                         | Timeout |
| --------------------- | ------------------------------- | ------- |
| `context7`            | Documentation and code examples | 30s     |
| `filesystem`          | File system operations          | 15s     |
| `memory`              | Persistent knowledge graph      | 10s     |
| `git`                 | Git repository operations       | 20s     |
| `fetch`               | Web content fetching            | 15s     |
| `sqlite`              | SQLite database operations      | 10s     |
| `sequential-thinking` | Step-by-step reasoning          | 30s     |
| `language-server`     | LSP integration                 | 20s     |

## Configuration Files

| File                | Purpose                                                       |
| ------------------- | ------------------------------------------------------------- |
| `opencode.json`     | Main OpenCode configuration (agents, tools, permissions, MCP) |
| `skills/index.json` | Skill registry with agent assignments and triggers            |
| `agents/*.md`       | Individual agent instructions and constraints                 |
| `skills/*/SKILL.md` | Skill implementation files (40+ skills)                       |
| `rules/*.md`        | Code style and stack-specific guidelines                      |
| `plugins/*.ts`      | Custom TypeScript plugins                                     |
| `workflows/*.yaml`  | Multi-phase workflow definitions                              |

## Commands

| Command         | Description                                | Agent        |
| --------------- | ------------------------------------------ | ------------ |
| `build`         | Build the project using npm                | core-builder |
| `test`          | Run project test suite                     | qa-tester    |
| `lint`          | Run linter checks                          | qa-reviewer  |
| `improve`       | Analyze and enhance project configuration  | docs-evolver |
| `reflect`       | Analyze and improve opencode configuration | docs-evolver |
| `db:init`       | Initialize database with schema            | devops-ops   |
| `process:check` | Check running processes                    | devops-ops   |
| `check-updates` | Check for dependency updates               | devops-ops   |
| `db:backup`     | Backup database to local file              | devops-ops   |

## Usage Patterns

### Qwen Code-Inspired Workflows

The `workflow-manager` skill implements Qwen Code patterns:

1. **ANALYZE**: Understand request, identify components
2. **PLAN**: Decompose into subtasks using sequential-thinking
3. **DELEGATE**: Launch SubAgents in parallel where possible
4. **SYNTHESIZE**: Combine results into unified solution
5. **VERIFY**: Fresh SubAgent for review/validation

### SubAgent Delegation

Use the Task tool with `lead-orchestrator` for complex multi-step tasks:

```
User: "Add user authentication to Laravel app"
→ core-planner: Analyze existing patterns
→ backend-laravel (parallel): Create models, routes, controllers
→ qa-reviewer: Security and standards review
→ qa-tester: Generate and run tests
```

## Stack Support

- **Laravel 13 + Livewire 4**: PHP backend development
- **Tauri + Rust**: Desktop application development
- **React + TypeScript**: Frontend development with Next.js support
- **Next.js + Prisma**: Fullstack web development

## Documentation

- **AGENTS.md**: Detailed agent descriptions and configurations
- **PLUGINS.md**: Plugin system documentation
- **docs/**: Additional documentation (User Guide, Skills Guide, Workflows Guide, etc.)

## Self-Improvement

Run `/reflect` or `/improve` to trigger the self-improvement cycle:

1. Analyzes current configuration
2. Identifies bottlenecks and improvement opportunities
3. Generates recommendations
4. Applies fixes after user approval

## Safety & Permissions

- **File permissions**: `"*": "ask"` for writes, `"*.env": "deny"` for secrets
- **Command permissions**: `"*": "ask"` for shell commands
- **MCP timeouts**: 10-30s to prevent hanging
- **Memory MCP**: Enabled for persistent context across sessions

## Project Structure (Clean & Organized)

```
opencode/
├── opencode.json          # Main configuration
├── skills/
│   ├── index.json        # Skill registry (40+ skills)
│   ├── SKILL.md         # Skill template
│   ├── database-design/
│   ├── deep-research/
│   ├── workflow-manager/
│   ├── agent-browser/    # Migrated from glm-skills
│   ├── fullstack-dev/    # Migrated from glm-skills
│   ├── ui-ux-pro-max/   # Migrated from glm-skills
│   └── ... (40+ skill directories)
├── agents/               # Agent definitions (19 agents)
├── rules/                # Code style rules
├── plugins/              # TypeScript plugins
├── workflows/            # YAML workflow definitions
├── tools/               # Utility scripts (cleaned up)
├── docs/                # Documentation
└── README.md            # This file
```

## Contributing

To add a new skill:

1. Create `skills/your-skill/SKILL.md`
2. Register in `skills/index.json`
3. Assign to appropriate agents
4. Document triggers and usage

## License

MIT License (see individual skills for their respective licenses)
