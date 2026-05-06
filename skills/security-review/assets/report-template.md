# Security Review Report: [Feature/Phase Name]

## Executive Summary

[One-paragraph overview of the security posture of the reviewed code. State clearly if the code is SAFE to merge or if BLOCKING vulnerabilities were found.]

## Scope of Review

- Files Analyzed: [List of files]
- Primary Domains: [e.g., Systems IPC, Backend API]

## Key Findings

### 🔴 Critical (Blockers)

- **[Finding Title]**: [Brief description]
  - **Location**: `[file_path]:[line_number]`
  - **Risk**: [Why this matters]
  - **Recommended Fix**: [Conceptual algorithm for the fix]

### 🟡 Moderate (Warnings)

- **[Finding Title]**: [Brief description]
  - **Location**: `[file_path]:[line_number]`
  - **Risk**: [Why this matters]
  - **Recommended Fix**: [Conceptual algorithm for the fix]

### 🟢 Safe Patterns Observed

- [Note any good security practices implemented, e.g., "Proper use of API Policies for access control."]

## Recommendations

1. [Actionable next step for the Build Agent]
2. [Actionable next step for the Architect]
