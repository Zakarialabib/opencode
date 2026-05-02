# Laravel Boost AI Rules

Laravel Boost provides specialized tools and patterns for AI-driven Laravel development. These rules adapt the official Laravel Boost guidelines for the local OpenCode environment.

## Core Principles

1. **MCP Tool Preference**: Prefer specialized MCP tools over manual shell commands when available (e.g., `database-query`, `database-schema`).
2. **Schema-First**: Always inspect table structure with `database-schema` before writing migrations or models.
3. **Docs-First**: Always use `search-docs` (or `context7`) before making code changes. Use multiple broad, topic-based queries.

## Database & Model Development

- Use `database-query` to run read-only queries for exploration instead of `php artisan tinker`.
- Use `database-schema` to verify column names and types before implementing logic.
- Avoid creating models or deleting data without explicit user approval.
- Prefer factory-driven tests over manual tinkering for data creation.

## Artisan & Command Line

- Use `php artisan route:list` to discover route names and paths. Use filters like `--name`, `--method`, or `--path`.
- Use `php artisan config:show [key]` to inspect configuration instead of searching files manually.
- When running Tinker commands from shell, use single quotes for the command and double quotes for PHP strings:
  `php artisan tinker --execute 'User::where("email", "user@example.com")->first();'`

## UI Development (Tailwind CSS & Livewire 4)

- **Single-File Components**: Prefer Livewire 4 single-file components (`render()` with `BLADE` string) for most UI work.
- **Tailwind Utility First**: Use standard Tailwind CSS utility classes. Avoid custom CSS unless absolutely necessary.
- **Accessibility**: Ensure form fields have appropriate labels and aria attributes.
- **Pint Formatting**: Always ensure PHP code is formatted with Laravel Pint after editing.

## Testing with Pest

- **Test-First**: When implementing business logic, prefer writing a Pest test first.
- **Pest 4.x Syntax**: Use modern Pest 4 features like `describe`, `it`, and `expect`.
- **Database Testing**: Use the `RefreshDatabase` trait for tests that interact with the database.
- **Mocking**: Use `Http::fake()` for external API calls and `Event::fake()` for testing event dispatching.

## Testing & Verification

- Always test interactive states after UI changes.
- Verify mobile responsiveness for all new components.
- Check browser logs/errors after significant changes to Livewire components.
