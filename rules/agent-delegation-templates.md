# Agent Delegation Templates

## Template Structure

Each template follows: **CONTEXT + TASK + CONSTRAINTS + QUALITY_GATES**

## core-factory Delegation Template

**When to use**: Core implementation, direct file editing, fast execution

**Context to include**:
- Previous decisions made
- Files already analyzed
- Architectural constraints
- Token budget remaining

**Task description**:
[Brief task from orchestrator]

**Constraints**:
- Follow project conventions (check rules/)
- No speculation, only verified changes
- Auto-format after edits
- Check for redundant imports

**Quality gates**:
- Code compiles/lints successfully
- No breaking changes to existing functionality
- Consistent with project style

## frontend-ui-ux Delegation Template

**When to use**: React, UI components, styling, UX improvements

**Context to include**:
- Design system reference (shadcn/ui, Tailwind)
- Existing component inventory
- Accessibility requirements (WCAG AA)
- Mobile/touch requirements

**Task description**:
[UI/UX task from orchestrator]

**Constraints**:
- Use existing components before creating new
- Mobile-first responsive design
- WCAG AA accessibility compliance
- Touch targets minimum 48px
- Follow design token system

**Quality gates**:
- Component reuses existing patterns
- Passes accessibility audit
- Responsive at all breakpoints
- Design consistency score ≥8/10

## backend-api Delegation Template

**When to use**: API endpoints, Node/Express, Laravel routes

**Context to include**:
- API contract/endpoint specification
- Database schema (Prisma/Laravel)
- Authentication requirements
- Mobile-first considerations

**Task description**:
[API implementation task]

**Constraints**:
- Type-safe, no `any` types
- Input validation on all endpoints
- Mobile-optimized responses (cursor pagination, select fields)
- Check for existing endpoints/services first
- No redundant imports

**Quality gates**:
- TypeScript/Php linting passes
- Endpoint returns expected response structure
- Handles error cases gracefully
- Mobile API follows offline-first patterns

## backend-laravel Delegation Template

**When to use**: Laravel-specific features, PHP, Livewire

**Context to include**:
- Laravel version (13.x) and PHP version (8.3+)
- Existing models and relationships
- Livewire component requirements
- Pest testing requirements

**Task description**:
[Laravel implementation task]

**Constraints**:
- Use PHP 8.3+ features (attributes, readonly classes)
- Follow Laravel naming conventions (PascalCase models, snake_case tables)
- Use JSON:API resources for API responses
- Pest testing for new features
- Run `php artisan pint` after edits

**Quality gates**:
- PHP linting passes (Intelephense)
- Tests pass (Pest/PHPUnit)
- Follows Laravel conventions strictly
- No unused imports
- Migrations are reversible

## backend-tauri Delegation Template

**When to use**: Rust, desktop app features, Tauri commands

**Context to include**:
- Command specification (src-tauri/src/main.rs)
- Frontend integration requirements
- Event system needs
- State management requirements

**Task description**:
[Tauri/Rust implementation task]

**Constraints**:
- Follow rules/tauri.md guidelines
- Return `Result<T, String>` for commands
- Use tauri::State for shared resources
- Emit events for frontend communication
- Never block main thread (use async)
- Keep React-Tauri bridging in @tauri-apps/api

**Quality gates**:
- `cargo check` passes without errors
- Rust analyzer diagnostics clean
- IPC communication tested end-to-end
- Permissions configured correctly
- Cross-platform compatibility maintained

## qa-guardian Delegation Template

**When to use**: Testing, review, debugging, validation

**Context to include**:
- Code files or directories to review
- Testing framework (Jest, Pest, cargo test)
- Security requirements
- Review focus areas

**Task description**:
[QA/testing task]

**Constraints**:
- Verify, not speculate
- Execute tests, don't just review
- Scan for secrets/vulnerabilities
- Flag duplicate/redundant code
- Never expose secrets in code

**Quality gates**:
- All tests pass
- No critical vulnerabilities
- Code coverage maintained
- Linting passes
- No security issues

## devops-engineer Delegation Template

**When to use**: Infrastructure, deployment, MCP integration

**Context to include**:
- Operation type (build, deploy, backup, MCP)
- Target system or service
- Safety requirements
- Environment context

**Task description**:
[DevOps operational task]

**Constraints**:
- Use bash with safety checks
- Avoid destructive commands
- Handle db:init, clean, process:check
- Validate MCP server availability

**Quality gates**:
- Commands execute without errors
- System remains stable
- Logs captured for debugging
- Rollback plan available for failures

## Best Practices for Delegation

### Context Compression Rules

1. Prioritize recent decisions over history
2. Include file paths, not file contents
3. Summarize constraints in bullet points
4. Keep total context under 1000 tokens

### Token Budget Allocation

- Orchestrator reserves: 8192 tokens
- Delegation context: ~1000 tokens
- Agent task: ~2000 tokens
- Response buffer: ~5000 tokens

### Error Handling

If agent fails:

1. Check error type (compilation, logic, permission)
2. Provide specific context for retry
3. Consider alternative agent if systematic failure
4. Document failure in session state

### Delegation Pattern Examples

#### Example 1: Core Factory Task
```
CONTEXT: Previous analysis shows auth module needs JWT refresh
FILES: src/auth/refresh.ts exists
CONSTRAINTS: Follow rules/auth.md, maintain backwards compatibility

TASK: Implement token refresh endpoint
CONSTRAINTS: Auto-format, check redundant imports
QUALITY: npm run lint passes
```

#### Example 2: Frontend UI Task
```
CONTEXT: Dashboard needs new chart component
EXISTING: Chart components in src/components/charts/
DESIGN: Use shadcn/ui design system

TASK: Create sales trend chart component
CONSTRAINTS: Mobile-first, WCAG AA, touch 48px
QUALITY: Reuse existing ChartWrapper, passes a11y audit
```

#### Example 3: Laravel Feature Task
```
CONTEXT: Blog module needs commenting system
MODELS: BlogPost exists with relationships

TASK: Implement Comment model with Livewire form
CONSTRAINTS: Pest tests, JSON:API resource, PHP 8.3 attributes
QUALITY: php artisan pint passes, tests green
```

### Tool Requirements by Agent

#### Must Have for All Agents:
- `task` - For spawning subagents
- `brain_diagnostic` - Health check
- `brain_search` - Semantic discovery

#### Agent-Specific Tools:

**core-factory**: read, write, edit, bash, lsp, grep, glob
**frontend-ui-ux**: read, write, edit, bash, lsp, skill, context7
**backend-api**: read, write, edit, bash, lsp, context7
**backend-laravel**: read, write, edit, bash, lsp, skill
**backend-tauri**: read, write, edit, bash, lsp, context7
**qa-guardian**: read, bash, lsp, skill, grep, glob
**devops-engineer**: read, write, edit, bash, skill

### Parallel Execution Guidelines

Agents should use `task` tool for:
- Independent file modifications
- Multiple component implementations
- Parallel test executions
- Separate feature branches

Maximum parallel tasks: 5 agents
Wait time between batch checks: 2000ms
