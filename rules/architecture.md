# Architecture Rules

## Principles

1. **Read before design** — Never propose architecture without reading the existing codebase first.
2. **Pattern consistency** — Extend existing patterns rather than introducing new ones. Grep for the pattern before creating.
3. **Dependency direction** — No circular imports. Clean layer boundaries: UI → Services → Data, never reverse.
4. **Simple over clever** — Readability is a feature. Choose the simplest solution that works.
5. **Pragmatic trade-offs** — Every decision is a trade-off. Document the rejected alternatives.

## System Design

- **Stack**: Tauri (Rust) desktop shell + React (TypeScript) frontend + Laravel (PHP) backend
- **Cross-stack**: IPC via Tauri commands (Rust → TypeScript), HTTP API (TypeScript → Laravel)
- **Mobile**: Tauri mobile for Android native, Jetpack Compose UI, Room for local storage
- **Data flow**: Unidirectional where possible. Events propagate up, data flows down.

## Architecture Decision Records

For any significant architectural decision (involving trade-offs, cost, or future impact):

1. Create an ADR in `docs/adr/YYYY-MM-DD-title.md`
2. Format: Context → Decision → Consequences → Alternatives
3. Reference the ADR in code comments for future maintainers

## Code Organization

- **Feature-first** grouping (not technical-layer grouping)
- Each feature module owns: routes, controllers, services, tests
- Shared utilities go in `lib/` or `app/Support/`
- Configuration files are not code — keep them at root level

## API Design

- RESTful endpoints with JSON:API responses
- Input validation on every endpoint (FormRequest for Laravel, zod for TypeScript)
- Proper HTTP status codes (201 create, 204 delete, 422 validation)
- Version API routes: `/api/v1/...`
