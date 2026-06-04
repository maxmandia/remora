import { modelCatalogRouter } from '../modules/model-catalog/model-catalog.router.ts'
import { systemRouter } from '../modules/system/system.router.ts'

import { router } from './init.ts'

export const appRouter = router({
  modelCatalog: modelCatalogRouter,
  system: systemRouter,
})

export type AppRouter = typeof appRouter
