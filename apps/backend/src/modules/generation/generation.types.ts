import type {
  GenerationAttachmentMediaInput,
  SignedGenerationAttachmentMedia,
  GenerationThreadAttachmentMediaValue,
  StoredGenerationAttachmentMediaWithPosition,
} from "../generation-attachment-media/generation-attachment-media.types.ts";
import type { GenerationThreadRecord } from "../generation-thread/generation-thread.types.ts";
import type {
  CanonicalVideoFieldId,
  GenerationProviderId,
} from "../model/model.types.ts";

export const generationJobStatuses = [
  "queued",
  "creating_provider_task",
  "provider_task_created",
  "waiting_for_provider_callback",
  "succeeded",
  "failed",
  "cancelled",
  "expired",
  "final_cost_calculation_failure",
] as const;

export type GenerationJobStatus = (typeof generationJobStatuses)[number];

export const generationResultAssetKinds = ["video", "image"] as const;

export type GenerationResultAssetKind =
  (typeof generationResultAssetKinds)[number];

export const defaultRequestedGenerations = 1;
export const minRequestedGenerations = 1;
export const maxRequestedGenerations = 15;

export type StoredGenerationResultAssetReference = {
  kind: GenerationResultAssetKind;
  bucket: string;
  objectKey: string;
  contentType: string | null;
  contentLength: number | null;
  etag: string | null;
  checksumSha256: string | null;
  sourceProviderUrl: string | null;
};

export type StoredGenerationResultPreviewReference = {
  bucket: string;
  objectKey: string;
  contentType: string | null;
  contentLength: number | null;
  etag: string | null;
  checksumSha256: string | null;
  frameTimeMs: number;
};

export const createVideoGenerationFieldIds = [
  "prompt",
  "resolution",
  "aspectRatio",
  "duration",
  "generateAudio",
] as const satisfies readonly CanonicalVideoFieldId[];

export type CreateVideoGenerationFieldId =
  (typeof createVideoGenerationFieldIds)[number];

type NonCreateVideoGenerationFieldId = "callbackUrl";
type AssertNever<T extends never> = T;

export type AssertCreateVideoGenerationFieldCoverage = AssertNever<
  Exclude<
    CanonicalVideoFieldId,
    CreateVideoGenerationFieldId | NonCreateVideoGenerationFieldId
  >
>;

export type CreateVideoGenerationFieldValues = {
  prompt: string;
  resolution: string;
  aspectRatio: string;
  duration: number;
  generateAudio: boolean;
};

export type AssertCreateVideoGenerationFieldValueCoverage = AssertNever<
  | Exclude<
      CreateVideoGenerationFieldId,
      keyof CreateVideoGenerationFieldValues
    >
  | Exclude<
      keyof CreateVideoGenerationFieldValues,
      CreateVideoGenerationFieldId
    >
>;

export type CreateVideoGenerationInput = {
  modelId: string;
  modelSpecId: string;
  threadId?: string;
  projectId?: string;
  requestedGenerations: number;
  attachmentMedia?: GenerationAttachmentMediaInput;
} & CreateVideoGenerationFieldValues;

export type GenerationSubmissionInput = Pick<
  CreateVideoGenerationInput,
  CreateVideoGenerationFieldId
>;

export type CreateVideoTaskInput = {
  jobId: string;
  modelId: string;
  modelSpecId: string;
  submittedInput: GenerationSubmissionInput;
  attachmentMedia: SignedGenerationAttachmentMedia[];
  callbackUrl: string;
};

export type GenerationProviderTaskStatus =
  | "queued"
  | "running"
  | "cancelled"
  | "succeeded"
  | "failed"
  | "expired";

export type GenerationProviderTaskError = {
  code: string | null;
  message: string | null;
};

export type GenerationProviderTaskUsage = {
  completionTokens: number | null;
  totalTokens: number | null;
};

export type CreateVideoTaskResult = {
  provider: GenerationProviderId;
  providerTaskId: string;
  providerModelId: string;
};

export type GenerationProviderTaskResult = {
  provider: GenerationProviderId;
  providerTaskId: string;
  providerModelId: string | null;
  status: GenerationProviderTaskStatus;
  videoUrl: string | null;
  usage: GenerationProviderTaskUsage | null;
  createdAt: number | null;
  updatedAt: number | null;
  providerError: GenerationProviderTaskError | null;
};

export type GenerationJobTerminalError = {
  source: "internal" | "provider";
  code: string | null;
  message: string | null;
};

export type FinalizeUnsuccessfulGenerationJobInput =
  | {
      jobId: string;
      status: "failed";
      terminalError: GenerationJobTerminalError;
    }
  | {
      jobId: string;
      status: "cancelled" | "expired";
      terminalError: GenerationJobTerminalError | null;
    };

export type GenerationJobRecord = {
  id: string;
  submissionId: string;
  submissionIndex: number;
  status: GenerationJobStatus;
  temporalWorkflowId: string | null;
  temporalRunId: string | null;
  callbackTokenHash: string | null;
  providerId: string | null;
  providerTaskId: string | null;
  providerModelId: string | null;
  terminalError: GenerationJobTerminalError | null;
  terminalAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type GenerationSubmissionRecord = {
  id: string;
  threadId: string;
  userId: string;
  modelId: string;
  modelSpecId: string;
  submittedInput: GenerationSubmissionInput;
  requestedGenerations: number;
  attachmentMedia: GenerationThreadAttachmentMediaValue;
  createdAt: Date;
  updatedAt: Date;
};

export type GenerationJobWithSubmissionContext = GenerationJobRecord & {
  threadId: string;
  userId: string;
  modelId: string;
  modelSpecId: string;
  submittedInput: GenerationSubmissionInput;
  requestedGenerations: number;
  attachmentMedia: StoredGenerationAttachmentMediaWithPosition[];
};

export type CreatedGenerationJobRecord = GenerationJobRecord & {
  providerId: string;
};

export type GenerationThreadJobResult = {
  providerId: string;
  providerTaskId: string;
  providerModelId: string | null;
  providerStatus: GenerationProviderTaskStatus;
  videoUrl: string | null;
  previewImageUrl: string | null;
  mediaUrlExpiresAt: string | null;
  assets?: StoredGenerationResultAssetReference[];
  preview?: StoredGenerationResultPreviewReference | null;
  providerError: GenerationProviderTaskError | null;
  receivedAt: string;
  createdAt: string;
  updatedAt: string;
};

export type GenerationThreadSubmissionJob = {
  id: string;
  submissionId: string;
  submissionIndex: number;
  status: GenerationJobStatus;
  providerId: string | null;
  providerTaskId: string | null;
  providerModelId: string | null;
  terminalError: GenerationJobTerminalError | null;
  createdAt: string;
  updatedAt: string;
  result: GenerationThreadJobResult | null;
};

export type GenerationThreadSubmission = {
  id: string;
  threadId: string;
  userId: string;
  modelId: string;
  modelDisplayName: string;
  modelSpecId: string;
  submittedInput: GenerationSubmissionInput;
  requestedGenerations: number;
  attachmentMedia: GenerationThreadAttachmentMediaValue;
  createdAt: string;
  updatedAt: string;
  jobs: GenerationThreadSubmissionJob[];
};

export type CreatedVideoGenerationSubmissionJob = {
  job: CreatedGenerationJobRecord;
  callbackToken: string;
};

export type CreatedVideoGenerationSubmission = {
  submission: GenerationSubmissionRecord;
  jobs: CreatedVideoGenerationSubmissionJob[];
  createdThread: GenerationThreadRecord | null;
};

export class UnsupportedGenerationModelError extends Error {
  readonly code = "UNSUPPORTED_MODEL";

  constructor(modelId: string) {
    super(`Unsupported generation model: ${modelId}`);
    this.name = "UnsupportedGenerationModelError";
  }
}

export class GenerationInputValidationError extends Error {
  readonly code = "INVALID_GENERATION_INPUT";
  readonly field: string;

  constructor(field: string, message: string) {
    super(message);
    this.name = "GenerationInputValidationError";
    this.field = field;
  }
}

export type GenerationProviderResultCallback = {
  kind: "result";
  result: GenerationProviderTaskResult;
  rawPayload: unknown;
  receivedAt: string;
};

export type GenerationProviderMalformedCallback = {
  kind: "malformed";
  terminalError: GenerationJobTerminalError;
  rawPayload: unknown;
  receivedAt: string;
};

export type GenerationProviderCallback =
  | GenerationProviderResultCallback
  | GenerationProviderMalformedCallback;

export class GenerationProviderTaskMismatchError extends Error {
  readonly code = "PROVIDER_TASK_ID_MISMATCH";

  constructor(
    readonly expectedProviderTaskId: string,
    readonly receivedProviderTaskId: string,
  ) {
    super("Provider task id did not match generation job");
    this.name = "GenerationProviderTaskMismatchError";
  }
}
