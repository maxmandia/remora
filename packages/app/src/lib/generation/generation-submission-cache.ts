import type {
  CreatedGenerationSubmission,
  GenerationThreadSubmission,
} from "@remora/domain/generation-submission/dto";
import type { PublishedGenerationModelSummary } from "@remora/domain/generation-model/dto";

import type { GenerationSettingsValue } from "./generation-settings.ts";

export type CreateOptimisticGenerationSubmissionInput = {
  model: PublishedGenerationModelSummary;
  prompt: string;
  requestedGenerations: number;
  settings: GenerationSettingsValue;
  threadId?: string;
  userId: string;
};

let optimisticGenerationSubmissionSequence = 0;

export function createOptimisticGenerationSubmission(
  {
    model,
    prompt,
    requestedGenerations,
    settings,
    threadId,
    userId,
  }: CreateOptimisticGenerationSubmissionInput,
  now = new Date(),
): GenerationThreadSubmission {
  if (model.type !== settings.modelType) {
    throw new Error("Generation model and settings types do not match");
  }

  const createdAt = now.toISOString();
  const submissionId = createOptimisticGenerationSubmissionId();
  const optimisticThreadId = threadId ?? `${submissionId}:thread`;

  const submissionBase = {
    id: submissionId,
    threadId: optimisticThreadId,
    userId,
    modelId: model.id,
    modelDisplayName: model.displayName,
    modelSpecId: model.latestSpecId,
    requestedGenerations,
    attachmentMedia: {
      images: [],
      videos: [],
      audios: [],
    },
    createdAt,
    updatedAt: createdAt,
    jobs: Array.from(
      { length: requestedGenerations },
      (_, submissionIndex) => ({
        id: `${submissionId}:job:${submissionIndex}`,
        submissionId,
        submissionIndex,
        status: "queued" as const,
        providerId: null,
        providerTaskId: null,
        providerModelId: null,
        terminalError: null,
        createdAt,
        updatedAt: createdAt,
        result: null,
      }),
    ),
  };

  if (settings.modelType === "image") {
    return {
      ...submissionBase,
      modelType: "image",
      submittedInput: {
        prompt: prompt.trim(),
        resolution: settings.resolution,
        aspectRatio: settings.aspectRatio,
      },
    };
  }

  return {
    ...submissionBase,
    modelType: "video",
    submittedInput: {
      prompt: prompt.trim(),
      resolution: settings.resolution,
      aspectRatio: settings.aspectRatio,
      duration: settings.duration,
      generateAudio: settings.generateAudio,
    },
  };
}

export function createOptimisticGenerationSubmissionRetry(
  submission: GenerationThreadSubmission,
  now = new Date(),
): GenerationThreadSubmission {
  const createdAt = now.toISOString();
  const submissionId = createOptimisticGenerationSubmissionId();
  const submissionBase = {
    ...submission,
    id: submissionId,
    createdAt,
    updatedAt: createdAt,
    jobs: Array.from(
      { length: submission.requestedGenerations },
      (_, submissionIndex) => ({
        id: `${submissionId}:job:${submissionIndex}`,
        submissionId,
        submissionIndex,
        status: "queued" as const,
        providerId: null,
        providerTaskId: null,
        providerModelId: null,
        terminalError: null,
        createdAt,
        updatedAt: createdAt,
        result: null,
      }),
    ),
  };

  return submission.modelType === "video"
    ? {
        ...submissionBase,
        modelType: "video",
        submittedInput: submission.submittedInput,
      }
    : {
        ...submissionBase,
        modelType: "image",
        submittedInput: submission.submittedInput,
      };
}

export function isOptimisticGenerationSubmission(
  submission: Pick<GenerationThreadSubmission, "id">,
) {
  return submission.id.startsWith("optimistic-generation-submission:");
}

export function appendGenerationSubmission(
  currentSubmissions: readonly GenerationThreadSubmission[] | undefined,
  submission: GenerationThreadSubmission,
): GenerationThreadSubmission[] {
  return [
    ...(currentSubmissions ?? []).filter(
      (currentSubmission) => currentSubmission.id !== submission.id,
    ),
    submission,
  ];
}

export function replaceGenerationSubmission(
  currentSubmissions: readonly GenerationThreadSubmission[] | undefined,
  optimisticSubmissionId: string | undefined,
  submission: GenerationThreadSubmission,
): GenerationThreadSubmission[] {
  if (!currentSubmissions || !optimisticSubmissionId) {
    return appendGenerationSubmission(currentSubmissions, submission);
  }

  let didReplace = false;
  const nextSubmissions: GenerationThreadSubmission[] = [];

  for (const currentSubmission of currentSubmissions) {
    if (currentSubmission.id === optimisticSubmissionId) {
      didReplace = true;
      nextSubmissions.push(submission);
      continue;
    }

    if (currentSubmission.id === submission.id) {
      continue;
    }

    nextSubmissions.push(currentSubmission);
  }

  return didReplace
    ? nextSubmissions
    : appendGenerationSubmission(currentSubmissions, submission);
}

export function removeGenerationSubmission(
  currentSubmissions: readonly GenerationThreadSubmission[] | undefined,
  submissionId: string,
): GenerationThreadSubmission[] {
  return (currentSubmissions ?? []).filter(
    (submission) => submission.id !== submissionId,
  );
}

export function reconcileOptimisticGenerationSubmission(
  optimisticSubmission: GenerationThreadSubmission,
  createdSubmission: CreatedGenerationSubmission,
): GenerationThreadSubmission {
  return {
    ...optimisticSubmission,
    id: createdSubmission.submissionId,
    threadId: createdSubmission.threadId,
    jobs: optimisticSubmission.jobs.map((optimisticJob, index) => {
      const createdJob = createdSubmission.jobs[index];

      return {
        ...optimisticJob,
        id: createdJob?.jobId ?? optimisticJob.id,
        submissionId: createdSubmission.submissionId,
        status: createdJob?.status ?? optimisticJob.status,
        terminalError: createdJob?.terminalError ?? null,
      };
    }),
  };
}

function createOptimisticGenerationSubmissionId() {
  optimisticGenerationSubmissionSequence += 1;

  return `optimistic-generation-submission:${optimisticGenerationSubmissionSequence}`;
}
