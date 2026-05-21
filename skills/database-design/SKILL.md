---
name: database-design
description: Database schema design, SQL optimization, and ORM architecture patterns
license: MIT
compatibility: opencode
metadata:
  audience: backend
  workflow: database
---

# Database & Architecture Design Skill

## Description

Inspired by PlanetScale's workflow skills and Spring AI's modularity, this skill equips The Architect and Build agents with deep context regarding the project's database architecture, serverless patterns, and query performance optimizations.

## Triggers

- When the user requests a new feature involving data persistence.
- When creating or modifying Backend Migrations or Database Models.
- When designing offline-first storage mechanisms for the Frontend.

## Instructions

1. **Schema Awareness**: Before proposing a new table or column, use the `sqlite` MCP to query the current `database.sqlite` schema. Do not guess existing structures.
2. **Performance Constraints**:
   - **Backend**: Ensure all new foreign keys are indexed. Avoid N+1 queries by enforcing eager loading in the proposed architecture.
   - **Frontend (Local)**: Favor lightweight, offline-first structures. Document how the local state syncs with the remote Backend DB.
3. **Migration Planning**:
   - Generate database migration files with proper `down()` methods.
   - If a migration modifies existing data, include a strategy for zero-downtime deployment.
4. **Artifact Generation**: Use `assets/schema-proposal.md` to present the architectural changes to the user before implementation.

## Assets

- `assets/schema-proposal.md`: A template for outlining table structures, indexes, and relationships.

## Integration with The Maestro

If the database change spans across the Systems/Frontend boundary (e.g., passing a new JSON payload structure from Backend to Frontend), The Maestro must validate the types in both domains before approving the schema.
