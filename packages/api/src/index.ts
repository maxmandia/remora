import { getSessionFromHeaders } from '@remora/auth'
import { initTRPC } from '@trpc/server'
import type { CreateFastifyContextOptions } from '@trpc/server/adapters/fastify'
import { TRPCError } from '@trpc/server'

export const createTRPCContext = async ({ req }: CreateFastifyContextOptions) => {
  const session = await getSessionFromHeaders(req.headers)

  return {
    session: session?.session ?? null,
    user: session?.user ?? null,
  }
}

const t = initTRPC.context<Awaited<ReturnType<typeof createTRPCContext>>>().create()

export const publicProcedure = t.procedure

export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.session || !ctx.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED' })
  }

  return next({
    ctx: {
      session: ctx.session,
      user: ctx.user,
    },
  })
})

export const appRouter = t.router({
  system: t.router({
    ping: publicProcedure.query(() => ({
      ok: true,
    })),
  }),
})

export type AppRouter = typeof appRouter
