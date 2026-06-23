import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  transactionExecutor: {
    kind: "transaction-executor",
  },
  transaction: vi.fn(),
}));

vi.mock("./client.ts", () => ({
  db: {
    transaction: mocks.transaction,
  },
}));

vi.mock("../modules/auth/auth.repository.ts", () => ({
  AuthRepository: class {
    constructor(readonly executor: unknown) {}
  },
}));

vi.mock("../modules/billing/billing.repository.ts", () => ({
  BillingRepository: class {
    constructor(readonly executor: unknown) {}
  },
}));

vi.mock("../modules/credits/credits.repository.ts", () => ({
  CreditsRepository: class {
    constructor(readonly executor: unknown) {}
  },
}));

vi.mock("../modules/generation-attachment-media/generation-attachment-media.repository.ts", () => ({
  GenerationAttachmentMediaRepository: class {
    constructor(readonly executor: unknown) {}
  },
}));

vi.mock("../modules/generation/generation.repository.ts", () => ({
  GenerationRepository: class {
    constructor(
      readonly executor: unknown,
      readonly attachmentMediaRepository: unknown,
    ) {}
  },
}));

vi.mock("../modules/project/project.repository.ts", () => ({
  ProjectRepository: class {
    constructor(readonly executor: unknown) {}
  },
}));

import { TransactionManager } from "./transaction-manager.ts";

describe("TransactionManager", () => {
  beforeEach(() => {
    mocks.transaction.mockReset();
    mocks.transaction.mockImplementation(
      async (callback: (tx: unknown) => Promise<unknown>) =>
        callback(mocks.transactionExecutor),
    );
  });

  it("opens one root transaction", async () => {
    const manager = new TransactionManager();

    await expect(
      manager.transaction(async () => "committed"),
    ).resolves.toBe("committed");

    expect(mocks.transaction).toHaveBeenCalledTimes(1);
  });

  it("passes the transaction executor to scoped repositories", async () => {
    const manager = new TransactionManager();

    await manager.transaction(async (tx) => {
      expect(tx.credits).toMatchObject({
        executor: mocks.transactionExecutor,
      });
      expect(tx.generationAttachmentMedia).toMatchObject({
        executor: mocks.transactionExecutor,
      });
      expect(tx.generation).toMatchObject({
        executor: mocks.transactionExecutor,
        attachmentMediaRepository: tx.generationAttachmentMedia,
      });
    });
  });

  it("reuses an active transaction manager instead of nesting", async () => {
    const manager = new TransactionManager();

    await manager.transaction(async (outer) => {
      await expect(
        outer.transaction(async (inner) => {
          expect(inner).toBe(outer);

          return "inner-result";
        }),
      ).resolves.toBe("inner-result");
    });

    expect(mocks.transaction).toHaveBeenCalledTimes(1);
  });
});
