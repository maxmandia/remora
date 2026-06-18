import type {
  GenerationJobStatus,
  GenerationJobTerminalError,
  GenerationThreadSubmission,
  PublishedGenerationModelSummary,
} from "@remora/backend/types";

import type { GenerationSettingsValue } from "../../lib/generation/index.ts";

export type CreateOptimisticGenerationSubmissionInput = {
  model: PublishedGenerationModelSummary;
  prompt: string;
  requestedGenerations: number;
  settings: GenerationSettingsValue;
  threadId?: string;
  userId: string;
};

export type CreatedGenerationSubmissionResult = {
  submissionId: string;
  threadId: string;
  jobs: CreatedGenerationSubmissionJobResult[];
};

type CreatedGenerationSubmissionJobResult = {
  jobId: string;
  status: GenerationJobStatus;
  terminalError?: GenerationJobTerminalError | null;
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
  const createdAt = now.toISOString();
  const submissionId = createOptimisticGenerationSubmissionId();
  const optimisticThreadId = threadId ?? `${submissionId}:thread`;

  return {
    id: submissionId,
    threadId: optimisticThreadId,
    userId,
    modelId: model.id,
    modelSpecId: model.latestSpecId,
    submittedInput: {
      prompt: prompt.trim(),
      aspectRatio: settings.aspectRatio,
      duration: settings.duration,
      generateAudio: settings.generateAudio,
    },
    requestedGenerations,
    referenceMedia: {
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
        status: "queued",
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
}

export function prependGenerationSubmission(
  currentSubmissions: readonly GenerationThreadSubmission[] | undefined,
  submission: GenerationThreadSubmission,
): GenerationThreadSubmission[] {
  return [
    submission,
    ...(currentSubmissions ?? []).filter(
      (currentSubmission) => currentSubmission.id !== submission.id,
    ),
  ];
}

export function replaceGenerationSubmission(
  currentSubmissions: readonly GenerationThreadSubmission[] | undefined,
  optimisticSubmissionId: string | undefined,
  submission: GenerationThreadSubmission,
): GenerationThreadSubmission[] {
  if (!currentSubmissions || !optimisticSubmissionId) {
    return prependGenerationSubmission(currentSubmissions, submission);
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
    : prependGenerationSubmission(currentSubmissions, submission);
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
  createdSubmission: CreatedGenerationSubmissionResult,
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
