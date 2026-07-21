import type { GenerationModelAdapter } from "../../model/model.types.ts";
import { validateBytePlusSeedanceVideoModel } from "./byteplus/byteplus.utils.ts";
import { validateGoogleGeminiInteractionsImageModel } from "./google/google.utils.ts";
import { validateKlingV3TextToVideoModel } from "./kling/kling.utils.ts";

import type {
  GenerationModelAdapterValidationInput,
  GenerationModelAdapterValidator,
} from "./provider.types.ts";

const generationModelAdapterValidators = {
  byteplus_seedance_video: validateBytePlusSeedanceVideoModel,
  google_gemini_interactions_image: validateGoogleGeminiInteractionsImageModel,
  kling_v3_text_to_video: validateKlingV3TextToVideoModel,
} satisfies Record<GenerationModelAdapter, GenerationModelAdapterValidator>;

export function validateGenerationModelAdapter(
  input: GenerationModelAdapterValidationInput,
): string[] {
  return generationModelAdapterValidators[input.adapter]({
    model: input.model,
    spec: input.spec,
  });
}
