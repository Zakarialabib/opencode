# Contributing to OpenCode

Thank you for considering contributing to OpenCode! This document provides guidelines and instructions for contributing to this project.

---

## Quick Start

### Prerequisites

- Node.js 18+ with npm
- Python 3.8+ (for Python components)
- Git
- Basic understanding of AI agent systems

### Setting Up Development Environment

1. **Fork the repository**

   ```bash
   git clone https://github.com/YOUR_USERNAME/opencode.git
   cd opencode
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Set up configuration**

   ```bash
   cp .env.example .env
   ```

4. **Run tests**

   ```bash
   npm test
   ```

5. **Start development**
   ```bash
   npm start
   ```

---

## Code Style Guidelines

### JavaScript/TypeScript

- Use **Biome** for formatting: `npm run lint:biome`
- Use **Prettier** for additional formatting: `npm run lint:prettier`
- Run both linters before committing: `npm run lint`

### Python

- Follow PEP 8 style guide
- Use type hints for function signatures
- Keep functions focused and small

### General

- Write meaningful commit messages following conventional commits
- Keep lines under 100 characters where possible
- Use descriptive variable and function names
- Add comments for complex logic
- Avoid commented-out code

---

## Git Workflow

### Branching Strategy

- `master` — stable, released code
- `feature/*` — new features (branch from master)
- `fix/*` — bug fixes (branch from master)
- `docs/*` — documentation only changes

### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

[optional body]
[optional footer]
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`, `ci`

Examples:

- `feat(agent): add infrastructure agent type`
- `fix(plugin): resolve MCP server crash on disconnect`
- `docs: add CONTRIBUTING.md`

---

## Pull Request Process

1. **Create an issue** first for significant changes
2. **Fork and branch** from `master`
3. **Make your changes** with clear commit messages
4. **Write or update tests** as needed
5. **Run all checks**: `npm run check-all`
6. **Update documentation** if your changes affect usage
7. **Submit a PR** with a clear description of changes

### PR Requirements

- All checks must pass (lint, test, type-check, config-validate)
- Tests must cover new functionality
- Documentation must be updated
- No hardcoded platform-specific paths
- Must work cross-platform (Windows, macOS, Linux)

### Review Process

- At least one maintainer review required
- Address all review comments
- Squash commits before merge
- Use merge commit (not rebase) for feature branches

---

## Testing Requirements

- Write unit tests for new plugins, agents, and utilities
- Write integration tests for workflows and cross-component interactions
- Maintain minimum **70% coverage** for critical components
- Run full test suite before submitting PR: `npm test`

---

## Adding a New Skill

1. Create `skills/your-skill/` directory
2. Add `SKILL.md` with:
   - Purpose and description
   - Dependencies and requirements
   - Usage examples
   - Expected outputs
3. Register in `skills/index.json`
4. Add tests in `skills/your-skill/tests/`

---

## Adding a New Plugin

1. Create plugin file in `plugins/` directory
2. Implement the standard plugin interface
3. Register in `opencode.json` under the `plugin` array
4. Add tests in `plugins/__tests__/`
5. Document configuration options

---

## Adding a New Agent

1. Create agent definition in `agents/` directory
2. Configure in `opencode.json` under the `agents` section
3. Add routing pattern in `plugins/agent-router.ts` if needed
4. Document capabilities and usage

---

## Adding a New Workflow

1. Create workflow YAML in `workflows/` directory
2. Validate with `npm run config:validate`
3. Test with sample feature or bug fix scenarios
4. Document in `docs/Workflows-Guide.md`

---

## Documentation

- Update relevant `docs/` files when changing behavior
- Keep the README up to date with features
- Add JSDoc/Python docstrings for new public APIs
- Update `CHANGELOG.md` with notable changes

---

## Questions?

- Open a [GitHub Discussion](https://github.com/Zakarialabib/opencode/discussions)
- Check existing issues and documentation
- Ask in the community channels
