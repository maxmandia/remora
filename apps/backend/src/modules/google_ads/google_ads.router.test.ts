import { beforeEach, describe, expect, it, vi } from "vitest";

import type { TRPCContext } from "../../trpc/context.ts";

const mocks = vi.hoisted(() => ({
  captureClickAttribution: vi.fn(),
}));

vi.mock("./google_ads.service.ts", () => ({
  googleAdsService: mocks,
}));

import { googleAdsRouter } from "./google_ads.router.ts";

describe("googleAds router", () => {
  beforeEach(() => {
    mocks.captureClickAttribution.mockReset();
    mocks.captureClickAttribution.mockResolvedValue({
      id: "attribution_1",
      expiresAt: new Date("2026-10-26T12:00:00.000Z"),
    });
  });

  it("captures case-sensitive click identifiers for signed-in users", async () => {
    const caller = googleAdsRouter.createCaller(createContext());

    await expect(
      caller.captureClickAttribution({
        clickIdType: "gclid",
        clickId: "CaseSensitiveClickId",
        capturedAt: new Date("2026-07-28T12:00:00.000Z"),
      }),
    ).resolves.toEqual({
      captured: true,
      expiresAt: new Date("2026-10-26T12:00:00.000Z"),
    });
    expect(mocks.captureClickAttribution).toHaveBeenCalledWith({
      userId: "user_1",
      clickIdType: "gclid",
      clickId: "CaseSensitiveClickId",
      capturedAt: new Date("2026-07-28T12:00:00.000Z"),
    });
  });

  it("suppresses attribution synchronization during impersonation", async () => {
    const caller = googleAdsRouter.createCaller(
      createContext({
        impersonatedBy: "admin_1",
      }),
    );

    await expect(
      caller.captureClickAttribution({
        clickIdType: "gbraid",
        clickId: "CaseSensitiveClickId",
        capturedAt: new Date("2026-07-28T12:00:00.000Z"),
      }),
    ).resolves.toEqual({ captured: false });
    expect(mocks.captureClickAttribution).not.toHaveBeenCalled();
  });
});

function createContext({
  impersonatedBy = null,
}: {
  impersonatedBy?: string | null;
} = {}): TRPCContext {
  return {
    actorUserId: impersonatedBy ?? "user_1",
    isImpersonating: Boolean(impersonatedBy),
    requestId: "request_1",
    session: {
      id: "session_1",
      impersonatedBy,
    },
    user: {
      id: "user_1",
      role: "user",
      name: "User",
      email: "user@example.test",
      emailVerified: true,
      image: null,
      createdAt: new Date("2026-07-28T12:00:00.000Z"),
      updatedAt: new Date("2026-07-28T12:00:00.000Z"),
    },
  } as unknown as TRPCContext;
}
