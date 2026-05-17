# Context Engineering — Auto-Fetch Package Documentation

## Trigger

When you encounter a package reference you don't have full context for:

| Pattern                                          | Example                                                  | Registry  |
| ------------------------------------------------ | -------------------------------------------------------- | --------- |
| `import X from 'pkg'` / `require('pkg')`         | `import { useQuery } from '@tanstack/react-query'`       | npm       |
| `cargo add pkg` / `use pkg::`                    | `use serde_json::Value;`                                 | crates.io |
| `composer require vendor/pkg` / `use Vendor\Pkg` | `use Spatie\MediaLibrary\MediaCollections\Models\Media;` | Packagist |
| `npm install pkg`                                | `npm install zod`                                        | npm       |
| `pub use pkg` / `pub mod`                        | `pub use tokio::sync::Mutex;`                            | crates.io |

## Workflow

### Step 1: Detect registry type

From the import/require/use pattern, determine which registry:

- `import ... from` or `require(...)` or `npm install` → **npm**
- `use X::Y` or `cargo add` or `pub use` → **crates.io**
- `use Vendor\Package` or `composer require` → **Packagist**

### Step 2: Fetch package metadata via fetch MCP

Use the `fetch` MCP to query the registry API:

**npm:**

```
fetch https://registry.npmjs.org/{package-name}
```

Returns: name, description, version, dependencies, maintainers

**crates.io:**

```
fetch https://crates.io/api/v1/crates/{crate-name}
```

Returns: name, description, max_version, dependencies, documentation URL

**Packagist:**

```
fetch https://repo.packagist.org/p2/{vendor}/{package}.json
```

Returns: name, description, version, type, dependencies

### Step 3: Fetch human-readable docs (if more detail needed)

If the API response isn't enough:

**npm:** `fetch https://www.npmjs.com/package/{package}` or docs link from metadata
**Rust:** `fetch https://docs.rs/{crate}/{version}` or the documentation URL from crates.io response
**Laravel:** `fetch https://packagist.org/packages/{vendor}/{package}` or check context7

### Step 4: Fallback to context7

For well-known libraries, context7 may have pre-indexed docs:

```
context7_resolve-library-id({ "library": "vendor/package" })
context7_query-docs({ "libraryId": "<id>", "query": "<what you need>" })
```

### Step 5: Brain Integration

The Brain plugin (`brain.ts`) **automatically** performs steps 1-4 via its context fallback chain:

- When code search returns < 3 chunks, Brain calls `context7` and registry APIs
- Results are cached in `docs-store.ts` (in-memory, 50-entry LRU) and injected into the user message
- You can view cached docs with `brain_docs_cache` tool
- Observability is handled by `learn/tracer.ts` — use `brain_status` or `brain_metrics` for pipeline analytics

So you typically don't need to fetch docs manually — the Brain does it. Use `brain_docs_cache` to check what's been fetched.

## Step 6: Cache and proceed

Keep the fetched info in your working context. You don't need to re-fetch if you already looked it up this session.

## When NOT to fetch

- Well-known stdlib packages (`react`, `vue`, `laravel/framework`, `serde`, `tokio`)
- Packages already documented in `rules/laravel.md` or `rules/react.md`
- You already fetched it this session
- The package name is clearly a local module (starts with `./`, `../`, or matches a project namespace)

## Package-to-context7 mapping (from rules)

| File               | Libraries                                                                                                         |
| ------------------ | ----------------------------------------------------------------------------------------------------------------- |
| `rules/laravel.md` | laravel/laravel, php/php-src, livewire/livewire, filamentphp/filament, pestphp/pest, laravel/ai                   |
| `rules/react.md`   | facebook/react, microsoft/typescript, solidjs/solid, tailwindlabs/tailwindcss, vitejs/vite, @tanstack/react-query |
