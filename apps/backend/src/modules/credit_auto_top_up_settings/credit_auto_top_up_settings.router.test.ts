import { maxCreditPurchaseAmountCents } from "@remora/domain/credits/validator";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { TRPCContext } from "../../trpc/context.ts";
import { creditAutoTopUpSettingsRouter } from "./credit_auto_top_up_settings.router.ts";
import { CreditAutoTopUpSettingsNotEditableError } from "./credit_auto_top_up_settings.types.ts";

const mocks = vi.hoisted(() => ({
  getSettingsByUserId: vi.fn(),
  updateSettings: vi.fn(),
}));

vi.mock("./credit_auto_top_up_settings.repository.ts", () => ({
  creditAutoTopUpSettingsRepository: {
    getSettingsByUserId: mocks.getSettingsByUserId,
  },
}));

vi.mock("../../app.service.ts", () => ({
  creditAutoTopUpSettingsService: {
    updateSettings: mocks.updateSettings,
  },
}));

describe("credit auto top-up settings router", () => {
  beforeEach(() => {
    mocks.getSettingsByUserId.mockReset();
    mocks.getSettingsByUserId.mockResolvedValue({
      userId: "user_1",
      enabled: true,
      topUpFloorUsdMicros: 5_000_000,
      topUpAmountUsdMicros: 25_000_000,
    });
    mocks.updateSettings.mockReset();
    mocks.updateSettings.mockResolvedValue({
      enabled: true,
      topUpFloorUsdMicros: 7_500_000,
      topUpAmountUsdMicros: 50_000_000,
    });
  });

  it("gets the signed-in user's auto top-up settings", async () => {
    const caller = creditAutoTopUpSettingsRouter.createCaller(
      createSignedInContext(),
    );

    await expect(caller.getSettings()).resolves.toEqual({
      enabled: true,
      topUpFloorUsdMicros: 5_000_000,
      topUpAmountUsdMicros: 25_000_000,
    });
    expect(mocks.getSettingsByUserId).toHaveBeenCalledWith("user_1");
  });

  it("requires authentication before getting settings", async () => {
    const caller = creditAutoTopUpSettingsRouter.createCaller(
      createSignedOutContext(),
    );

    await expect(caller.getSettings()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
    expect(mocks.getSettingsByUserId).not.toHaveBeenCalled();
  });

  it("maps missing settings to not found errors", async () => {
    const caller = creditAutoTopUpSettingsRouter.createCaller(
      createSignedInContext(),
    );
    mocks.getSettingsByUserId.mockResolvedValue(null);

    await expect(caller.getSettings()).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "Credit auto-reload settings were not found.",
    });
  });

  it("updates signed-in users' auto top-up settings", async () => {
    const caller = creditAutoTopUpSettingsRouter.createCaller(
      createSignedInContext(),
    );

    await expect(
      caller.updateSettings({
        enabled: true,
        topUpFloorCents: 750,
        topUpAmountCents: 5000,
      }),
    ).resolves.toEqual({
      enabled: true,
      topUpFloorUsdMicros: 7_500_000,
      topUpAmountUsdMicros: 50_000_000,
    });
    expect(mocks.updateSettings).toHaveBeenCalledWith({
      userId: "user_1",
      enabled: true,
      topUpFloorUsdMicros: 7_500_000,
      topUpAmountUsdMicros: 50_000_000,
    });
  });

  it("disables signed-in users' auto top-up settings", async () => {
    const caller = creditAutoTopUpSettingsRouter.createCaller(
      createSignedInContext(),
    );
    mocks.updateSettings.mockResolvedValue({
      enabled: false,
      topUpFloorUsdMicros: 0,
      topUpAmountUsdMicros: 0,
    });

    await expect(
      caller.updateSettings({
        enabled: false,
      }),
    ).resolves.toEqual({
      enabled: false,
      topUpFloorUsdMicros: 0,
      topUpAmountUsdMicros: 0,
    });
    expect(mocks.updateSettings).toHaveBeenCalledWith({
      userId: "user_1",
      enabled: false,
    });
  });

  it("requires authentication before updating settings", async () => {
    const caller = creditAutoTopUpSettingsRouter.createCaller(
      createSignedOutContext(),
    );

    await expect(
      caller.updateSettings({
        enabled: true,
        topUpFloorCents: 750,
        topUpAmountCents: 5000,
      }),
    ).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
    expect(mocks.updateSettings).not.toHaveBeenCalled();
  });

  it("rejects invalid settings updates", async () => {
    const caller = creditAutoTopUpSettingsRouter.createCaller(
      createSignedInContext(),
    );

    for (const input of [
      { enabled: true, topUpFloorCents: 0, topUpAmountCents: 5000 },
      { enabled: true, topUpFloorCents: 750, topUpAmountCents: 0 },
      {
        enabled: true,
        topUpFloorCents: maxCreditPurchaseAmountCents + 1,
        topUpAmountCents: 5000,
      },
    ] as const) {
      await expect(caller.updateSettings(input)).rejects.toMatchObject({
        code: "BAD_REQUEST",
      });
    }
    expect(mocks.updateSettings).not.toHaveBeenCalled();
  });

  it("maps non-editable settings to conflict errors", async () => {
    const caller = creditAutoTopUpSettingsRouter.createCaller(
      createSignedInContext(),
    );
    mocks.updateSettings.mockRejectedValue(
      new CreditAutoTopUpSettingsNotEditableError("user_1"),
    );

    await expect(
      caller.updateSettings({
        enabled: true,
        topUpFloorCents: 750,
        topUpAmountCents: 5000,
      }),
    ).rejects.toMatchObject({
      code: "CONFLICT",
      message: "Credit auto-reload settings are not editable for user user_1",
    });
  });
});

function createSignedInContext(): TRPCContext {
  return {
    session: {
      id: "session_1",
    },
    user: {
      id: "user_1",
      name: "User",
      email: "user@example.test",
      emailVerified: true,
      image: null,
      createdAt: "2026-06-05T00:00:00.000Z",
      updatedAt: "2026-06-05T00:00:00.000Z",
    },
  } as unknown as TRPCContext;
}

function createSignedOutContext(): TRPCContext {
  return {
    session: null,
    user: null,
  } as unknown as TRPCContext;
}
