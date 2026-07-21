import type { AttachmentMediaRole } from "@remora/domain/generation-attachment-media/dto";
import type {
  GenerationAttachmentMediaFieldSpec,
  PublishedGenerationModelSummary,
} from "@remora/domain/generation-model/dto";
import { validateGenerationAttachmentMediaRules } from "@remora/domain/generation-attachment-media/validator";

import { getFileExtension } from "../image.ts";

export const attachmentMediaFieldIds = ["images", "videos", "audios"] as const;
export const attachmentMediaRoleOrder = [
  "reference",
  "firstFrame",
  "lastFrame",
] as const satisfies readonly AttachmentMediaRole[];
export const attachmentMediaFrameRoles = [
  "firstFrame",
  "lastFrame",
] as const satisfies readonly AttachmentMediaRole[];

export type AttachmentMediaFieldId = (typeof attachmentMediaFieldIds)[number];

export type GenerationAttachmentMediaItem = {
  file: File;
  role: AttachmentMediaRole;
};

export type GenerationAttachmentMediaValue = Record<
  AttachmentMediaFieldId,
  GenerationAttachmentMediaItem[]
>;

export type AttachmentMediaFieldSpec = GenerationAttachmentMediaFieldSpec & {
  id: AttachmentMediaFieldId;
};

export type AttachmentMediaRoleMode = "empty" | "frame" | "mixed" | "reference";

export type AttachmentMediaRolePickerState = {
  accept: string;
  disabled: boolean;
  multiple: boolean;
  role: AttachmentMediaRole;
};

export type AttachmentMediaAddAction =
  | {
      kind: "disabled";
    }
  | {
      kind: "dropdown";
      choices: AttachmentMediaRolePickerState[];
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
      kind: "lastFrameRequiresFirstFrame";
    }
  | {
      kind: "mixedAttachmentRoles";
    }
  | {
      kind: "fileTooLarge";
      maxBytes: number;
    }
  | {
      kind: "selectionTooLarge";
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

export function getAttachmentMediaAddAction({
  fieldSpecs,
  value,
}: {
  fieldSpecs: AttachmentMediaFieldSpec[];
  value: GenerationAttachmentMediaValue;
}): AttachmentMediaAddAction {
  const choices = attachmentMediaRoleOrder
    .filter((role) => isAttachmentMediaRoleSupported(fieldSpecs, role))
    .map((role) =>
      getAttachmentMediaPickerStateForRole({ fieldSpecs, role, value }),
    );

  if (choices.length === 0 || choices.every((picker) => picker.disabled)) {
    return { kind: "disabled" };
  }

  return { kind: "dropdown", choices };
}

export function getAttachmentMediaPickerStateForRole({
  fieldSpecs,
  role,
  value,
}: {
  fieldSpecs: AttachmentMediaFieldSpec[];
  role: AttachmentMediaRole;
  value: GenerationAttachmentMediaValue;
}): AttachmentMediaRolePickerState {
  const availableFieldSpecs = getAvailableAttachmentMediaFieldSpecsForRole({
    fieldSpecs,
    role,
    value,
  });
  const hasUnboundedCapacity = availableFieldSpecs.some(
    (fieldSpec) => fieldSpec.arrayMax === undefined,
  );
  const finiteRemainingCapacity = availableFieldSpecs.reduce(
    (total, fieldSpec) =>
      total + getRemainingAttachmentMediaCapacity(fieldSpec, value),
    0,
  );

  return {
    accept: availableFieldSpecs.map(getAttachmentMediaAccept).join(","),
    disabled: !canAddAttachmentMediaRole({ fieldSpecs, role, value }),
    multiple:
      role === "reference" &&
      (hasUnboundedCapacity || finiteRemainingCapacity > 1),
    role,
  };
}

export function appendAttachmentMediaFiles({
  fieldSpecs,
  files,
  role,
  value,
}: {
  fieldSpecs: AttachmentMediaFieldSpec[];
  files: File[];
  role: AttachmentMediaRole;
  value: GenerationAttachmentMediaValue;
}): GenerationAttachmentMediaValue {
  let nextValue = value;

  for (const file of files) {
    if (!canAddAttachmentMediaRole({ fieldSpecs, role, value: nextValue })) {
      continue;
    }

    const fieldId = getAttachmentMediaFieldIdForFile(
      file,
      getAvailableAttachmentMediaFieldSpecsForRole({
        fieldSpecs,
        role,
        value: nextValue,
      }),
    );

    if (!fieldId) {
      continue;
    }

    nextValue = {
      ...nextValue,
      [fieldId]: [...nextValue[fieldId], { file, role }],
    };

    if (role !== "reference") {
      break;
    }
  }

  return nextValue;
}

export function getAttachmentMediaRoleMode(
  value: GenerationAttachmentMediaValue,
): AttachmentMediaRoleMode {
  const roles = new Set(
    attachmentMediaFieldIds.flatMap((fieldId) =>
      value[fieldId].map((item) => item.role),
    ),
  );
  const hasReference = roles.has("reference");
  const hasFrame = attachmentMediaFrameRoles.some((role) => roles.has(role));

  if (!hasReference && !hasFrame) {
    return "empty";
  }

  if (hasReference && hasFrame) {
    return "mixed";
  }

  return hasReference ? "reference" : "frame";
}

export function hasAttachmentMediaRole(
  value: GenerationAttachmentMediaValue,
  role: AttachmentMediaRole,
): boolean {
  return attachmentMediaFieldIds.some((fieldId) =>
    value[fieldId].some((item) => item.role === role),
  );
}

export function getAttachmentMediaRoleLabel(role: AttachmentMediaRole) {
  switch (role) {
    case "reference":
      return "Reference";
    case "firstFrame":
      return "First frame";
    case "lastFrame":
      return "Last frame";
  }
}

export function getAttachmentMediaRoleShortLabel(role: AttachmentMediaRole) {
  switch (role) {
    case "reference":
      return null;
    case "firstFrame":
      return "First";
    case "lastFrame":
      return "Last";
  }
}

function isAttachmentMediaFieldId(
  fieldId: string,
): fieldId is AttachmentMediaFieldId {
  return (attachmentMediaFieldIds as readonly string[]).includes(fieldId);
}

function isAttachmentMediaRoleSupported(
  fieldSpecs: AttachmentMediaFieldSpec[],
  role: AttachmentMediaRole,
) {
  return fieldSpecs.some((fieldSpec) =>
    fieldSpec.mediaRoleCapabilities.includes(role),
  );
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
// file matches, or null when no field accepts it (wrong format -> gated out).
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
  const issues: AttachmentMediaFileIssue[] =
    validateGenerationAttachmentMediaRules({
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
  const roleMode = getAttachmentMediaRoleMode(value);
  const fieldSpec = getGenerationAttachmentMediaFieldSpecs(selectedModel).find(
    (candidate) => candidate.id === fieldId,
  );
  const maxTotalFileSizeBytes =
    fieldSpec?.mediaConstraints?.maxTotalFileSizeBytes;

  if (
    maxTotalFileSizeBytes !== undefined &&
    value[fieldId].reduce((total, item) => total + item.file.size, 0) >
      maxTotalFileSizeBytes
  ) {
    issues.push({
      kind: "selectionTooLarge",
      maxBytes: maxTotalFileSizeBytes,
    });
  }

  if (roleMode === "mixed") {
    issues.push({ kind: "mixedAttachmentRoles" });
  }

  if (
    fieldId === "images" &&
    hasAttachmentMediaRole(value, "lastFrame") &&
    !hasAttachmentMediaRole(value, "firstFrame")
  ) {
    issues.push({ kind: "lastFrameRequiresFirstFrame" });
  }

  return issues;
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
      (item) =>
        validateAttachmentMediaFile(fieldSpec, item.file).length > 0 ||
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
    case "lastFrameRequiresFirstFrame":
      return "Last frame attachments need a first frame attachment.";
    case "mixedAttachmentRoles":
      return "Reference attachments cannot be combined with first or last frame attachments.";
    case "fileTooLarge":
      return `File is too large (max ${formatFileSize(issue.maxBytes)}).`;
    case "selectionTooLarge":
      return `Combined files are too large (max ${formatFileSize(issue.maxBytes)}).`;
  }
}

function getAvailableAttachmentMediaFieldSpecsForRole({
  fieldSpecs,
  role,
  value,
}: {
  fieldSpecs: AttachmentMediaFieldSpec[];
  role: AttachmentMediaRole;
  value: GenerationAttachmentMediaValue;
}) {
  if (role !== "reference" && hasAttachmentMediaRole(value, role)) {
    return [];
  }

  return fieldSpecs.filter(
    (fieldSpec) =>
      fieldSpec.mediaRoleCapabilities.includes(role) &&
      getRemainingAttachmentMediaCapacity(fieldSpec, value) > 0,
  );
}

function canAddAttachmentMediaRole({
  fieldSpecs,
  role,
  value,
}: {
  fieldSpecs: AttachmentMediaFieldSpec[];
  role: AttachmentMediaRole;
  value: GenerationAttachmentMediaValue;
}) {
  const roleMode = getAttachmentMediaRoleMode(value);

  if (roleMode === "mixed") {
    return false;
  }

  if (role === "reference" && roleMode === "frame") {
    return false;
  }

  if (role !== "reference" && roleMode === "reference") {
    return false;
  }

  return (
    getAvailableAttachmentMediaFieldSpecsForRole({ fieldSpecs, role, value })
      .length > 0
  );
}

function getRemainingAttachmentMediaCapacity(
  fieldSpec: AttachmentMediaFieldSpec,
  value: GenerationAttachmentMediaValue,
) {
  if (fieldSpec.arrayMax === undefined) {
    return Number.POSITIVE_INFINITY;
  }

  return Math.max(fieldSpec.arrayMax - value[fieldSpec.id].length, 0);
}

function formatFileSize(bytes: number): string {
  const megabytes = bytes / 1_048_576;
  const rounded = Number.isInteger(megabytes)
    ? megabytes
    : Math.round(megabytes * 10) / 10;

  return `${rounded} MB`;
}
