export const createSeedanceVideoGenerationWorkflowType =
  "createSeedanceVideoGenerationWorkflow";
export const createManualCreditPurchaseWorkflowType =
  "createManualCreditPurchaseWorkflow";
export const createCreditAutoTopUpWorkflowType =
  "createCreditAutoTopUpWorkflow";
export const seedanceVideoGenerationProviderCallbackSignal =
  "seedanceVideoGenerationProviderCallback";
export const createSeedanceVideoTaskActivityType =
  "createSeedanceVideoTaskActivity";
export const reserveSeedanceVideoTaskRateLimitActivityType =
  "reserveSeedanceVideoTaskRateLimitActivity";
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
export const finalizeUnsuccessfulGenerationJobActivityType =
  "finalizeUnsuccessfulGenerationJobActivity";
export const markGenerationJobSucceededActivityType =
  "markGenerationJobSucceededActivity";
export const publishGenerationJobSucceededRealtimeEventActivityType =
  "publishGenerationJobSucceededRealtimeEventActivity";
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
export const configureManualCreditPurchaseAutoReloadActivityType =
  "configureManualCreditPurchaseAutoReloadActivity";
export const processCreditAutoTopUpActivityType =
  "processCreditAutoTopUpActivity";

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
import type { CreditAutoTopUpResult } from "../modules/credit_auto_top_up_settings/credit_auto_top_up_settings.types.ts";
import type {
  ManualCreditPurchaseGrantResult,
  VerifiedManualCreditPurchase,
} from "../modules/credits/credits.types.ts";

import type {
  CreateSeedanceVideoTaskInput,
  FinalizeUnsuccessfulGenerationJobInput,
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
import type { GenerationRateLimitReservationResult } from "../modules/model_rate_limits/model_rate_limits.types.ts";

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

export type CreateCreditAutoTopUpWorkflowInput = {
  userId: string;
  triggerLedgerEntryId: string;
};

export type CreateCreditAutoTopUpWorkflowResult = CreditAutoTopUpResult;

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

export type MarkGenerationJobFinalCostCalculationFailedActivityInput = {
  jobId: string;
  terminalError: GenerationJobTerminalError;
};

export type MarkGenerationJobSucceededActivityInput = {
  jobId: string;
};

export type PublishGenerationJobSucceededRealtimeEventActivityInput = {
  jobId: string;
};

export type FinalizeUnsuccessfulGenerationJobActivityInput =
  FinalizeUnsuccessfulGenerationJobInput;

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

export type ReserveSeedanceVideoTaskRateLimitActivityInput =
  CreateSeedanceVideoTaskInput;

export type ReserveSeedanceVideoTaskRateLimitActivityResult =
  GenerationRateLimitReservationResult;

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

export type ConfigureManualCreditPurchaseAutoReloadActivityInput =
  VerifiedManualCreditPurchase;

export type ConfigureManualCreditPurchaseAutoReloadActivityResult = {
  enabled: boolean;
};

export type ProcessCreditAutoTopUpActivityInput =
  CreateCreditAutoTopUpWorkflowInput;

export type ProcessCreditAutoTopUpActivityResult = CreditAutoTopUpResult;
