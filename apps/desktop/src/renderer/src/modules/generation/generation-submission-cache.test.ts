import type {
  GenerationThreadSubmission,
  PublishedGenerationModelSummary,
} from "@remora/backend/types";
import { describe, expect, it } from "vitest";

import type { GenerationSettingsValue } from "../../lib/generation/index.ts";
import {
  createOptimisticGenerationSubmission,
  prependGenerationSubmission,
  reconcileOptimisticGenerationSubmission,
  removeGenerationSubmission,
  replaceGenerationSubmission,
} from "./generation-submission-cache.ts";

describe("generation submission cache helpers", () => {
  it("creates optimistic generation submissions", () => {
    const submission = createOptimisticGenerationSubmission(
      {
        model: createModel(),
        prompt: "  A glass studio above the ocean  ",
        requestedGenerations: 2,
        settings: createSettings({ requestedGenerations: 2 }),
        threadId: "thread_1",
        userId: "user_1",
      },
      new Date("2026-06-15T12:00:00.000Z"),
    );

    expect(submission).toEqual({
      id: expect.stringMatching(/^optimistic-generation-submission:\d+$/),
      threadId: "thread_1",
      userId: "user_1",
      modelId: "seedance-2.0-video",
      modelSpecId: "seedance-2.0-video-v1",
      submittedInput: {
        prompt: "A glass studio above the ocean",
        aspectRatio: "16:9",
        duration: 5,
        generateAudio: true,
      },
      requestedGenerations: 2,
      attachmentMedia: {
        images: [],
        videos: [],
        audios: [],
      },
      createdAt: "2026-06-15T12:00:00.000Z",
      updatedAt: "2026-06-15T12:00:00.000Z",
      jobs: [
        expect.objectContaining({
          id: `${submission.id}:job:0`,
          submissionId: submission.id,
          submissionIndex: 0,
          status: "queued",
        }),
        expect.objectContaining({
          id: `${submission.id}:job:1`,
          submissionId: submission.id,
          submissionIndex: 1,
          status: "queued",
        }),
      ],
    });
  });

  it("prepends submissions without duplicating the same submission id", () => {
    const existingSubmission = createSubmission({
      id: "submission_existing",
    });
    const optimisticSubmission = createSubmission({
      id: "optimistic-generation-submission:1",
    });
    const currentSubmissions = [optimisticSubmission, existingSubmission];

    const nextSubmissions = prependGenerationSubmission(
      currentSubmissions,
      optimisticSubmission,
    );

    expect(nextSubmissions).toEqual([optimisticSubmission, existingSubmission]);
    expect(nextSubmissions).not.toBe(currentSubmissions);
  });

  it("replaces optimistic submissions and removes duplicate server rows", () => {
    const optimisticSubmission = createSubmission({
      id: "optimistic-generation-submission:1",
    });
    const createdSubmission = createSubmission({
      id: "submission_created",
    });
    const duplicateCreatedSubmission = createSubmission({
      id: "submission_created",
      submittedInput: { prompt: "stale duplicate" },
    });
    const existingSubmission = createSubmission({
      id: "submission_existing",
    });

    expect(
      replaceGenerationSubmission(
        [optimisticSubmission, duplicateCreatedSubmission, existingSubmission],
        optimisticSubmission.id,
        createdSubmission,
      ),
    ).toEqual([createdSubmission, existingSubmission]);
  });

  it("prepends reconciled submissions when the optimistic row is absent", () => {
    const existingSubmission = createSubmission({
      id: "submission_existing",
    });
    const createdSubmission = createSubmission({
      id: "submission_created",
    });

    expect(
      replaceGenerationSubmission(
        [existingSubmission],
        "optimistic-generation-submission:missing",
        createdSubmission,
      ),
    ).toEqual([createdSubmission, existingSubmission]);
  });

  it("removes only the requested submission on rollback", () => {
    const optimisticSubmission = createSubmission({
      id: "optimistic-generation-submission:1",
    });
    const concurrentSubmission = createSubmission({
      id: "optimistic-generation-submission:2",
    });
    const existingSubmission = createSubmission({
      id: "submission_existing",
    });

    expect(
      removeGenerationSubmission(
        [optimisticSubmission, concurrentSubmission, existingSubmission],
        optimisticSubmission.id,
      ),
    ).toEqual([concurrentSubmission, existingSubmission]);
  });

  it("reconciles optimistic submissions with returned submission and job ids", () => {
    const optimisticSubmission = createSubmission({
      id: "optimistic-generation-submission:1",
      threadId: "optimistic-generation-submission:1:thread",
      jobs: [
        createSubmissionJob({
          id: "optimistic-generation-submission:1:job:0",
          submissionId: "optimistic-generation-submission:1",
          status: "queued",
        }),
        createSubmissionJob({
          id: "optimistic-generation-submission:1:job:1",
          submissionId: "optimistic-generation-submission:1",
          submissionIndex: 1,
          status: "queued",
        }),
      ],
    });

    expect(
      reconcileOptimisticGenerationSubmission(optimisticSubmission, {
        submissionId: "submission_created",
        threadId: "thread_created",
        jobs: [
          { jobId: "job_created_1", status: "queued" },
          {
            jobId: "job_created_2",
            status: "failed",
            terminalError: {
              source: "provider",
              code: "provider_unavailable",
              message: "Provider unavailable",
            },
          },
        ],
      }),
    ).toEqual({
      ...optimisticSubmission,
      id: "submission_created",
      threadId: "thread_created",
      jobs: [
        {
          ...optimisticSubmission.jobs[0],
          id: "job_created_1",
          submissionId: "submission_created",
          status: "queued",
          terminalError: null,
        },
        {
          ...optimisticSubmission.jobs[1],
          id: "job_created_2",
          submissionId: "submission_created",
          status: "failed",
          terminalError: {
            source: "provider",
            code: "provider_unavailable",
            message: "Provider unavailable",
          },
        },
      ],
    });
  });
});

function createModel(): PublishedGenerationModelSummary {
  return {
    id: "seedance-2.0-video",
    providerId: "byteplus",
    providerName: "BytePlus",
    displayName: "Seedance 2.0",
    type: "video",
    latestSpecId: "seedance-2.0-video-v1",
    latestSpecVersion: 1,
    spec: {
      schemaVersion: 1,
      id: "seedance-2.0-video",
      provider: "byteplus",
      providerModelId: "dreamina-seedance-2-0-260128",
      displayName: "Seedance 2.0",
      type: "video",
      status: "published",
      sourceUrls: [],
      endpoint: {
        method: "POST",
        path: "/contents/generations/tasks",
      },
      modelParameter: {
        path: ["model"],
        source: "spec",
      },
      fields: [
        {
          id: "aspectRatio",
          label: "Aspect ratio",
          componentKind: "select",
          valueKind: "string",
          required: true,
          advanced: false,
          defaultValue: "16:9",
          omitWhenEmpty: false,
          omitWhenDefault: false,
          notes: [],
        },
      ],
      groups: [
        {
          id: "output",
          label: "Output",
          fieldIds: ["aspectRatio"],
          advanced: false,
        },
      ],
      transforms: [{ kind: "seedanceContentArray" }],
      validationRules: ["seedance20ContentRules"],
    },
  };
}

function createSettings(
  overrides: Partial<GenerationSettingsValue> = {},
): GenerationSettingsValue {
  return {
    aspectRatio: "16:9",
    duration: 5,
    generateAudio: true,
    requestedGenerations: 1,
    ...overrides,
  };
}

function createSubmission(
  overrides: Partial<
    Omit<GenerationThreadSubmission, "jobs" | "submittedInput">
  > & {
    jobs?: GenerationThreadSubmission["jobs"];
    submittedInput?: Partial<GenerationThreadSubmission["submittedInput"]>;
  } = {},
): GenerationThreadSubmission {
  const { jobs, submittedInput, requestedGenerations, ...submissionOverrides } =
    overrides;
  const id = submissionOverrides.id ?? "submission_1";
  const createdJobs = jobs ?? [
    createSubmissionJob({
      submissionId: id,
    }),
  ];

  return {
    id,
    threadId: "thread_1",
    userId: "user_1",
    modelId: "seedance-2.0-video",
    modelSpecId: "seedance-2.0-video-v1",
    submittedInput: {
      prompt: "A quiet ocean studio",
      aspectRatio: "16:9",
      duration: 5,
      generateAudio: true,
      ...submittedInput,
    },
    requestedGenerations: requestedGenerations ?? createdJobs.length,
    attachmentMedia: {
      images: [],
      videos: [],
      audios: [],
    },
    createdAt: "2026-06-05T00:00:00.000Z",
    updatedAt: "2026-06-05T00:01:00.000Z",
    jobs: createdJobs,
    ...submissionOverrides,
  };
}

function createSubmissionJob(
  overrides: Partial<GenerationThreadSubmission["jobs"][number]> = {},
): GenerationThreadSubmission["jobs"][number] {
  return {
    id: "job_1",
    submissionId: "submission_1",
    submissionIndex: 0,
    status: "queued",
    providerId: null,
    providerTaskId: null,
    providerModelId: null,
    terminalError: null,
    createdAt: "2026-06-05T00:00:00.000Z",
    updatedAt: "2026-06-05T00:01:00.000Z",
    result: null,
    ...overrides,
  };
}
