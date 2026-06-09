# AGENTS.md

## Task Completion Requirements

- Use `pnpm` for all package operations. The workspace is pinned to `pnpm@10.33.4`; do not add `npm`, `yarn`, or `bun` lockfiles.
- Run `pnpm typecheck` from the repository root before considering code changes complete.
- For web-facing changes, also run the relevant web command: `pnpm --filter @remora/web build` for routing/rendering/build changes and `pnpm --filter @remora/web test` when behavior is covered by tests.
- For database schema changes, run `pnpm db:generate`, inspect the generated Drizzle migration, and keep schema and migration changes together.
- If a task only changes documentation or comments, typecheck/build may be skipped, but call that out in the handoff.

## Project Snapshot

Remora is aiming to become the Linear of generative media creation: a refined, fast, highly engineered workspace for creating image and video assets through multiple model providers.

This repository is still an intentionally bare skeleton. The current shape is TanStack Start for the web app, a backend app with Fastify plus tRPC for HTTP, Better Auth for authentication, Drizzle for database access, shared environment parsing, and a future worker boundary for orchestration. Keep early changes lean, typed, and biased toward clean service boundaries without adding product behavior before it is needed.

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
- `apps/backend`: Backend app. Owns HTTP concerns on port `4000`, worker health on port `4001`, CORS, Better Auth routing, tRPC adapter registration, tRPC routers, auth setup, Drizzle client, module-local schemas, and migrations.
- `packages/env`: Zod-backed environment parsing. Owns environment defaults, coercion, and validation.
- `packages/ui`: Shared UI primitives, theme CSS, and font assets consumed by web and desktop clients.

## Architecture Notes

- Keep backend entrypoints thin. `apps/backend/src/http/index.ts` and `apps/backend/src/worker/index.ts` should wire services together; domain logic belongs in backend modules or focused shared packages.
- Keep `apps/backend` as the typed API surface. Add routers and procedures there, then consume exported types from `@remora/backend/types` instead of hand-writing request/response types.
- Keep authentication centralized in `apps/backend/src/modules/auth`. Use `getSessionFromHeaders` or a module-level helper instead of reimplementing Better Auth header/session plumbing.
- Keep database access behind `apps/backend/src/db`. Schema changes belong beside the owning backend module and must be re-exported through `apps/backend/src/db/schema.ts`, with generated migrations under `apps/backend/drizzle`.
- Keep environment access behind `packages/env`. Do not read raw `process.env` throughout the app except when passing it into a parser.
- For new top-level backend module files, only use dotted suffixes for `.service.ts`, `.repository.ts`, `.router.ts`, and `.types.ts`. Avoid adding new top-level files like `.http.ts`, `.callback.ts`, or `.utils.ts`; keep route wiring in routers and private helpers local until repetition proves they need a named module.
- Keep app-level React providers and cross-cutting context in dedicated `providers` directories rather than colocating them with route/page UI components. Routes and pages should compose UI and consume provider hooks, while provider modules own shared state wiring.

## Frontend Standards

- Build the actual workspace experience first, not a landing page, unless the task explicitly asks for marketing content.
- Use existing UI primitives and local style conventions before introducing new component systems.
- Prefer Tailwind utilities for component styling, layout, state variants, and motion whenever they can express the behavior clearly. Avoid adding raw CSS for component-local UI when Tailwind arbitrary values or variants are sufficient; keep raw CSS for global theme tokens, font faces, Electron shell/window behavior, or shared primitives where a stylesheet is meaningfully clearer.
- Favor compact, high-signal interfaces suited to repeated creative work: clear navigation, stable layouts, readable controls, and no decorative clutter.
- Preserve TanStack Router conventions. Route files live in `apps/web/src/routes`; generated route tree changes are expected when routes change.
- In the desktop renderer, keep route components in route-specific files with a `*-route.tsx` suffix. Avoid grouping unrelated routes in vague bucket modules; shared route-only helpers can live beside those route files until they become reusable UI.
- Use `lucide-react` icons for icon buttons when an appropriate icon exists.
- Avoid adding visible instructional copy that explains obvious UI behavior. The interface should be discoverable through layout, control choice, labels, and states.

## API, Auth, and Data Conventions

- Public tRPC procedures should be explicit. Use `protectedProcedure` for anything requiring a signed-in user.
- Return typed, structured errors where possible. Avoid leaking provider, auth, or database internals to the browser.
- Treat generation providers and orchestration as unreliable external systems. Future code in this area should assume retries, partial failure, cancellation, and resumability.
- Keep database migrations reviewable. Generated SQL should be small enough to understand in the same change as the schema edit.

## Environment

- Copy `.env.example` to `.env` for local development.
- Default local ports are web `3000`, backend HTTP `4000`, and backend worker health `4001`.
- The user will usually already have the relevant `pnpm dev` processes running. Before starting a dev server, check whether the needed local service or Electron window is already up and prefer using that running process for verification.
- Required database/auth values are parsed through `packages/env`; update `.env.example` whenever a new required variable is introduced.
