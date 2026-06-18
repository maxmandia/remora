import type {
  PublishedGenerationModelSummary,
  VideoFieldSpec,
} from "@remora/backend/types";

import { getFileExtension } from "../image.ts";

export const referenceMediaFieldIds = ["images", "videos", "audios"] as const;

export type ReferenceMediaFieldId = (typeof referenceMediaFieldIds)[number];

export type GenerationReferenceMediaValue = Record<
  ReferenceMediaFieldId,
  File[]
>;

export type ReferenceMediaFieldSpec = VideoFieldSpec & {
  id: ReferenceMediaFieldId;
  componentKind: "mediaList";
  valueKind: "array";
};

// Broad per-kind accept used as a fallback for fields that do not declare
// mediaConstraints, keeping legacy/non-Seedance specs working.
const referenceMediaWildcardByFieldId = {
  images: "image/*",
  videos: "video/*",
  audios: "audio/*",
} as const satisfies Record<ReferenceMediaFieldId, string>;

export type ReferenceMediaFileIssue =
  | {
      kind: "unsupportedField";
    }
  | {
      kind: "unsupportedFormat";
    }
  | {
      kind: "fileTooLarge";
      maxBytes: number;
    };

export function createEmptyGenerationReferenceMediaValue(): GenerationReferenceMediaValue {
  return {
    images: [],
    videos: [],
    audios: [],
  };
}

export function getGenerationReferenceMediaFieldSpecs(
  selectedModel: PublishedGenerationModelSummary,
): ReferenceMediaFieldSpec[] {
  return selectedModel.spec.fields.filter(
    (field): field is ReferenceMediaFieldSpec =>
      isReferenceMediaFieldId(field.id) &&
      field.componentKind === "mediaList" &&
      field.valueKind === "array" &&
      (field.arrayMax === undefined || field.arrayMax > 0),
  );
}

function isReferenceMediaFieldId(
  fieldId: string,
): fieldId is ReferenceMediaFieldId {
  return (referenceMediaFieldIds as readonly string[]).includes(fieldId);
}

// Builds the <input accept> string for a media field from its constraints,
// falling back to the broad per-kind wildcard when no constraints are declared.
export function getReferenceMediaAccept(
  fieldSpec: ReferenceMediaFieldSpec,
): string {
  const constraints = fieldSpec.mediaConstraints;

  if (!constraints) {
    return referenceMediaWildcardByFieldId[fieldSpec.id];
  }

  return [...constraints.mimeTypes, ...constraints.extensions].join(",");
}

// The format gate: true when the file's extension or MIME matches the field's
// declared constraints. Falls back to MIME-prefix matching for fields without
// constraints so wildcard/legacy specs still route correctly.
export function matchesReferenceMediaField(
  fieldSpec: ReferenceMediaFieldSpec,
  file: File,
): boolean {
  const constraints = fieldSpec.mediaConstraints;

  if (!constraints) {
    return matchesReferenceMediaWildcard(fieldSpec.id, file);
  }

  const extension = getFileExtension(file.name);

  if (extension && constraints.extensions.includes(extension)) {
    return true;
  }

  return file.type !== "" && constraints.mimeTypes.includes(file.type);
}

function matchesReferenceMediaWildcard(
  fieldId: ReferenceMediaFieldId,
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
export function getReferenceMediaFieldIdForFile(
  file: File,
  fieldSpecs: ReferenceMediaFieldSpec[],
): ReferenceMediaFieldId | null {
  const match = fieldSpecs.find((fieldSpec) =>
    matchesReferenceMediaField(fieldSpec, file),
  );

  return match?.id ?? null;
}

// Physical-property issues for a file already routed into a field. Format is not
// re-checked here (it is enforced upstream by routing). This pass validates file
// size; dimensions/duration/fps need async decode and are handled in a later pass.
export function validateReferenceMediaFile(
  fieldSpec: ReferenceMediaFieldSpec,
  file: File,
): ReferenceMediaFileIssue[] {
  const issues: ReferenceMediaFileIssue[] = [];

  if (!matchesReferenceMediaField(fieldSpec, file)) {
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

export function hasGenerationReferenceMediaValidationIssues(
  selectedModel: PublishedGenerationModelSummary,
  value: GenerationReferenceMediaValue,
) {
  const fieldSpecs = getGenerationReferenceMediaFieldSpecs(selectedModel);
  const fieldSpecById = new Map(
    fieldSpecs.map((fieldSpec) => [fieldSpec.id, fieldSpec]),
  );

  return referenceMediaFieldIds.some((fieldId) => {
    const files = value[fieldId];

    if (files.length === 0) {
      return false;
    }

    const fieldSpec = fieldSpecById.get(fieldId);

    if (!fieldSpec) {
      return true;
    }

    return files.some(
      (file) => validateReferenceMediaFile(fieldSpec, file).length > 0,
    );
  });
}

// Human-readable copy for a validation issue, shown in the preview tooltip.
export function describeReferenceMediaFileIssue(
  issue: ReferenceMediaFileIssue,
): string {
  switch (issue.kind) {
    case "unsupportedField":
      return "This model does not support this reference type.";
    case "unsupportedFormat":
      return "This file format is not supported by the selected model.";
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
