export const createSeedanceVideoGenerationWorkflowType =
  "createSeedanceVideoGenerationWorkflow";
export const seedanceVideoGenerationProviderCallbackSignal =
  "seedanceVideoGenerationProviderCallback";
export const createSeedanceVideoTaskActivityType =
  "createSeedanceVideoTaskActivity";
export const retrieveSeedanceVideoTaskActivityType =
  "retrieveSeedanceVideoTaskActivity";
export const createGenerationResultPreviewActivityType =
  "createGenerationResultPreviewActivity";
export const markGenerationJobCreatingProviderTaskActivityType =
  "markGenerationJobCreatingProviderTaskActivity";
export const markGenerationJobProviderTaskCreatedActivityType =
  "markGenerationJobProviderTaskCreatedActivity";
export const markGenerationJobWaitingForProviderCallbackActivityType =
  "markGenerationJobWaitingForProviderCallbackActivity";
export const markGenerationJobFailedActivityType =
  "markGenerationJobFailedActivity";
export const markGenerationJobSucceededActivityType =
  "markGenerationJobSucceededActivity";
export const publishGenerationJobSucceededRealtimeEventActivityType =
  "publishGenerationJobSucceededRealtimeEventActivity";
export const markGenerationJobCancelledActivityType =
  "markGenerationJobCancelledActivity";
export const markGenerationJobExpiredActivityType =
  "markGenerationJobExpiredActivity";
export const upsertGenerationResultActivityType =
  "upsertGenerationResultActivity";
export const saveGenerationMediaActivityType = "saveGenerationMediaActivity";
export const prepareReferenceMediaForProviderRequestActivityType =
  "prepareReferenceMediaForProviderRequestActivity";

export type {
  CreateSeedanceVideoTaskInput as CreateSeedanceVideoTaskActivityInput,
  CreateSeedanceVideoTaskResult as CreateSeedanceVideoTaskActivityResult,
  GenerationJobRecord,
  GenerationJobStatus,
  GenerationJobTerminalError,
  RetrieveSeedanceVideoTaskInput as RetrieveSeedanceVideoTaskActivityInput,
  RetrieveSeedanceVideoTaskResult as RetrieveSeedanceVideoTaskActivityResult,
  SeedanceReferenceAudioInput,
  SeedanceReferenceImageInput,
  SeedanceReferenceVideoInput,
  SeedanceVideoGenerationProviderCallback,
  StoredGenerationResultAssetReference,
  StoredGenerationResultPreviewReference,
} from "../modules/generation/generation.types.ts";

import type {
  GenerationJobRecord,
  GenerationJobStatus,
  GenerationJobTerminalError,
  SeedanceReferenceAudioInput,
  SeedanceReferenceImageInput,
  SeedanceReferenceVideoInput,
  SeedanceVideoGenerationProviderCallback,
  StoredGenerationResultAssetReference,
  StoredGenerationResultPreviewReference,
} from "../modules/generation/generation.types.ts";

export type TemporalWorkerConfig = {
  address: string;
  namespace: string;
  taskQueue: string;
};

export type TemporalWorkerRuntime = {
  run: () => Promise<void>;
};

export type CreateSeedanceVideoGenerationWorkflowInput = {
  jobId: string;
  submissionId: string;
  modelId: string;
  modelSpecId: string;
  prompt: string;
  aspectRatio: string;
  duration: number;
  generateAudio: boolean;
  hasReferenceMedia: boolean;
  callbackUrl: string;
};

export type CreateSeedanceVideoGenerationWorkflowResult = {
  jobId: string;
  status: GenerationJobStatus;
  providerTaskId: string | null;
};

export type MarkGenerationJobCreatingProviderTaskActivityInput = {
  jobId: string;
  workflowId: string;
  runId: string;
};

export type MarkGenerationJobProviderTaskCreatedActivityInput = {
  jobId: string;
  providerId: string;
  providerTaskId: string;
  providerModelId: string;
};

export type MarkGenerationJobWaitingForProviderCallbackActivityInput =
  MarkGenerationJobProviderTaskCreatedActivityInput;

export type MarkGenerationJobFailedActivityInput = {
  jobId: string;
  terminalError: GenerationJobTerminalError;
};

export type MarkGenerationJobSucceededActivityInput = {
  jobId: string;
};

export type PublishGenerationJobSucceededRealtimeEventActivityInput = {
  jobId: string;
};

export type MarkGenerationJobCancelledActivityInput = {
  jobId: string;
  terminalError: GenerationJobTerminalError | null;
};

export type MarkGenerationJobExpiredActivityInput =
  MarkGenerationJobCancelledActivityInput;

export type UpsertGenerationResultActivityInput = {
  jobId: string;
  callback: Extract<
    SeedanceVideoGenerationProviderCallback,
    { kind: "result" }
  >;
  storedAssets?: StoredGenerationResultAssetReference[];
  storedPreview?: StoredGenerationResultPreviewReference | null;
};

export type SaveGenerationMediaActivityInput = {
  jobId: string;
  videoUrl: string | null;
};

export type SaveGenerationMediaActivityResult =
  StoredGenerationResultAssetReference[];

export type PrepareReferenceMediaForProviderRequestActivityInput = {
  submissionId: string;
};

export type PrepareReferenceMediaForProviderRequestActivityResult = {
  images: SeedanceReferenceImageInput[];
  videos: SeedanceReferenceVideoInput[];
  audios: SeedanceReferenceAudioInput[];
};

export type CreateGenerationResultPreviewActivityInput = {
  jobId: string;
  video: StoredGenerationResultAssetReference;
};

export type CreateGenerationResultPreviewActivityResult =
  StoredGenerationResultPreviewReference;

export type MarkGenerationJobActivityResult = GenerationJobRecord;
