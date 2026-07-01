# Application Overview

Remora is a desktop application for image & video generation. We are building a tool focused on performance, intuitiveness and stability.

# Codebase Ethos

We do not take shortcuts for the sake of convenience. We operate at the level of a practical staff-level engineer. We fight entropy with every line of code. We leave the codebase better than we found it.

## Style Guide

### Backend Modules

We take EXTREME care of our module code, as we consider it the most sacred part of our codebase. Do not create any new file extensions besides those listed below.

`module.router.ts` files define our API surface and should remain thin entrypoints that validate requests and delegate to services or repositories.
`module.service.ts` files house our business logic. Use when the behavior depends on injected dependencies, config, lifecycle, I/O, caching, or mockable side effects.
`module.repository.ts` files are used solely for database operations and should not be used for business logic.
`module.utils.ts` files belong to functions where the behavior is deterministic from its inputs.
`module.types.ts` files define the types associated with the module that cannot be inferred directly from the db schema.
`module.observability.ts` files define module-specific logging, tracing, telemetry naming, event policy, and observability adapters. Shared runtime setup for logging and tracing belongs in shared observability services.

Service methods should not exist only to pass through to a repository. If a behavior is just a direct database insert, update, or query, put it in the repository and call it from the real service workflow. Services should own orchestration, business rules, provider calls, idempotency, cleanup, and other side effects.

### Tailwind CSS

Instead of storing the tailwind class in a variable, we should use it directly inside a re-usable component.

```jsx
// Good
function Component({ children }) {
  return (
    <div className="bg-primary relative z-10 min-h-28 w-full rounded-lg px-3 py-2">
      {children}
    </div>
  );
}

<Component>
  {/* code here */}
</Component>
<Component>
  {/* code here */}
</Component>

// Bad
const className = "bg-primary relative z-10 min-h-28 w-full rounded-lg px-3 py-2";

<div className={className}>
  <!-- code here -->
</div>
<div className={className}>
  <!-- code here -->
</div>
```

### Drizzle

Prefer Drizzle's relational querying capabilities over doing a manual flat join.

```ts
// Good
const rows = await db.query.project.findMany({
  columns: {
    id: true,
    name: true,
  },
  with: {
    threads: true,
  },
});

// Bad
const rows = await db
  .select()
  .from(schema.project)
  .leftJoin(
    schema.generationThread,
    eq(schema.project.id, schema.generationThread.projectId),
  );
```

### Naming Guidelines

The verbiage we use throughout the codebase is incredibly important for developer clarity. We should aim to keep method and function names pointed and concise.

```ts
// Bad
insertBillingProfileForCreatedStripeCustomer();

// Good
createBillingProfile();
```

## Verification

We should run our tests and typechecker to confirm our changes are valid before returning any confirmation back to the user.
