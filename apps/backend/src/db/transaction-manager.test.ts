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

vi.mock("../modules/model_rates/model_rates.repository.ts", () => ({
  ModelRatesRepository: class {
    constructor(readonly executor: unknown) {}
  },
}));

vi.mock("../modules/model_rate_limits/model_rate_limits.repository.ts", () => ({
  ModelRateLimitsRepository: class {
    constructor(readonly executor: unknown) {}
  },
}));

vi.mock("../modules/project/project.repository.ts", () => ({
  ProjectRepository: class {
    constructor(readonly executor: unknown) {}
  },
}));

import {
  TransactionManager,
  type TransactionServiceScope,
} from "./transaction-manager.ts";

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
      expect(tx.modelRates).toMatchObject({
        executor: mocks.transactionExecutor,
      });
      expect(tx.modelRateLimits).toMatchObject({
        executor: mocks.transactionExecutor,
      });
    });
  });

  it("creates scoped services from the active transaction manager", async () => {
    const scopedServices = {
      kind: "scoped-services",
    } as unknown as TransactionServiceScope;
    const createServiceScope = vi.fn(() => scopedServices);
    const manager = new TransactionManager({ createServiceScope });

    await manager.transaction(async (tx) => {
      expect(tx.services).toBe(scopedServices);
      expect(createServiceScope).toHaveBeenCalledWith(tx);
    });
  });

  it("caches scoped services for a transaction manager", async () => {
    const scopedServices = {
      kind: "scoped-services",
    } as unknown as TransactionServiceScope;
    const createServiceScope = vi.fn(() => scopedServices);
    const manager = new TransactionManager({ createServiceScope });

    await manager.transaction(async (tx) => {
      expect(tx.services).toBe(scopedServices);
      expect(tx.services).toBe(scopedServices);
    });

    expect(createServiceScope).toHaveBeenCalledTimes(1);
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

  it("reuses scoped services across nested transactions", async () => {
    const scopedServices = {
      kind: "scoped-services",
    } as unknown as TransactionServiceScope;
    const createServiceScope = vi.fn(() => scopedServices);
    const manager = new TransactionManager({ createServiceScope });

    await manager.transaction(async (outer) => {
      expect(outer.services).toBe(scopedServices);

      await outer.transaction(async (inner) => {
        expect(inner).toBe(outer);
        expect(inner.services).toBe(scopedServices);
      });
    });

    expect(createServiceScope).toHaveBeenCalledTimes(1);
  });

  it("runs after-commit callbacks after the root transaction commits", async () => {
    const manager = new TransactionManager();
    const calls: string[] = [];

    await expect(
      manager.transaction(async (tx) => {
        tx.afterCommit(() => {
          calls.push("after-commit");
        });
        calls.push("inside-transaction");

        return "committed";
      }),
    ).resolves.toBe("committed");

    expect(calls).toEqual(["inside-transaction", "after-commit"]);
  });

  it("does not run after-commit callbacks when the transaction rolls back", async () => {
    const manager = new TransactionManager();
    const afterCommit = vi.fn();

    await expect(
      manager.transaction(async (tx) => {
        tx.afterCommit(afterCommit);

        throw new Error("rollback");
      }),
    ).rejects.toThrow("rollback");

    expect(afterCommit).not.toHaveBeenCalled();
  });

  it("shares after-commit queues across nested transactions", async () => {
    const manager = new TransactionManager();
    const calls: string[] = [];

    await manager.transaction(async (outer) => {
      outer.afterCommit(() => {
        calls.push("outer-after-commit");
      });

      await outer.transaction(async (inner) => {
        inner.afterCommit(() => {
          calls.push("inner-after-commit");
        });
        calls.push("nested-complete");
      });

      expect(calls).toEqual(["nested-complete"]);
    });

    expect(calls).toEqual([
      "nested-complete",
      "outer-after-commit",
      "inner-after-commit",
    ]);
    expect(mocks.transaction).toHaveBeenCalledTimes(1);
  });

  it("coalesces keyed after-commit callbacks with the first registration winning", async () => {
    const manager = new TransactionManager();
    const calls: string[] = [];

    await manager.transaction(async (tx) => {
      tx.afterCommit(() => {
        calls.push("first");
      }, { key: "shared-key" });
      tx.afterCommit(() => {
        calls.push("second");
      }, { key: "shared-key" });
      tx.afterCommit(() => {
        calls.push("unkeyed");
      });
    });

    expect(calls).toEqual(["first", "unkeyed"]);
  });

  it("keeps committed transactions successful when after-commit callbacks fail", async () => {
    const manager = new TransactionManager();
    const calls: string[] = [];

    await expect(
      manager.transaction(async (tx) => {
        tx.afterCommit(() => {
          calls.push("first");

          throw new Error("publish failed");
        });
        tx.afterCommit(() => {
          calls.push("second");
        });

        return "committed";
      }),
    ).resolves.toBe("committed");

    expect(calls).toEqual(["first", "second"]);
  });

  it("rejects after-commit registrations outside active transactions", () => {
    const manager = new TransactionManager();

    expect(() => manager.afterCommit(() => undefined)).toThrow(
      "afterCommit can only be registered inside a transaction",
    );
  });
});
