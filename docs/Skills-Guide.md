# 🛠️ Skills Guide

Skills are specialized capabilities registered in `skills/index.json`, with `SKILL.md` as the entry point. Agents load skills automatically based on task context.

---

## 🧐 What is a Skill?

A skill is a directory containing a `SKILL.md` file and optional assets, registered in `skills/index.json`. It provides:

- **Instructions**: How to use specific tools (e.g., `agent-browser`).
- **Best Practices**: Coding standards for a stack (e.g., Laravel 13).
- **Workflows**: Step-by-step guides for common tasks.

---

## 📂 Skill Categories

### 1. **Registered Core Skills (`skills/`, registered in `skills/index.json`)**

These are managed skills with defined agent assignments and triggers:

- **`stack-context`**: Auto-detects Tauri/React/Laravel stack and pulls Context7 docs.
- **`self-improver`**: Engine that helps OpenCode evolve via docs and LSP analysis.
- **`security-review`**: Specialized auditing for secrets and vulnerabilities.
- **`laravel-feature-scaffold`**: Boilerplate generation for Laravel models/controllers/tests.
- **`workflow-manager`**: Qwen-inspired task scheduling for multi-step workflows.
- **`ui-ux-pro-max`**: Premium design standards and HSL palettes for UI work.
- **`agent-browser`**: High-fidelity UI automation via Playwright.

See `skills/index.json` for the full list of 16 registered skills.

### 2. **Community Skills (`skills/`)**

A collection of 40+ community-driven skills (e.g., `qingyan-research`, `xlsx`, `ppt`). See the full list in the [**GLM Skills Catalog**](GLM-Skills-Catalog.md).

---

## 🚀 Using Skills

### Automatic Loading

Skills are loaded automatically when an agent needs them. For example, if you ask the `frontend-ui-ux` agent to "Fix the layout," it will load the `ui-ux-pro-max` skill.

### Explicit Invocation

Delegate to the agent assigned to the skill. For example:

```bash
# Trigger agent-browser skill via qa-debugger agent
Ask qa-debugger to "Open https://example.com and check layout"
```

---

## 🎨 Spotlight: The UI/UX Skill

The `ui-ux-pro-max` skill (`skills/ui-ux-pro-max/SKILL.md`) provides agents with:

- Premium color palettes (HSL-based).
- Modern design patterns (Glassmorphism, Neumorphism).
- Responsive grid systems.

When you use the `frontend-ui-ux` agent, it leverages this skill to ensure your web apps meet premium design standards.

---

## ✍️ Creating a Skill

1. Create a folder in `skills/`.
2. Add a `SKILL.md` entry point with instructions.
3. Register the skill in `skills/index.json` with:
   - Agent assignments
   - Trigger conditions
   - Category and tags

Example `skills/index.json` entry:

```json
{
  "name": "my-custom-skill",
  "displayName": "My Custom Skill",
  "description": "Handles XYZ tasks with precision.",
  "category": "custom",
  "agents": ["core-builder"],
  "entryPoint": "SKILL.md"
}
```

---

> [!TIP]
> Use the `skill-creator` skill (`skills/skill-creator/SKILL.md`) to help draft new skill definitions!
