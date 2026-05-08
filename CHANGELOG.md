# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

---

## [Unreleased]

### Added

- LICENSE file (MIT) for legal clarity
- .env.example with API key configuration template
- tsconfig.json for TypeScript type checking
- CONTRIBUTING.md with contribution guidelines and workflow
- SECURITY.md with vulnerability reporting process
- CODE_OF_CONDUCT.md based on Contributor Covenant
- GitHub issue templates (bug report, feature request, question)
- GitHub pull request template
- CHANGELOG.md for version tracking
- GitHub Actions CI workflow (lint, test, validate, type-check)
- GitHub Actions release workflow
- Vitest configuration for JavaScript/TypeScript testing framework
- `opencode.sh` launcher for Linux/macOS
- `tools/path-resolver.ts` for cross-platform path resolution

### Changed

- `.gitignore` expanded to cover database files, env files, OS files, IDE configs, Python artifacts, logs, and build outputs
- `database.sqlite` removed from git tracking
- `package.json` scripts expanded with test, lint, format, type-check, and validation commands
- `opencode.json` plugin paths converted from absolute to relative for cross-platform compatibility

### Security

- Database file no longer tracked in version control
- Environment variables properly isolated via `.gitignore`
- Plugin and MCP server paths use relative references to prevent path injection
