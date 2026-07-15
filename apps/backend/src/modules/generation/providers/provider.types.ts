import type {
  GenerationModelAdapter,
  GenerationModelType,
  GenerationProviderId,
  VideoModelSpec,
} from "../../model/model.types.ts";

export type GenerationProviderModelValidationInput = {
  model: {
    providerId: GenerationProviderId;
    type: GenerationModelType;
  };
  spec: VideoModelSpec;
};

export type GenerationModelAdapterValidationInput =
  GenerationProviderModelValidationInput & {
    adapter: GenerationModelAdapter;
  };

export type GenerationModelAdapterValidator = (
  input: GenerationProviderModelValidationInput,
) => string[];
