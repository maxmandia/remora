import type {
  GenerationJobStatus,
  GenerationJobTerminalError,
} from "@remora/domain/generation-submission/dto";
import { createVideoGenerationInputSchema } from "@remora/domain/generation-submission/validator";
import { parseBackendHttpEnv } from "@remora/env";
import { TRPCError } from "@trpc/server";
import type { FastifyInstance } from "fastify";
import { createHash, timingSafeEqual } from "node:crypto";
import { z } from "zod";

import {
  generationAttachmentMediaService,
  generationService,
} from "../../app.service.ts";
import {
  signalVideoGenerationProviderCallback,
  startGenerationThreadNameWorkflow,
  startVideoGenerationWorkflow,
} from "../../temporal/client.ts";
import { router } from "../../trpc/init.ts";
import { protectedProcedure } from "../../trpc/procedures.ts";
import { InsufficientCreditBalanceError } from "../credits/credits.types.ts";
import { hasAttachmentMedia } from "../generation-attachment-media/generation-attachment-media.utils.ts";
import { GenerationAttachmentMediaValidationError } from "../generation-attachment-media/generation-attachment-media.types.ts";
import { logGenerationThreadLifecycleEvent } from "../generation-thread/generation-thread.observability.ts";
import {
  GenerationProjectNotFoundError,
  GenerationThreadNotFoundError,
} from "../generation-thread/generation-thread.types.ts";
import {
  runWithSpan,
  toErrorLogFields,
} from "../observability/observability.service.ts";
import { logGenerationLifecycleEvent } from "./generation.observability.ts";
import { generationRepository } from "./generation.repository.ts";
import type { GenerationProviderCallback } from "./generation.types.ts";
import {
  GenerationInputValidationError,
  GenerationModelTypeMismatchError,
  GenerationProviderTaskMismatchError,
  UnsupportedGenerationModelError,
} from "./generation.types.ts";

const listThreadSubmissionsInputSchema = z.object({
  threadId: z.string().min(1),
});

const listAttachmentMediaFromSubmissionInputSchema = z.object({
  submissionId: z.string().min(1),
});

export const generationRouter = router({
  listSubmissionsFromThread: protectedProcedure
    .input(listThreadSubmissionsInputSchema)
    .query(({ ctx, input }) =>
      generationService.listSubmissionsFromThread({
        userId: ctx.user.id,
        threadId: input.threadId,
      }),
    ),

  listAttachmentMediaFromSubmission: protectedProcedure
    .input(listAttachmentMediaFromSubmissionInputSchema)
    .query(({ ctx, input }) =>
      generationAttachmentMediaService.listSignedAttachmentMediaFromSubmission({
        submissionId: input.submissionId,
        userId: ctx.user.id,
      }),
    ),

  createVideo: protectedProcedure
    .input(createVideoGenerationInputSchema)
    .mutation(async ({ ctx, input }) =>
      runWithSpan(
        "generation.create_video",
        {
          userId: ctx.user.id,
          requestId: ctx.requestId,
          modelId: input.modelId,
          modelSpecId: input.modelSpecId,
          requestedGenerations: input.requestedGenerations,
        },
        async () => {
          try {
            const createdSubmission =
              await generationService.createVideoGenerationSubmission({
                userId: ctx.user.id,
                input,
              });
            logGenerationLifecycleEvent("generation.submission.created", {
              userId: ctx.user.id,
              requestId: ctx.requestId,
              submissionId: createdSubmission.submission.id,
              threadId: createdSubmission.submission.threadId,
              modelId: createdSubmission.submission.modelId,
              modelSpecId: createdSubmission.submission.modelSpecId,
              requestedGenerations:
                createdSubmission.submission.requestedGenerations,
              jobCount: createdSubmission.jobs.length,
            });

            if (createdSubmission.createdThread) {
              const thread = createdSubmission.createdThread;

              void startGenerationThreadNameWorkflow({
                threadId: thread.id,
                userId: thread.userId,
                prompt: createdSubmission.submission.submittedInput.prompt,
                provisionalName: thread.name,
              }).catch((error) => {
                logGenerationThreadLifecycleEvent(
                  "generation_thread.name_workflow_start_failed",
                  {
                    userId: thread.userId,
                    requestId: ctx.requestId,
                    threadId: thread.id,
                    ...toErrorLogFields(error),
                  },
                );
              });
            }

            const startedJobs: Array<{
              jobId: string;
              workflowId: string | null;
              status: GenerationJobStatus;
              terminalError: GenerationJobTerminalError | null;
            }> = [];

            for (const { job, callbackToken } of createdSubmission.jobs) {
              const workflowLogFields = {
                userId: ctx.user.id,
                requestId: ctx.requestId,
                submissionId: createdSubmission.submission.id,
                jobId: job.id,
                threadId: createdSubmission.submission.threadId,
                modelId: createdSubmission.submission.modelId,
                modelSpecId: createdSubmission.submission.modelSpecId,
                providerId: job.providerId,
                providerModelId: job.providerModelId,
              };
              const callbackUrl = buildGenerationCallbackUrl({
                providerId: job.providerId,
                jobId: job.id,
                token: callbackToken,
              });

              let workflow;
              const workflowStartedAt = Date.now();

              logGenerationLifecycleEvent(
                "generation.workflow.starting",
                workflowLogFields,
              );

              try {
                workflow = await startVideoGenerationWorkflow({
                  jobId: job.id,
                  submissionId: createdSubmission.submission.id,
                  modelId: createdSubmission.submission.modelId,
                  modelSpecId: createdSubmission.submission.modelSpecId,
                  providerId: job.providerId,
                  submittedInput: createdSubmission.submission.submittedInput,
                  hasAttachmentMedia: hasAttachmentMedia(
                    createdSubmission.submission.attachmentMedia,
                  ),
                  callbackUrl,
                });
              } catch (error) {
                logGenerationLifecycleEvent(
                  "generation.workflow.start_failed",
                  {
                    ...workflowLogFields,
                    durationMs: Date.now() - workflowStartedAt,
                    ...toErrorLogFields(error),
                  },
                );

                const terminalError = serializeWorkflowStartFailure(error);
                const failedJob =
                  await generationService.finalizeUnsuccessfulGenerationJob({
                    jobId: job.id,
                    status: "failed",
                    terminalError,
                  });

                startedJobs.push({
                  jobId: job.id,
                  workflowId: null,
                  status: failedJob.status,
                  terminalError: failedJob.terminalError,
                });

                continue;
              }

              logGenerationLifecycleEvent("generation.workflow.started", {
                ...workflowLogFields,
                durationMs: Date.now() - workflowStartedAt,
                temporalWorkflowId: workflow.workflowId,
                temporalRunId: workflow.runId,
              });

              startedJobs.push({
                jobId: job.id,
                workflowId: workflow.workflowId,
                status: job.status,
                terminalError: null,
              });
            }

            return {
              submissionId: createdSubmission.submission.id,
              threadId: createdSubmission.submission.threadId,
              jobs: startedJobs,
            };
          } catch (error) {
            if (
              error instanceof UnsupportedGenerationModelError ||
              error instanceof GenerationModelTypeMismatchError ||
              error instanceof GenerationInputValidationError ||
              error instanceof GenerationAttachmentMediaValidationError ||
              error instanceof InsufficientCreditBalanceError
            ) {
              throw new TRPCError({
                code: "BAD_REQUEST",
                message: error.message,
                cause: error,
              });
            }

            if (
              error instanceof GenerationThreadNotFoundError ||
              error instanceof GenerationProjectNotFoundError
            ) {
              throw new TRPCError({
                code: "NOT_FOUND",
                message: error.message,
                cause: error,
              });
            }

            throw error;
          }
        },
      ),
    ),
});

export async function registerGenerationCallbackRoutes(
  server: FastifyInstance,
) {
  server.post<{
    Params: { providerId: string; jobId: string };
    Querystring: { token?: string };
  }>("/api/generation-callbacks/:providerId/:jobId", async (request, reply) =>
    runWithSpan(
      "generation.provider_callback",
      {
        requestId: request.id,
        providerId: request.params.providerId,
        jobId: request.params.jobId,
      },
      async () => {
        const { providerId, jobId } = request.params;
        const token = request.query.token;

        if (!token) {
          logGenerationLifecycleEvent("generation.provider.callback_rejected", {
            requestId: request.id,
            providerId,
            jobId,
            errorCode: "MISSING_CALLBACK_TOKEN",
            errorMessage: "Missing callback token",
            errorSource: "internal",
          });

          return reply.status(401).send({ error: "Missing callback token" });
        }

        const job = await generationRepository.getGenerationJobById(jobId);

        if (!job) {
          logGenerationLifecycleEvent("generation.provider.callback_rejected", {
            requestId: request.id,
            providerId,
            jobId,
            errorCode: "GENERATION_JOB_NOT_FOUND",
            errorMessage: "Generation job was not found",
            errorSource: "internal",
          });

          return reply
            .status(404)
            .send({ error: "Generation job was not found" });
        }

        const callbackLogFields = {
          userId: job.userId,
          requestId: request.id,
          submissionId: job.submissionId,
          jobId: job.id,
          threadId: job.threadId,
          modelId: job.modelId,
          modelSpecId: job.modelSpecId,
          providerId,
          providerModelId: job.providerModelId,
          providerTaskId: job.providerTaskId,
          temporalWorkflowId: job.temporalWorkflowId,
          temporalRunId: job.temporalRunId,
        };

        if (job.providerId !== providerId) {
          logGenerationLifecycleEvent("generation.provider.callback_rejected", {
            ...callbackLogFields,
            expectedProviderId: job.providerId,
            errorCode: "GENERATION_PROVIDER_MISMATCH",
            errorMessage: "Generation callback provider did not match job",
            errorSource: "internal",
          });

          return reply
            .status(404)
            .send({ error: "Generation job was not found" });
        }

        if (
          !job.callbackTokenHash ||
          !verifyGenerationCallbackToken({
            token,
            expectedHash: job.callbackTokenHash,
          })
        ) {
          logGenerationLifecycleEvent("generation.provider.callback_rejected", {
            ...callbackLogFields,
            errorCode: "INVALID_CALLBACK_TOKEN",
            errorMessage: "Invalid callback token",
            errorSource: "internal",
          });

          return reply.status(401).send({ error: "Invalid callback token" });
        }

        if (!job.temporalWorkflowId) {
          logGenerationLifecycleEvent("generation.provider.callback_rejected", {
            ...callbackLogFields,
            errorCode: "GENERATION_WORKFLOW_NOT_STARTED",
            errorMessage: "Generation workflow has not started",
            errorSource: "internal",
          });

          return reply
            .status(409)
            .send({ error: "Generation workflow has not started" });
        }

        if (isTerminalGenerationJobStatus(job.status)) {
          return reply.status(202).send({ ok: true });
        }

        const receivedAt = new Date().toISOString();
        let callback: GenerationProviderCallback;

        try {
          callback =
            await generationService.normalizeVideoGenerationProviderCallback({
              modelId: job.modelId,
              modelSpecId: job.modelSpecId,
              expectedProviderTaskId: job.providerTaskId,
              rawPayload: request.body,
              receivedAt,
            });
        } catch (error) {
          if (error instanceof GenerationProviderTaskMismatchError) {
            logGenerationLifecycleEvent(
              "generation.provider.callback_rejected",
              {
                ...callbackLogFields,
                receivedProviderTaskId: error.receivedProviderTaskId,
                errorCode: error.code,
                errorMessage: error.message,
                errorSource: "provider",
              },
            );

            return reply
              .status(409)
              .send({ error: "Provider task id did not match generation job" });
          }

          throw error;
        }

        if (callback.kind === "result") {
          logGenerationLifecycleEvent("generation.provider.callback_received", {
            ...callbackLogFields,
            providerTaskId: callback.result.providerTaskId,
            providerModelId: callback.result.providerModelId,
            status: callback.result.status,
          });
        } else {
          logGenerationLifecycleEvent("generation.provider.callback_received", {
            ...callbackLogFields,
            status: "malformed",
            errorCode: callback.terminalError.code,
            errorMessage: callback.terminalError.message,
            errorSource: callback.terminalError.source,
          });
        }

        try {
          await signalVideoGenerationProviderCallback({
            jobId,
            callback,
          });
        } catch (error) {
          const errorFields = toErrorLogFields(error);

          logGenerationLifecycleEvent("generation.provider.callback_rejected", {
            ...callbackLogFields,
            errorSource: errorFields.errorSource,
            errorCode: "GENERATION_WORKFLOW_SIGNAL_FAILED",
            errorMessage: errorFields.errorMessage,
          });

          return reply
            .status(409)
            .send({ error: "Generation workflow could not accept callback" });
        }

        logGenerationLifecycleEvent("generation.provider.callback_signaled", {
          ...callbackLogFields,
          status:
            callback.kind === "result" ? callback.result.status : "malformed",
        });

        return reply.status(202).send({ ok: true });
      },
    ),
  );
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
    status === "expired" ||
    status === "final_cost_calculation_failure"
  );
}
