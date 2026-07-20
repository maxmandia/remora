import type {
  SignedGenerationAttachmentMedia,
  StoredGenerationAttachmentMediaWithPosition,
} from "../generation-attachment-media/generation-attachment-media.types.ts";
import type { GenerationThreadRecord } from "../generation-thread/generation-thread.types.ts";
import type {
  GenerationModelAdapter,
  GenerationModelRateLimitMode,
} from "../model/model.types.ts";
import type { GenerationThreadAttachmentMediaValue } from "@remora/domain/generation-attachment-media/dto";
import type {
  GenerationModelType,
  GenerationProviderId,
  GenerationPublicationStatus,
  VideoModelSpec,
} from "@remora/domain/generation-model/dto";
import type {
  GenerationJobStatus,
  GenerationJobTerminalError,
  GenerationProviderTaskError,
  GenerationProviderTaskStatus,
  ImageGenerationSubmissionInput,
  VideoGenerationSubmissionInput,
} from "@remora/domain/generation-submission/dto";
export {
  createImageGenerationFieldIds,
  createVideoGenerationFieldIds,
  defaultRequestedGenerations,
  generationJobStatuses,
  generationResultAssetKinds,
  maxRequestedGenerations,
  minRequestedGenerations,
} from "@remora/domain/generation-submission/dto";
export type {
  AssertCreateImageGenerationFieldCoverage,
  AssertCreateImageGenerationFieldValueCoverage,
  AssertCreateVideoGenerationFieldCoverage,
  AssertCreateVideoGenerationFieldValueCoverage,
  CreateGenerationInputBase,
  CreateGenerationSubmissionInput,
  CreateImageGenerationFieldId,
  CreateImageGenerationFieldValues,
  CreateImageGenerationInput,
  CreateVideoGenerationFieldId,
  CreateVideoGenerationFieldValues,
  CreateVideoGenerationInput,
  GenerationJobStatus,
  GenerationJobTerminalError,
  GenerationProviderTaskError,
  GenerationProviderTaskStatus,
  GenerationResultAssetKind,
  GenerationSubmissionInput,
  GenerationSubmissionInputByModelType,
  GenerationThreadJobResult,
  GenerationThreadSubmission,
  GenerationThreadSubmissionJob,
  ImageGenerationSubmissionInput,
  ImageGenerationThreadSubmission,
  StoredGenerationResultAssetReference,
  StoredGenerationResultPreviewReference,
  VideoGenerationSubmissionInput,
  VideoGenerationThreadSubmission,
} from "@remora/domain/generation-submission/dto";

export type CreateVideoTaskInput = {
  jobId: string;
  modelId: string;
  modelSpecId: string;
  submittedInput: VideoGenerationSubmissionInput;
  attachmentMedia: SignedGenerationAttachmentMedia[];
  callbackUrl: string;
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

type GenerationSubmissionRecordBase = {
  id: string;
  threadId: string;
  userId: string;
  modelId: string;
  modelSpecId: string;
  requestedGenerations: number;
  attachmentMedia: GenerationThreadAttachmentMediaValue;
  createdAt: Date;
  updatedAt: Date;
};

export type VideoGenerationSubmissionRecord = GenerationSubmissionRecordBase & {
  modelType: "video";
  submittedInput: VideoGenerationSubmissionInput;
};

export type ImageGenerationSubmissionRecord = GenerationSubmissionRecordBase & {
  modelType: "image";
  submittedInput: ImageGenerationSubmissionInput;
};

export type GenerationSubmissionRecord =
  | VideoGenerationSubmissionRecord
  | ImageGenerationSubmissionRecord;

type GenerationModelSpecRecordBase = {
  id: string;
  modelId: string;
  providerId: string;
  status: GenerationPublicationStatus;
  adapter: GenerationModelAdapter | null;
  rateLimitMode: GenerationModelRateLimitMode;
};

export type GenerationModelSpecRecord =
  | (GenerationModelSpecRecordBase & {
      modelType: "video";
      spec: VideoModelSpec;
    })
  | (GenerationModelSpecRecordBase & {
      modelType: "image";
      spec: unknown;
    });

type GenerationJobWithSubmissionContextBase = GenerationJobRecord & {
  threadId: string;
  userId: string;
  modelId: string;
  modelSpecId: string;
  requestedGenerations: number;
  attachmentMedia: StoredGenerationAttachmentMediaWithPosition[];
};

export type GenerationJobWithSubmissionContext =
  | (GenerationJobWithSubmissionContextBase & {
      modelType: "video";
      submittedInput: VideoGenerationSubmissionInput;
    })
  | (GenerationJobWithSubmissionContextBase & {
      modelType: "image";
      submittedInput: ImageGenerationSubmissionInput;
    });

export type CreatedGenerationJobRecord = GenerationJobRecord & {
  providerId: string;
};

export type CreatedVideoGenerationSubmissionJob = {
  job: CreatedGenerationJobRecord;
  callbackToken: string;
};

export type CreatedVideoGenerationSubmission = {
  submission: VideoGenerationSubmissionRecord;
  jobs: CreatedVideoGenerationSubmissionJob[];
  createdThread: GenerationThreadRecord | null;
};

export class GenerationModelTypeMismatchError extends Error {
  readonly code = "GENERATION_MODEL_TYPE_MISMATCH";

  constructor(
    readonly modelId: string,
    readonly expectedModelType: GenerationModelType,
    readonly actualModelType: GenerationModelType,
  ) {
    super(
      `Generation model ${modelId} is ${actualModelType}, not ${expectedModelType}`,
    );
    this.name = "GenerationModelTypeMismatchError";
  }
}

export class GenerationSubmissionInputParseError extends Error {
  readonly code = "INVALID_GENERATION_SUBMITTED_INPUT";

  constructor(
    readonly modelType: GenerationModelType,
    options?: ErrorOptions,
  ) {
    super(`Invalid ${modelType} generation submitted input`, options);
    this.name = "GenerationSubmissionInputParseError";
  }
}

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
