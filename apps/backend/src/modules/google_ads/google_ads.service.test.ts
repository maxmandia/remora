import { beforeEach, describe, expect, it, vi } from "vitest";

import type { GoogleAdsRepository } from "./google_ads.repository.ts";
import {
  GoogleAdsAttributionValidationError,
  type GoogleAdsClickAttributionRecord,
  type GoogleAdsDataManagerClient,
  type GoogleAdsPurchaseConversionRecord,
} from "./google_ads.types.ts";

vi.mock("./google_ads.repository.ts", () => ({
  googleAdsRepository: {},
}));
vi.mock("../../clients/google-data-manager/google-data-manager.ts", () => ({
  googleDataManagerClient: {},
}));

const now = new Date("2026-07-28T12:00:00.000Z");
const attribution: GoogleAdsClickAttributionRecord = {
  id: "attribution_1",
  userId: "user_1",
  clickIdType: "gclid",
  clickId: "CaseSensitiveClickId",
  capturedAt: new Date("2026-07-27T12:00:00.000Z"),
  expiresAt: new Date("2026-10-25T12:00:00.000Z"),
  createdAt: new Date("2026-07-27T12:00:00.000Z"),
};

describe("GoogleAdsService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("preserves case and applies the 90-day attribution expiry", async () => {
    const repository = createRepository();
    repository.upsertClickAttribution.mockImplementation(async (input) => ({
      ...input,
      id: "attribution_1",
      createdAt: now,
    }));
    const { GoogleAdsService } = await import("./google_ads.service.ts");
    const service = new GoogleAdsService(
      repository as unknown as GoogleAdsRepository,
      createDataManager(),
      createConfig,
      () => now,
    );

    await expect(
      service.captureClickAttribution({
        userId: "user_1",
        clickIdType: "gclid",
        clickId: "CaseSensitiveClickId",
        capturedAt: now,
      }),
    ).resolves.toEqual({
      id: "attribution_1",
      expiresAt: new Date("2026-10-26T12:00:00.000Z"),
    });
    expect(repository.upsertClickAttribution).toHaveBeenCalledWith({
      userId: "user_1",
      clickIdType: "gclid",
      clickId: "CaseSensitiveClickId",
      capturedAt: now,
      expiresAt: new Date("2026-10-26T12:00:00.000Z"),
    });
  });

  it.each([
    {
      clickId: " invalid",
      capturedAt: now,
    },
    {
      clickId: "valid",
      capturedAt: new Date("2026-04-28T11:59:59.999Z"),
    },
    {
      clickId: "valid",
      capturedAt: new Date("2026-07-28T12:05:00.001Z"),
    },
  ])("rejects malformed, expired, or future captures", async (input) => {
    const { GoogleAdsService } = await import("./google_ads.service.ts");
    const service = new GoogleAdsService(
      createRepository() as unknown as GoogleAdsRepository,
      createDataManager(),
      createConfig,
      () => now,
    );

    await expect(
      service.captureClickAttribution({
        userId: "user_1",
        clickIdType: "gclid",
        ...input,
      }),
    ).rejects.toBeInstanceOf(GoogleAdsAttributionValidationError);
  });

  it("prepares an attributed purchase and submits it idempotently", async () => {
    const repository = createRepository();
    const conversion = createConversion();
    repository.findAttributionById.mockResolvedValue(attribution);
    repository.createPurchaseConversion.mockResolvedValue(conversion);
    repository.findPurchaseConversionForDelivery.mockResolvedValue({
      conversion,
      creditAmountUsdMicros: 25_000_000,
    });
    const dataManager = createDataManager();
    dataManager.ingestPurchaseConversion.mockResolvedValue({
      validatedOnly: false,
      requestId: "request_123",
    });
    const { GoogleAdsService } = await import("./google_ads.service.ts");
    const service = new GoogleAdsService(
      repository as unknown as GoogleAdsRepository,
      dataManager,
      createConfig,
      () => now,
    );
    const input = {
      analyticsContext: { suppressed: false },
      attributionId: attribution.id,
      creditLedgerEntryId: "ledger_1",
      eventOccurredAt: now,
      stripeCheckoutSessionId: "cs_123",
      transactionId: "pi_123",
      userId: "user_1",
    };

    await expect(service.preparePurchaseConversion(input)).resolves.toEqual(
      conversion,
    );
    await expect(service.deliverPurchaseConversion("pi_123")).resolves.toEqual({
      status: "accepted",
      googleRequestId: "request_123",
    });
    expect(dataManager.ingestPurchaseConversion).toHaveBeenCalledWith({
      transactionId: "pi_123",
      eventOccurredAt: now,
      creditAmountUsdMicros: 25_000_000,
      clickIdType: "gclid",
      clickId: "CaseSensitiveClickId",
    });
    expect(repository.updatePurchaseConversion).toHaveBeenCalledWith(
      "pi_123",
      {
        status: "accepted",
        googleRequestId: "request_123",
      },
    );
  });

  it("fails delivery when the linked ledger amount is not positive", async () => {
    const repository = createRepository();
    repository.findPurchaseConversionForDelivery.mockResolvedValue({
      conversion: createConversion(),
      creditAmountUsdMicros: 0,
    });
    const { GoogleAdsService } = await import("./google_ads.service.ts");
    const service = new GoogleAdsService(
      repository as unknown as GoogleAdsRepository,
      createDataManager(),
      createConfig,
      () => now,
    );

    await expect(service.deliverPurchaseConversion("pi_123")).resolves.toEqual({
      status: "failed",
    });
    expect(repository.updatePurchaseConversion).toHaveBeenCalledWith(
      "pi_123",
      {
        status: "failed",
      },
    );
  });

  it("records successful diagnostics without persisting warning codes", async () => {
    const repository = createRepository();
    const dataManager = createDataManager();
    dataManager.getRequestStatus.mockResolvedValue({
      status: "succeeded",
      warningCodes: ["CLICK_NOT_RECENT"],
    });
    const { GoogleAdsService } = await import("./google_ads.service.ts");
    const service = new GoogleAdsService(
      repository as unknown as GoogleAdsRepository,
      dataManager,
      createConfig,
      () => now,
    );

    await expect(
      service.refreshPurchaseConversionStatus("pi_123", "request_123"),
    ).resolves.toBe("succeeded");
    expect(repository.updatePurchaseConversion).toHaveBeenCalledWith(
      "pi_123",
      {
        status: "succeeded",
      },
    );
  });
});

function createRepository() {
  return {
    upsertClickAttribution: vi.fn(),
    findLatestActiveAttribution: vi.fn(),
    findAttributionById: vi.fn(),
    createPurchaseConversion: vi.fn(),
    findPurchaseConversionByTransactionId: vi.fn(),
    findPurchaseConversionForDelivery: vi.fn(),
    updatePurchaseConversion: vi.fn(),
    deleteExpiredAttributions: vi.fn(),
  };
}

function createDataManager() {
  return {
    ingestPurchaseConversion: vi.fn(),
    getRequestStatus: vi.fn(),
  } as unknown as GoogleAdsDataManagerClient & {
    ingestPurchaseConversion: ReturnType<typeof vi.fn>;
    getRequestStatus: ReturnType<typeof vi.fn>;
  };
}

function createConfig() {
  return {
    mode: "send" as const,
    customerId: "8426092029",
    purchaseConversionActionId: "123456789",
    projectId: "remora-production",
    serviceAccountCredentials: {
      client_email: "google-ads@remora-production.iam.gserviceaccount.com",
      private_key: "private-key",
    },
  };
}

function createConversion(
  overrides: Partial<GoogleAdsPurchaseConversionRecord> = {},
): GoogleAdsPurchaseConversionRecord {
  return {
    transactionId: "pi_123",
    userId: "user_1",
    attributionId: "attribution_1",
    stripeCheckoutSessionId: "cs_123",
    creditLedgerEntryId: "ledger_1",
    eventOccurredAt: now,
    status: "pending",
    googleRequestId: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}
