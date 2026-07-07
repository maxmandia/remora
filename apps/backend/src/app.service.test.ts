import { describe, expect, it, vi } from "vitest";

import type { TransactionManager } from "./db/transaction-manager.ts";

vi.mock("./db/client.ts", () => ({
  db: {},
  postgresClient: {},
  schema: {},
}));

vi.mock(
  "./modules/generation-attachment-media/generation-media-probe.service.ts",
  () => ({
    FfprobeMediaMetadataProbe: class {},
  }),
);

vi.mock("./modules/storage/object-storage.service.ts", () => ({
  objectStorageService: {
    kind: "object-storage-service",
  },
}));

import { createTransactionServiceScope } from "./app.service.ts";

describe("app service composition", () => {
  it("wires transaction-scoped services to transaction repositories", () => {
    const tx = createTransactionManager();

    const services = createTransactionServiceScope(tx);

    expect(readPrivate(services.auth, "billing")).toBe(services.billing);
    expect(readPrivate(services.auth, "repository")).toBe(tx.auth);
    expect(readPrivate(services.billing, "repository")).toBe(tx.billing);
    expect(readPrivate(services.billing, "credits")).toBe(tx.credits);
    expect(readPrivate(services.credits, "billing")).toBe(tx.billing);
    expect(readPrivate(services.credits, "repository")).toBe(tx.credits);
    expect(readPrivate(services.credits, "transactionManager")).toBe(tx);
    expect(readPrivate(services.generation, "repository")).toBe(
      tx.generation,
    );
    expect(readPrivate(services.generation, "attachmentMedia")).toBe(
      services.generationAttachmentMedia,
    );
    expect(readPrivate(services.generation, "modelRateLimits")).toBe(
      services.modelRateLimits,
    );
    expect(readPrivate(services.generation, "modelRates")).toBe(
      services.modelRates,
    );
    expect(readPrivate(services.generation, "transactionManager")).toBe(tx);
    expect(readPrivate(services.generationAttachmentMedia, "repository")).toBe(
      tx.generationAttachmentMedia,
    );
    expect(
      readPrivate(services.generationCostFinalization, "transactionManager"),
    ).toBe(tx);
    expect(readPrivate(services.modelRateLimits, "transactionManager")).toBe(
      tx,
    );
    expect(readPrivate(services.modelRates, "repository")).toBe(tx.modelRates);
  });
});

function createTransactionManager() {
  return {
    auth: { kind: "auth-repository" },
    billing: { kind: "billing-repository" },
    credits: { kind: "credits-repository" },
    generation: { kind: "generation-repository" },
    generationAttachmentMedia: {
      kind: "generation-attachment-media-repository",
    },
    modelRateLimits: { kind: "model-rate-limits-repository" },
    modelRates: { kind: "model-rates-repository" },
    transaction: vi.fn(),
  } as unknown as TransactionManager;
}

function readPrivate<T>(value: unknown, key: string): T {
  return (value as Record<string, T>)[key]!;
}
