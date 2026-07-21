import type {
  GenerationModelAdapter,
  GenerationModelSpec,
  GenerationModelType,
  GenerationProviderId,
} from "../../model/model.types.ts";

export type GenerationProviderModelValidationInput = {
  model: {
    providerId: GenerationProviderId;
    type: GenerationModelType;
  };
  spec: GenerationModelSpec;
};

export type GenerationModelAdapterValidationInput =
  GenerationProviderModelValidationInput & {
    adapter: GenerationModelAdapter;
  };

export type GenerationModelAdapterValidator = (
  input: GenerationProviderModelValidationInput,
) => string[];
