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
  ImageModelSpec,
  Model3dModelSpec,
  VideoModelSpec,
} from "@remora/domain/generation-model/dto";
import type {
  GenerationJobStatus,
  GenerationJobTerminalError,
  GenerationProviderTaskError,
  GenerationProviderTaskStatus,
  ImageGenerationSubmissionInput,
  Model3dGenerationSubmissionInput,
  VideoGenerationSubmissionInput,
} from "@remora/domain/generation-submission/dto";
import type { Readable } from "node:stream";
export {
  createImageGenerationFieldIds,
  createModel3dGenerationFieldIds,
  createVideoGenerationFieldIds,
  defaultRequestedGenerations,
  generationJobStatuses,
  generationResultAssetKinds,
  maxRequestedGenerations,
  minRequestedGenerations,
} from "@remora/domain/generation-submission/dto";
export {
  isTerminalGenerationJobStatus,
  terminalGenerationJobStatuses,
} from "@remora/domain/generation-submission/helpers";
export type { TerminalGenerationJobStatus } from "@remora/domain/generation-submission/helpers";
export type {
  AssertCreateImageGenerationFieldCoverage,
  AssertCreateImageGenerationFieldValueCoverage,
  AssertCreateModel3dGenerationFieldCoverage,
  AssertCreateModel3dGenerationFieldValueCoverage,
  AssertCreateVideoGenerationFieldCoverage,
  AssertCreateVideoGenerationFieldValueCoverage,
  CreateGenerationInputBase,
  CreateGenerationSubmissionInput,
  CreateImageGenerationFieldId,
  CreateImageGenerationFieldValues,
  CreateImageGenerationInput,
  CreateModel3dGenerationFieldId,
  CreateModel3dGenerationFieldValues,
  CreateModel3dGenerationInput,
  CreateVideoGenerationFieldId,
  CreateVideoGenerationFieldValues,
  CreateVideoGenerationInput,
  GenerationJobStatus,
  GenerationJobTerminalError,
  GenerationDraftEnhancementQuote,
  GenerationProviderTaskError,
  GenerationProviderTaskStatus,
  GenerationResultAssetKind,
  GenerationResultAssetReference,
  GenerationSubmissionInput,
  GenerationSubmissionInputByModelType,
  GenerationThreadJobResult,
  GenerationThreadSubmission,
  GenerationThreadSubmissionJob,
  ImageGenerationSubmissionInput,
  ImageGenerationThreadSubmission,
  Model3dGenerationSubmissionInput,
  Model3dGenerationThreadSubmission,
  Model3dGeometryQuality,
  Model3dTextureLevel,
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
  callbackUrl: string | null;
  draftEnhancementSourceJobId?: string;
  draftCacheBase64?: string;
};

export type PollVideoTaskInput = {
  modelId: string;
  modelSpecId: string;
  providerTaskId: string;
  pollingUrl: string;
  expectsDraftCache?: boolean;
};

export type CreateImageTaskInput = {
  jobId: string;
  modelId: string;
  modelSpecId: string;
  submittedInput: ImageGenerationSubmissionInput;
  attachmentMedia: SignedGenerationAttachmentMedia[];
};

export type CreateModel3dTaskInput = {
  jobId: string;
  modelId: string;
  modelSpecId: string;
  submittedInput: Model3dGenerationSubmissionInput;
  attachmentMedia: SignedGenerationAttachmentMedia[];
};

export type GenerationProviderTaskUsage = {
  completionTokens: number | null;
  totalTokens: number | null;
  inputTokens?: number | null;
  inputTextTokens?: number | null;
  inputImageTokens?: number | null;
  outputTextTokens?: number | null;
  outputImageTokens?: number | null;
  thoughtTokens?: number | null;
};

export type CreateVideoTaskResult =
  | {
      provider: "bfl";
      providerTaskId: string;
      providerModelId: string;
      pollingUrl: string;
    }
  | {
      provider: "byteplus" | "kling";
      providerTaskId: string;
      providerModelId: string;
      pollingUrl: null;
    };

export type CreateImageTaskResult = {
  provider: "google" | "openai";
  providerTaskId: string;
  providerModelId: string;
  image: {
    data: Buffer;
    contentType: "image/jpeg";
    contentLength: number;
  };
  usage: {
    inputTokens: number | null;
    inputTextTokens?: number | null;
    inputImageTokens?: number | null;
    outputTextTokens: number | null;
    outputImageTokens: number | null;
    thoughtTokens: number | null;
    totalTokens: number | null;
  } | null;
  rawPayload: unknown;
  receivedAt: string;
};

export type CreateModel3dTaskResult = {
  provider: "tripo";
  providerTaskId: string;
  providerModelId: string;
  pollingUrl: null;
};

export type GenerationImageDownload = {
  body: Readable;
  contentLength: number | null;
  contentType: string | null;
  filename: string;
};

export type GenerationModel3dDownload = {
  body: Readable;
  contentLength: number | null;
  contentType: string | null;
  filename: string;
};

export type GenerationProviderTaskResult = {
  provider: GenerationProviderId;
  providerTaskId: string;
  providerModelId: string | null;
  status: GenerationProviderTaskStatus;
  videoUrl: string | null;
  draftCacheUrl: string | null;
  modelUrl?: string | null;
  renderedImageUrl?: string | null;
  creditsConsumed?: number | null;
  usage: GenerationProviderTaskUsage | null;
  createdAt: number | null;
  updatedAt: number | null;
  providerError: GenerationProviderTaskError | null;
};

export type StoredGenerationDraftCacheReference = {
  bucket: string;
  objectKey: string;
  contentType: string | null;
  contentLength: number | null;
  etag: string | null;
  checksumSha256: string | null;
  sourceProviderUrl: string;
};

export type GenerationDraftEnhancementSourceJob = {
  jobId: string;
  submissionIndex: number;
  status: GenerationJobStatus;
  draftCache: StoredGenerationDraftCacheReference | null;
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

export type Model3dGenerationSubmissionRecord =
  GenerationSubmissionRecordBase & {
    modelType: "model3d";
    submittedInput: Model3dGenerationSubmissionInput;
  };

export type GenerationSubmissionRecord =
  | VideoGenerationSubmissionRecord
  | ImageGenerationSubmissionRecord
  | Model3dGenerationSubmissionRecord;

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
      spec: ImageModelSpec;
    })
  | (GenerationModelSpecRecordBase & {
      modelType: "model3d";
      spec: Model3dModelSpec;
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
    })
  | (GenerationJobWithSubmissionContextBase & {
      modelType: "model3d";
      submittedInput: Model3dGenerationSubmissionInput;
    });

export type GenerationImageResultAssetContext = {
  status: GenerationJobStatus;
  userId: string;
  asset: {
    bucket: string;
    objectKey: string;
    contentLength: number | null;
    contentType: string | null;
  } | null;
};

export type GenerationModel3dResultAssetContext =
  GenerationImageResultAssetContext;

export type GenerationImageDownloadUrl = {
  url: string;
  contentType: string | null;
};

export type CreatedGenerationJobRecord = GenerationJobRecord & {
  providerId: string;
};

export type CreatedVideoGenerationSubmissionJob =
  | {
      job: CreatedGenerationJobRecord;
      providerExecution: {
        mode: "callback";
        callbackToken: string;
      };
    }
  | {
      job: CreatedGenerationJobRecord;
      providerExecution: {
        mode: "polling";
      };
      draftEnhancementSourceJobId?: string;
    };

export type CreatedVideoGenerationSubmission = {
  submission: VideoGenerationSubmissionRecord;
  jobs: CreatedVideoGenerationSubmissionJob[];
  createdThread: GenerationThreadRecord | null;
};

export type CreatedDraftEnhancementSubmission = Omit<
  CreatedVideoGenerationSubmission,
  "jobs"
> & {
  jobs: Array<{
    job: CreatedGenerationJobRecord;
    providerExecution: { mode: "polling" };
    draftEnhancementSourceJobId: string;
  }>;
};

export type CreatedImageGenerationSubmission = {
  submission: ImageGenerationSubmissionRecord;
  jobs: CreatedGenerationJobRecord[];
  createdThread: GenerationThreadRecord | null;
};

export type CreatedModel3dGenerationSubmission = {
  submission: Model3dGenerationSubmissionRecord;
  jobs: CreatedGenerationJobRecord[];
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

export class GenerationSubmissionNotFoundError extends Error {
  constructor() {
    super("Generation submission was not found");
    this.name = "GenerationSubmissionNotFoundError";
  }
}

export class GenerationSubmissionRetryUnavailableError extends Error {
  constructor() {
    super("This model is no longer available");
    this.name = "GenerationSubmissionRetryUnavailableError";
  }
}

export class GenerationDraftEnhancementUnavailableError extends Error {
  constructor(message = "This draft cannot be enhanced") {
    super(message);
    this.name = "GenerationDraftEnhancementUnavailableError";
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

export class GenerationImageDownloadNotFoundError extends Error {
  constructor() {
    super("Generated image was not found");
    this.name = "GenerationImageDownloadNotFoundError";
  }
}

export class GenerationModel3dDownloadNotFoundError extends Error {
  constructor() {
    super("Generated 3D model was not found");
    this.name = "GenerationModel3dDownloadNotFoundError";
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
