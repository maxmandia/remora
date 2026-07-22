import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PublicPricingCatalog } from "./public-pricing";
import { fetchPublicPricing } from "./public-pricing";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
}));

vi.mock("../clients/trpc", () => ({
  trpcClient: {
    modelRates: {
      listPublicPricing: {
        query: mocks.query,
      },
    },
  },
}));

describe("public pricing", () => {
  beforeEach(() => {
    mocks.query.mockReset();
  });

  it("loads pricing through the shared tRPC client", async () => {
    const catalog: PublicPricingCatalog = {
      currencyCode: "USD",
      surchargeBasisPoints: 1000,
      models: [],
    };
    mocks.query.mockResolvedValue(catalog);

    await expect(fetchPublicPricing()).resolves.toBe(catalog);
    expect(mocks.query).toHaveBeenCalledOnce();
    expect(mocks.query).toHaveBeenCalledWith();
  });

  it("propagates client errors for the route loader to handle", async () => {
    const error = new Error("Pricing unavailable");
    mocks.query.mockRejectedValue(error);

    await expect(fetchPublicPricing()).rejects.toBe(error);
  });
});
