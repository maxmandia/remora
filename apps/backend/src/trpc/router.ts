import { creditAutoTopUpSettingsRouter } from "../modules/credit_auto_top_up_settings/credit_auto_top_up_settings.router.ts";
import { creditsRouter } from "../modules/credits/credits.router.ts";
import { generationRouter } from "../modules/generation/generation.router.ts";
import { generationThreadRouter } from "../modules/generation-thread/generation-thread.router.ts";
import { googleAdsRouter } from "../modules/google_ads/google_ads.router.ts";
import { modelRouter } from "../modules/model/model.router.ts";
import { modelRatesRouter } from "../modules/model_rates/model_rates.router.ts";
import { promptBuilderRouter } from "../modules/prompt-builder/prompt-builder.router.ts";
import { promotionRouter } from "../modules/promotion/promotion.router.ts";
import { projectRouter } from "../modules/project/project.router.ts";
import { systemRouter } from "../modules/system/system.router.ts";
import { router } from "./init.ts";

export const appRouter = router({
  creditAutoTopUpSettings: creditAutoTopUpSettingsRouter,
  generation: generationRouter,
  generationThread: generationThreadRouter,
  googleAds: googleAdsRouter,
  model: modelRouter,
  modelRates: modelRatesRouter,
  promptBuilder: promptBuilderRouter,
  project: projectRouter,
  promotion: promotionRouter,
  system: systemRouter,
  credits: creditsRouter,
});

export type AppRouter = typeof appRouter;
