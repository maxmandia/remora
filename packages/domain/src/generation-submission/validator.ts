import { z } from "zod";

import { attachmentMediaRoles } from "../generation-attachment-media/dto.ts";
import type {
  CreateImageGenerationInput,
  CreateVideoGenerationInput,
  ImageGenerationSubmissionInput,
  VideoGenerationSubmissionInput,
} from "./dto.ts";
import { maxRequestedGenerations, minRequestedGenerations } from "./dto.ts";

export const generationAttachmentMediaInputSchema = z.object({
  images: z
    .array(
      z.object({
        id: z.string().min(1),
        role: z.enum(attachmentMediaRoles),
      }),
    )
    .optional(),
  videos: z
    .array(
      z.object({
        id: z.string().min(1),
        role: z.literal("reference"),
      }),
    )
    .optional(),
  audios: z
    .array(
      z.object({
        id: z.string().min(1),
        role: z.literal("reference"),
      }),
    )
    .optional(),
});

const createGenerationInputBaseShape = {
  modelId: z.string().min(1),
  modelSpecId: z.string().min(1),
  threadId: z.string().min(1).optional(),
  projectId: z.string().min(1).optional(),
  requestedGenerations: z
    .number()
    .int()
    .min(minRequestedGenerations)
    .max(maxRequestedGenerations),
  attachmentMedia: generationAttachmentMediaInputSchema.optional(),
};

function hasSingleGenerationTarget(input: {
  threadId?: string;
  projectId?: string;
}) {
  return !(input.threadId && input.projectId);
}

export const createVideoGenerationInputSchema = z
  .object({
    ...createGenerationInputBaseShape,
    prompt: z.string().trim().min(1),
    resolution: z.string().min(1),
    aspectRatio: z.string().min(1),
    duration: z.number().int(),
    generateAudio: z.boolean(),
  })
  .refine(hasSingleGenerationTarget, {
    message: "Choose either threadId or projectId.",
    path: ["projectId"],
  }) satisfies z.ZodType<CreateVideoGenerationInput>;

export const createImageGenerationInputSchema = z
  .object({
    ...createGenerationInputBaseShape,
    prompt: z.string().trim().min(1),
    resolution: z.string().min(1),
    aspectRatio: z.string().min(1),
  })
  .strict()
  .refine(hasSingleGenerationTarget, {
    message: "Choose either threadId or projectId.",
    path: ["projectId"],
  }) satisfies z.ZodType<CreateImageGenerationInput>;

export const videoGenerationSubmissionInputSchema = z
  .object({
    prompt: z.string().trim().min(1),
    resolution: z.string().min(1),
    aspectRatio: z.string().min(1),
    duration: z.number().int(),
    generateAudio: z.boolean(),
  })
  .strict() satisfies z.ZodType<VideoGenerationSubmissionInput>;

export const imageGenerationSubmissionInputSchema = z
  .object({
    prompt: z.string().trim().min(1),
    resolution: z.string().min(1),
    aspectRatio: z.string().min(1),
  })
  .strict() satisfies z.ZodType<ImageGenerationSubmissionInput>;
