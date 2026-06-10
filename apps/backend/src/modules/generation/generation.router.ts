import { createHash, timingSafeEqual } from "node:crypto";

import { parseBackendHttpEnv } from "@remora/env";
import { TRPCError } from "@trpc/server";
import type { FastifyInstance } from "fastify";
import { z } from "zod";

import {
  signalSeedanceVideoGenerationProviderCallback,
  startSeedanceVideoGenerationWorkflow,
} from "../../temporal/client.ts";
import { router } from "../../trpc/init.ts";
import { protectedProcedure } from "../../trpc/procedures.ts";
import { generationRepository } from "./generation.repository.ts";
import { generationService } from "./generation.service.ts";
import { BytePlusSeedanceClient } from "./providers/byteplus/seedance.client.ts";
import {
  GenerationInputValidationError,
  GenerationThreadNotFoundError,
  UnsupportedGenerationModelError,
} from "./generation.types.ts";
import type { CreateVideoGenerationInput } from "./generation.types.ts";

const createVideoInputSchema: z.ZodType<CreateVideoGenerationInput> = z.object({
  modelId: z.string().min(1),
  threadId: z.string().min(1).optional(),
  prompt: z.string().trim().min(1),
  aspectRatio: z.string().min(1),
  duration: z.number().int(),
  generateAudio: z.boolean(),
});

export const generationRouter = router({
  listThreads: protectedProcedure.query(({ ctx }) =>
    generationRepository.listGenerationThreadsForUser(ctx.user.id),
  ),

  createVideo: protectedProcedure
    .input(createVideoInputSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const createdJob = await generationService.createVideoGenerationJob({
          userId: ctx.user.id,
          input,
        });
        const { job, callbackToken } = createdJob;
        const callbackUrl = buildGenerationCallbackUrl({
          providerId: job.providerId ?? "byteplus",
          jobId: job.id,
          token: callbackToken,
        });

        let workflow;
        try {
          workflow = await startSeedanceVideoGenerationWorkflow({
            jobId: job.id,
            modelId: job.modelId,
            modelSpecId: job.modelSpecId,
            prompt: job.submittedInput.prompt,
            aspectRatio: job.submittedInput.aspectRatio,
            duration: job.submittedInput.duration,
            generateAudio: job.submittedInput.generateAudio,
            callbackUrl,
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
          threadId: job.threadId,
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

        if (error instanceof GenerationThreadNotFoundError) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: error.code,
            cause: error,
          });
        }

        throw error;
      }
    }),
});

export async function registerGenerationCallbackRoutes(
  server: FastifyInstance,
) {
  server.post<{
    Params: { providerId: string; jobId: string };
    Querystring: { token?: string };
  }>("/api/generation-callbacks/:providerId/:jobId", async (request, reply) => {
    const { providerId, jobId } = request.params;
    const token = request.query.token;

    if (!token) {
      return reply.status(401).send({ error: "Missing callback token" });
    }

    const job = await generationRepository.getGenerationJobById(jobId);

    if (!job || job.providerId !== providerId) {
      return reply.status(404).send({ error: "Generation job was not found" });
    }

    if (
      !job.callbackTokenHash ||
      !verifyGenerationCallbackToken({
        token,
        expectedHash: job.callbackTokenHash,
      })
    ) {
      return reply.status(401).send({ error: "Invalid callback token" });
    }

    if (!job.temporalWorkflowId) {
      return reply
        .status(409)
        .send({ error: "Generation workflow has not started" });
    }

    if (isTerminalGenerationJobStatus(job.status)) {
      return reply.status(202).send({ ok: true });
    }

    const receivedAt = new Date().toISOString();
    let callback;

    try {
      // TODO: Add provider-specific callback parsing here when Kling execution lands.
      const result = BytePlusSeedanceClient.normalizeSeedanceVideoTaskResponse(
        request.body,
      );

      if (job.providerTaskId && job.providerTaskId !== result.providerTaskId) {
        return reply
          .status(409)
          .send({ error: "Provider task id did not match generation job" });
      }

      callback = {
        kind: "result" as const,
        result,
        rawPayload: request.body,
        receivedAt,
      };
    } catch {
      callback = {
        kind: "malformed" as const,
        terminalError: {
          source: "provider" as const,
          code: "MALFORMED_PROVIDER_CALLBACK",
          message: "Provider callback payload could not be parsed",
        },
        rawPayload: request.body,
        receivedAt,
      };
    }

    try {
      await signalSeedanceVideoGenerationProviderCallback({
        jobId,
        callback,
      });
    } catch {
      return reply
        .status(409)
        .send({ error: "Generation workflow could not accept callback" });
    }

    return reply.status(202).send({ ok: true });
  });
}

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

function buildGenerationCallbackUrl(input: {
  providerId: string;
  jobId: string;
  token: string;
}) {
  const env = parseBackendHttpEnv(process.env);
  const baseUrl = env.API_PUBLIC_ORIGIN.endsWith("/")
    ? env.API_PUBLIC_ORIGIN
    : `${env.API_PUBLIC_ORIGIN}/`;
  const url = new URL(
    `api/generation-callbacks/${encodeURIComponent(input.providerId)}/${encodeURIComponent(input.jobId)}`,
    baseUrl,
  );

  url.searchParams.set("token", input.token);

  return url.toString();
}

function verifyGenerationCallbackToken({
  token,
  expectedHash,
}: {
  token: string;
  expectedHash: string;
}) {
  const actual = Buffer.from(hashGenerationCallbackToken(token), "hex");
  const expected = Buffer.from(expectedHash, "hex");

  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function hashGenerationCallbackToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function isTerminalGenerationJobStatus(status: string) {
  return (
    status === "succeeded" ||
    status === "failed" ||
    status === "cancelled" ||
    status === "expired"
  );
}
