import { parseGenerationValidationRules } from "@remora/domain/generation-model/validation-rules";

import { attachmentMediaRoles } from "./types.ts";
import type {
  GenerationModelSpec,
  AttachmentMediaRole,
  VideoFieldSpec,
  VideoModelSpec,
  VideoAttachmentMediaFieldSpec,
} from "./types.ts";

type AttachmentMediaRoleCapabilities =
  VideoAttachmentMediaFieldSpec["mediaRoleCapabilities"];

export function parsePersistedGenerationModelSpec(
  spec: GenerationModelSpec,
): GenerationModelSpec {
  const specType = spec.type;

  switch (specType) {
    case "video":
      return parsePersistedVideoModelSpec(spec);
    default: {
      const exhaustiveType: never = specType;
      throw new Error(
        `Unsupported generation model spec type: ${exhaustiveType}`,
      );
    }
  }
}

export function parsePersistedVideoModelSpec(
  spec: VideoModelSpec,
): VideoModelSpec {
  return {
    ...spec,
    fields: spec.fields.map(
      parsePersistedVideoFieldSpec,
    ) as VideoModelSpec["fields"],
    validationRules: parseGenerationValidationRules(spec.validationRules),
  };
}

function parsePersistedVideoFieldSpec(field: VideoFieldSpec): VideoFieldSpec {
  if (field.componentKind !== "mediaList") {
    return field;
  }

  const persistedField = field as VideoFieldSpec & {
    valueKind: unknown;
  };

  if (persistedField.valueKind !== "array") {
    throw new Error(`Media field ${field.id} must use array valueKind`);
  }

  return {
    ...field,
    mediaRoleCapabilities: parseMediaRoleCapabilities(field),
  };
}

function parseMediaRoleCapabilities(
  field: VideoFieldSpec,
): AttachmentMediaRoleCapabilities {
  const capabilities = (
    field as VideoFieldSpec & {
      mediaRoleCapabilities?: unknown;
    }
  ).mediaRoleCapabilities;

  if (!Array.isArray(capabilities)) {
    throw new Error(
      `Media field ${field.id} must declare mediaRoleCapabilities`,
    );
  }

  if (capabilities.length === 0) {
    throw new Error(
      `Media field ${field.id} must declare at least one mediaRoleCapability`,
    );
  }

  const parsedCapabilities = capabilities.map((capability) => {
    if (!isAttachmentMediaRole(capability)) {
      throw new Error(
        `Media field ${field.id} has unsupported mediaRoleCapability: ${String(capability)}`,
      );
    }

    return capability;
  });

  return parsedCapabilities as AttachmentMediaRoleCapabilities;
}

function isAttachmentMediaRole(value: unknown): value is AttachmentMediaRole {
  return (attachmentMediaRoles as readonly unknown[]).includes(value);
}
