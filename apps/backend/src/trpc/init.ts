import { initTRPC } from '@trpc/server'

import type { TRPCContext } from './context.ts'

export const t = initTRPC.context<TRPCContext>().create()
export const router = t.router
