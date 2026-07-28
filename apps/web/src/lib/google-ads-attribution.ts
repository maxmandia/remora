const googleAdsAttributionStorageKey = "remora.google_ads_click_attribution.v1";
const googleAdsAttributionLifetimeMs = 90 * 24 * 60 * 60 * 1_000;
const googleAdsAttributionFutureToleranceMs = 5 * 60 * 1_000;
const googleAdsClickIdMaxLength = 512;
const controlCharacterPattern = /[\u0000-\u001F\u007F]/;

export const googleAdsClickIdTypes = ["gclid", "gbraid", "wbraid"] as const;
export type GoogleAdsClickIdType = (typeof googleAdsClickIdTypes)[number];

export type StoredGoogleAdsClickAttribution = {
  clickIdType: GoogleAdsClickIdType;
  clickId: string;
  capturedAt: string;
};

export type GoogleAdsClickCaptureResult =
  | { status: "absent" }
  | { status: "ambiguous" }
  | { status: "invalid" }
  | { status: "storage_failed" }
  | { status: "stored"; attribution: StoredGoogleAdsClickAttribution };

export type GoogleAdsAttributionSyncResult =
  | { status: "absent" }
  | { status: "expired" }
  | { status: "invalid" }
  | { status: "storage_failed" }
  | { status: "synchronized" }
  | { status: "failed" };

export function captureGoogleAdsAttributionFromSearch(
  search: string,
  options: {
    now?: Date;
    storage?: Pick<Storage, "getItem" | "setItem">;
  } = {},
): GoogleAdsClickCaptureResult {
  const parameters = new URLSearchParams(search);
  const candidates = googleAdsClickIdTypes.flatMap((clickIdType) =>
    parameters.getAll(clickIdType).map((clickId) => ({ clickIdType, clickId })),
  );

  if (candidates.length === 0) {
    return { status: "absent" };
  }

  if (candidates.length !== 1) {
    return { status: "ambiguous" };
  }

  const candidate = candidates[0];

  if (!candidate || !isValidClickId(candidate.clickId)) {
    return { status: "invalid" };
  }

  const attribution: StoredGoogleAdsClickAttribution = {
    ...candidate,
    capturedAt: (options.now ?? new Date()).toISOString(),
  };
  const storage = options.storage ?? getBrowserStorage();

  if (!storage) {
    return { status: "storage_failed" };
  }

  try {
    storage.setItem(
      googleAdsAttributionStorageKey,
      JSON.stringify(attribution),
    );
  } catch {
    return { status: "storage_failed" };
  }

  return { status: "stored", attribution };
}

export async function syncStoredGoogleAdsAttribution(
  capture: (input: {
    clickIdType: GoogleAdsClickIdType;
    clickId: string;
    capturedAt: Date;
  }) => Promise<unknown>,
  options: {
    now?: Date;
    storage?: Pick<Storage, "getItem" | "removeItem">;
  } = {},
): Promise<GoogleAdsAttributionSyncResult> {
  const storage = options.storage ?? getBrowserStorage();

  if (!storage) {
    return { status: "storage_failed" };
  }

  let serialized: string | null;

  try {
    serialized = storage.getItem(googleAdsAttributionStorageKey);
  } catch {
    return { status: "storage_failed" };
  }

  if (!serialized) {
    return { status: "absent" };
  }

  const attribution = parseStoredAttribution(serialized);

  if (!attribution) {
    removeStoredAttribution(storage, serialized);
    return { status: "invalid" };
  }

  const capturedAt = new Date(attribution.capturedAt);
  const now = options.now ?? new Date();

  if (capturedAt.getTime() < now.getTime() - googleAdsAttributionLifetimeMs) {
    removeStoredAttribution(storage, serialized);
    return { status: "expired" };
  }

  if (
    capturedAt.getTime() >
    now.getTime() + googleAdsAttributionFutureToleranceMs
  ) {
    removeStoredAttribution(storage, serialized);
    return { status: "invalid" };
  }

  try {
    await capture({
      clickIdType: attribution.clickIdType,
      clickId: attribution.clickId,
      capturedAt,
    });
  } catch {
    return { status: "failed" };
  }

  removeStoredAttribution(storage, serialized);
  return { status: "synchronized" };
}

function parseStoredAttribution(
  serialized: string,
): StoredGoogleAdsClickAttribution | null {
  try {
    const value: unknown = JSON.parse(serialized);

    if (
      !value ||
      typeof value !== "object" ||
      !("clickIdType" in value) ||
      !googleAdsClickIdTypes.includes(
        value.clickIdType as GoogleAdsClickIdType,
      ) ||
      !("clickId" in value) ||
      typeof value.clickId !== "string" ||
      !isValidClickId(value.clickId) ||
      !("capturedAt" in value) ||
      typeof value.capturedAt !== "string" ||
      !Number.isFinite(new Date(value.capturedAt).getTime())
    ) {
      return null;
    }

    return {
      clickIdType: value.clickIdType as GoogleAdsClickIdType,
      clickId: value.clickId,
      capturedAt: value.capturedAt,
    };
  } catch {
    return null;
  }
}

function isValidClickId(clickId: string): boolean {
  return (
    clickId.length > 0 &&
    clickId.length <= googleAdsClickIdMaxLength &&
    clickId.trim() === clickId &&
    !controlCharacterPattern.test(clickId)
  );
}

function removeStoredAttribution(
  storage: Pick<Storage, "getItem" | "removeItem">,
  expectedValue: string,
): void {
  try {
    if (storage.getItem(googleAdsAttributionStorageKey) === expectedValue) {
      storage.removeItem(googleAdsAttributionStorageKey);
    }
  } catch {
    // Storage failures must not interrupt sign-in or navigation.
  }
}

function getBrowserStorage(): Storage | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}
