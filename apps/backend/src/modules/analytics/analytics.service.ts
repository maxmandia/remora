import { randomUUID } from "node:crypto";

import Mixpanel from "mixpanel";

import {
  parseBackendAnalyticsEnv,
  type BackendAnalyticsEnv,
} from "@remora/env";
import { assertNever } from "@remora/utils";

import type {
  AnalyticsEvent,
  AnalyticsEventProperties,
  AnalyticsTracker,
  GenerationAnalyticsContext,
} from "./analytics.types.ts";
import { createAnalyticsInsertId } from "./analytics.utils.ts";

type AnalyticsClient = Pick<ReturnType<typeof Mixpanel.init>, "track">;

type AnalyticsServiceDependencies = {
  createClient: (token: string) => AnalyticsClient;
  createOccurrenceId: () => string;
  getConfig: () => BackendAnalyticsEnv;
  reportError: (message: string, error: unknown) => void;
};

type AnalyticsDelivery = {
  eventName: AnalyticsEvent["type"];
  userId: string;
  occurredAt: Date;
  occurrenceId?: string;
  properties?: AnalyticsEventProperties;
};

const defaultDependencies: AnalyticsServiceDependencies = {
  createClient: (token) =>
    Mixpanel.init(token, {
      geolocate: false,
      host: "api.mixpanel.com",
    }),
  createOccurrenceId: randomUUID,
  getConfig: () => parseBackendAnalyticsEnv(process.env),
  reportError: (message, error) => console.error(message, error),
};

export class AnalyticsService implements AnalyticsTracker {
  private client: AnalyticsClient | null = null;
  private initialized = false;

  constructor(
    private readonly dependencies: AnalyticsServiceDependencies = defaultDependencies,
  ) {}

  initialize(): void {
    if (this.initialized) {
      return;
    }

    this.initialized = true;

    try {
      const config = this.dependencies.getConfig();

      if (!config.MIXPANEL_PROJECT_TOKEN) {
        return;
      }

      this.client = this.dependencies.createClient(
        config.MIXPANEL_PROJECT_TOKEN,
      );
    } catch (error) {
      this.reportError("Backend analytics initialization failed", error);
    }
  }

  track(event: AnalyticsEvent): void {
    switch (event.type) {
      case "account_signed_up":
        return this.deliver({
          eventName: event.type,
          userId: event.userId,
          occurredAt: event.occurredAt,
          occurrenceId: event.userId,
          properties: { signup_method: "email_password" },
        });
      case "generation_submission_created":
        return this.deliver({
          eventName: event.type,
          userId: event.userId,
          occurredAt: event.occurredAt,
          occurrenceId: event.submissionId,
          properties: {
            ...this.toGenerationProperties(event.generation),
            target_type: event.targetType,
            estimated_cost_usd_micros_per_output:
              event.estimatedCostUsdMicrosPerOutput,
            estimated_cost_usd_micros_total: event.estimatedCostUsdMicrosTotal,
          },
        });
      case "generation_job_succeeded":
        return this.deliver({
          eventName: event.type,
          userId: event.userId,
          occurredAt: event.occurredAt,
          occurrenceId: event.jobId,
          properties: this.toGenerationJobProperties(event),
        });
      case "generation_job_failed":
        return this.deliver({
          eventName: event.type,
          userId: event.userId,
          occurredAt: event.occurredAt,
          occurrenceId: event.jobId,
          properties: {
            ...this.toGenerationJobProperties(event),
            terminal_status: event.terminalStatus,
            error_source: event.errorSource,
            error_code: event.errorCode,
          },
        });
      case "insufficient_credits_encountered":
        return this.deliver({
          eventName: event.type,
          userId: event.userId,
          occurredAt: event.occurredAt,
          properties: {
            ...this.toGenerationProperties(event.generation),
            target_type: event.targetType,
            required_credit_usd_micros_per_output:
              event.requiredCreditUsdMicrosPerOutput,
            required_credit_usd_micros_total:
              event.requiredCreditUsdMicrosTotal,
          },
        });
      case "project_created":
        return this.deliver({
          eventName: event.type,
          userId: event.userId,
          occurredAt: event.occurredAt,
          occurrenceId: event.projectId,
        });
      case "credit_checkout_started":
        return this.deliver({
          eventName: event.type,
          userId: event.userId,
          occurredAt: event.occurredAt,
          occurrenceId: event.stripeCheckoutSessionId,
          properties: {
            credit_amount_usd_micros: event.creditAmountUsdMicros,
            auto_top_up_selected: event.autoTopUpSelected,
          },
        });
      case "credit_purchase_completed":
        return this.deliver({
          eventName: event.type,
          userId: event.userId,
          occurredAt: event.occurredAt,
          occurrenceId: event.ledgerEntryId,
          properties: {
            purchase_kind: event.purchaseKind,
            credit_amount_usd_micros: event.creditAmountUsdMicros,
            auto_top_up_selected: event.autoTopUpSelected,
            top_up_floor_usd_micros: event.topUpFloorUsdMicros,
          },
        });
      default:
        return assertNever(event);
    }
  }

  private deliver({
    eventName,
    userId,
    occurredAt,
    occurrenceId,
    properties = {},
  }: AnalyticsDelivery): void {
    if (!this.client) {
      return;
    }

    const insertId = createAnalyticsInsertId(
      eventName,
      occurrenceId ?? this.dependencies.createOccurrenceId(),
    );

    try {
      this.client.track(
        eventName,
        {
          ...this.withoutUndefined(properties),
          event_version: 1,
          distinct_id: userId,
          $user_id: userId,
          $insert_id: insertId,
          time: Math.floor(occurredAt.getTime() / 1_000),
        },
        (error) => {
          if (error) {
            this.reportError("Backend analytics delivery failed", error);
          }
        },
      );
    } catch (error) {
      this.reportError("Backend analytics delivery failed", error);
    }
  }

  private toGenerationProperties(
    generation: GenerationAnalyticsContext,
  ): AnalyticsEventProperties {
    return {
      model_id: generation.modelId,
      model_spec_id: generation.modelSpecId,
      requested_output_count: generation.requestedOutputCount,
      resolution: generation.resolution,
      aspect_ratio: generation.aspectRatio,
      generation_duration_seconds: generation.generationDurationSeconds,
      generate_audio: generation.generateAudio,
      attachment_count: generation.attachmentCount,
      has_image_attachment: generation.hasImageAttachment,
      has_video_attachment: generation.hasVideoAttachment,
      has_audio_attachment: generation.hasAudioAttachment,
    };
  }

  private toGenerationJobProperties(input: {
    generation: GenerationAnalyticsContext;
    outputIndex: number;
    providerId?: string;
    providerModelId?: string;
    processingDurationMs: number;
  }): AnalyticsEventProperties {
    return {
      ...this.toGenerationProperties(input.generation),
      output_index: input.outputIndex,
      provider_id: input.providerId,
      provider_model_id: input.providerModelId,
      processing_duration_ms: input.processingDurationMs,
    };
  }

  private withoutUndefined(
    properties: AnalyticsEventProperties,
  ): Record<string, boolean | number | string> {
    return Object.fromEntries(
      Object.entries(properties).filter(
        (entry): entry is [string, boolean | number | string] =>
          entry[1] !== undefined,
      ),
    );
  }

  private reportError(message: string, error: unknown): void {
    try {
      this.dependencies.reportError(message, error);
    } catch {
      // Analytics must never interrupt startup or product workflows.
    }
  }
}

export const analyticsService = new AnalyticsService();
