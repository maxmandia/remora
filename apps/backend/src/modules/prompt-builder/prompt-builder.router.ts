import { z } from "zod";

import { router } from "../../trpc/init.ts";
import { publicProcedure } from "../../trpc/procedures.ts";
import { promptBuilderService } from "./prompt-builder.service.ts";
import { promptBuilderPromptMaxLength } from "./prompt-builder.utils.ts";

const promptBuilderInputSchema = z.strictObject({
  modelId: z.string().trim().min(1).max(128),
  prompt: z.string().trim().min(1).max(promptBuilderPromptMaxLength),
});

const promptBuilderOutputSchema = z.discriminatedUnion("modelType", [
  z.strictObject({
    modelId: z.string().min(1).max(128),
    modelType: z.literal("image"),
    prompt: z.string().min(1).max(promptBuilderPromptMaxLength),
  }),
  z.strictObject({
    modelId: z.string().min(1).max(128),
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
