import {
  parseBackendGoogleAdsEnv,
  type BackendGoogleAdsEnv,
} from "@remora/env";
import { protos, v1 } from "@google-ads/datamanager";

import type {
  GoogleAdsDataManagerClient,
  GoogleAdsDataManagerRequestStatus,
  GoogleAdsPurchaseConversionDeliveryInput,
} from "../../modules/google_ads/google_ads.types.ts";

type EnabledGoogleAdsConfig = Exclude<BackendGoogleAdsEnv, { mode: "off" }>;

export class GoogleDataManagerClient implements GoogleAdsDataManagerClient {
  private client: v1.IngestionServiceClient | null = null;

  constructor(
    private readonly getConfig: () => BackendGoogleAdsEnv = () =>
      parseBackendGoogleAdsEnv(process.env),
  ) {}

  async ingestPurchaseConversion(
    input: GoogleAdsPurchaseConversionDeliveryInput,
  ) {
    const config = this.getEnabledConfig();
    const [response] = await this.getClient(config).ingestEvents({
      destinations: [
        {
          operatingAccount: {
            accountId: config.customerId,
            accountType: "GOOGLE_ADS",
          },
          productDestinationId: config.purchaseConversionActionId,
        },
      ],
      events: [
        {
          transactionId: input.transactionId,
          eventTimestamp: this.toTimestamp(input.eventOccurredAt),
          adIdentifiers: {
            [input.clickIdType]: input.clickId,
          },
          currency: "USD",
          conversionValue: input.creditAmountUsdMicros / 1_000_000,
          eventSource: "WEB",
        },
      ],
      validateOnly: config.mode === "validate",
    });

    if (config.mode === "validate") {
      return { validatedOnly: true as const, requestId: null };
    }

    const requestId = response.requestId?.trim();

    if (!requestId) {
      throw new Error("Google Data Manager response omitted request_id");
    }

    return {
      validatedOnly: false as const,
      requestId,
    };
  }

  async getRequestStatus(
    requestId: string,
  ): Promise<GoogleAdsDataManagerRequestStatus> {
    const config = this.getEnabledConfig();
    const [response] = await this.getClient(config).retrieveRequestStatus({
      requestId,
    });
    const destination = response.requestStatusPerDestination?.[0];

    if (!destination) {
      throw new Error(
        `Google Data Manager diagnostics omitted destination for ${requestId}`,
      );
    }

    const statuses =
      protos.google.ads.datamanager.v1.RequestStatusPerDestination
        .RequestStatus;
    const status = destination.requestStatus;

    if (
      status === statuses.PROCESSING ||
      status === statuses.REQUEST_STATUS_UNKNOWN ||
      status === "PROCESSING" ||
      status === "REQUEST_STATUS_UNKNOWN"
    ) {
      return { status: "processing" };
    }

    const warningCodes = (destination.warningInfo?.warningCounts ?? []).map(
      ({ reason }) =>
        this.toEnumName(
          protos.google.ads.datamanager.v1.ProcessingWarningReason,
          reason,
        ),
    );

    if (status === statuses.SUCCESS || status === "SUCCESS") {
      return {
        status: "succeeded",
        warningCodes,
      };
    }

    const errorCodes = (destination.errorInfo?.errorCounts ?? []).map(
      ({ reason }) =>
        this.toEnumName(
          protos.google.ads.datamanager.v1.ProcessingErrorReason,
          reason,
        ),
    );

    return {
      status: "failed",
      errorCodes:
        errorCodes.length > 0
          ? errorCodes
          : [`GOOGLE_DATA_MANAGER_${String(status)}`],
      warningCodes,
    };
  }

  private getEnabledConfig(): EnabledGoogleAdsConfig {
    const config = this.getConfig();

    if (config.mode === "off") {
      throw new Error("Google Ads server conversions are disabled");
    }

    return config;
  }

  private getClient(config: EnabledGoogleAdsConfig) {
    this.client ??= new v1.IngestionServiceClient({
      projectId: config.projectId,
      credentials: config.serviceAccountCredentials,
    });

    return this.client;
  }

  private toTimestamp(date: Date) {
    const milliseconds = date.getTime();
    return {
      seconds: Math.floor(milliseconds / 1_000),
      nanos: (milliseconds % 1_000) * 1_000_000,
    };
  }

  private toEnumName(
    enumValues: Record<string | number, string | number>,
    value: string | number | null | undefined,
  ): string {
    if (typeof value === "string") {
      return value;
    }

    if (typeof value === "number") {
      const name = enumValues[value];
      return typeof name === "string" ? name : String(value);
    }

    return "UNSPECIFIED";
  }
}

export const googleDataManagerClient = new GoogleDataManagerClient();
