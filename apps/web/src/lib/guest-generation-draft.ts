import {
  attachmentMediaFieldIds,
  createEmptyGenerationAttachmentMediaValue,
  hasGenerationAttachmentMediaValidationIssues,
  isGenerationSettingsValidForModel,
  type AttachmentMediaFieldId,
  type GenerationAttachmentMediaValue,
  type GenerationSettingsValue,
} from "@remora/app/generation";
import {
  attachmentMediaRoles,
  type AttachmentMediaRole,
} from "@remora/domain/generation-attachment-media/dto";
import type { PublishedGenerationModelSummary } from "@remora/domain/generation-model/dto";
import { z } from "zod";

export const guestGenerationDraftSchemaVersion = 1;
export const guestGenerationDraftLifetimeMs = 24 * 60 * 60 * 1000;

const nonnegativeSafeIntegerSchema = z.number().int().nonnegative().safe();
const guestGenerationDraftAttachmentMetadataSchema = z.strictObject({
  lastModified: nonnegativeSafeIntegerSchema,
  name: z.string(),
  size: nonnegativeSafeIntegerSchema,
  type: z.string(),
});
const storedGuestGenerationDraftAttachmentSchema = z
  .strictObject({
    fieldId: z.enum(attachmentMediaFieldIds),
    file: z.custom<Blob>(
      (value) => typeof Blob === "function" && value instanceof Blob,
    ),
    metadata: guestGenerationDraftAttachmentMetadataSchema,
    role: z.enum(attachmentMediaRoles),
  })
  .superRefine(({ file, metadata }, context) => {
    const storedFileMetadataMatches =
      file.size === metadata.size &&
      file.type === metadata.type &&
      (!("name" in file) || file.name === metadata.name) &&
      (!("lastModified" in file) ||
        file.lastModified === metadata.lastModified);

    if (!storedFileMetadataMatches) {
      context.addIssue({
        code: "custom",
        message: "Stored file metadata does not match the file.",
      });
    }
  });
const storedGuestGenerationDraftSchema = z.strictObject({
  attachments: z.array(storedGuestGenerationDraftAttachmentSchema),
  expiresAt: nonnegativeSafeIntegerSchema,
  modelId: z.string().min(1),
  modelSpecId: z.string().min(1),
  promotionTicket: z
    .string()
    .refine((value) => value.trim().length > 0, "Promotion ticket is empty."),
  prompt: z.string(),
  schemaVersion: z.literal(guestGenerationDraftSchemaVersion),
  settings: z.unknown(),
});

export type GuestGenerationDraftAttachmentMetadata = z.infer<
  typeof guestGenerationDraftAttachmentMetadataSchema
>;

export type GuestGenerationDraftAttachment = {
  fieldId: AttachmentMediaFieldId;
  file: File;
  metadata: GuestGenerationDraftAttachmentMetadata;
  role: AttachmentMediaRole;
};

export type GuestGenerationDraftV1 = {
  attachments: GuestGenerationDraftAttachment[];
  expiresAt: number;
  modelId: string;
  modelSpecId: string;
  promotionTicket: string;
  prompt: string;
  schemaVersion: typeof guestGenerationDraftSchemaVersion;
  settings: GenerationSettingsValue;
};

export type GuestGenerationDraftInput = {
  attachmentMedia: GenerationAttachmentMediaValue;
  model: PublishedGenerationModelSummary;
  prompt: string;
  settings: GenerationSettingsValue;
};

export type CreateGuestGenerationDraftInput = GuestGenerationDraftInput & {
  promotionTicket: string;
};

export type CreateGuestGenerationDraftResult =
  | {
      draft: GuestGenerationDraftV1;
      status: "valid";
    }
  | {
      status: "invalid";
    };

export type ReadGuestGenerationDraftValidationResult =
  | {
      draft: GuestGenerationDraftV1;
      status: "valid";
    }
  | {
      reason: "expired" | "incompatible" | "malformed";
      status: "invalid";
    };

export function createGuestGenerationDraft({
  input,
  now = Date.now(),
}: {
  input: CreateGuestGenerationDraftInput;
  now?: number;
}): CreateGuestGenerationDraftResult {
  const { attachmentMedia, model, promotionTicket, prompt, settings } = input;
  const expiresAt = now + guestGenerationDraftLifetimeMs;

  if (
    !nonnegativeSafeIntegerSchema.safeParse(now).success ||
    !nonnegativeSafeIntegerSchema.safeParse(expiresAt).success ||
    promotionTicket.trim().length === 0 ||
    !isGuestGenerationDraftInputValid({
      attachmentMedia,
      model,
      prompt,
      settings,
    })
  ) {
    return { status: "invalid" };
  }

  return {
    status: "valid",
    draft: {
      attachments: attachmentMediaFieldIds.flatMap((fieldId) =>
        attachmentMedia[fieldId].map(({ file, role }) => ({
          fieldId,
          file,
          metadata: {
            lastModified: file.lastModified,
            name: file.name,
            size: file.size,
            type: file.type,
          },
          role,
        })),
      ),
      expiresAt,
      modelId: model.id,
      modelSpecId: model.latestSpecId,
      promotionTicket,
      prompt,
      schemaVersion: guestGenerationDraftSchemaVersion,
      settings: { ...settings },
    },
  };
}

export function isGuestGenerationDraftInputValid({
  attachmentMedia,
  model,
  prompt,
  settings,
}: GuestGenerationDraftInput) {
  return (
    model.type === model.spec.type &&
    isPromptValidForModel(model, prompt) &&
    isGenerationSettingsValidForModel(model, settings) &&
    !hasGenerationAttachmentMediaValidationIssues(model, attachmentMedia) &&
    hasValidFileObjects(attachmentMedia)
  );
}

export function validateStoredGuestGenerationDraft({
  models,
  now = Date.now(),
  value,
}: {
  models: PublishedGenerationModelSummary[];
  now?: number;
  value: unknown;
}): ReadGuestGenerationDraftValidationResult {
  const parseResult = storedGuestGenerationDraftSchema.safeParse(value);

  if (!parseResult.success) {
    return { reason: "malformed", status: "invalid" };
  }

  const storedDraft = parseResult.data;

  if (storedDraft.expiresAt <= now) {
    return { reason: "expired", status: "invalid" };
  }

  const model = models.find(
    (candidate) => candidate.id === storedDraft.modelId,
  );

  if (
    !model ||
    model.latestSpecId !== storedDraft.modelSpecId ||
    model.type !== model.spec.type ||
    !isPromptValidForModel(model, storedDraft.prompt) ||
    !isGenerationSettingsValidForModel(model, storedDraft.settings)
  ) {
    return { reason: "incompatible", status: "invalid" };
  }

  const reconstructedAttachments = reconstructAttachments(
    storedDraft.attachments,
  );

  if (!reconstructedAttachments) {
    return { reason: "malformed", status: "invalid" };
  }

  const attachmentMedia = toGenerationAttachmentMediaValue(
    reconstructedAttachments,
  );

  if (hasGenerationAttachmentMediaValidationIssues(model, attachmentMedia)) {
    return { reason: "incompatible", status: "invalid" };
  }

  return {
    status: "valid",
    draft: {
      ...storedDraft,
      attachments: reconstructedAttachments,
      settings: { ...storedDraft.settings },
    },
  };
}

type StoredGuestGenerationDraftAttachment = z.infer<
  typeof storedGuestGenerationDraftAttachmentSchema
>;

function reconstructAttachments(
  attachments: StoredGuestGenerationDraftAttachment[],
): GuestGenerationDraftAttachment[] | null {
  if (typeof File !== "function") {
    return null;
  }

  const reconstructed: GuestGenerationDraftAttachment[] = [];

  for (const attachment of attachments) {
    try {
      reconstructed.push({
        fieldId: attachment.fieldId,
        file: new File([attachment.file], attachment.metadata.name, {
          lastModified: attachment.metadata.lastModified,
          type: attachment.metadata.type,
        }),
        metadata: { ...attachment.metadata },
        role: attachment.role,
      });
    } catch {
      return null;
    }
  }

  return reconstructed;
}

function toGenerationAttachmentMediaValue(
  attachments: GuestGenerationDraftAttachment[],
) {
  const value = createEmptyGenerationAttachmentMediaValue();

  for (const attachment of attachments) {
    value[attachment.fieldId].push({
      file: attachment.file,
      role: attachment.role,
    });
  }

  return value;
}

function isPromptValidForModel(
  model: PublishedGenerationModelSummary,
  prompt: string,
) {
  const normalizedPrompt = prompt.trim();
  const promptField = model.spec.fields.find((field) => field.id === "prompt");

  if (
    !promptField ||
    promptField.valueKind !== "string" ||
    normalizedPrompt.length === 0
  ) {
    return false;
  }

  return (
    (promptField.minLength === undefined ||
      normalizedPrompt.length >= promptField.minLength) &&
    (promptField.maxLength === undefined ||
      normalizedPrompt.length <= promptField.maxLength)
  );
}

function hasValidFileObjects(value: GenerationAttachmentMediaValue) {
  return (
    typeof File === "function" &&
    attachmentMediaFieldIds.every((fieldId) =>
      value[fieldId].every(({ file }) => file instanceof File),
    )
  );
}
