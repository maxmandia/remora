import { beforeEach, describe, expect, it, vi } from "vitest";

import { ModelRatesRepository } from "./model_rates.repository.ts";

type GenerationModelRateRecord = Awaited<
  ReturnType<ModelRatesRepository["listModelRates"]>
>[number];

const mocks = vi.hoisted(() => ({
  rateRows: [] as unknown[],
  select: vi.fn(),
  from: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  asc: vi.fn(),
  eq: vi.fn(),
  generationModelRateTable: {
    id: "generation_model_rate.id",
    modelId: "generation_model_rate.model_id",
    component: "generation_model_rate.component",
    quantitySource: "generation_model_rate.quantity_source",
    finalQuantitySource: "generation_model_rate.final_quantity_source",
    quantityUnit: "generation_model_rate.quantity_unit",
    unitQuantity: "generation_model_rate.unit_quantity",
    unitPriceUsdMicros: "generation_model_rate.unit_price_usd_micros",
    conditions: "generation_model_rate.conditions",
  },
}));

vi.mock("drizzle-orm", () => ({
  asc: mocks.asc,
  eq: mocks.eq,
}));

vi.mock("../../db/client.ts", () => ({
  db: {
    select: mocks.select,
  },
  schema: {
    generationModelRate: mocks.generationModelRateTable,
  },
}));

describe("model rates repository", () => {
  beforeEach(() => {
    mocks.rateRows = [];
    mocks.select.mockReset();
    mocks.from.mockReset();
    mocks.where.mockReset();
    mocks.orderBy.mockReset();
    mocks.asc.mockReset();
    mocks.eq.mockReset();

    const query = {
      from: mocks.from,
      where: mocks.where,
      orderBy: mocks.orderBy,
    };

    mocks.select.mockReturnValue(query);
    mocks.from.mockReturnValue(query);
    mocks.where.mockReturnValue(query);
    mocks.orderBy.mockImplementation(async () => mocks.rateRows);
    mocks.asc.mockImplementation((column: unknown) => ({
      column,
      direction: "asc",
    }));
    mocks.eq.mockImplementation((left: unknown, right: unknown) => ({
      left,
      operator: "eq",
      right,
    }));
  });

  it("queries rates by model id", async () => {
    const repository = new ModelRatesRepository();
    const rate = createRate();
    mocks.rateRows = [rate];

    await expect(repository.listModelRates("model_1")).resolves.toEqual([
      rate,
    ]);

    expect(mocks.select).toHaveBeenCalledWith();
    expect(mocks.from).toHaveBeenCalledWith(mocks.generationModelRateTable);
    expect(mocks.eq).toHaveBeenCalledWith(
      "generation_model_rate.model_id",
      "model_1",
    );
  });

  it("returns an empty array when no rows exist", async () => {
    const repository = new ModelRatesRepository();

    await expect(repository.listModelRates("model_1")).resolves.toEqual([]);
  });

  it("orders rates deterministically by id", async () => {
    const repository = new ModelRatesRepository();

    await repository.listModelRates("model_1");

    expect(mocks.asc).toHaveBeenCalledWith("generation_model_rate.id");
    expect(mocks.orderBy).toHaveBeenCalledWith({
      column: "generation_model_rate.id",
      direction: "asc",
    });
  });
});

function createRate(
  overrides: Partial<GenerationModelRateRecord> = {},
): GenerationModelRateRecord {
  return {
    id: "rate_1",
    modelId: "model_1",
    component: "output_video",
    quantitySource: "output_duration_seconds",
    finalQuantitySource: null,
    quantityUnit: "second",
    unitQuantity: 1,
    unitPriceUsdMicros: 84000,
    conditions: {},
    createdAt: new Date("2026-06-05T00:00:00.000Z"),
    updatedAt: new Date("2026-06-05T00:00:00.000Z"),
    ...overrides,
  };
}
