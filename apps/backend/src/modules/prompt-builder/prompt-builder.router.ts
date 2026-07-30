import { generationModelTypes } from "@remora/domain/generation-model/dto";
import { z } from "zod";

import { router } from "../../trpc/init.ts";
import { publicProcedure } from "../../trpc/procedures.ts";
import { promptBuilderService } from "./prompt-builder.service.ts";
import { promptBuilderPromptMaxLength } from "./prompt-builder.utils.ts";

const promptBuilderInputSchema = z.strictObject({
  modelType: z.enum(generationModelTypes),
  prompt: z.string().trim().min(1).max(promptBuilderPromptMaxLength),
});

const promptBuilderOutputSchema = z.discriminatedUnion("modelType", [
  z.strictObject({
    modelType: z.literal("image"),
    prompt: z.string().min(1).max(promptBuilderPromptMaxLength),
  }),
  z.strictObject({
    modelType: z.literal("video"),
    prompt: z.string().min(1).max(promptBuilderPromptMaxLength),
    duration: z.number().int().positive(),
  }),
]);

export const promptBuilderRouter = router({
  build: publicProcedure
    .input(promptBuilderInputSchema)
    .output(promptBuilderOutputSchema)
    .mutation(({ input }) => promptBuilderService.build(input)),
});
