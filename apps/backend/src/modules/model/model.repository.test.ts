import { readFileSync } from "node:fs";

import { beforeEach, describe, expect, it, vi } from "vitest";

import type { DatabaseExecutor } from "../../db/client.ts";
import type { ModelDefinitionV1 } from "./model.types.ts";
import { ModelRepository } from "./model.repository.ts";
import {
  normalizeModelDefinition,
  validateModelDefinition,
} from "./model.utils.ts";

const mocks = vi.hoisted(() => ({
  findModels: vi.fn(),
  findModel: vi.fn(),
  findModelSpec: vi.fn(),
  findProvider: vi.fn(),
}));

vi.mock("../../db/client.ts", () => ({ db: {} }));

const definitionPath = new URL(
  "../../../catalog/models/seedance-2.0-video.json",
  import.meta.url,
);

describe("model repository", () => {
  beforeEach(() => {
    mocks.findModels.mockReset();
    mocks.findModel.mockReset();
    mocks.findModelSpec.mockReset();
    mocks.findProvider.mockReset();
  });

  it("loads a complete model spec", async () => {
    const modelSpec = {
      id: "seedance-2.0-video-v1",
      modelId: "seedance-2.0-video",
      version: 1,
      schemaVersion: 1,
      status: "published",
      adapter: "byteplus_seedance_video",
      rateLimitMode: "enforced",
      spec: { endpoint: "video_generation" },
      publishedAt: new Date("2026-07-01T00:00:00.000Z"),
      createdAt: new Date("2026-07-01T00:00:00.000Z"),
      updatedAt: new Date("2026-07-01T00:00:00.000Z"),
    };
    mocks.findModelSpec.mockResolvedValue(modelSpec);
    const repository = createRepository();

    await expect(
      repository.getModelSpec("seedance-2.0-video-v1"),
    ).resolves.toEqual(modelSpec);
    expect(mocks.findModelSpec).toHaveBeenCalledWith({
      where: expect.any(Function),
    });
  });

  it("loads published models through relational catalog queries", async () => {
    const definition = readDefinition();
    const normalized = normalizeModelDefinition(definition);
    const spec = normalized.specs[0];
    mocks.findModels.mockResolvedValue([
      {
        id: normalized.model.id,
        providerId: normalized.model.providerId,
        displayName: normalized.model.displayName,
        type: normalized.model.type,
        provider: { name: "BytePlus" },
        specs: [{ id: spec.id, version: spec.version, spec: spec.spec }],
      },
    ]);
    const repository = createRepository();

    await expect(repository.listPublished()).resolves.toEqual([
      {
        id: normalized.model.id,
        providerId: "byteplus",
        providerName: "BytePlus",
        displayName: normalized.model.displayName,
        type: "video",
        latestSpecId: spec.id,
        latestSpecVersion: 1,
        spec: spec.spec,
      },
    ]);
    expect(mocks.findModels).toHaveBeenCalledWith(
      expect.objectContaining({
        with: expect.objectContaining({
          provider: expect.any(Object),
          specs: expect.any(Object),
        }),
      }),
    );
  });

  it("loads spec-scoped rates and cumulative rate limits for planning", async () => {
    const definition = readDefinition();
    const normalized = normalizeModelDefinition(definition);
    const spec = normalized.specs[0];
    const rate = spec.rates[0];
    const rule =
      spec.rateLimits.mode === "enforced" ? spec.rateLimits.rules[0] : null;

    if (!rule) {
      throw new Error("Seedance fixture must use enforced rate limits");
    }

    mocks.findProvider.mockResolvedValue({ id: "byteplus" });
    mocks.findModel.mockResolvedValue({
      id: normalized.model.id,
      providerId: normalized.model.providerId,
      displayName: normalized.model.displayName,
      type: normalized.model.type,
      status: normalized.model.status,
      specs: [
        {
          id: spec.id,
          modelId: normalized.model.id,
          version: spec.version,
          schemaVersion: spec.schemaVersion,
          status: spec.status,
          adapter: spec.adapter,
          rateLimitMode: spec.rateLimits.mode,
          spec: spec.spec,
          publishedAt: new Date("2026-07-01T00:00:00.000Z"),
          rates: [
            {
              ...rate,
              modelSpecId: spec.id,
              createdAt: new Date("2026-07-01T00:00:00.000Z"),
              updatedAt: new Date("2026-07-01T00:00:00.000Z"),
            },
          ],
          rateLimits: [
            {
              id: rule.id,
              modelSpecId: spec.id,
              bucketId: rule.bucket.id,
              conditions: rule.conditions,
              createdAt: new Date("2026-07-01T00:00:00.000Z"),
              updatedAt: new Date("2026-07-01T00:00:00.000Z"),
              bucket: {
                ...rule.bucket,
                providerId: "byteplus",
                createdAt: new Date("2026-07-01T00:00:00.000Z"),
                updatedAt: new Date("2026-07-01T00:00:00.000Z"),
              },
            },
          ],
        },
      ],
    });
    const repository = createRepository();

    await expect(
      repository.loadCatalogState({
        modelId: normalized.model.id,
        providerId: "byteplus",
      }),
    ).resolves.toMatchObject({
      providerExists: true,
      specs: [
        {
          id: spec.id,
          rates: [rate],
          rateLimits: [rule],
        },
      ],
    });
    expect(mocks.findModel).toHaveBeenCalledWith(
      expect.objectContaining({
        with: {
          specs: expect.objectContaining({
            with: {
              rates: true,
              rateLimits: { with: { bucket: true } },
            },
          }),
        },
      }),
    );
  });
});

function createRepository() {
  return new ModelRepository({
    query: {
      generationModel: {
        findMany: mocks.findModels,
        findFirst: mocks.findModel,
      },
      generationModelSpec: {
        findFirst: mocks.findModelSpec,
      },
      generationProvider: {
        findFirst: mocks.findProvider,
      },
    },
  } as unknown as DatabaseExecutor);
}

function readDefinition(): ModelDefinitionV1 {
  return validateModelDefinition(
    JSON.parse(readFileSync(definitionPath, "utf8")),
  );
}
