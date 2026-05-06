# Security Review Skill

## Description

This skill provides a standardized, context-efficient playbook for the Build or Architect agents to perform code security reviews before pushing to the repository. It focuses on identifying vulnerabilities in Systems Code, Backend PHP Framework, and Modern JS Framework specific to the project's Phase constraints.

## Triggers

- When the user runs `/security-review`.
- Automatically invoked by The Maestro before executing a `git commit` or merging a Phase branch.
- When cross-domain bridges (e.g., Systems to JS IPC) are created or modified.

## Instructions

1. **Scope Identification**: Use the `git` MCP to identify all modified files in the current working tree.
2. **Context Loading**: Read the target files. DO NOT load the entire project into context. Only load the diffs and the specific functions being modified.
3. **Vulnerability Scanning**:
   - **Systems Code**: Check for IPC payload validation, command scope restrictions, and memory safety (lifetimes affecting JS reactivity).
   - **Backend Framework**: Check for ORM mass assignment, missing Authorization gates, and raw SQL injections.
   - **Frontend JS**: Check for XSS vulnerabilities in dynamic rendering (`innerHTML`) and improper state mutations.
4. **Report Generation**: Generate a structured report using the template provided in `assets/report-template.md`.

## Assets

- Use `assets/report-template.md` to format your findings. This ensures consistent, machine-readable outputs that the Documentarian can log into the Knowledge Graph.

## Context Efficiency Rule

Do not output raw code fixes in the initial report unless explicitly requested. Provide the vulnerability path and the conceptual fix. Wait for the user to authorize the Build agent to apply the fixes.
