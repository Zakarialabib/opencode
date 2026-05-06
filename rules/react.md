# React (TypeScript) Stack Rules

## Context7 Documentation Sources

When working on React/TypeScript frontend, always pull docs from:

- **react** → `facebook/react` (v18+)
- **typescript** → `microsoft/typescript`
- **solid-js** → `solidjs/solid` (if using SolidJS instead)
- **tailwindcss** → `tailwindlabs/tailwindcss` (v3+)
- **vite** → `vitejs/vite` (if using Vite)
- **tanstack-query** → `@tanstack/react-query` (if using React Query)

Use Context7 MCP tool: `context7_resolve-library-id` then `context7_query-docs`

## Coding Standards

### TypeScript/React

- Use **TypeScript strict mode**: `"strict": true` in `tsconfig.json`
- **Functional components** only (no class components)
- **Hooks** over HOCs or render props
- **Named exports** preferred over default exports
- Use **interface** for object shapes, **type** for unions/complex types

### Component Structure

```tsx
interface ButtonProps {
  variant: "primary" | "secondary";
  onClick: () => void;
  children: React.ReactNode;
}

export function Button({ variant, onClick, children }: ButtonProps) {
  return (
    <button className={`btn-${variant}`} onClick={onClick}>
      {children}
    </button>
  );
}
```

### Best Practices

- **Memoization**: Use `React.memo`, `useMemo`, `useCallback` for expensive operations
- **State**: Local state with `useState`, global with context/query, avoid prop drilling
- **Effects**: Always include dependency array; avoid `exhaustive-deps` warnings
- **Keys**: Use stable IDs, never array index
- **Error boundaries**: Wrap risky components

## Tools & Commands

| Tool           | Command                          | Purpose            |
| -------------- | -------------------------------- | ------------------ |
| **biome**      | `npx biome format --write $FILE` | Format TS/JS files |
| **typescript** | `npx tsc --noEmit`               | Type checking      |
| **eslint**     | `npx eslint .`                   | Lint JS/TS files   |
| **vite**       | `npx vite`                       | Dev server         |

## Project Structure (SolidJS/Tauri Frontend)

```
src/
├── components/      # Reusable UI components
├── pages/           # Route-level components
├── hooks/           # Custom React/Solid hooks
├── stores/          # State management
├── utils/           # Utility functions
├── types/           # TypeScript type definitions
└── main.tsx         # Entry point
```

## Common Patterns

```typescript
// Custom hook
function useLocalStorage<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : initial;
  });

  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(value));
  }, [key, value]);

  return [value, setValue] as const;
}

// API call with React Query
const { data, error, isLoading } = useQuery({
  queryKey: ["screens"],
  queryFn: () => fetch("/api/screens").then((r) => r.json()),
});
```

## When to Use This Stack

- Building UI components
- Frontend state management
- API integration
- Responsive layouts with Tailwind
