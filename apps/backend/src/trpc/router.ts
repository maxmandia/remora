import { modelRouter } from '../modules/model/model.router.ts'
import { systemRouter } from '../modules/system/system.router.ts'

import { router } from './init.ts'

export const appRouter = router({
  model: modelRouter,
  system: systemRouter,
})

export type AppRouter = typeof appRouter
