import { z } from "zod";

import { modelRatesService } from "../../app.service.ts";
import { router } from "../../trpc/init.ts";
import { protectedProcedure } from "../../trpc/procedures.ts";
import { attachmentMediaRoles } from "../generation-attachment-media/schema/table.ts";
import {
  maxRequestedGenerations,
  minRequestedGenerations,
} from "../generation/generation.types.ts";

import type {
  EstimateGenerationCostAttachmentMediaInput,
  EstimateGenerationCostInput,
} from "./model_rates.types.ts";

const estimateGenerationCostAttachmentMediaItemSchema = z.object({
  role: z.enum(attachmentMediaRoles),
});

const estimateGenerationCostAttachmentMediaVideoItemSchema =
  estimateGenerationCostAttachmentMediaItemSchema.extend({
    durationSec: z.number().positive().optional(),
  });

const estimateGenerationCostAttachmentMediaSchema = z
  .object({
    images: z.array(estimateGenerationCostAttachmentMediaItemSchema).optional(),
    videos: z
      .array(estimateGenerationCostAttachmentMediaVideoItemSchema)
      .optional(),
    audios: z.array(estimateGenerationCostAttachmentMediaItemSchema).optional(),
  })
  .optional() satisfies z.ZodType<
  EstimateGenerationCostAttachmentMediaInput | undefined
>;

const estimateGenerationCostInputSchema = z.object({
  modelId: z.string().min(1),
  modelSpecId: z.string().min(1),
  resolution: z.string().min(1),
  aspectRatio: z.string().min(1),
  duration: z.number().int(),
  generateAudio: z.boolean(),
  requestedGenerations: z
    .number()
    .int()
    .min(minRequestedGenerations)
    .max(maxRequestedGenerations),
  attachmentMedia: estimateGenerationCostAttachmentMediaSchema,
}) satisfies z.ZodType<EstimateGenerationCostInput>;

export const modelRatesRouter = router({
  estimateGenerationCost: protectedProcedure
    .input(estimateGenerationCostInputSchema)
    .query(({ input }) =>
      modelRatesService.estimateGenerationCostForAllJobs(input),
    ),
});
