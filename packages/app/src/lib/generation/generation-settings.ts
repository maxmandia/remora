import type {
  CreateImageGenerationFieldId,
  CreateImageGenerationInput,
  CreateVideoGenerationFieldId,
  CreateVideoGenerationInput,
  GenerationThreadSubmission,
} from "@remora/domain/generation-submission/dto";
import {
  defaultRequestedGenerations,
  maxRequestedGenerations,
  minRequestedGenerations,
} from "@remora/domain/generation-submission/dto";
import type { PublishedGenerationModelSummary } from "@remora/domain/generation-model/dto";
import {
  isPrimitiveSelectValue,
  isRecord,
  matchesGenerationFieldValueKind,
} from "@remora/utils";

export type GenerationModelSettingsFieldId =
  | Exclude<
      CreateVideoGenerationFieldId | CreateImageGenerationFieldId,
      "prompt"
    >
  | "draft";

export type GenerationSettingsFieldId =
  | GenerationModelSettingsFieldId
  | "requestedGenerations";

export const orderedGenerationSettingIds = [
  "requestedGenerations",
  "draft",
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
  Exclude<GenerationSettingsFieldId, "draft" | "duration" | "generateAudio">
> & {
  modelType: "image";
};

export type GenerationSettingsValue =
  | VideoGenerationSettingsValue
  | ImageGenerationSettingsValue;

export type RestoredGenerationSettings = {
  settings: GenerationSettingsValue;
  wasAdapted: boolean;
};

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
  const draftField = selectedModel.spec.fields.find(
    (field) => field.id === "draft",
  );
  const draft = draftField
    ? getDefaultFieldValue(selectedModel, "draft", "boolean")
    : undefined;

  if (
    typeof aspectRatio !== "string" ||
    typeof resolution !== "string" ||
    typeof duration !== "number" ||
    typeof generateAudio !== "boolean" ||
    (draftField && typeof draft !== "boolean")
  ) {
    return null;
  }

  return {
    modelType: "video",
    resolution,
    aspectRatio,
    duration,
    generateAudio,
    ...(typeof draft === "boolean" ? { draft } : {}),
    requestedGenerations: defaultRequestedGenerations,
  };
}

export function isGenerationSettingsValidForModel(
  selectedModel: PublishedGenerationModelSummary,
  value: unknown,
): value is GenerationSettingsValue {
  if (!isRecord(value) || value.modelType !== selectedModel.type) {
    return false;
  }

  const supportsDraft = selectedModel.spec.fields.some(
    (field) => field.id === "draft",
  );
  const expectedKeys =
    selectedModel.type === "video"
      ? [
          "aspectRatio",
          ...(supportsDraft && Object.hasOwn(value, "draft") ? ["draft"] : []),
          "duration",
          "generateAudio",
          "modelType",
          "requestedGenerations",
          "resolution",
        ]
      : ["aspectRatio", "modelType", "requestedGenerations", "resolution"];

  if (
    Object.keys(value).length !== expectedKeys.length ||
    !expectedKeys.every((key) =>
      Object.prototype.hasOwnProperty.call(value, key),
    )
  ) {
    return false;
  }

  if (
    !Number.isInteger(value.requestedGenerations) ||
    (value.requestedGenerations as number) < minRequestedGenerations ||
    (value.requestedGenerations as number) > maxRequestedGenerations
  ) {
    return false;
  }

  if (
    !isGenerationSettingFieldValueValid(
      selectedModel,
      "aspectRatio",
      value.aspectRatio,
    ) ||
    !isGenerationSettingFieldValueValid(
      selectedModel,
      "resolution",
      value.resolution,
    )
  ) {
    return false;
  }

  if (selectedModel.type === "image") {
    return true;
  }

  return (
    isGenerationSettingFieldValueValid(
      selectedModel,
      "duration",
      value.duration,
    ) &&
    isGenerationSettingFieldValueValid(
      selectedModel,
      "generateAudio",
      value.generateAudio,
    ) &&
    (!supportsDraft ||
      isGenerationSettingFieldValueValid(
        selectedModel,
        "draft",
        value.draft ?? false,
      ))
  );
}

export function restoreGenerationSettingsFromSubmission(
  selectedModel: PublishedGenerationModelSummary,
  submission: GenerationThreadSubmission,
): RestoredGenerationSettings | null {
  if (selectedModel.type !== submission.modelType) {
    return null;
  }

  const defaults = getDefaultGenerationSettings(selectedModel);

  if (!defaults || defaults.modelType !== submission.modelType) {
    return null;
  }

  let wasAdapted = false;
  const requestedGenerations =
    Number.isInteger(submission.requestedGenerations) &&
    submission.requestedGenerations >= minRequestedGenerations &&
    submission.requestedGenerations <= maxRequestedGenerations
      ? submission.requestedGenerations
      : defaults.requestedGenerations;

  if (requestedGenerations !== submission.requestedGenerations) {
    wasAdapted = true;
  }

  const restoreField = <T extends string | number | boolean>(
    fieldId: GenerationModelSettingsFieldId,
    submittedValue: T,
    defaultValue: T,
  ): T => {
    if (
      isGenerationSettingFieldValueValid(selectedModel, fieldId, submittedValue)
    ) {
      return submittedValue;
    }

    wasAdapted = true;
    return defaultValue;
  };

  if (submission.modelType === "image" && defaults.modelType === "image") {
    return {
      settings: {
        modelType: "image",
        requestedGenerations,
        resolution: restoreField(
          "resolution",
          submission.submittedInput.resolution,
          defaults.resolution,
        ),
        aspectRatio: restoreField(
          "aspectRatio",
          submission.submittedInput.aspectRatio,
          defaults.aspectRatio,
        ),
      },
      wasAdapted,
    };
  }

  if (submission.modelType !== "video" || defaults.modelType !== "video") {
    return null;
  }

  const supportsDraft = selectedModel.spec.fields.some(
    (field) => field.id === "draft",
  );
  const submittedDraft = submission.submittedInput.draft;

  if (!supportsDraft && submittedDraft) {
    wasAdapted = true;
  }

  return {
    settings: {
      modelType: "video",
      requestedGenerations,
      resolution: restoreField(
        "resolution",
        submission.submittedInput.resolution,
        defaults.resolution,
      ),
      aspectRatio: restoreField(
        "aspectRatio",
        submission.submittedInput.aspectRatio,
        defaults.aspectRatio,
      ),
      duration: restoreField(
        "duration",
        submission.submittedInput.duration,
        defaults.duration,
      ),
      generateAudio: restoreField(
        "generateAudio",
        submission.submittedInput.generateAudio,
        defaults.generateAudio,
      ),
      ...(supportsDraft
        ? {
            draft: restoreField(
              "draft",
              submittedDraft,
              defaults.draft ?? false,
            ),
          }
        : {}),
    },
    wasAdapted,
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

function isGenerationSettingFieldValueValid(
  model: PublishedGenerationModelSummary,
  fieldId: GenerationModelSettingsFieldId,
  value: unknown,
) {
  const field = model.spec.fields.find((candidate) => candidate.id === fieldId);

  if (!field || !matchesGenerationFieldValueKind(value, field.valueKind)) {
    return false;
  }

  if (
    field.options &&
    !field.options.some((option) => option.value === value)
  ) {
    return false;
  }

  if (typeof value === "number") {
    if (
      (field.valueKind === "integer" && !Number.isInteger(value)) ||
      (field.min !== undefined && value < field.min) ||
      (field.max !== undefined && value > field.max)
    ) {
      return false;
    }
  }

  if (
    typeof value === "string" &&
    ((field.minLength !== undefined && value.length < field.minLength) ||
      (field.maxLength !== undefined && value.length > field.maxLength))
  ) {
    return false;
  }

  return true;
}
