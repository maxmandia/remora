import type {
  CreateImageGenerationInput,
  CreateVideoGenerationInput,
  CreatedGenerationSubmission,
  CreatedGenerationSubmissionJob,
} from "@remora/domain/generation-submission/dto";
import { parseBackendHttpEnv } from "@remora/env";

import {
  startGenerationWorkflow,
  startGenerationThreadNameWorkflow,
} from "../../temporal/client.ts";
import { hasAttachmentMedia } from "../generation-attachment-media/generation-attachment-media.utils.ts";
import { logGenerationThreadLifecycleEvent } from "../generation-thread/generation-thread.observability.ts";
import { toErrorLogFields } from "../observability/observability.service.ts";
import { logGenerationLifecycleEvent } from "./generation.observability.ts";
import type { GenerationService } from "./generation.service.ts";
import type {
  CreatedGenerationJobRecord,
  CreatedImageGenerationSubmission,
  CreatedVideoGenerationSubmission,
} from "./generation.types.ts";

type GenerationWorkflowStarters = {
  startGenerationWorkflow: typeof startGenerationWorkflow;
  startGenerationThreadNameWorkflow: typeof startGenerationThreadNameWorkflow;
};

type GenerationWorkflowInput = Parameters<typeof startGenerationWorkflow>[0];

type PreparedImageGenerationJob = {
  modelType: "image";
  job: CreatedGenerationJobRecord;
  submittedInput: CreatedImageGenerationSubmission["submission"]["submittedInput"];
  providerExecution: Extract<
    GenerationWorkflowInput,
    { providerExecution: { mode: "inline" } }
  >["providerExecution"];
};

type PreparedVideoGenerationJob = {
  modelType: "video";
  job: CreatedGenerationJobRecord;
  submittedInput: CreatedVideoGenerationSubmission["submission"]["submittedInput"];
  providerExecution: Extract<
    GenerationWorkflowInput,
    { providerExecution: { mode: "callback" } }
  >["providerExecution"];
};

type PreparedGenerationJob =
  | PreparedImageGenerationJob
  | PreparedVideoGenerationJob;

type PreparedGenerationSubmission =
  | {
      modelType: "image";
      created: CreatedImageGenerationSubmission;
      jobs: PreparedImageGenerationJob[];
    }
  | {
      modelType: "video";
      created: CreatedVideoGenerationSubmission;
      jobs: PreparedVideoGenerationJob[];
    };

type CreateGenerationRequestContext = {
  userId: string;
  requestId: string;
};

export class GenerationOrchestrationService {
  private readonly workflows: GenerationWorkflowStarters;

  constructor(
    private readonly generation: Pick<
      GenerationService,
      | "createImageGenerationSubmission"
      | "createVideoGenerationSubmission"
      | "finalizeUnsuccessfulGenerationJob"
    >,
    workflows: Partial<GenerationWorkflowStarters> = {},
  ) {
    this.workflows = {
      startGenerationWorkflow,
      startGenerationThreadNameWorkflow,
      ...workflows,
    };
  }

  async createVideo({
    userId,
    requestId,
    input,
  }: CreateGenerationRequestContext & {
    input: CreateVideoGenerationInput;
  }): Promise<CreatedGenerationSubmission> {
    const created = await this.generation.createVideoGenerationSubmission({
      userId,
      input,
    });

    return this.createGeneration({
      userId,
      requestId,
      prepared: {
        modelType: "video",
        created,
        jobs: created.jobs.map(({ job, callbackToken }) => ({
          modelType: "video",
          job,
          submittedInput: created.submission.submittedInput,
          providerExecution: {
            mode: "callback",
            outputKind: "video",
            callbackUrl: this.buildGenerationCallbackUrl({
              providerId: job.providerId,
              jobId: job.id,
              token: callbackToken,
            }),
          },
        })),
      },
    });
  }

  async createImage({
    userId,
    requestId,
    input,
  }: CreateGenerationRequestContext & {
    input: CreateImageGenerationInput;
  }): Promise<CreatedGenerationSubmission> {
    const created = await this.generation.createImageGenerationSubmission({
      userId,
      input,
    });

    return this.createGeneration({
      userId,
      requestId,
      prepared: {
        modelType: "image",
        created,
        jobs: created.jobs.map((job) => ({
          modelType: "image",
          job,
          submittedInput: created.submission.submittedInput,
          providerExecution: {
            mode: "inline",
            outputKind: "image",
          },
        })),
      },
    });
  }

  private async createGeneration({
    userId,
    requestId,
    prepared,
  }: CreateGenerationRequestContext & {
    prepared: PreparedGenerationSubmission;
  }): Promise<CreatedGenerationSubmission> {
    const { created } = prepared;

    this.logSubmissionCreated({ created, requestId, userId });
    this.startThreadNameGeneration({ created, requestId });

    const jobs: CreatedGenerationSubmissionJob[] = [];

    for (const preparedJob of prepared.jobs) {
      jobs.push(
        await this.startJob({
          created,
          preparedJob,
          requestId,
          userId,
        }),
      );
    }

    return this.toCreatedWorkflowSubmission(created, jobs);
  }

  private async startJob({
    created,
    preparedJob,
    requestId,
    userId,
  }: {
    created:
      | CreatedImageGenerationSubmission
      | CreatedVideoGenerationSubmission;
    preparedJob: PreparedGenerationJob;
    requestId: string;
    userId: string;
  }): Promise<CreatedGenerationSubmissionJob> {
    const { job } = preparedJob;
    const workflowLogFields = {
      userId,
      requestId,
      submissionId: created.submission.id,
      jobId: job.id,
      threadId: created.submission.threadId,
      modelId: created.submission.modelId,
      modelSpecId: created.submission.modelSpecId,
      providerId: job.providerId,
      providerModelId: job.providerModelId,
    };
    const workflowStartedAt = Date.now();

    logGenerationLifecycleEvent(
      "generation.workflow.starting",
      workflowLogFields,
    );

    try {
      const workflowInputBase = {
        jobId: job.id,
        submissionId: created.submission.id,
        modelId: created.submission.modelId,
        modelSpecId: created.submission.modelSpecId,
        providerId: job.providerId,
        hasAttachmentMedia: hasAttachmentMedia(
          created.submission.attachmentMedia,
        ),
      };
      const workflowInput: GenerationWorkflowInput =
        preparedJob.modelType === "image"
          ? {
              ...workflowInputBase,
              submittedInput: preparedJob.submittedInput,
              providerExecution: preparedJob.providerExecution,
            }
          : {
              ...workflowInputBase,
              submittedInput: preparedJob.submittedInput,
              providerExecution: preparedJob.providerExecution,
            };
      const workflow =
        await this.workflows.startGenerationWorkflow(workflowInput);

      logGenerationLifecycleEvent("generation.workflow.started", {
        ...workflowLogFields,
        durationMs: Date.now() - workflowStartedAt,
        temporalWorkflowId: workflow.workflowId,
        temporalRunId: workflow.runId,
      });

      return {
        jobId: job.id,
        workflowId: workflow.workflowId,
        status: job.status,
        terminalError: null,
      };
    } catch (error) {
      logGenerationLifecycleEvent("generation.workflow.start_failed", {
        ...workflowLogFields,
        durationMs: Date.now() - workflowStartedAt,
        ...toErrorLogFields(error),
      });

      const failedJob = await this.generation.finalizeUnsuccessfulGenerationJob(
        {
          jobId: job.id,
          status: "failed",
          terminalError: this.serializeWorkflowStartFailure(error),
        },
      );

      return {
        jobId: job.id,
        workflowId: null,
        status: failedJob.status,
        terminalError: failedJob.terminalError,
      };
    }
  }

  private startThreadNameGeneration({
    created,
    requestId,
  }: {
    created:
      | CreatedImageGenerationSubmission
      | CreatedVideoGenerationSubmission;
    requestId: string;
  }) {
    if (!created.createdThread) {
      return;
    }

    const thread = created.createdThread;

    void this.workflows
      .startGenerationThreadNameWorkflow({
        threadId: thread.id,
        userId: thread.userId,
        prompt: created.submission.submittedInput.prompt,
        provisionalName: thread.name,
      })
      .catch((error) => {
        logGenerationThreadLifecycleEvent(
          "generation_thread.name_workflow_start_failed",
          {
            userId: thread.userId,
            requestId,
            threadId: thread.id,
            ...toErrorLogFields(error),
          },
        );
      });
  }

  private logSubmissionCreated({
    created,
    requestId,
    userId,
  }: {
    created:
      | CreatedImageGenerationSubmission
      | CreatedVideoGenerationSubmission;
    requestId: string;
    userId: string;
  }) {
    logGenerationLifecycleEvent("generation.submission.created", {
      userId,
      requestId,
      submissionId: created.submission.id,
      threadId: created.submission.threadId,
      modelId: created.submission.modelId,
      modelSpecId: created.submission.modelSpecId,
      requestedGenerations: created.submission.requestedGenerations,
      jobCount: created.jobs.length,
    });
  }

  private toCreatedWorkflowSubmission(
    created:
      | CreatedImageGenerationSubmission
      | CreatedVideoGenerationSubmission,
    jobs: CreatedGenerationSubmissionJob[],
  ): CreatedGenerationSubmission {
    return {
      submissionId: created.submission.id,
      threadId: created.submission.threadId,
      jobs,
    };
  }

  private serializeWorkflowStartFailure(error: unknown) {
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

  private buildGenerationCallbackUrl(input: {
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
}
