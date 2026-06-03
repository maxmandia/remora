import { systemRouter } from '../modules/system/system.router.ts'

import { router } from './init.ts'

export const appRouter = router({
  system: systemRouter,
})

export type AppRouter = typeof appRouter
