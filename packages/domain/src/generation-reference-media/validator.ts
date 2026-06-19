import type { GenerationValidationRule } from "../generation-model/validation-rules.ts";

export type GenerationReferenceMediaRuleValue = {
  images: readonly unknown[];
  videos: readonly unknown[];
  audios: readonly unknown[];
};

export type GenerationReferenceMediaRuleIssue = {
  kind: "audioRequiresVisualReference";
  fieldId: "audios";
};

type ReferenceMediaRuleHandler = (
  referenceMedia: GenerationReferenceMediaRuleValue,
) => GenerationReferenceMediaRuleIssue[];

const referenceMediaRuleHandlers = {
  seedance20ContentRules: (referenceMedia) => {
    if (
      referenceMedia.audios.length > 0 &&
      referenceMedia.images.length === 0 &&
      referenceMedia.videos.length === 0
    ) {
      return [
        {
          kind: "audioRequiresVisualReference",
          fieldId: "audios",
        },
      ];
    }

    return [];
  },
  klingTextToVideoRules: () => [],
} satisfies Record<GenerationValidationRule, ReferenceMediaRuleHandler>;

export function validateGenerationReferenceMediaRules({
  referenceMedia,
  validationRules,
}: {
  referenceMedia: GenerationReferenceMediaRuleValue;
  validationRules: readonly GenerationValidationRule[];
}): GenerationReferenceMediaRuleIssue[] {
  return validationRules.flatMap((rule) =>
    referenceMediaRuleHandlers[rule](referenceMedia),
  );
}
