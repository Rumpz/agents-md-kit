---
name: react-principles
description: Principles and practices for writing React: SOLID, DRY/KISS/YAGNI, Hooks, state, effects, TypeScript and testing. Use when creating, refactoring or reviewing React components, Hooks, props or frontend structure.
---

# React Principles

Three parts: Part 1 structures components (SOLID), Part 2 keeps them simple (DRY, KISS, YAGNI), Part 3 covers everyday React practice. When Part 1 and Part 2 pull in different directions, choose the simpler solution that meets today's concrete requirements.

## Part 1: SOLID Principles

Use these principles to keep components small, composable and testable. When writing or reviewing React code, check each principle below. Apply them with judgment: a principle is a guide to better structure, not a reason to over-engineer (see Part 2, especially KISS and YAGNI).

### 1. Single Responsibility Principle (SRP)

**Rule:** A component or Hook has one reason to change.

**Do**
- Split components that fetch data, manage forms and render complex layouts into small UI components plus dedicated custom Hooks.
- Put data fetching, subscriptions and form logic in Hooks (`useUser`, `useCheckoutForm`).
- Keep presentational components free of side effects where possible.

**Don't**
- Build one component that fetches, validates, transforms and renders everything.

```tsx
// Bad: fetching + state + rendering in one component
function UserProfile({ id }) {
  const [user, setUser] = useState(null);
  useEffect(() => { fetch(`/api/users/${id}`).then(r => r.json()).then(setUser); }, [id]);
  return user ? <div>{/* 80 lines of layout */}</div> : <Spinner />;
}

// Good: logic in a Hook, rendering in a UI component
function useUser(id: string) { /* fetching + state */ }
function UserProfile({ id }: { id: string }) {
  const { user, isLoading } = useUser(id);
  return isLoading ? <Spinner /> : <UserCard user={user} />;
}
```

**Smell check:** if you describe the component using "and" ("fetches users and renders the table and handles the form"), split it.

### 2. Open/Closed Principle (OCP)

**Rule:** Components are open for extension but closed for modification. Extend behavior from the outside instead of editing the component's source.

**Do**
- Accept `children`, render props, slots (`header`, `footer`) or `className`/`style` props.
- Use composition (compound components) for variants with different content.

**Don't**
- Add a new boolean flag or `if/else` branch every time a new variation is needed (`isCompact`, `isSpecial`, `showFooterV2`).

```tsx
// Bad: grows a new flag per use case
<Card showHeader showFooter isCompact withIcon />

// Good: extend through composition
<Card>
  <Card.Header>Title</Card.Header>
  <Card.Body>...</Card.Body>
  <Card.Footer><Button>Save</Button></Card.Footer>
</Card>
```

### 3. Liskov Substitution Principle (LSP)

**Rule:** A specialized component must be usable anywhere its base component is, without breaking behavior.

**Do**
- When wrapping a native element, extend its props type and forward them (`React.ComponentPropsWithoutRef<'button'>`).
- Forward `ref` (`forwardRef`, or the `ref` prop in React 19+) when the base element supports it.
- Spread remaining props onto the underlying element.

**Don't**
- Swallow or rename standard props (`onClick`, `disabled`, `type`, `aria-*`).
- Change the expected behavior of the base element (e.g. a "button" that ignores `disabled`).

```tsx
type PrimaryButtonProps = React.ComponentPropsWithoutRef<'button'> & {
  tone?: 'default' | 'danger';
};

function PrimaryButton({ tone = 'default', className, ...rest }: PrimaryButtonProps) {
  return <button className={cx('btn-primary', tone, className)} {...rest} />;
}
```

### 4. Interface Segregation Principle (ISP)

**Rule:** Components should not depend on props they do not use. Props are the component's interface; keep it minimal.

**Do**
- Pass only the specific values a component needs.
- Define narrow prop types for each component.

**Don't**
- Pass whole objects (`user`, `order`, `config`) when only a few fields are used.

```tsx
// Bad: depends on a 20-field User type to show an image and a name
<Avatar user={user} />

// Good: depends only on what it renders
<Avatar imageUrl={user.imageUrl} username={user.username} />
```

**Exception:** if a component genuinely represents the whole entity (e.g. `<UserCard user={user} />`), passing the object is fine. Keep that type as narrow as practical (`Pick<User, 'name' | 'imageUrl'>`).

### 5. Dependency Inversion Principle (DIP)

**Rule:** High-level UI components depend on abstractions, not on concrete low-level details such as a specific API client, `fetch`, `localStorage` or an analytics SDK.

**Do**
- Wrap external services in custom Hooks (`useTodos`, `useLocalPreference`) or Context providers.
- Inject dependencies through Context or props so tests can swap in mocks.
- Keep the Hook's returned shape independent of the underlying implementation.

**Don't**
- Call `fetch`, `axios`, `localStorage` or SDK clients directly inside presentational components.

```tsx
// Component depends on an abstraction (the Hook's contract)
function TodoList() {
  const { todos, isLoading } = useTodos();
  ...
}

// Implementation can change (REST, GraphQL, mock) without touching TodoList
function useTodos() { /* uses api client from context */ }
```

### SOLID Review Checklist

Before finishing a React change, confirm:

- [ ] Each component/Hook has one clear reason to change (SRP)
- [ ] New variations are added via `children`/render props/styling props, not new flags (OCP)
- [ ] Wrapper components accept and forward the base element's standard props (LSP)
- [ ] Components receive only the props they use (ISP)
- [ ] External services are behind Hooks or Context, and components are testable with mocks (DIP)

## Part 2: DRY, KISS, YAGNI

These rules keep React code simple and balanced. Use them alongside Part 1 (SOLID). When the two pull in different directions, prefer the simpler solution that meets today's concrete requirements.

### DRY: Don't Repeat Yourself

**Rule:** Extract repeated JSX into reusable components and duplicated stateful logic into custom Hooks.

**Do**
- Extract JSX that appears in several places into one component.
- Move repeated `useState` + `useEffect` patterns into a custom Hook (`useDebounce`, `useToggle`, `useFetch`).
- Share constants, types and validation rules from one place.

**Don't**
- Abstract after the first duplication. Wait until the same code appears about three times (the "rule of three") or the duplication is clearly the same concept.
- Merge code that looks alike but changes for different reasons. A wrong abstraction costs more than duplication.

```tsx
// Duplicated logic in several components
const [open, setOpen] = useState(false);
const toggle = () => setOpen(o => !o);

// Extracted once
function useToggle(initial = false) {
  const [on, setOn] = useState(initial);
  const toggle = useCallback(() => setOn(o => !o), []);
  return [on, toggle] as const;
}
```

### KISS: Keep It Simple, Stupid

**Rule:** Prefer the most straightforward solution that works.

**Do**
- Start with `useState`, `useReducer` and plain prop passing.
- Lift state up before reaching for Context; use Context before reaching for a state library.
- Add a state management library (Redux, Zustand, etc.) only when the app genuinely needs it: many distant components sharing complex state, or heavy cross-cutting updates.
- Write code a new teammate can read top to bottom.

**Don't**
- Introduce global stores, custom abstractions or deep indirection for state that a single component or parent owns.
- Use clever one-liners or patterns that hide intent.

### YAGNI: You Aren't Gonna Need It

**Rule:** Build only what is needed now.

**Do**
- Write the straightforward version first, then measure.
- Add `useMemo`, `useCallback` and `React.memo` only after profiling (React DevTools Profiler) shows a real bottleneck, or when referential stability is required for correctness (e.g. a stable dependency for an effect or a memoized child).
- Add props, config options and abstraction layers when a concrete use case exists.

**Don't**
- Wrap every function in `useCallback` or every value in `useMemo` by default.
- Add "just in case" props, generic wrapper components or plugin systems for imagined future needs.

### Quick Decision Guide

| Situation | Choose |
|---|---|
| Same JSX/logic copied 3+ times for the same reason | Extract (DRY) |
| Two snippets look similar but change for different reasons | Leave duplicated |
| State used by one component or its parent | `useState` / prop passing (KISS) |
| Slow render observed in the profiler | Add memoization (YAGNI satisfied) |
| "We might need this later" | Don't build it yet |

### DRY/KISS/YAGNI Review Checklist

- [ ] Repeated JSX/logic extracted only where it is truly the same concept (DRY)
- [ ] State handled with the simplest tool that fits (KISS)
- [ ] No premature `useMemo`/`useCallback`/abstractions without a measured need (YAGNI)

## Part 3: React Practices

### Hooks
- Call Hooks only at the top level of components and custom Hooks, never inside conditions, loops or nested functions. Custom Hooks start with `use`.
- Keep the `react-hooks/exhaustive-deps` lint rule on. Fix dependency arrays instead of suppressing the warning.

### State
- Keep state as local as possible. Lift it up only when siblings need it.
- Don't store derived data in state. Compute it during render.
- Server data: use a data-fetching library (TanStack Query, SWR, framework loaders) instead of hand-rolled `useEffect` + `useState`. Always handle loading, error and empty states.
- Use `useReducer` for related transitions. Replace piles of boolean flags with a status union (`'idle' | 'loading' | 'success' | 'error'`).
- Never mutate state or props. Create new objects and arrays.
- Large forms: use a form library (React Hook Form) and validate with the same schema as the backend where possible.

### Effects
- Effects synchronize with external systems (subscriptions, timers, DOM APIs). They are not for transforming data, handling events (use handlers) or resetting state on prop change (use `key`).
- Always clean up subscriptions, timers, listeners and in-flight requests (`AbortController`). Effects must survive Strict Mode's double invocation.

### Rendering and Keys
- Render is pure: no side effects, no randomness, no mutation.
- Stable, unique `key` for list items. Don't use the array index for lists that reorder or change.
- Never define a component inside another component.
- Code-split routes (`React.lazy` + `Suspense`), virtualize very long lists, and measure before memoizing (YAGNI).

### TypeScript
- Use `strict` mode. Type props explicitly, avoid `any`, and model variants with discriminated unions.
- Wrapper components extend native props (`React.ComponentPropsWithoutRef<'button'>`).
- Prefer `unknown` over `any` for untrusted data, then narrow it. Parse API responses with a schema (Zod) at the boundary.

### Structure and Naming
- Organize by feature and colocate the component, hooks, styles and tests. Components are PascalCase, Hooks are `useX`, and each file has one main component.
- Use barrel files sparingly. They hurt tree-shaking and create import cycles.

### Accessibility, SEO and Security
- Follow `html-syntax-and-semantics`. Keep `eslint-plugin-jsx-a11y` enabled. Public pages use SSR/SSG per `seo-best-practices`.
- Never render unsanitized HTML with `dangerouslySetInnerHTML`. Validate URLs placed in `href`/`src` (block `javascript:`). Anything in a client bundle is public (`VITE_*`, `NEXT_PUBLIC_*`), so never put secrets there. See `backend-security`.

### Testing
- Vitest or Jest with React Testing Library: query by role, label and text, and test behavior, not implementation details.
- Mock the network with MSW. Test Hooks through components or `renderHook`. Add axe checks for accessibility.
- Playwright for a few critical end-to-end flows.

### React Practices Checklist
- [ ] Hooks rules and exhaustive-deps satisfied; effects clean up
- [ ] No derived state; server data handled by a data library with loading/error/empty states
- [ ] Stable keys; no components defined inside components
- [ ] Strict TypeScript, no `any`, narrow prop types
- [ ] Tests assert user-visible behavior; a11y lint and axe pass
