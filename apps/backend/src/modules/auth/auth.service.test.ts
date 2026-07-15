import { describe, expect, it, vi } from "vitest";

import { AuthService } from "./auth.service.ts";

vi.mock("./auth.repository.ts", () => ({
  authRepository: { deleteUserById: vi.fn() },
}));

describe("auth service", () => {
  it("tracks and notifies only after billing initialization succeeds", async () => {
    const billing = {
      initBillingForNewUser: vi.fn().mockResolvedValue(undefined),
    };
    const repository = { deleteUserById: vi.fn() };
    const analytics = { track: vi.fn() };
    const notifications = { notifyAccountSignedUp: vi.fn() };
    const service = new AuthService(billing as never, {
      analytics,
      notifications,
      repository: repository as never,
    });
    const occurredAt = new Date("2026-07-13T12:00:00.000Z");

    await service.completeSignup({
      userId: "user_1",
      email: "user@example.test",
      name: "User",
      occurredAt,
    });

    expect(analytics.track).toHaveBeenCalledWith({
      type: "account_signed_up",
      userId: "user_1",
      occurredAt,
    });
    expect(notifications.notifyAccountSignedUp).toHaveBeenCalledWith({
      userId: "user_1",
      email: "user@example.test",
      name: "User",
      occurredAt,
    });
  });

  it("does not track or notify users rolled back after billing failure", async () => {
    const error = new Error("billing failed");
    const billing = { initBillingForNewUser: vi.fn().mockRejectedValue(error) };
    const repository = { deleteUserById: vi.fn().mockResolvedValue(undefined) };
    const analytics = { track: vi.fn() };
    const notifications = { notifyAccountSignedUp: vi.fn() };
    const service = new AuthService(billing as never, {
      analytics,
      notifications,
      repository: repository as never,
    });

    await expect(
      service.completeSignup({
        userId: "user_1",
        email: "user@example.test",
        name: null,
        occurredAt: new Date("2026-07-13T12:00:00.000Z"),
      }),
    ).rejects.toBe(error);
    expect(repository.deleteUserById).toHaveBeenCalledWith("user_1");
    expect(analytics.track).not.toHaveBeenCalled();
    expect(notifications.notifyAccountSignedUp).not.toHaveBeenCalled();
  });

  it("contains unexpected synchronous notification failures", async () => {
    const notificationError = new Error("notification failed");
    const billing = {
      initBillingForNewUser: vi.fn().mockResolvedValue(undefined),
    };
    const logger = { error: vi.fn() };
    const service = new AuthService(billing as never, {
      analytics: { track: vi.fn() },
      notifications: {
        notifyAccountSignedUp: vi.fn(() => {
          throw notificationError;
        }),
      },
      repository: { deleteUserById: vi.fn() } as never,
    });

    await expect(
      service.completeSignup({
        userId: "user_1",
        email: "user@example.test",
        name: "User",
        occurredAt: new Date("2026-07-13T12:00:00.000Z"),
        logger,
      }),
    ).resolves.toBeUndefined();
    expect(logger.error).toHaveBeenCalledWith(
      "Failed to dispatch signup notification for user user_1",
      notificationError,
    );
  });
});
