export const createSeedanceVideoGenerationWorkflowType =
  "createSeedanceVideoGenerationWorkflow";
export const createManualCreditPurchaseWorkflowType =
  "createManualCreditPurchaseWorkflow";
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
export const settleGenerationJobCostActivityType =
  "settleGenerationJobCostActivity";
export const saveGenerationMediaActivityType = "saveGenerationMediaActivity";
export const prepareAttachmentMediaForProviderRequestActivityType =
  "prepareAttachmentMediaForProviderRequestActivity";
export const verifyManualCreditCheckoutSessionActivityType =
  "verifyManualCreditCheckoutSessionActivity";
export const grantManualCreditPurchaseActivityType =
  "grantManualCreditPurchaseActivity";

export type {
  CreateSeedanceVideoTaskInput as CreateSeedanceVideoTaskActivityInput,
  CreateSeedanceVideoTaskResult as CreateSeedanceVideoTaskActivityResult,
  GenerationJobRecord,
  GenerationJobStatus,
  GenerationJobTerminalError,
  RetrieveSeedanceVideoTaskInput as RetrieveSeedanceVideoTaskActivityInput,
  RetrieveSeedanceVideoTaskResult as RetrieveSeedanceVideoTaskActivityResult,
  SeedanceAudioInput,
  SeedanceImageInput,
  SeedanceVideoInput,
  SeedanceVideoGenerationProviderCallback,
  StoredGenerationResultAssetReference,
  StoredGenerationResultPreviewReference,
} from "../modules/generation/generation.types.ts";
import type {
  ManualCreditPurchaseGrantResult,
  VerifiedManualCreditPurchase,
} from "../modules/credits/credits.types.ts";

import type {
  GenerationJobRecord,
  GenerationJobStatus,
  GenerationJobTerminalError,
  SeedanceAudioInput,
  SeedanceImageInput,
  SeedanceVideoInput,
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
  resolution: string;
  aspectRatio: string;
  duration: number;
  generateAudio: boolean;
  hasAttachmentMedia: boolean;
  callbackUrl: string;
};

export type CreateSeedanceVideoGenerationWorkflowResult = {
  jobId: string;
  status: GenerationJobStatus;
  providerTaskId: string | null;
};

export type CreateManualCreditPurchaseWorkflowInput = {
  stripeCheckoutSessionId: string;
  stripeEventId: string;
  receivedAt: string;
};

export type CreateManualCreditPurchaseWorkflowResult =
  ManualCreditPurchaseGrantResult;

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

export type SettleGenerationJobCostActivityInput = {
  jobId: string;
  callback: Extract<
    SeedanceVideoGenerationProviderCallback,
    { kind: "result" }
  >;
};

export type SaveGenerationMediaActivityInput = {
  jobId: string;
  videoUrl: string | null;
};

export type SaveGenerationMediaActivityResult =
  StoredGenerationResultAssetReference[];

export type PrepareAttachmentMediaForProviderRequestActivityInput = {
  submissionId: string;
};

export type PrepareAttachmentMediaForProviderRequestActivityResult = {
  images: SeedanceImageInput[];
  videos: SeedanceVideoInput[];
  audios: SeedanceAudioInput[];
};

export type CreateGenerationResultPreviewActivityInput = {
  jobId: string;
  video: StoredGenerationResultAssetReference;
};

export type CreateGenerationResultPreviewActivityResult =
  StoredGenerationResultPreviewReference;

export type MarkGenerationJobActivityResult = GenerationJobRecord;

export type VerifyManualCreditCheckoutSessionActivityInput = {
  stripeCheckoutSessionId: string;
  stripeEventId: string;
};

export type VerifyManualCreditCheckoutSessionActivityResult =
  VerifiedManualCreditPurchase;

export type GrantManualCreditPurchaseActivityInput =
  VerifiedManualCreditPurchase;

export type GrantManualCreditPurchaseActivityResult =
  ManualCreditPurchaseGrantResult;
