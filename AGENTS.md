# AGENTS.md

## Task Completion Requirements

- Use `pnpm` for all package operations. The workspace is pinned to `pnpm@10.33.4`; do not add `npm`, `yarn`, or `bun` lockfiles.
- Run `pnpm typecheck` from the repository root before considering code changes complete.
- For web-facing changes, also run the relevant web command: `pnpm --filter @remora/web build` for routing/rendering/build changes and `pnpm --filter @remora/web test` when behavior is covered by tests.
- For database schema changes, run `pnpm db:generate`, inspect the generated Drizzle migration, and keep schema and migration changes together.
- If a task only changes documentation or comments, typecheck/build may be skipped, but call that out in the handoff.

## Project Snapshot

Remora is aiming to become the Linear of generative media creation: a refined, fast, highly engineered workspace for creating image and video assets through multiple model providers.

This repository is still an intentionally bare skeleton. The current shape is TanStack Start for the web app, Fastify plus tRPC for the API shell, Better Auth for authentication, Drizzle for database access, shared environment parsing, and a future worker boundary for orchestration. Keep early changes lean, typed, and biased toward clean service boundaries without adding product behavior before it is needed.

## Core Priorities

1. Product polish with restraint.
2. Type-safe service boundaries.
3. Fast, predictable local development.
4. Reliability before cleverness, especially around auth, generation state, billing, and provider calls.

When tradeoffs are required, choose correctness, debuggability, and clear ownership over short-term convenience.

## Product Direction

Remora should feel like a serious creative workspace, not a demo gallery. UI work should be quiet, dense, responsive, and precise. Avoid marketing-page patterns, oversized hero treatments, ornamental effects, and placeholder product surfaces unless the task explicitly asks for them.

Do not invent image/video generation flows, provider abstractions, asset libraries, billing behavior, or orchestration semantics ahead of the real requirements. If a feature needs those decisions, create the smallest typed seam that lets the next decision land cleanly.

## Maintainability

Long-term maintainability is a core priority. Before adding new behavior, check whether it belongs in an existing package boundary or whether a small shared module would keep logic out of app entrypoints.

Avoid duplicating validation, environment parsing, auth/session access, API contract types, and database shape across packages. Prefer shared typed contracts over parallel local definitions. Keep abstractions boring until repetition proves they are needed.

## Package Roles

- `apps/web`: TanStack Start web app on port `3000`. Owns routing, UI composition, auth client usage, and browser-facing experience.
- `apps/desktop`: Electron desktop app. Owns the primary desktop workspace shell, secure main/preload wiring, and renderer composition.
- `apps/api`: Fastify server on port `4000`. Owns HTTP concerns, CORS, Better Auth routing, health checks, and tRPC adapter registration.
- `apps/worker`: Worker health shell on port `4001`. Reserved for future orchestration/runtime work. Do not move provider orchestration into the web or API app by default.
- `packages/api`: Shared tRPC router, procedures, context creation, and exported `AppRouter` type. Keep API contracts here rather than redefining them in clients.
- `packages/auth`: Better Auth configuration and session helpers. Owns auth setup, trusted origins, adapter wiring, and exported session/user types.
- `packages/db`: Drizzle client, schema, and migrations. Owns database table shape and database exports.
- `packages/env`: Zod-backed environment parsing. Owns environment defaults, coercion, and validation.
- `packages/ui`: Shared UI primitives, theme CSS, and font assets consumed by web and desktop clients.

## Architecture Notes

- Keep app entrypoints thin. `apps/api/src/index.ts` and `apps/worker/src/index.ts` should wire services together; domain logic belongs in shared packages or focused modules.
- Keep `packages/api` as the typed API surface. Add routers and procedures there, then consume the router type from the web instead of hand-writing request/response types.
- Keep authentication centralized in `packages/auth`. Use `getSessionFromHeaders` or a package-level helper instead of reimplementing Better Auth header/session plumbing.
- Keep database access behind `packages/db`. Schema changes belong in `packages/db/src/schema.ts` with generated migrations under `packages/db/drizzle`.
- Keep environment access behind `packages/env`. Do not read raw `process.env` throughout the app except when passing it into a parser.

## Frontend Standards

- Build the actual workspace experience first, not a landing page, unless the task explicitly asks for marketing content.
- Use existing UI primitives and local style conventions before introducing new component systems.
- Favor compact, high-signal interfaces suited to repeated creative work: clear navigation, stable layouts, readable controls, and no decorative clutter.
- Preserve TanStack Router conventions. Route files live in `apps/web/src/routes`; generated route tree changes are expected when routes change.
- Use `lucide-react` icons for icon buttons when an appropriate icon exists.
- Avoid adding visible instructional copy that explains obvious UI behavior. The interface should be discoverable through layout, control choice, labels, and states.

## API, Auth, and Data Conventions

- Public tRPC procedures should be explicit. Use `protectedProcedure` for anything requiring a signed-in user.
- Return typed, structured errors where possible. Avoid leaking provider, auth, or database internals to the browser.
- Treat generation providers and orchestration as unreliable external systems. Future code in this area should assume retries, partial failure, cancellation, and resumability.
- Keep database migrations reviewable. Generated SQL should be small enough to understand in the same change as the schema edit.

## Environment

- Copy `.env.example` to `.env` for local development.
- Default local ports are web `3000`, API `4000`, and worker health `4001`.
- The user will usually already have the relevant `pnpm dev` processes running. Before starting a dev server, check whether the needed local service or Electron window is already up and prefer using that running process for verification.
- Required database/auth values are parsed through `packages/env`; update `.env.example` whenever a new required variable is introduced.
