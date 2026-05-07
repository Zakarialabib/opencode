# Pest Testing Skill

Specialized skill for writing and running tests using Pest 4.x.

## Basic Test Pattern

```php
describe('user authentication', function () {
    it('can login with valid credentials', function () {
        $user = User::factory()->create();

        $response = $this->post('/login', [
            'email' => $user->email,
            'password' => 'password',
        ]);

        $response->assertRedirect('/dashboard');
        $this->assertAuthenticatedAs($user);
    });
});
```

## Expectations

```php
expect($user->name)->toBe('John Doe');
expect($response->status())->toBe(200);
expect($posts)->toHaveCount(5);
```

## Architecture Testing

```php
test('models extend eloquent', function () {
    expect('App\Models')
        ->toExtend('Illuminate\Database\Eloquent\Model');
});
```

## Guidelines

- **Use `it()` for descriptions**: Keep descriptions concise and starting with "it".
- **Group tests with `describe()`**: Organize related tests into logical groups.
- **Factory usage**: Always use factories for data creation in tests.
- **Mocking**: Use `Http::fake()` and `Event::fake()` to isolate units.
- **Clean state**: Use the `RefreshDatabase` trait.
