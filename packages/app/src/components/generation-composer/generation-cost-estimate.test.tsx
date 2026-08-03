/** @vitest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { GenerationCostEstimate } from "./generation-cost-estimate.tsx";

describe("GenerationCostEstimate", () => {
  afterEach(() => {
    cleanup();
  });

  it("formats the estimated cost with cents precision", () => {
    render(
      <GenerationCostEstimate
        estimatedCostUsdMicros={831_600}
        isInsufficientCredits={false}
        isLoading={false}
      />,
    );

    expect(screen.getByText(/≈ \$0\.83/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Buy credits" })).toBeNull();
  });

  it("highlights the estimate without offering to buy credits", () => {
    render(
      <GenerationCostEstimate
        estimatedCostUsdMicros={1_250_000}
        isInsufficientCredits
        isLoading={false}
      />,
    );

    const estimate = screen.getByText(/≈ \$1\.25/);
    expect(estimate.className).toContain("text-destructive");
    expect(screen.queryByRole("button", { name: "Buy credits" })).toBeNull();
  });

  it("does not show a stale estimate while the next estimate is loading", () => {
    render(
      <GenerationCostEstimate
        estimatedCostUsdMicros={831_600}
        isInsufficientCredits={false}
        isLoading
      />,
    );

    expect(screen.queryByText(/≈/)).toBeNull();
  });
});
