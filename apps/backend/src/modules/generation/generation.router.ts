import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { startSeedanceVideoGenerationWorkflow } from "../../temporal/client.ts";
import { router } from "../../trpc/init.ts";
import { protectedProcedure } from "../../trpc/procedures.ts";
import { generationRepository } from "./generation.repository.ts";
import { generationService } from "./generation.service.ts";
import {
  GenerationInputValidationError,
  UnsupportedGenerationModelError,
} from "./generation.types.ts";
import type { CreateVideoGenerationInput } from "./generation.types.ts";

const createVideoInputSchema: z.ZodType<CreateVideoGenerationInput> = z.object({
  modelId: z.string().min(1),
  prompt: z.string().trim().min(1),
  aspectRatio: z.string().min(1),
  duration: z.number().int(),
  generateAudio: z.boolean(),
});

export const generationRouter = router({
  createVideo: protectedProcedure
    .input(createVideoInputSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const job = await generationService.createVideoGenerationJob({
          userId: ctx.user.id,
          input,
        });

        let workflow;
        try {
          workflow = await startSeedanceVideoGenerationWorkflow({
            jobId: job.id,
            prompt: job.submittedInput.prompt,
            aspectRatio: job.submittedInput.aspectRatio,
            duration: job.submittedInput.duration,
            generateAudio: job.submittedInput.generateAudio,
          });
        } catch (error) {
          await generationRepository.markGenerationJobWorkflowStartFailed({
            jobId: job.id,
            terminalError: serializeWorkflowStartFailure(error),
          });

          throw error;
        }

        return {
          jobId: job.id,
          workflowId: workflow.workflowId,
          status: job.status,
        };
      } catch (error) {
        if (
          error instanceof UnsupportedGenerationModelError ||
          error instanceof GenerationInputValidationError
        ) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: error.code,
            cause: error,
          });
        }

        throw error;
      }
    }),
});

// TODO: Can probably move this out into a new file
function serializeWorkflowStartFailure(error: unknown) {
  return {
    source: "internal" as const,
    code: "WORKFLOW_START_FAILED",
    message:
      error instanceof Error
        ? error.message
        : typeof error === "string"
          ? error
          : "Temporal workflow start failed",
  };
}
