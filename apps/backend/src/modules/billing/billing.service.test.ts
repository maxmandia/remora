import { describe, expect, it, vi } from "vitest";

import type { CreditsRepository } from "../credits/credits.repository.ts";
import type { BillingRepository } from "./billing.repository.ts";
import { BillingService } from "./billing.service.ts";

vi.mock("../credits/credits.repository.ts", () => ({
  creditsRepository: {
    createUserBalance: vi.fn(),
  },
}));

vi.mock("./billing.repository.ts", () => ({
  billingRepository: {
    createBillingProfile: vi.fn(),
    createCreditAutoTopUpSettings: vi.fn(),
  },
}));

describe("BillingService", () => {
  it("initializes billing profile, auto top-up settings, and credit balance for new users", async () => {
    const billingRepository = createBillingRepository();
    const creditsRepository = createCreditsRepository();
    const stripeCustomerClient = createStripeCustomerClient();
    const service = new BillingService(billingRepository, {
      creditsRepository,
      stripeCustomerClient,
    });

    await expect(
      service.initBillingForNewUser({
        email: "user@example.test",
        name: "User",
        userId: "user_1",
      }),
    ).resolves.toEqual({
      userId: "user_1",
      stripeCustomerId: "cus_123",
    });

    expect(billingRepository.createBillingProfile).toHaveBeenCalledWith({
      userId: "user_1",
      stripeCustomerId: "cus_123",
    });
    expect(billingRepository.createCreditAutoTopUpSettings).toHaveBeenCalledWith(
      {
        userId: "user_1",
      },
    );
    expect(creditsRepository.createUserBalance).toHaveBeenCalledWith({
      userId: "user_1",
    });
    expect(
      vi.mocked(billingRepository.createBillingProfile).mock
        .invocationCallOrder[0],
    ).toBeLessThan(
      vi.mocked(billingRepository.createCreditAutoTopUpSettings).mock
        .invocationCallOrder[0],
    );
    expect(
      vi.mocked(billingRepository.createCreditAutoTopUpSettings).mock
        .invocationCallOrder[0],
    ).toBeLessThan(
      vi.mocked(creditsRepository.createUserBalance).mock
        .invocationCallOrder[0],
    );
    expect(stripeCustomerClient.del).not.toHaveBeenCalled();
  });

  it("deletes the Stripe customer when credit balance creation fails", async () => {
    const billingRepository = createBillingRepository();
    const creditsRepository = createCreditsRepository({
      createUserBalance: vi.fn().mockRejectedValue(new Error("DB unavailable")),
    });
    const stripeCustomerClient = createStripeCustomerClient();
    const service = new BillingService(billingRepository, {
      creditsRepository,
      stripeCustomerClient,
    });

    await expect(
      service.initBillingForNewUser({
        email: "user@example.test",
        name: null,
        userId: "user_1",
      }),
    ).rejects.toThrow("DB unavailable");

    expect(stripeCustomerClient.del).toHaveBeenCalledWith("cus_123");
  });
});

function createBillingRepository() {
  return {
    createBillingProfile: vi.fn().mockResolvedValue({
      userId: "user_1",
      stripeCustomerId: "cus_123",
    }),
    createCreditAutoTopUpSettings: vi.fn().mockResolvedValue({
      userId: "user_1",
    }),
  } as unknown as BillingRepository;
}

function createCreditsRepository({
  createUserBalance = vi.fn().mockResolvedValue(undefined),
}: {
  createUserBalance?: ReturnType<typeof vi.fn>;
} = {}) {
  return {
    createUserBalance,
  } as unknown as CreditsRepository;
}

function createStripeCustomerClient() {
  return {
    create: vi.fn().mockResolvedValue({
      id: "cus_123",
    }),
    del: vi.fn().mockResolvedValue({}),
  };
}
