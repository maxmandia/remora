/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

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
        onBuyCredits={vi.fn()}
      />,
    );

    expect(screen.getByText(/≈ \$0\.83/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Buy credits" })).toBeNull();
  });

  it("renders a buy credits button before insufficient estimates", () => {
    const onBuyCredits = vi.fn();

    render(
      <GenerationCostEstimate
        estimatedCostUsdMicros={1_250_000}
        isInsufficientCredits
        isLoading={false}
        onBuyCredits={onBuyCredits}
      />,
    );

    const buyCreditsButton = screen.getByRole("button", {
      name: "Buy credits",
    });
    const estimate = screen.getByText(/≈ \$1\.25/);

    expect(
      buyCreditsButton.compareDocumentPosition(estimate) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(estimate.className).toContain("text-destructive");

    fireEvent.click(buyCreditsButton);

    expect(onBuyCredits).toHaveBeenCalledOnce();
  });
});
