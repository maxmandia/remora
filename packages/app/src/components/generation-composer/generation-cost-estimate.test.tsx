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

    expect(screen.getByText("~ $0.83")).toBeTruthy();
  });

  it("renders insufficient estimates with destructive text", () => {
    render(
      <GenerationCostEstimate
        estimatedCostUsdMicros={1_250_000}
        isInsufficientCredits
        isLoading={false}
      />,
    );

    expect(screen.getByText("~ $1.25").parentElement?.className).toContain(
      "text-destructive",
    );
  });
});
