import { describe, expect, it, vi } from "vitest";

import {
  AuthEmailVerificationService,
  GuestVerificationEmailNotAllowedError,
} from "./auth-email-verification.service.ts";

describe("auth email verification service", () => {
  it("authorizes the configured callback for a claimed unverified user", async () => {
    const promotion = {
      getStatus: vi.fn().mockResolvedValue({ status: "verification_required" }),
    };
    const service = createService({ promotion });

    await expect(
      service.authorizeSend({
        callbackUrl: "https://remora.test/check-email?verified=true",
        expectedCallbackUrl: "https://remora.test/check-email?verified=true",
        requestedEmail: "guest@example.test",
        sessionEmail: "guest@example.test",
        userId: "user_1",
      }),
    ).resolves.toBeUndefined();
    expect(promotion.getStatus).toHaveBeenCalledWith("user_1");
  });

  it.each(["none", "eligible", "redeemed"])(
    "rejects promotion status %s",
    async (status) => {
      const service = createService({
        promotion: {
          getStatus: vi.fn().mockResolvedValue({ status }),
        },
      });

      await expect(
        service.authorizeSend({
          callbackUrl: "https://remora.test/check-email?verified=true",
          expectedCallbackUrl: "https://remora.test/check-email?verified=true",
          requestedEmail: "guest@example.test",
          sessionEmail: "guest@example.test",
          userId: "user_1",
        }),
      ).rejects.toBeInstanceOf(GuestVerificationEmailNotAllowedError);
    },
  );

  it("rejects an unexpected callback without reading promotion state", async () => {
    const promotion = { getStatus: vi.fn() };
    const service = createService({ promotion });

    await expect(
      service.authorizeSend({
        callbackUrl: "https://remora.test/check-email",
        expectedCallbackUrl: "https://remora.test/check-email?verified=true",
        requestedEmail: "guest@example.test",
        sessionEmail: "guest@example.test",
        userId: "user_1",
      }),
    ).rejects.toBeInstanceOf(GuestVerificationEmailNotAllowedError);
    expect(promotion.getStatus).not.toHaveBeenCalled();
  });

  it("rejects delivery for an email other than the session user", async () => {
    const promotion = { getStatus: vi.fn() };
    const service = createService({ promotion });

    await expect(
      service.authorizeSend({
        callbackUrl: "https://remora.test/check-email?verified=true",
        expectedCallbackUrl: "https://remora.test/check-email?verified=true",
        requestedEmail: "other@example.test",
        sessionEmail: "guest@example.test",
        userId: "user_1",
      }),
    ).rejects.toBeInstanceOf(GuestVerificationEmailNotAllowedError);
    expect(promotion.getStatus).not.toHaveBeenCalled();
  });

  it("delivers through the provider-neutral email service", async () => {
    const email = {
      sendVerificationEmail: vi.fn().mockResolvedValue({
        providerMessageId: "message_1",
        status: "delivered",
      }),
    };
    const service = createService({ email });

    await expect(
      service.send({
        email: "user@example.test",
        verificationUrl: "https://api.example.test/verify?token=secret",
      }),
    ).resolves.toEqual({
      providerMessageId: "message_1",
      status: "delivered",
    });
    expect(email.sendVerificationEmail).toHaveBeenCalledWith({
      email: "user@example.test",
      verificationUrl: "https://api.example.test/verify?token=secret",
    });
  });

  it("delegates completed verification to the promotion workflow", async () => {
    const promotion = {
      getStatus: vi.fn(),
      trackEmailVerified: vi.fn().mockResolvedValue(undefined),
    };
    const service = createService({ promotion });
    const occurredAt = new Date("2026-07-27T12:00:00.000Z");

    await expect(
      service.recordVerification({
        occurredAt,
        userId: "user_1",
      }),
    ).resolves.toBeUndefined();
    expect(promotion.trackEmailVerified).toHaveBeenCalledWith({
      occurredAt,
      userId: "user_1",
    });
  });
});

function createService({
  email = { sendVerificationEmail: vi.fn() },
  promotion = {
    getStatus: vi.fn().mockResolvedValue({ status: "verification_required" }),
    trackEmailVerified: vi.fn(),
  },
}: {
  email?: { sendVerificationEmail: ReturnType<typeof vi.fn> };
  promotion?: {
    getStatus: ReturnType<typeof vi.fn>;
    trackEmailVerified?: ReturnType<typeof vi.fn>;
  };
} = {}) {
  return new AuthEmailVerificationService(
    {
      trackEmailVerified: vi.fn(),
      ...promotion,
    } as never,
    email as never,
  );
}
