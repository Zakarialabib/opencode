# Backend Laravel Rules

- Follow existing Laravel project conventions before introducing new structure.
- Use Form Request validation and authorization for user input where applicable.
- Keep migrations reversible and review schema changes with `lead-backend`.
- Avoid N+1 queries; eager-load relationships intentionally.
- Add or update Pest/PHPUnit tests for behavior changes.
- Escalate auth, permission, or sensitive-data changes to `lead-security`.
