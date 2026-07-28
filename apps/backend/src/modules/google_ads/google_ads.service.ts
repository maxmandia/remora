import {
  parseBackendGoogleAdsEnv,
  type BackendGoogleAdsEnv,
} from "@remora/env";
import { isRecord } from "@remora/utils";

import { googleDataManagerClient } from "../../clients/google-data-manager/google-data-manager.ts";
import {
  googleAdsRepository,
  type GoogleAdsRepository,
} from "./google_ads.repository.ts";
import {
  GoogleAdsAttributionValidationError,
  googleAdsAttributionLifetimeMs,
  type CaptureGoogleAdsClickAttributionInput,
  type GoogleAdsDataManagerClient,
  type GoogleAdsPurchaseConversionRecord,
  type PrepareGoogleAdsPurchaseConversionInput,
} from "./google_ads.types.ts";
import { logGoogleAdsLifecycleEvent } from "./google_ads.observability.ts";

const googleAdsAttributionFutureToleranceMs = 5 * 60 * 1_000;
const googleAdsClickIdMaxLength = 512;
const controlCharacterPattern = /[\u0000-\u001F\u007F]/;

export class GoogleAdsService {
  constructor(
    private readonly repository: GoogleAdsRepository = googleAdsRepository,
    private readonly dataManager: GoogleAdsDataManagerClient = googleDataManagerClient,
    private readonly getConfig: () => BackendGoogleAdsEnv = () =>
      parseBackendGoogleAdsEnv(process.env),
    private readonly now: () => Date = () => new Date(),
  ) {}

  async captureClickAttribution(input: CaptureGoogleAdsClickAttributionInput) {
    this.validateClickAttribution(input);
    const expiresAt = new Date(
      input.capturedAt.getTime() + googleAdsAttributionLifetimeMs,
    );
    const attribution = await this.repository.upsertClickAttribution({
      ...input,
      expiresAt,
    });

    logGoogleAdsLifecycleEvent("google_ads.attribution.captured", {
      attributionId: attribution.id,
      clickIdType: attribution.clickIdType,
      userId: attribution.userId,
    });

    return {
      id: attribution.id,
      expiresAt: attribution.expiresAt,
    };
  }

  async getActiveAttributionId(
    userId: string,
    occurredAt: Date = this.now(),
  ): Promise<string | null> {
    const attribution = await this.repository.findLatestActiveAttribution(
      userId,
      occurredAt,
    );

    return attribution?.id ?? null;
  }

  async preparePurchaseConversion(
    input: PrepareGoogleAdsPurchaseConversionInput,
  ): Promise<GoogleAdsPurchaseConversionRecord> {
    const config = this.getConfig();
    const attribution = input.attributionId
      ? await this.repository.findAttributionById(input.attributionId)
      : null;
    const hasValidAttribution =
      attribution?.userId === input.userId &&
      attribution.capturedAt <= input.eventOccurredAt &&
      attribution.expiresAt > input.eventOccurredAt;
    const status =
      input.analyticsContext.suppressed ||
      config.mode === "off" ||
      !hasValidAttribution
        ? "skipped"
        : "pending";
    const conversion = await this.repository.createPurchaseConversion({
      ...input,
      attributionId: hasValidAttribution ? attribution.id : null,
      status,
    });

    this.assertMatchingPurchaseConversion(conversion, input);
    logGoogleAdsLifecycleEvent(
      status === "skipped"
        ? "google_ads.conversion.skipped"
        : "google_ads.conversion.prepared",
      {
        attributionId: conversion.attributionId,
        creditLedgerEntryId: conversion.creditLedgerEntryId,
        status: conversion.status,
        stripeCheckoutSessionId: conversion.stripeCheckoutSessionId,
        transactionId: conversion.transactionId,
        userId: conversion.userId,
      },
    );

    return conversion;
  }

  async deliverPurchaseConversion(
    transactionId: string,
  ): Promise<
    | { status: "skipped" | "succeeded" | "failed" | "timed_out" }
    | { status: "accepted"; googleRequestId: string }
  > {
    const delivery =
      await this.repository.findPurchaseConversionForDelivery(transactionId);

    if (!delivery) {
      throw new Error(`Google Ads conversion ${transactionId} was not found`);
    }

    const { conversion, creditAmountUsdMicros } = delivery;

    if (
      conversion.status === "skipped" ||
      conversion.status === "succeeded" ||
      conversion.status === "failed" ||
      conversion.status === "timed_out"
    ) {
      return { status: conversion.status };
    }

    if (conversion.googleRequestId) {
      return {
        status: "accepted",
        googleRequestId: conversion.googleRequestId,
      };
    }

    if (
      !Number.isSafeInteger(creditAmountUsdMicros) ||
      creditAmountUsdMicros <= 0
    ) {
      await this.failPurchaseConversion(
        transactionId,
        "GOOGLE_ADS_CREDIT_AMOUNT_INVALID",
      );
      return { status: "failed" };
    }

    const attribution = conversion.attributionId
      ? await this.repository.findAttributionById(conversion.attributionId)
      : null;

    if (!attribution || attribution.userId !== conversion.userId) {
      await this.failPurchaseConversion(
        transactionId,
        "GOOGLE_ADS_ATTRIBUTION_MISSING",
      );
      return { status: "failed" };
    }

    const result = await this.dataManager.ingestPurchaseConversion({
      transactionId,
      eventOccurredAt: conversion.eventOccurredAt,
      creditAmountUsdMicros,
      clickIdType: attribution.clickIdType,
      clickId: attribution.clickId,
    });

    if (result.validatedOnly) {
      await this.markPurchaseConversionSucceeded(transactionId);
      logGoogleAdsLifecycleEvent("google_ads.conversion.succeeded", {
        transactionId,
        warningCode: "GOOGLE_ADS_VALIDATE_ONLY",
      });
      return { status: "succeeded" };
    }

    await this.markPurchaseConversionAccepted({
      transactionId,
      googleRequestId: result.requestId,
    });
    logGoogleAdsLifecycleEvent("google_ads.conversion.accepted", {
      googleRequestId: result.requestId,
      transactionId,
    });
    return {
      status: "accepted",
      googleRequestId: result.requestId,
    };
  }

  async refreshPurchaseConversionStatus(
    transactionId: string,
    googleRequestId: string,
  ): Promise<"processing" | "succeeded" | "failed"> {
    const result = await this.dataManager.getRequestStatus(googleRequestId);

    if (result.status === "processing") {
      await this.markPurchaseConversionProcessing(transactionId);
      logGoogleAdsLifecycleEvent("google_ads.conversion.processing", {
        googleRequestId,
        transactionId,
      });
      return "processing";
    }

    if (result.status === "succeeded") {
      const warningCode = result.warningCodes[0] ?? null;
      await this.markPurchaseConversionSucceeded(transactionId);
      logGoogleAdsLifecycleEvent("google_ads.conversion.succeeded", {
        googleRequestId,
        transactionId,
        warningCode,
      });
      return "succeeded";
    }

    const errorCode = result.errorCodes[0] ?? "GOOGLE_ADS_PROCESSING_FAILED";
    const warningCode = result.warningCodes[0] ?? null;
    await this.markPurchaseConversionFailed(transactionId);
    logGoogleAdsLifecycleEvent("google_ads.conversion.failed", {
      errorCode,
      googleRequestId,
      transactionId,
      warningCode,
    });
    return "failed";
  }

  async timeOutPurchaseConversion(transactionId: string): Promise<void> {
    await this.markPurchaseConversionTimedOut(transactionId);
    logGoogleAdsLifecycleEvent("google_ads.conversion.timed_out", {
      errorCode: "GOOGLE_ADS_DIAGNOSTICS_TIMEOUT",
      transactionId,
    });
  }

  async markPurchaseConversionAccepted({
    transactionId,
    googleRequestId,
  }: {
    transactionId: string;
    googleRequestId: string;
  }): Promise<void> {
    await this.repository.updatePurchaseConversion(transactionId, {
      status: "accepted",
      googleRequestId,
    });
  }

  async markPurchaseConversionProcessing(transactionId: string): Promise<void> {
    await this.repository.updatePurchaseConversion(transactionId, {
      status: "processing",
    });
  }

  async markPurchaseConversionSucceeded(transactionId: string): Promise<void> {
    await this.repository.updatePurchaseConversion(transactionId, {
      status: "succeeded",
    });
  }

  async markPurchaseConversionFailed(transactionId: string): Promise<void> {
    await this.repository.updatePurchaseConversion(transactionId, {
      status: "failed",
    });
  }

  async markPurchaseConversionTimedOut(transactionId: string): Promise<void> {
    await this.repository.updatePurchaseConversion(transactionId, {
      status: "timed_out",
    });
  }

  async failPurchaseConversionDelivery(
    transactionId: string,
    error: unknown,
  ): Promise<void> {
    const errorCode = this.getErrorCode(error);
    await this.failPurchaseConversion(transactionId, errorCode);
  }

  async pruneExpiredAttributions(): Promise<{ deletedCount: number }> {
    const deletedCount = await this.repository.deleteExpiredAttributions(
      this.now(),
    );
    logGoogleAdsLifecycleEvent("google_ads.attribution.pruned", {
      deletedCount,
    });
    return { deletedCount };
  }

  private validateClickAttribution({
    clickId,
    capturedAt,
  }: CaptureGoogleAdsClickAttributionInput): void {
    const now = this.now();

    if (
      clickId.length === 0 ||
      clickId.length > googleAdsClickIdMaxLength ||
      clickId.trim() !== clickId ||
      controlCharacterPattern.test(clickId)
    ) {
      throw new GoogleAdsAttributionValidationError(
        "Google Ads click identifier is invalid",
      );
    }

    if (
      !Number.isFinite(capturedAt.getTime()) ||
      capturedAt.getTime() < now.getTime() - googleAdsAttributionLifetimeMs ||
      capturedAt.getTime() >
        now.getTime() + googleAdsAttributionFutureToleranceMs
    ) {
      throw new GoogleAdsAttributionValidationError(
        "Google Ads click identifier timestamp is invalid",
      );
    }
  }

  private assertMatchingPurchaseConversion(
    conversion: GoogleAdsPurchaseConversionRecord,
    input: PrepareGoogleAdsPurchaseConversionInput,
  ): void {
    if (
      conversion.userId !== input.userId ||
      conversion.stripeCheckoutSessionId !== input.stripeCheckoutSessionId ||
      conversion.creditLedgerEntryId !== input.creditLedgerEntryId ||
      conversion.eventOccurredAt.getTime() !== input.eventOccurredAt.getTime()
    ) {
      throw new Error(
        `Google Ads conversion ${input.transactionId} already exists with conflicting values`,
      );
    }
  }

  private async failPurchaseConversion(
    transactionId: string,
    errorCode: string,
  ): Promise<void> {
    await this.markPurchaseConversionFailed(transactionId);
    logGoogleAdsLifecycleEvent("google_ads.conversion.failed", {
      errorCode,
      transactionId,
    });
  }

  private getErrorCode(error: unknown): string {
    if (isRecord(error)) {
      if (typeof error.code === "number" || typeof error.code === "string") {
        return `GOOGLE_DATA_MANAGER_${String(error.code)}`;
      }

      if (typeof error.name === "string" && error.name) {
        return error.name.slice(0, 128);
      }
    }

    return "GOOGLE_DATA_MANAGER_REQUEST_FAILED";
  }
}

export const googleAdsService = new GoogleAdsService();
