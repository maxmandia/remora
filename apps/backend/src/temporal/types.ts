export const createVideoGenerationWorkflowType =
  "createVideoGenerationWorkflow";
export const createManualCreditPurchaseWorkflowType =
  "createManualCreditPurchaseWorkflow";
export const createCreditAutoTopUpWorkflowType =
  "createCreditAutoTopUpWorkflow";
export const createGenerationThreadNameWorkflowType =
  "createGenerationThreadNameWorkflow";
export const videoGenerationProviderCallbackSignal =
  "videoGenerationProviderCallback";
export const createVideoTaskActivityType = "createVideoTaskActivity";
export const reserveProviderSubmissionCapacityActivityType =
  "reserveProviderSubmissionCapacityActivity";
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
export const prepareGenerationAttachmentMediaActivityType =
  "prepareGenerationAttachmentMediaActivity";
export const verifyManualCreditCheckoutSessionActivityType =
  "verifyManualCreditCheckoutSessionActivity";
export const grantManualCreditPurchaseActivityType =
  "grantManualCreditPurchaseActivity";
export const configureManualCreditPurchaseAutoReloadActivityType =
  "configureManualCreditPurchaseAutoReloadActivity";
export const processCreditAutoTopUpActivityType =
  "processCreditAutoTopUpActivity";
export const generateGenerationThreadNameActivityType =
  "generateGenerationThreadNameActivity";
export const updateGenerationThreadNameActivityType =
  "updateGenerationThreadNameActivity";
export const publishGenerationThreadNameUpdatedRealtimeEventActivityType =
  "publishGenerationThreadNameUpdatedRealtimeEventActivity";

export type {
  CreateVideoTaskInput as CreateVideoTaskActivityInput,
  CreateVideoTaskResult as CreateVideoTaskActivityResult,
  GenerationJobRecord,
  GenerationJobStatus,
  GenerationJobTerminalError,
  GenerationProviderCallback,
  GenerationProviderTaskResult,
  GenerationProviderTaskStatus,
  GenerationSubmissionInput,
  StoredGenerationResultAssetReference,
  StoredGenerationResultPreviewReference,
} from "../modules/generation/generation.types.ts";
export type { SignedGenerationAttachmentMedia } from "../modules/generation-attachment-media/generation-attachment-media.types.ts";
import type { CreditAutoTopUpResult } from "../modules/credit_auto_top_up_settings/credit_auto_top_up_settings.types.ts";
import type {
  ManualCreditPurchaseGrantResult,
  VerifiedManualCreditPurchase,
} from "../modules/credits/credits.types.ts";

import type {
  FinalizeUnsuccessfulGenerationJobInput,
  GenerationJobRecord,
  GenerationJobStatus,
  GenerationJobTerminalError,
  GenerationProviderCallback,
  GenerationSubmissionInput,
  StoredGenerationResultAssetReference,
  StoredGenerationResultPreviewReference,
} from "../modules/generation/generation.types.ts";
import type { SignedGenerationAttachmentMedia } from "../modules/generation-attachment-media/generation-attachment-media.types.ts";
import type {
  GenerationRateLimitReservationResult,
  ReserveProviderSubmissionCapacityInput,
} from "../modules/model_rate_limits/model_rate_limits.types.ts";

export type TemporalWorkerConfig = {
  address: string;
  namespace: string;
  taskQueue: string;
};

export type TemporalWorkerRuntime = {
  run: () => Promise<void>;
};

export type CreateGenerationThreadNameWorkflowInput = {
  threadId: string;
  userId: string;
  prompt: string;
  provisionalName: string;
};

export type CreateGenerationThreadNameWorkflowResult = {
  threadId: string;
  updated: boolean;
};

export type GenerateGenerationThreadNameActivityInput = {
  threadId: string;
  prompt: string;
};

export type GenerateGenerationThreadNameActivityResult = {
  name: string;
};

export type UpdateGenerationThreadNameActivityInput = {
  threadId: string;
  userId: string;
  expectedName: string;
  name: string;
};

export type UpdateGenerationThreadNameActivityResult = {
  updated: boolean;
};

export type PublishGenerationThreadNameUpdatedRealtimeEventActivityInput = {
  threadId: string;
  userId: string;
};

export type CreateVideoGenerationWorkflowInput = {
  jobId: string;
  submissionId: string;
  modelId: string;
  modelSpecId: string;
  providerId: string;
  submittedInput: GenerationSubmissionInput;
  hasAttachmentMedia: boolean;
  callbackUrl: string;
};

export type CreateVideoGenerationWorkflowResult = {
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
  callback: Extract<GenerationProviderCallback, { kind: "result" }>;
  storedAssets?: StoredGenerationResultAssetReference[];
  storedPreview?: StoredGenerationResultPreviewReference | null;
};

export type SettleGenerationJobCostActivityInput = {
  jobId: string;
  callback: Extract<GenerationProviderCallback, { kind: "result" }>;
};

export type SaveGenerationMediaActivityInput = {
  jobId: string;
  videoUrl: string | null;
};

export type SaveGenerationMediaActivityResult =
  StoredGenerationResultAssetReference[];

export type PrepareGenerationAttachmentMediaActivityInput = {
  submissionId: string;
};

export type ReserveProviderSubmissionCapacityActivityInput =
  ReserveProviderSubmissionCapacityInput;

export type ReserveProviderSubmissionCapacityActivityResult =
  GenerationRateLimitReservationResult;

export type PrepareGenerationAttachmentMediaActivityResult =
  SignedGenerationAttachmentMedia[];

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
