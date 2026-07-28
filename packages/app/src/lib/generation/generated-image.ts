import type { AttachmentMediaRole } from "@remora/domain/generation-attachment-media/dto";
import type { PublishedGenerationModelSummary } from "@remora/domain/generation-model/dto";

import {
  attachmentMediaRoleOrder,
  getAttachmentMediaPickerStateForRole,
  getGenerationAttachmentMediaFieldSpecs,
  type AttachmentMediaFieldSpec,
  type GenerationAttachmentMediaValue,
} from "./attachment-media.ts";

export type GeneratedImageDescriptor = {
  jobId: string;
  url: string;
  contentLength: number | null;
  contentType: string | null;
};

export type GeneratedImageAttachmentRoleChoice = {
  disabled: boolean;
  role: AttachmentMediaRole;
};

export type GeneratedImageContextMenuActions = {
  getRoleChoices: (
    image: GeneratedImageDescriptor,
  ) => GeneratedImageAttachmentRoleChoice[];
  onAdd: (image: GeneratedImageDescriptor, role: AttachmentMediaRole) => void;
  onDownload: (image: GeneratedImageDescriptor) => void;
};

export function getGeneratedImageAttachmentRoleChoices({
  image,
  selectedModel,
  value,
}: {
  image: GeneratedImageDescriptor;
  selectedModel: PublishedGenerationModelSummary | null;
  value: GenerationAttachmentMediaValue;
}): GeneratedImageAttachmentRoleChoice[] {
  if (!selectedModel) {
    return [];
  }

  const imageFieldSpecs = getGenerationAttachmentMediaFieldSpecs(
    selectedModel,
  ).filter((fieldSpec) => fieldSpec.id === "images");

  return attachmentMediaRoleOrder.flatMap((role) => {
    const roleFieldSpecs = imageFieldSpecs.filter((fieldSpec) =>
      fieldSpec.mediaRoleCapabilities.includes(role),
    );

    if (roleFieldSpecs.length === 0) {
      return [];
    }

    const picker = getAttachmentMediaPickerStateForRole({
      fieldSpecs: imageFieldSpecs,
      role,
      value,
    });
    const acceptsImage = roleFieldSpecs.some((fieldSpec) =>
      acceptsGeneratedImage(fieldSpec, image, value),
    );

    return [{ disabled: picker.disabled || !acceptsImage, role }];
  });
}

export function getGeneratedImageFileName({
  contentType,
  jobId,
}: Pick<GeneratedImageDescriptor, "contentType" | "jobId">) {
  const extension = getImageExtension(contentType);

  return `remora-image-${jobId}${extension ? `.${extension}` : ""}`;
}

export function getImageExtension(contentType: string | null) {
  switch (contentType?.split(";")[0]?.trim().toLowerCase()) {
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "image/bmp":
      return "bmp";
    case "image/gif":
      return "gif";
    case "image/avif":
      return "avif";
    default:
      return null;
  }
}

function acceptsGeneratedImage(
  fieldSpec: AttachmentMediaFieldSpec,
  image: GeneratedImageDescriptor,
  value: GenerationAttachmentMediaValue,
) {
  const constraints = fieldSpec.mediaConstraints;

  if (!constraints) {
    return image.contentType === null || image.contentType.startsWith("image/");
  }

  if (
    image.contentType !== null &&
    !constraints.mimeTypes.includes(normalizeContentType(image.contentType))
  ) {
    return false;
  }

  if (
    image.contentLength !== null &&
    constraints.maxFileSizeBytes !== undefined &&
    image.contentLength > constraints.maxFileSizeBytes
  ) {
    return false;
  }

  if (
    image.contentLength !== null &&
    constraints.maxTotalFileSizeBytes !== undefined
  ) {
    const currentBytes = value[fieldSpec.id].reduce(
      (total, item) => total + item.file.size,
      0,
    );

    if (
      currentBytes + image.contentLength >
      constraints.maxTotalFileSizeBytes
    ) {
      return false;
    }
  }

  return true;
}

function normalizeContentType(contentType: string) {
  return contentType.split(";")[0]?.trim().toLowerCase() ?? contentType;
}
