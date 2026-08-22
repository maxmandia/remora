import { z } from "zod";

import { attachmentMediaRoles } from "../generation-attachment-media/dto.ts";
import type {
  CreateImageGenerationInput,
  CreateModel3dGenerationInput,
  CreateVideoGenerationInput,
  ImageGenerationSubmissionInput,
  Model3dGenerationSubmissionInput,
  VideoGenerationSubmissionInput,
} from "./dto.ts";
import {
  maxRequestedGenerations,
  minRequestedGenerations,
  model3dGeometryQualities,
  model3dTextureLevels,
} from "./dto.ts";

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
    draft: z.boolean().default(false),
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

const model3dGenerationInputShape = {
  prompt: z.string().trim().max(1_024),
  textureLevel: z.enum(model3dTextureLevels).default("standard"),
  faceLimit: z.number().int().positive().nullable().default(null),
  geometryQuality: z.enum(model3dGeometryQualities).nullable().default(null),
};

export const createModel3dGenerationInputSchema = z
  .object({
    ...createGenerationInputBaseShape,
    ...model3dGenerationInputShape,
  })
  .strict()
  .refine(hasSingleGenerationTarget, {
    message: "Choose either threadId or projectId.",
    path: ["projectId"],
  }) satisfies z.ZodType<CreateModel3dGenerationInput>;

export const videoGenerationSubmissionInputSchema = z
  .object({
    prompt: z.string().trim().min(1),
    resolution: z.string().min(1),
    aspectRatio: z.string().min(1),
    duration: z.number().int(),
    generateAudio: z.boolean(),
    draft: z.boolean().default(false),
  })
  .strict() satisfies z.ZodType<VideoGenerationSubmissionInput>;

export const imageGenerationSubmissionInputSchema = z
  .object({
    prompt: z.string().trim().min(1),
    resolution: z.string().min(1),
    aspectRatio: z.string().min(1),
  })
  .strict() satisfies z.ZodType<ImageGenerationSubmissionInput>;

export const model3dGenerationSubmissionInputSchema = z
  .object(model3dGenerationInputShape)
  .strict() satisfies z.ZodType<Model3dGenerationSubmissionInput>;
