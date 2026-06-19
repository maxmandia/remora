import { parseGenerationValidationRules } from "@remora/domain/generation-model/validation-rules";

import type { GenerationModelSpec, VideoModelSpec } from "./types.ts";

export function parsePersistedGenerationModelSpec(
  spec: GenerationModelSpec,
): GenerationModelSpec {
  const specType = spec.type;

  switch (specType) {
    case "video":
      return parsePersistedVideoModelSpec(spec);
    default: {
      const exhaustiveType: never = specType;
      throw new Error(
        `Unsupported generation model spec type: ${exhaustiveType}`,
      );
    }
  }
}

export function parsePersistedVideoModelSpec(
  spec: VideoModelSpec,
): VideoModelSpec {
  return {
    ...spec,
    validationRules: parseGenerationValidationRules(spec.validationRules),
  };
}
