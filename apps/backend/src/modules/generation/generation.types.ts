import type {
  GenerationAttachmentMediaInput,
  GenerationThreadAttachmentMediaValue,
} from "../generation-attachment-media/generation-attachment-media.types.ts";
import type {
  CanonicalVideoFieldId,
  VideoModelSpec,
} from "../model/model.types.ts";

export const defaultSeedanceVideoGenerationModelId = "seedance-2.0-video";
export const seedance20FastVideoGenerationModelId = "seedance-2.0-fast-video";

export const supportedVideoGenerationModelIds = [
  defaultSeedanceVideoGenerationModelId,
  seedance20FastVideoGenerationModelId,
] as const;

export type SupportedVideoGenerationModelId =
  (typeof supportedVideoGenerationModelIds)[number];

export function isSupportedVideoGenerationModelId(
  modelId: string,
): modelId is SupportedVideoGenerationModelId {
  return supportedVideoGenerationModelIds.includes(
    modelId as SupportedVideoGenerationModelId,
  );
}

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

export const generationResultAssetKinds = ["video"] as const;

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
  modelSpecId?: string;
  threadId?: string;
  projectId?: string;
  requestedGenerations: number;
  attachmentMedia?: GenerationAttachmentMediaInput;
} & CreateVideoGenerationFieldValues;

export type GenerationSubmissionInput = Pick<
  CreateVideoGenerationInput,
  CreateVideoGenerationFieldId
>;

export type GenerationJobTerminalError = {
  source: "internal" | "provider";
  code: string | null;
  message: string | null;
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
};

export type GenerationThreadSummary = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
};

export type GenerationThreadJobResult = {
  providerId: string;
  providerTaskId: string;
  providerModelId: string | null;
  providerStatus: SeedanceProviderStatus;
  videoUrl: string | null;
  previewImageUrl: string | null;
  mediaUrlExpiresAt: string | null;
  assets?: StoredGenerationResultAssetReference[];
  preview?: StoredGenerationResultPreviewReference | null;
  providerError: SeedanceProviderError | null;
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
  modelSpecId: string;
  submittedInput: GenerationSubmissionInput;
  requestedGenerations: number;
  attachmentMedia: GenerationThreadAttachmentMediaValue;
  createdAt: string;
  updatedAt: string;
  jobs: GenerationThreadSubmissionJob[];
};

export type CreatedVideoGenerationSubmissionJob = {
  job: GenerationJobRecord;
  callbackToken: string;
};

export type CreatedVideoGenerationSubmission = {
  submission: GenerationSubmissionRecord;
  jobs: CreatedVideoGenerationSubmissionJob[];
};

export class GenerationThreadNotFoundError extends Error {
  readonly code = "GENERATION_THREAD_NOT_FOUND";

  constructor(threadId: string) {
    super(`Generation thread was not found: ${threadId}`);
    this.name = "GenerationThreadNotFoundError";
  }
}

export class GenerationProjectNotFoundError extends Error {
  readonly code = "GENERATION_PROJECT_NOT_FOUND";

  constructor(projectId: string) {
    super(`Generation project was not found: ${projectId}`);
    this.name = "GenerationProjectNotFoundError";
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

export type SeedanceImageRole =
  | "first_frame"
  | "last_frame"
  | "reference_image";
export type SeedanceVideoRole = "reference_video";
export type SeedanceAudioRole = "reference_audio";
export type SeedanceProviderStatus =
  | "queued"
  | "running"
  | "cancelled"
  | "succeeded"
  | "failed"
  | "expired";

export type SeedanceImageInput = {
  url: string;
  role?: SeedanceImageRole;
};

export type SeedanceVideoInput = {
  url: string;
  role?: SeedanceVideoRole;
};

export type SeedanceAudioInput = {
  url: string;
  role?: SeedanceAudioRole;
};

export type SeedanceVideoTaskOptions = {
  resolution?: string;
  aspectRatio?: string;
  duration?: number;
  generateAudio?: boolean;
  watermark?: boolean;
  seed?: number;
  returnLastFrame?: boolean;
  priority?: number;
  safetyIdentifier?: string;
  callbackUrl?: string;
  executionExpiresAfter?: number;
  serviceTier?: "default" | "flex";
  draft?: boolean;
  frames?: number;
  cameraFixed?: boolean;
};

export type SeedanceVideoTaskPayloadInput = SeedanceVideoTaskOptions & {
  prompt?: string;
  images?: SeedanceImageInput[];
  videos?: SeedanceVideoInput[];
  audios?: SeedanceAudioInput[];
  draftTaskId?: string;
};

export type CreateSeedanceVideoTaskInput = SeedanceVideoTaskPayloadInput & {
  modelId: string;
  modelSpecId: string;
};

export type RetrieveSeedanceVideoTaskInput = {
  providerTaskId: string;
};

export type SeedanceProviderError = {
  code: string | null;
  message: string | null;
};

export type SeedanceUsage = {
  completionTokens: number | null;
  totalTokens: number | null;
};

export type CreateSeedanceVideoTaskResult = {
  provider: "byteplus";
  providerTaskId: string;
  providerModelId: string;
};

export type RetrieveSeedanceVideoTaskResult = {
  provider: "byteplus";
  providerTaskId: string;
  providerModelId: string | null;
  status: SeedanceProviderStatus;
  videoUrl: string | null;
  usage: SeedanceUsage | null;
  createdAt: number | null;
  updatedAt: number | null;
  providerError: SeedanceProviderError | null;
};

export type SeedanceVideoGenerationProviderResultCallback = {
  kind: "result";
  result: RetrieveSeedanceVideoTaskResult;
  rawPayload: unknown;
  receivedAt: string;
};

export type SeedanceVideoGenerationProviderMalformedCallback = {
  kind: "malformed";
  terminalError: GenerationJobTerminalError;
  rawPayload: unknown;
  receivedAt: string;
};

export type SeedanceVideoGenerationProviderCallback =
  | SeedanceVideoGenerationProviderResultCallback
  | SeedanceVideoGenerationProviderMalformedCallback;

export type SeedanceVideoTaskRequest = {
  model: string;
  content: SeedanceContentItem[];
  resolution?: string;
  ratio?: string;
  duration?: number;
  generate_audio?: boolean;
  watermark?: boolean;
  seed?: number;
  return_last_frame?: boolean;
  priority?: number;
  safety_identifier?: string;
  callback_url?: string;
  execution_expires_after?: number;
  service_tier?: "default";
  draft?: boolean;
  frames?: number;
  camera_fixed?: boolean;
};

export type SeedanceContentItem =
  | {
      type: "text";
      text: string;
    }
  | {
      type: "image_url";
      image_url: { url: string };
      role?: SeedanceImageRole;
    }
  | {
      type: "video_url";
      video_url: { url: string };
      role: SeedanceVideoRole;
    }
  | {
      type: "audio_url";
      audio_url: { url: string };
      role: SeedanceAudioRole;
    }
  | {
      type: "draft_task";
      draft_task: { id: string };
    };

export type SeedancePayloadBuildInput = {
  spec: VideoModelSpec;
  input: SeedanceVideoTaskPayloadInput;
};
