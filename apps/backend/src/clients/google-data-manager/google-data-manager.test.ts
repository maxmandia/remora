import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  ingestEvents: vi.fn(),
  retrieveRequestStatus: vi.fn(),
}));

vi.mock("@google-ads/datamanager", () => ({
  protos: {},
  v1: {
    IngestionServiceClient: class {
      ingestEvents = mocks.ingestEvents;
      retrieveRequestStatus = mocks.retrieveRequestStatus;
    },
  },
}));

import { GoogleDataManagerClient } from "./google-data-manager.ts";

describe("GoogleDataManagerClient", () => {
  beforeEach(() => {
    mocks.ingestEvents.mockReset();
    mocks.ingestEvents.mockResolvedValue([{ requestId: "request_123" }]);
  });

  it("sends the minimal click-matched purchase payload without customer PII", async () => {
    const client = new GoogleDataManagerClient(() => ({
      mode: "send",
      customerId: "8426092029",
      purchaseConversionActionId: "123456789",
      projectId: "remora-production",
      serviceAccountCredentials: {
        client_email: "google-ads@remora-production.iam.gserviceaccount.com",
        private_key: "private-key",
      },
    }));

    await expect(
      client.ingestPurchaseConversion({
        transactionId: "pi_123",
        eventOccurredAt: new Date("2026-07-28T12:34:56.789Z"),
        creditAmountUsdMicros: 25_000_000,
        clickIdType: "gclid",
        clickId: "CaseSensitiveClickId",
      }),
    ).resolves.toEqual({
      validatedOnly: false,
      requestId: "request_123",
    });

    expect(mocks.ingestEvents).toHaveBeenCalledWith({
      destinations: [
        {
          operatingAccount: {
            accountId: "8426092029",
            accountType: "GOOGLE_ADS",
          },
          productDestinationId: "123456789",
        },
      ],
      events: [
        {
          transactionId: "pi_123",
          eventTimestamp: {
            seconds: 1_785_242_096,
            nanos: 789_000_000,
          },
          adIdentifiers: {
            gclid: "CaseSensitiveClickId",
          },
          currency: "USD",
          conversionValue: 25,
          eventSource: "WEB",
        },
      ],
      validateOnly: false,
    });

    const payload = mocks.ingestEvents.mock.calls[0]?.[0];
    expect(JSON.stringify(payload)).not.toMatch(
      /email|userData|ipAddress|phone/i,
    );
  });

  it("uses validateOnly without requiring a request ID", async () => {
    mocks.ingestEvents.mockResolvedValue([{}]);
    const client = new GoogleDataManagerClient(() => ({
      mode: "validate",
      customerId: "8426092029",
      purchaseConversionActionId: "123456789",
      projectId: "remora-production",
      serviceAccountCredentials: {
        client_email: "google-ads@remora-production.iam.gserviceaccount.com",
        private_key: "private-key",
      },
    }));

    await expect(
      client.ingestPurchaseConversion({
        transactionId: "pi_123",
        eventOccurredAt: new Date("2026-07-28T12:34:56.789Z"),
        creditAmountUsdMicros: 1_000_000,
        clickIdType: "wbraid",
        clickId: "CaseSensitiveClickId",
      }),
    ).resolves.toEqual({ validatedOnly: true, requestId: null });
    expect(mocks.ingestEvents).toHaveBeenCalledWith(
      expect.objectContaining({ validateOnly: true }),
    );
  });
});
