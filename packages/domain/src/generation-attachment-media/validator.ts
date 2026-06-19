import type { GenerationValidationRule } from "../generation-model/validation-rules.ts";

export type GenerationAttachmentMediaRuleValue = {
  images: readonly unknown[];
  videos: readonly unknown[];
  audios: readonly unknown[];
};

export type GenerationAttachmentMediaRuleIssue = {
  kind: "audioRequiresVisualAttachment";
  fieldId: "audios";
};

type AttachmentMediaRuleHandler = (
  attachmentMedia: GenerationAttachmentMediaRuleValue,
) => GenerationAttachmentMediaRuleIssue[];

const attachmentMediaRuleHandlers = {
  seedance20ContentRules: (attachmentMedia) => {
    if (
      attachmentMedia.audios.length > 0 &&
      attachmentMedia.images.length === 0 &&
      attachmentMedia.videos.length === 0
    ) {
      return [
        {
          kind: "audioRequiresVisualAttachment",
          fieldId: "audios",
        },
      ];
    }

    return [];
  },
  klingTextToVideoRules: () => [],
} satisfies Record<GenerationValidationRule, AttachmentMediaRuleHandler>;

export function validateGenerationAttachmentMediaRules({
  attachmentMedia,
  validationRules,
}: {
  attachmentMedia: GenerationAttachmentMediaRuleValue;
  validationRules: readonly GenerationValidationRule[];
}): GenerationAttachmentMediaRuleIssue[] {
  return validationRules.flatMap((rule) =>
    attachmentMediaRuleHandlers[rule](attachmentMedia),
  );
}
