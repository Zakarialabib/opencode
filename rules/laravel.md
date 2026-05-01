# Laravel 13 + Livewire 4 Stack Rules

## Context7 Documentation Sources

When working on Laravel/PHP backend, always pull docs from:

- **laravel** → `laravel/laravel` (v13.x - requires PHP 8.3+)
- **php** → `php/php-src` (v8.3+)
- **eloquent** → `laravel/framework` (Eloquent ORM docs)
- **livewire** → `livewire/livewire` (v4.x - single-file components)
- **filament** → `filamentphp/filament` (v3.x+ if using Filament)
- **pest** → `pestphp/pest` (v4.x for testing)
- **laravel-ai** → `laravel/ai` (Laravel 13 AI SDK)

Use Context7 MCP tool: `context7_resolve-library-id` then `context7_query-docs`

## Laravel 13 New Features

- **First-party AI SDK**: Unified API for text generation, tool-calling, embeddings
- **JSON:API Resources**: Native JSON:API compliant responses
- **PHP 8.3 Attributes**: `#[Table]`, `#[Fillable]`, `#[Hidden]` on models
- **Native Vector Search**: `pgvector` support for semantic search
- **Queue Routing**: `Queue::route()` for class-based queue rules
- **Cache::touch()**: Extend TTL without retrieving value
- **Enhanced CSRF**: `PreventRequestForgery` middleware with origin verification

## Livewire 4 New Features

- **Single-file components**: Write PHP, Blade, JS, CSS in one file
- **Parallel live updates**: Requests run in parallel for faster typing
- **wire:transition**: Hardware-accelerated animations via View Transitions API
- **wire:show**: Toggle visibility using CSS
- **wire:text**: Update text content reactively
- **$js actions**: Run client-side only actions
- **Interceptors**: Hook into requests at every level

## Coding Standards

### PHP/Laravel 13

- Follow **PSR-12** coding standard
- Use **PHP 8.3+ features**: Readonly classes, typed class constants, `#[Override]` attribute
- Use **strict types**: `declare(strict_types=1);` at top of every file
- **PHP Attributes** over class properties for model configuration:

  ```php
  use Illuminate\Database\Eloquent\Attributes\Table;
  use Illuminate\Database\Eloquent\Attributes\Fillable;

  #[Table('blog_posts')]
  class BlogPost extends Model
  {
      #[Fillable(['title', 'content', 'user_id'])]
      // ...
  }
  ```

- **Named routes** over hardcoded URLs
- **Dependency injection** over facades when possible
- **Form Request** classes for validation
- **Policy** classes for authorization
- **API Resources** for JSON responses (use JSON:API resources in Laravel 13)

### Naming Conventions

| Element             | Convention              | Example                                |
| ------------------- | ----------------------- | -------------------------------------- |
| Models              | PascalCase, singular    | `User`, `BlogPost`                     |
| Tables              | snake_case, plural      | `users`, `blog_posts`                  |
| Controllers         | PascalCase + Controller | `UserController`                       |
| Migrations          | snake_case + timestamp  | `2024_01_01_000000_create_users_table` |
| Routes              | kebab-case              | `/user-profile`                        |
| Livewire Components | PascalCase              | `BlogPostForm`, `UserProfile`          |

## Tools & Commands

| Tool         | Command                        | Purpose                                              |
| ------------ | ------------------------------ | ---------------------------------------------------- |
| **pint**     | `./vendor/bin/pint`            | Laravel's code style fixer (v1.18+)                  |
| **phpstan**  | `./vendor/bin/phpstan analyse` | Static analysis (Level 8 for Laravel 13)             |
| **pest**     | `./vendor/bin/pest`            | Run tests (v4.x for PHPUnit 12 support)              |
| **artisan**  | `php artisan migrate`          | Run migrations                                       |
| **tinker**   | `php artisan tinker`           | REPL for testing                                     |
| **livewire** | `php artisan make:livewire`    | Create Livewire components (v4 default: single-file) |

## Project Structure (Laravel 13 Minimal)

```
app/
├── Http/
│   ├── Controllers/    # Request handlers
│   ├── Requests/       # Form request validation
│   └── Resources/      # API resources (JSON:API)
├── Models/             # Eloquent models (with PHP 8.3 attributes)
├── Policies/           # Authorization policies
├── Services/           # Business logic
└── Providers/          # Service providers

livewire/               # Livewire single-file components (v4)
├── BlogPostForm.php    # Contains PHP + Blade + JS + CSS
└── UserProfile.php

resources/
└── views/
    └── livewire/       # Traditional Blade views (optional)
```

## Common Patterns

### Eloquent Model with PHP 8.3 Attributes (Laravel 13)

```php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Attributes\Table;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Table('blog_posts')]
class BlogPost extends Model
{
    #[Fillable(['title', 'content', 'user_id'])]

    protected $casts = [
        'published_at' => 'datetime',
        'is_published' => 'boolean',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function comments(): HasMany
    {
        return $this->hasMany(Comment::class);
    }
}
```

### Livewire 4 Single-File Component

```php
namespace App\Livewire;

use Livewire\Component;
use App\Models\BlogPost;

class BlogPostForm extends Component
{
    public $title = '';
    public $content = '';

    public function save()
    {
        $this->validate([
            'title' => 'required|min:3',
            'content' => 'required|min:10',
        ]);

        BlogPost::create([
            'title' => $this->title,
            'content' => $this->content,
            'user_id' => auth()->id(),
        ]);

        $this->reset(['title', 'content']);
        session()->flash('message', 'Post created successfully!');
    }

    public function render()
    {
        return <<<'BLADE'
            <form wire:submit="save">
                <input wire:model="title" type="text" placeholder="Title">
                <textarea wire:model="content" placeholder="Content"></textarea>
                <button type="submit">Save</button>
                @if (session('message'))
                    <div>{{ session('message') }}</div>
                @endif
            </form>
        BLADE;
    }
}
```

### Controller with JSON:API Resource (Laravel 13)

```php
namespace App\Http\Controllers;

use App\Http\Requests\StoreBlogPostRequest;
use App\Http\Resources\BlogPostResource;
use App\Models\BlogPost;

class BlogPostController extends Controller
{
    public function store(StoreBlogPostRequest $request)
    {
        $post = auth()->user()->blogPosts()->create($request->validated());

        return BlogPostResource::make($post)
            ->response()
            ->setStatusCode(201);
    }

    public function index()
    {
        return BlogPostResource::collection(
            BlogPost::with('user')->paginate(15)
        );
    }
}
```

## When to Use This Stack

- Building API endpoints (use JSON:API resources in Laravel 13)
- Database migrations/models with PHP 8.3 attributes
- Authentication/authorization with Policies
- Queue jobs with `Queue::route()` (Laravel 13)
- Real-time features with Livewire 4 + Alpine.js
- AI features with Laravel AI SDK (Laravel 13)
- Semantic search with native vector support (Laravel 13)
- Server-side rendering with Livewire 4 single-file components
