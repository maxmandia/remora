import { describe, expect, it, vi } from "vitest";

import {
  GuestGenerationHandoffService,
  runSignupWithGuestGeneration,
} from "./guest-generation-handoff";

describe("guest generation handoff", () => {
  it("revalidates the local draft before returning its ticket", async () => {
    const models = [{ id: "model_1" }];
    const repository = {
      read: vi.fn().mockResolvedValue({
        status: "found",
        draft: { promotionTicket: "ticket_1" },
      }),
      save: vi.fn(),
      clear: vi.fn(),
    };
    const service = createService({
      listPublishedModels: vi.fn().mockResolvedValue(models),
      repository,
    });

    await expect(service.resolveTicket()).resolves.toBe("ticket_1");
    expect(repository.read).toHaveBeenCalledWith(models);
  });

  it.each([
    {
      result: { status: "empty" },
      message: "no longer available",
    },
    {
      result: { status: "discarded", reason: "expired" },
      message: "no longer available",
    },
    {
      result: { status: "failed", reason: "storage-error" },
      message: "Unable to read",
    },
  ])(
    "reports a recoverable $result.status result",
    async ({ result, message }) => {
      const service = createService({
        repository: {
          read: vi.fn().mockResolvedValue(result),
          save: vi.fn(),
          clear: vi.fn(),
        },
      });

      await expect(service.resolveTicket()).rejects.toThrow(message);
    },
  );

  it("claims the server-validated ticket", async () => {
    const claim = vi.fn().mockResolvedValue(undefined);
    const service = createService({ claim });

    await expect(service.claim("ticket_1")).resolves.toBeUndefined();
    expect(claim).toHaveBeenCalledWith("ticket_1");
  });

  it("turns claim failures into a retryable handoff error", async () => {
    const repository = {
      read: vi.fn().mockResolvedValue({
        status: "found",
        draft: { promotionTicket: "ticket_1" },
      }),
      save: vi.fn(),
      clear: vi.fn(),
    };
    const service = createService({
      claim: vi.fn().mockRejectedValue(new Error("conflict")),
      repository,
    });

    await expect(service.claim("ticket_1")).rejects.toThrow(
      "setup could not be completed",
    );
    await expect(service.resolveTicket()).resolves.toBe("ticket_1");
    expect(repository.clear).not.toHaveBeenCalled();
  });

  it("revalidates, creates the account, then claims before continuing", async () => {
    const events: string[] = [];
    const onClaimed = vi.fn(() => {
      events.push("continue");
    });

    await runSignupWithGuestGeneration({
      claim: vi.fn(async () => {
        events.push("claim");
      }),
      createAccount: vi.fn(async () => {
        events.push("signup");
        return { error: null };
      }),
      isAccountCreated: (result: { error: null }) => !result.error,
      isGuestGeneration: true,
      onClaimed,
      onTicketResolved: vi.fn(() => {
        events.push("ticket");
      }),
      resolveTicket: vi.fn(async () => {
        events.push("revalidate");
        return "ticket_1";
      }),
    });

    expect(events).toEqual([
      "revalidate",
      "ticket",
      "signup",
      "claim",
      "continue",
    ]);
    expect(onClaimed).toHaveBeenCalledOnce();
  });

  it("does not continue to email after a claim failure", async () => {
    const onClaimed = vi.fn();

    await expect(
      runSignupWithGuestGeneration({
        claim: vi.fn().mockRejectedValue(new Error("claim failed")),
        createAccount: vi.fn().mockResolvedValue({ error: null }),
        isAccountCreated: (result: { error: null }) => !result.error,
        isGuestGeneration: true,
        onClaimed,
        onTicketResolved: vi.fn(),
        resolveTicket: vi.fn().mockResolvedValue("ticket_1"),
      }),
    ).rejects.toThrow("claim failed");
    expect(onClaimed).not.toHaveBeenCalled();
  });

  it("keeps direct signup isolated from the guest handoff", async () => {
    const claim = vi.fn();
    const createAccount = vi.fn().mockResolvedValue({ error: null });
    const onClaimed = vi.fn();
    const resolveTicket = vi.fn();

    await expect(
      runSignupWithGuestGeneration({
        claim,
        createAccount,
        isAccountCreated: (result: { error: null }) => !result.error,
        isGuestGeneration: false,
        onClaimed,
        onTicketResolved: vi.fn(),
        resolveTicket,
      }),
    ).resolves.toEqual({ error: null });
    expect(createAccount).toHaveBeenCalledOnce();
    expect(resolveTicket).not.toHaveBeenCalled();
    expect(claim).not.toHaveBeenCalled();
    expect(onClaimed).not.toHaveBeenCalled();
  });
});

function createService(
  overrides: Partial<
    ConstructorParameters<typeof GuestGenerationHandoffService>[0]
  > = {},
) {
  return new GuestGenerationHandoffService({
    claim: vi.fn(),
    listPublishedModels: vi.fn().mockResolvedValue([]),
    repository: {
      read: vi.fn().mockResolvedValue({ status: "empty" }),
      save: vi.fn(),
      clear: vi.fn(),
    },
    ...overrides,
  } as never);
}
