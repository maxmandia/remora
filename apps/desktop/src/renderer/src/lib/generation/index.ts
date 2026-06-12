import type {
  CreateVideoGenerationFieldId,
  CreateVideoGenerationInput,
  PublishedGenerationModelSummary,
} from "@remora/backend/types";
import { defaultRequestedGenerations } from "@remora/backend/types";
import { isPrimitiveSelectValue } from "@remora/utils";

export type GenerationModelSettingsFieldId = Exclude<
  CreateVideoGenerationFieldId,
  "prompt"
>;

export type GenerationSettingsFieldId =
  | GenerationModelSettingsFieldId
  | "requestedGenerations";

export const orderedGenerationSettingIds = [
  "requestedGenerations",
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

export type GenerationSettingsValue = Pick<
  CreateVideoGenerationInput,
  GenerationSettingsFieldId
>;

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
  const duration = getDefaultFieldValue(selectedModel, "duration", "number");
  const generateAudio = getDefaultFieldValue(
    selectedModel,
    "generateAudio",
    "boolean",
  );

  if (
    typeof aspectRatio !== "string" ||
    typeof duration !== "number" ||
    typeof generateAudio !== "boolean"
  ) {
    return null;
  }

  return {
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
