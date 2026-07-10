import { creditAutoTopUpSettingsRouter } from "../modules/credit_auto_top_up_settings/credit_auto_top_up_settings.router.ts";
import { creditsRouter } from "../modules/credits/credits.router.ts";
import { generationRouter } from "../modules/generation/generation.router.ts";
import { generationThreadRouter } from "../modules/generation-thread/generation-thread.router.ts";
import { modelRouter } from "../modules/model/model.router.ts";
import { modelRatesRouter } from "../modules/model_rates/model_rates.router.ts";
import { projectRouter } from "../modules/project/project.router.ts";
import { systemRouter } from "../modules/system/system.router.ts";
import { router } from "./init.ts";

export const appRouter = router({
  creditAutoTopUpSettings: creditAutoTopUpSettingsRouter,
  generation: generationRouter,
  generationThread: generationThreadRouter,
  model: modelRouter,
  modelRates: modelRatesRouter,
  project: projectRouter,
  system: systemRouter,
  credits: creditsRouter,
});

export type AppRouter = typeof appRouter;
