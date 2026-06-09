import { generationRouter } from "../modules/generation/generation.router.ts";
import { modelRouter } from "../modules/model/model.router.ts";
import { systemRouter } from "../modules/system/system.router.ts";

import { router } from "./init.ts";

export const appRouter = router({
  generation: generationRouter,
  model: modelRouter,
  system: systemRouter,
});

export type AppRouter = typeof appRouter;
