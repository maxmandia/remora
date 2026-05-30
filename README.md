# Remora

Bare-bones service skeleton for a generative media creation product.

## Services

- `apps/web`: TanStack Start web app on port `3000`
- `apps/api`: Fastify + tRPC API shell on port `4000`
- `apps/worker`: worker health shell on port `4001`
- `packages/api`: shared tRPC router and `AppRouter` type
- `packages/db`: shared Drizzle plumbing
- `packages/env`: shared environment parsing

## Commands

```sh
pnpm install
pnpm dev:web
pnpm dev:api
pnpm dev:worker
pnpm typecheck
```

Copy `.env.example` to `.env` before running database-backed commands.
