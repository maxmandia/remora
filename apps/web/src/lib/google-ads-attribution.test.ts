/** @vitest-environment jsdom */

import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  captureGoogleAdsAttributionFromSearch,
  syncStoredGoogleAdsAttribution,
} from "./google-ads-attribution";

describe("Google Ads click attribution", () => {
  let storage: ReturnType<typeof createMemoryStorage>;

  beforeEach(() => {
    storage = createMemoryStorage();
  });

  it("preserves identifier case and synchronizes the latest capture", async () => {
    const capturedAt = new Date("2026-07-28T12:00:00.000Z");
    const capture = vi.fn().mockResolvedValue({ captured: true });

    expect(
      captureGoogleAdsAttributionFromSearch("?gclid=AbC_123-xYz", {
        now: capturedAt,
        storage,
      }),
    ).toEqual({
      status: "stored",
      attribution: {
        clickIdType: "gclid",
        clickId: "AbC_123-xYz",
        capturedAt: capturedAt.toISOString(),
      },
    });
    await expect(
      syncStoredGoogleAdsAttribution(capture, {
        now: new Date("2026-07-29T12:00:00.000Z"),
        storage,
      }),
    ).resolves.toEqual({ status: "synchronized" });
    expect(capture).toHaveBeenCalledWith({
      clickIdType: "gclid",
      clickId: "AbC_123-xYz",
      capturedAt,
    });
  });

  it.each([
    "?gclid=one&gbraid=two",
    "?gclid=one&gclid=two",
    "?wbraid=one&gbraid=two&gclid=three",
  ])("rejects ambiguous search parameters: %s", (search) => {
    expect(
      captureGoogleAdsAttributionFromSearch(search, { storage }),
    ).toEqual({
      status: "ambiguous",
    });
    expect(storage.size()).toBe(0);
  });

  it.each(["?gclid=", "?gclid=%20value", `?gclid=${"a".repeat(513)}`])(
    "rejects malformed identifiers: %s",
    (search) => {
      expect(
        captureGoogleAdsAttributionFromSearch(search, { storage }),
      ).toEqual({ status: "invalid" });
    },
  );

  it("drops expired and future-dated stored captures", async () => {
    captureGoogleAdsAttributionFromSearch("?gbraid=CaseSensitive", {
      now: new Date("2026-01-01T00:00:00.000Z"),
      storage,
    });
    await expect(
      syncStoredGoogleAdsAttribution(vi.fn(), {
        now: new Date("2026-04-02T00:00:00.000Z"),
        storage,
      }),
    ).resolves.toEqual({ status: "expired" });

    captureGoogleAdsAttributionFromSearch("?wbraid=Future", {
      now: new Date("2026-07-28T12:10:00.000Z"),
      storage,
    });
    await expect(
      syncStoredGoogleAdsAttribution(vi.fn(), {
        now: new Date("2026-07-28T12:00:00.000Z"),
        storage,
      }),
    ).resolves.toEqual({ status: "invalid" });
  });

  it("contains storage and synchronization failures", async () => {
    const failingStorage = {
      getItem: vi.fn(() => {
        throw new Error("storage unavailable");
      }),
      setItem: vi.fn(() => {
        throw new Error("storage unavailable");
      }),
      removeItem: vi.fn(),
    };

    expect(
      captureGoogleAdsAttributionFromSearch("?gclid=one", {
        storage: failingStorage,
      }),
    ).toEqual({ status: "storage_failed" });
    await expect(
      syncStoredGoogleAdsAttribution(vi.fn(), {
        storage: failingStorage,
      }),
    ).resolves.toEqual({ status: "storage_failed" });

    captureGoogleAdsAttributionFromSearch("?gclid=one", { storage });
    await expect(
      syncStoredGoogleAdsAttribution(
        vi.fn().mockRejectedValue(new Error("network")),
        { storage },
      ),
    ).resolves.toEqual({ status: "failed" });
    expect(storage.size()).toBe(1);
  });
});

function createMemoryStorage() {
  const values = new Map<string, string>();

  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => {
      values.delete(key);
    },
    size: () => values.size,
  };
}
