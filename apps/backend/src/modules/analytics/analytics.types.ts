export type GenerationAnalyticsContext = {
  modelType: "video" | "image";
  modelId: string;
  modelSpecId: string;
  requestedOutputCount: number;
  resolution: string;
  aspectRatio: string;
  generationDurationSeconds?: number;
  generateAudio?: boolean;
  attachmentCount: number;
  hasImageAttachment: boolean;
  hasVideoAttachment: boolean;
  hasAudioAttachment: boolean;
};

export type GenerationTargetType =
  | "existing_thread"
  | "new_project_thread"
  | "new_unprojected_thread";

export type GenerationJobFailureStatus =
  | "failed"
  | "cancelled"
  | "expired"
  | "final_cost_calculation_failure";

export type AnalyticsEventProperties = Record<
  string,
  boolean | number | string | undefined
>;

type AnalyticsEventBase = {
  userId: string;
  occurredAt: Date;
};

type GenerationJobAnalyticsEventBase = AnalyticsEventBase & {
  jobId: string;
  generation: GenerationAnalyticsContext;
  outputIndex: number;
  providerId?: string;
  providerModelId?: string;
  processingDurationMs: number;
};

export type AnalyticsEvent =
  | (AnalyticsEventBase & {
      type: "account_signed_up";
    })
  | (AnalyticsEventBase & {
      type: "generation_submission_created";
      submissionId: string;
      generation: GenerationAnalyticsContext;
      targetType: GenerationTargetType;
      estimatedCostUsdMicrosPerOutput: number;
      estimatedCostUsdMicrosTotal: number;
    })
  | (GenerationJobAnalyticsEventBase & {
      type: "generation_job_succeeded";
    })
  | (GenerationJobAnalyticsEventBase & {
      type: "generation_job_failed";
      terminalStatus: GenerationJobFailureStatus;
      errorSource?: "internal" | "provider";
      errorCode?: string;
    })
  | (AnalyticsEventBase & {
      type: "insufficient_credits_encountered";
      generation: GenerationAnalyticsContext;
      targetType: GenerationTargetType;
      requiredCreditUsdMicrosPerOutput: number;
      requiredCreditUsdMicrosTotal: number;
    })
  | (AnalyticsEventBase & {
      type: "project_created";
      projectId: string;
    })
  | (AnalyticsEventBase & {
      type: "credit_checkout_started";
      stripeCheckoutSessionId: string;
      creditAmountUsdMicros: number;
      autoTopUpSelected: boolean;
    })
  | (AnalyticsEventBase & {
      type: "credit_purchase_completed";
      ledgerEntryId: string;
      purchaseKind: "manual" | "auto_top_up";
      creditAmountUsdMicros: number;
      autoTopUpSelected?: boolean;
      topUpFloorUsdMicros?: number;
    });

export type AnalyticsTracker = {
  track(event: AnalyticsEvent): void;
};
