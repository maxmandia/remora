import { describe, expect, it, vi } from "vitest";

import { AuthService } from "./auth.service.ts";

vi.mock("./auth.repository.ts", () => ({
  authRepository: { deleteUserById: vi.fn() },
}));

describe("auth service", () => {
  it("tracks signup only after billing initialization succeeds", async () => {
    const billing = {
      initBillingForNewUser: vi.fn().mockResolvedValue(undefined),
    };
    const repository = { deleteUserById: vi.fn() };
    const analytics = { track: vi.fn() };
    const service = new AuthService(
      billing as never,
      repository as never,
      analytics,
    );
    const occurredAt = new Date("2026-07-13T12:00:00.000Z");

    await service.initBillingForCreatedUser({
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
  });

  it("does not track users rolled back after billing failure", async () => {
    const error = new Error("billing failed");
    const billing = { initBillingForNewUser: vi.fn().mockRejectedValue(error) };
    const repository = { deleteUserById: vi.fn().mockResolvedValue(undefined) };
    const analytics = { track: vi.fn() };
    const service = new AuthService(
      billing as never,
      repository as never,
      analytics,
    );

    await expect(
      service.initBillingForCreatedUser({
        userId: "user_1",
        email: "user@example.test",
        name: null,
        occurredAt: new Date("2026-07-13T12:00:00.000Z"),
      }),
    ).rejects.toBe(error);
    expect(repository.deleteUserById).toHaveBeenCalledWith("user_1");
    expect(analytics.track).not.toHaveBeenCalled();
  });
});
