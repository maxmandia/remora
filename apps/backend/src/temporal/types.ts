export const createGenerationWorkflowType = "createGenerationWorkflow";
export const createManualCreditPurchaseWorkflowType =
  "createManualCreditPurchaseWorkflow";
export const createCreditAutoTopUpWorkflowType =
  "createCreditAutoTopUpWorkflow";
export const createGenerationThreadNameWorkflowType =
  "createGenerationThreadNameWorkflow";
export const generationProviderCallbackSignal = "generationProviderCallback";
export const createVideoTaskActivityType = "createVideoTaskActivity";
export const createAndStoreImageActivityType = "createAndStoreImageActivity";
export const accrueGenerationProviderCostActivityType =
  "accrueGenerationProviderCostActivity";
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
  CreateImageTaskInput as CreateImageTaskActivityInput,
  CreateVideoTaskInput as CreateVideoTaskActivityInput,
  CreateVideoTaskResult as CreateVideoTaskActivityResult,
  GenerationJobRecord,
  GenerationJobStatus,
  GenerationJobTerminalError,
  GenerationProviderCallback,
  GenerationProviderResultCallback,
  GenerationProviderTaskResult,
  GenerationProviderTaskStatus,
  StoredGenerationResultAssetReference,
  StoredGenerationResultPreviewReference,
  ImageGenerationSubmissionInput,
  VideoGenerationSubmissionInput,
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
  GenerationProviderResultCallback,
  ImageGenerationSubmissionInput,
  StoredGenerationResultAssetReference,
  StoredGenerationResultPreviewReference,
  VideoGenerationSubmissionInput,
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

type CreateGenerationWorkflowInputBase = {
  jobId: string;
  submissionId: string;
  modelId: string;
  modelSpecId: string;
  providerId: string;
  hasAttachmentMedia: boolean;
};

export type CreateGenerationWorkflowInput =
  | (CreateGenerationWorkflowInputBase & {
      providerExecution: {
        mode: "inline";
        outputKind: "image";
      };
      submittedInput: ImageGenerationSubmissionInput;
    })
  | (CreateGenerationWorkflowInputBase & {
      providerExecution: {
        mode: "callback";
        outputKind: "video";
        callbackUrl: string;
      };
      submittedInput: VideoGenerationSubmissionInput;
    });

export type CreateGenerationWorkflowResult = {
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

export type AccrueGenerationProviderCostActivityInput =
  SettleGenerationJobCostActivityInput;

export type CreateAndStoreImageActivityInput = {
  jobId: string;
  modelId: string;
  modelSpecId: string;
  submittedInput: ImageGenerationSubmissionInput;
  attachmentMedia: SignedGenerationAttachmentMedia[];
};

export type CreateAndStoreImageActivityResult = {
  callback: GenerationProviderResultCallback & {
    result: GenerationProviderResultCallback["result"] & {
      provider: "google";
      providerModelId: string;
      status: "succeeded";
      videoUrl: null;
    };
  };
  storedAsset: StoredGenerationResultAssetReference | null;
  storageError: GenerationJobTerminalError | null;
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
