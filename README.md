# Remora

Bare-bones service skeleton for a generative media creation product.

## Services

- `apps/web`: TanStack Start web app on port `3000`
- `apps/desktop`: Electron desktop app with a Vite React renderer
- `apps/backend`: Fastify + tRPC HTTP shell on port `4000`, plus worker health shell on port `4001`
- `packages/env`: shared environment parsing
- `packages/ui`: shared UI primitives, theme CSS, and font assets

## Commands

Local backend development requires `ffmpeg` and `ffprobe` to be installed and
available on `PATH`. Both executables are provided by the FFmpeg package.

```sh
pnpm install
pnpm dev:web
pnpm dev:desktop
pnpm dev:backend
pnpm dev:http
pnpm dev:worker
pnpm package:desktop
pnpm typecheck
```

Copy `.env.example` to `.env` before running database-backed commands.
