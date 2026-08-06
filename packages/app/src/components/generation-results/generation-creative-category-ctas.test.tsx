/** @vitest-environment jsdom */

import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { GenerationCreativeCategoryCtas } from "./generation-creative-category-ctas.tsx";

describe("GenerationCreativeCategoryCtas", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders inert creative category buttons with descriptions", () => {
    const { container } = render(<GenerationCreativeCategoryCtas />);

    const group = screen.getByRole("group", { name: "Creative categories" });

    expect(group).toBeTruthy();
    expect(group.className).toContain("py-[14px]");
    expect(group.className).toContain("rounded-none");
    expect(group.className).toContain("border-0");
    expect(group.className).toContain("shadow-none");

    const sprocketRails = container.querySelectorAll<SVGElement>(
      '[data-slot="film-sprocket-rail"]',
    );

    expect(sprocketRails).toHaveLength(2);
    expect(
      Array.from(sprocketRails, (rail) => rail.dataset.edge),
    ).toStrictEqual(["top", "bottom"]);

    for (const rail of sprocketRails) {
      expect(rail.getAttribute("aria-hidden")).toBe("true");
      expect(rail.classList.contains("pointer-events-none")).toBe(true);
    }

    const [, bottomRail] = sprocketRails;

    expect(
      Array.from(bottomRail?.querySelectorAll("text") ?? [], (frameNumber) =>
        frameNumber.textContent,
      ),
    ).toStrictEqual(["47", "48", "49"]);

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
      expect(button.className).toContain("rounded-none");
      expect(button.className).toContain("border-transparent");
      expect(button.className).toContain("focus-visible:ring-inset");
      expect(button.className).not.toContain("before:bg");
      expect(button.className).not.toContain("hover:border");
      expect(button.className).not.toContain("hover:shadow");
      expect(button.className).toContain(
        "hover:bg-[color-mix(in_srgb,var(--surface-strong),var(--surface-strong-foreground)_4%)]",
      );
      expect(within(button).getByText(label)).toBeTruthy();
      expect(within(button).getByText(subtitle)).toBeTruthy();
    }
  });
});
