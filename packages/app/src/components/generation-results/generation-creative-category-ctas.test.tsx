/** @vitest-environment jsdom */

import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { GenerationCreativeCategoryCtas } from "./generation-creative-category-ctas.tsx";

describe("GenerationCreativeCategoryCtas", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders inert creative category buttons with descriptions", () => {
    render(<GenerationCreativeCategoryCtas />);

    expect(
      screen.getByRole("group", { name: "Creative categories" }),
    ).toBeTruthy();

    const categories = [
      ["Film", "Explore stories"],
      ["Ads", "Explore campaigns"],
      ["Art", "Explore visuals"],
    ] as const;

    for (const [label, subtitle] of categories) {
      const button = screen.getByRole("button", {
        description: subtitle,
        name: label,
      });

      expect(button.getAttribute("type")).toBe("button");
      expect(button.className).toContain("bg-surface-strong");
      expect(button.className).toContain(
        "hover:bg-[color-mix(in_srgb,var(--surface-strong),var(--surface-strong-foreground)_4%)]",
      );
      expect(within(button).getByText(label)).toBeTruthy();
      expect(within(button).getByText(subtitle)).toBeTruthy();
    }
  });
});
