import type {
  CreateImageGenerationFieldId,
  CreateImageGenerationInput,
  CreateVideoGenerationFieldId,
  CreateVideoGenerationInput,
} from "@remora/domain/generation-submission/dto";
import { defaultRequestedGenerations } from "@remora/domain/generation-submission/dto";
import type { PublishedGenerationModelSummary } from "@remora/domain/generation-model/dto";
import { isPrimitiveSelectValue } from "@remora/utils";

export type GenerationModelSettingsFieldId = Exclude<
  CreateVideoGenerationFieldId | CreateImageGenerationFieldId,
  "prompt"
>;

export type GenerationSettingsFieldId =
  | GenerationModelSettingsFieldId
  | "requestedGenerations";

export const orderedGenerationSettingIds = [
  "requestedGenerations",
  "resolution",
  "aspectRatio",
  "duration",
  "generateAudio",
] as const satisfies readonly GenerationSettingsFieldId[];

type AssertNever<T extends never> = T;

export type AssertGenerationSettingsFieldCoverage = AssertNever<
  Exclude<
    GenerationSettingsFieldId,
    (typeof orderedGenerationSettingIds)[number]
  >
>;

export type VideoGenerationSettingsValue = Pick<
  CreateVideoGenerationInput,
  GenerationSettingsFieldId
> & {
  modelType: "video";
};

export type ImageGenerationSettingsValue = Pick<
  CreateImageGenerationInput,
  Exclude<GenerationSettingsFieldId, "duration" | "generateAudio">
> & {
  modelType: "image";
};

export type GenerationSettingsValue =
  | VideoGenerationSettingsValue
  | ImageGenerationSettingsValue;

export function getDefaultGenerationSettings(
  selectedModel: PublishedGenerationModelSummary | null,
): GenerationSettingsValue | null {
  if (!selectedModel) {
    return null;
  }

  const aspectRatio = getDefaultFieldValue(
    selectedModel,
    "aspectRatio",
    "string",
  );
  const resolution = getDefaultFieldValue(
    selectedModel,
    "resolution",
    "string",
  );

  if (selectedModel.type === "image") {
    if (typeof aspectRatio !== "string" || typeof resolution !== "string") {
      return null;
    }

    return {
      modelType: "image",
      resolution,
      aspectRatio,
      requestedGenerations: defaultRequestedGenerations,
    };
  }

  const duration = getDefaultFieldValue(selectedModel, "duration", "number");
  const generateAudio = getDefaultFieldValue(
    selectedModel,
    "generateAudio",
    "boolean",
  );

  if (
    typeof aspectRatio !== "string" ||
    typeof resolution !== "string" ||
    typeof duration !== "number" ||
    typeof generateAudio !== "boolean"
  ) {
    return null;
  }

  return {
    modelType: "video",
    resolution,
    aspectRatio,
    duration,
    generateAudio,
    requestedGenerations: defaultRequestedGenerations,
  };
}

function getDefaultFieldValue(
  model: PublishedGenerationModelSummary,
  fieldId: GenerationModelSettingsFieldId,
  valueType: "string" | "number" | "boolean",
) {
  const field = model.spec.fields.find((candidate) => candidate.id === fieldId);

  if (!field) {
    return null;
  }

  if (
    isPrimitiveSelectValue(field.defaultValue) &&
    typeof field.defaultValue === valueType
  ) {
    return field.defaultValue;
  }

  return field.options?.find((option) => typeof option.value === valueType)
    ?.value;
}
