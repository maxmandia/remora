import { initTRPC } from '@trpc/server'

export const createTRPCContext = async () => ({})

const t = initTRPC.context<Awaited<ReturnType<typeof createTRPCContext>>>().create()

export const appRouter = t.router({
  system: t.router({
    ping: t.procedure.query(() => ({
      ok: true,
    })),
  }),
})

export type AppRouter = typeof appRouter
