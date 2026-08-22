import type { GenerationModelAdapter } from "../../model/model.types.ts";
import { validateBflFlux3VideoModel } from "./bfl/bfl.utils.ts";
import { validateBytePlusSeedanceVideoModel } from "./byteplus/byteplus.utils.ts";
import { validateGoogleGeminiInteractionsImageModel } from "./google/google.utils.ts";
import { validateKlingV3TextToVideoModel } from "./kling/kling.utils.ts";
import { validateOpenAIGptImage2Model } from "./openai/openai.utils.ts";
import { validateTripoModel3dModel } from "./tripo/tripo.utils.ts";

import type {
  GenerationModelAdapterValidationInput,
  GenerationModelAdapterValidator,
} from "./provider.types.ts";

const generationModelAdapterValidators = {
  bfl_flux_3_video: validateBflFlux3VideoModel,
  byteplus_seedance_video: validateBytePlusSeedanceVideoModel,
  google_gemini_interactions_image: validateGoogleGeminiInteractionsImageModel,
  kling_v3_text_to_video: validateKlingV3TextToVideoModel,
  openai_gpt_image_2: validateOpenAIGptImage2Model,
  tripo_model3d: validateTripoModel3dModel,
} satisfies Record<GenerationModelAdapter, GenerationModelAdapterValidator>;

export function validateGenerationModelAdapter(
  input: GenerationModelAdapterValidationInput,
): string[] {
  return generationModelAdapterValidators[input.adapter]({
    model: input.model,
    spec: input.spec,
  });
}
