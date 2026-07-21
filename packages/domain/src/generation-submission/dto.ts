import type {
  GenerationAttachmentMediaInput,
  GenerationThreadAttachmentMediaValue,
} from "../generation-attachment-media/dto.ts";
import type {
  CanonicalImageFieldId,
  CanonicalVideoFieldId,
} from "../generation-model/dto.ts";

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

export const createImageGenerationFieldIds = [
  "prompt",
  "resolution",
  "aspectRatio",
] as const satisfies readonly CanonicalImageFieldId[];

export type CreateImageGenerationFieldId =
  (typeof createImageGenerationFieldIds)[number];

export type AssertCreateImageGenerationFieldCoverage = AssertNever<
  Exclude<CanonicalImageFieldId, CreateImageGenerationFieldId>
>;

export type CreateImageGenerationFieldValues = {
  prompt: string;
  resolution: string;
  aspectRatio: string;
};

export type AssertCreateImageGenerationFieldValueCoverage = AssertNever<
  | Exclude<
      CreateImageGenerationFieldId,
      keyof CreateImageGenerationFieldValues
    >
  | Exclude<
      keyof CreateImageGenerationFieldValues,
      CreateImageGenerationFieldId
    >
>;

export type CreateGenerationInputBase = {
  modelId: string;
  modelSpecId: string;
  threadId?: string;
  projectId?: string;
  requestedGenerations: number;
  attachmentMedia?: GenerationAttachmentMediaInput;
};

export type CreateVideoGenerationInput = CreateGenerationInputBase &
  CreateVideoGenerationFieldValues;

export type CreateImageGenerationInput = CreateGenerationInputBase &
  CreateImageGenerationFieldValues;

export type CreateGenerationSubmissionInput =
  | {
      modelType: "video";
      input: CreateVideoGenerationInput;
    }
  | {
      modelType: "image";
      input: CreateImageGenerationInput;
    };

export type VideoGenerationSubmissionInput = Pick<
  CreateVideoGenerationInput,
  CreateVideoGenerationFieldId
>;

export type ImageGenerationSubmissionInput = Pick<
  CreateImageGenerationInput,
  CreateImageGenerationFieldId
>;

export type GenerationSubmissionInput =
  | VideoGenerationSubmissionInput
  | ImageGenerationSubmissionInput;

export type GenerationSubmissionInputByModelType = {
  video: VideoGenerationSubmissionInput;
  image: ImageGenerationSubmissionInput;
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

export type GenerationJobTerminalError = {
  source: "internal" | "provider";
  code: string | null;
  message: string | null;
};

export type CreatedGenerationSubmissionJob = {
  jobId: string;
  workflowId: string | null;
  status: GenerationJobStatus;
  terminalError: GenerationJobTerminalError | null;
};

export type CreatedGenerationSubmission = {
  submissionId: string;
  threadId: string;
  jobs: CreatedGenerationSubmissionJob[];
};

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

export type GenerationResultAssetReference =
  StoredGenerationResultAssetReference & {
    url: string | null;
    urlExpiresAt: string | null;
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

export type GenerationThreadJobResult = {
  providerId: string;
  providerTaskId: string;
  providerModelId: string | null;
  providerStatus: GenerationProviderTaskStatus;
  videoUrl: string | null;
  previewImageUrl: string | null;
  mediaUrlExpiresAt: string | null;
  assets?: GenerationResultAssetReference[];
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

type GenerationThreadSubmissionBase = {
  id: string;
  threadId: string;
  userId: string;
  modelId: string;
  modelDisplayName: string;
  modelSpecId: string;
  requestedGenerations: number;
  attachmentMedia: GenerationThreadAttachmentMediaValue;
  createdAt: string;
  updatedAt: string;
  jobs: GenerationThreadSubmissionJob[];
};

export type VideoGenerationThreadSubmission = GenerationThreadSubmissionBase & {
  modelType: "video";
  submittedInput: VideoGenerationSubmissionInput;
};

export type ImageGenerationThreadSubmission = GenerationThreadSubmissionBase & {
  modelType: "image";
  submittedInput: ImageGenerationSubmissionInput;
};

export type GenerationThreadSubmission =
  | VideoGenerationThreadSubmission
  | ImageGenerationThreadSubmission;
