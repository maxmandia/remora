import { validateGenerationAttachmentMediaRules } from "@remora/domain/generation-attachment-media/validator";
import type {
  PublishedGenerationModelSummary,
  AttachmentMediaRole,
  VideoAttachmentMediaFieldSpec,
} from "@remora/backend/types";

import { getFileExtension } from "../image.ts";

export const attachmentMediaFieldIds = ["images", "videos", "audios"] as const;

export type AttachmentMediaFieldId = (typeof attachmentMediaFieldIds)[number];

export type GenerationAttachmentMediaValue = Record<
  AttachmentMediaFieldId,
  File[]
>;

export type AttachmentMediaFieldSpec = VideoAttachmentMediaFieldSpec & {
  id: AttachmentMediaFieldId;
};

// Broad per-kind accept used as a fallback for fields that do not declare
// mediaConstraints, keeping legacy/non-Seedance specs working.
const attachmentMediaWildcardByFieldId = {
  images: "image/*",
  videos: "video/*",
  audios: "audio/*",
} as const satisfies Record<AttachmentMediaFieldId, string>;

export type AttachmentMediaFileIssue =
  | {
      kind: "unsupportedField";
    }
  | {
      kind: "unsupportedFormat";
    }
  | {
      kind: "audioRequiresVisualAttachment";
    }
  | {
      kind: "fileTooLarge";
      maxBytes: number;
    };

export function createEmptyGenerationAttachmentMediaValue(): GenerationAttachmentMediaValue {
  return {
    images: [],
    videos: [],
    audios: [],
  };
}

export function getGenerationAttachmentMediaFieldSpecs(
  selectedModel: PublishedGenerationModelSummary,
): AttachmentMediaFieldSpec[] {
  return selectedModel.spec.fields.filter(
    (field): field is AttachmentMediaFieldSpec =>
      isAttachmentMediaFieldId(field.id) &&
      field.componentKind === "mediaList" &&
      field.valueKind === "array" &&
      (field.arrayMax === undefined || field.arrayMax > 0),
  );
}

export function getAttachmentMediaRoleCapabilities(
  fieldSpec: AttachmentMediaFieldSpec,
): readonly AttachmentMediaRole[] {
  return fieldSpec.mediaRoleCapabilities;
}

function isAttachmentMediaFieldId(
  fieldId: string,
): fieldId is AttachmentMediaFieldId {
  return (attachmentMediaFieldIds as readonly string[]).includes(fieldId);
}

// Builds the <input accept> string for a media field from its constraints,
// falling back to the broad per-kind wildcard when no constraints are declared.
export function getAttachmentMediaAccept(
  fieldSpec: AttachmentMediaFieldSpec,
): string {
  const constraints = fieldSpec.mediaConstraints;

  if (!constraints) {
    return attachmentMediaWildcardByFieldId[fieldSpec.id];
  }

  return [...constraints.mimeTypes, ...constraints.extensions].join(",");
}

// The format gate: true when the file's extension or MIME matches the field's
// declared constraints. Falls back to MIME-prefix matching for fields without
// constraints so wildcard/legacy specs still route correctly.
export function matchesAttachmentMediaField(
  fieldSpec: AttachmentMediaFieldSpec,
  file: File,
): boolean {
  const constraints = fieldSpec.mediaConstraints;

  if (!constraints) {
    return matchesAttachmentMediaWildcard(fieldSpec.id, file);
  }

  const extension = getFileExtension(file.name);

  if (extension && constraints.extensions.includes(extension)) {
    return true;
  }

  return file.type !== "" && constraints.mimeTypes.includes(file.type);
}

function matchesAttachmentMediaWildcard(
  fieldId: AttachmentMediaFieldId,
  file: File,
): boolean {
  switch (fieldId) {
    case "images":
      return file.type.startsWith("image/");
    case "videos":
      return file.type.startsWith("video/");
    case "audios":
      return file.type.startsWith("audio/");
  }
}

// Spec-driven routing: returns the id of the first field whose constraints the
// file matches, or null when no field accepts it (wrong format → gated out).
export function getAttachmentMediaFieldIdForFile(
  file: File,
  fieldSpecs: AttachmentMediaFieldSpec[],
): AttachmentMediaFieldId | null {
  const match = fieldSpecs.find((fieldSpec) =>
    matchesAttachmentMediaField(fieldSpec, file),
  );

  return match?.id ?? null;
}

// Physical-property issues for a file already routed into a field. Format is not
// re-checked here (it is enforced upstream by routing). This pass validates file
// size; dimensions/duration/fps need async decode and are handled in a later pass.
export function validateAttachmentMediaFile(
  fieldSpec: AttachmentMediaFieldSpec,
  file: File,
): AttachmentMediaFileIssue[] {
  const issues: AttachmentMediaFileIssue[] = [];

  if (!matchesAttachmentMediaField(fieldSpec, file)) {
    issues.push({ kind: "unsupportedFormat" });
  }

  const constraints = fieldSpec.mediaConstraints;

  if (!constraints) {
    return issues;
  }

  if (
    constraints.maxFileSizeBytes !== undefined &&
    file.size > constraints.maxFileSizeBytes
  ) {
    issues.push({
      kind: "fileTooLarge",
      maxBytes: constraints.maxFileSizeBytes,
    });
  }

  return issues;
}

export function validateAttachmentMediaSelection(
  fieldId: AttachmentMediaFieldId,
  value: GenerationAttachmentMediaValue,
  selectedModel: PublishedGenerationModelSummary,
): AttachmentMediaFileIssue[] {
  return validateGenerationAttachmentMediaRules({
    attachmentMedia: value,
    validationRules: selectedModel.spec.validationRules,
  })
    .filter((issue) => issue.fieldId === fieldId)
    .map((issue) => {
      switch (issue.kind) {
        case "audioRequiresVisualAttachment":
          return { kind: "audioRequiresVisualAttachment" };
      }
    });
}

export function hasGenerationAttachmentMediaValidationIssues(
  selectedModel: PublishedGenerationModelSummary,
  value: GenerationAttachmentMediaValue,
) {
  const fieldSpecs = getGenerationAttachmentMediaFieldSpecs(selectedModel);
  const fieldSpecById = new Map(
    fieldSpecs.map((fieldSpec) => [fieldSpec.id, fieldSpec]),
  );

  return attachmentMediaFieldIds.some((fieldId) => {
    const files = value[fieldId];

    if (files.length === 0) {
      return false;
    }

    const fieldSpec = fieldSpecById.get(fieldId);

    if (!fieldSpec) {
      return true;
    }

    return files.some(
      (file) =>
        validateAttachmentMediaFile(fieldSpec, file).length > 0 ||
        validateAttachmentMediaSelection(fieldId, value, selectedModel).length >
          0,
    );
  });
}

// Human-readable copy for a validation issue, shown in the preview tooltip.
export function describeAttachmentMediaFileIssue(
  issue: AttachmentMediaFileIssue,
): string {
  switch (issue.kind) {
    case "unsupportedField":
      return "This model does not support this attachment type.";
    case "unsupportedFormat":
      return "This file format is not supported by the selected model.";
    case "audioRequiresVisualAttachment":
      return "Audio attachments need an image or video attachment.";
    case "fileTooLarge":
      return `File is too large (max ${formatFileSize(issue.maxBytes)}).`;
  }
}

function formatFileSize(bytes: number): string {
  const megabytes = bytes / 1_048_576;
  const rounded = Number.isInteger(megabytes)
    ? megabytes
    : Math.round(megabytes * 10) / 10;

  return `${rounded} MB`;
}
