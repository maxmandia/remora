/** @vitest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { SiteFooter } from "./site-footer";

describe("SiteFooter", () => {
  afterEach(() => {
    cleanup();
  });

  it("links to the planned policy and support pages", () => {
    render(<SiteFooter />);

    expect(
      screen.getByRole("link", { name: "Pricing" }).getAttribute("href"),
    ).toBe("/pricing");
    expect(
      screen.getByRole("link", { name: "Models" }).getAttribute("href"),
    ).toBe("/models");
    expect(
      screen.getByRole("link", { name: "Terms" }).getAttribute("href"),
    ).toBe("/terms");
    expect(
      screen.getByRole("link", { name: "Privacy" }).getAttribute("href"),
    ).toBe("/privacy");
    expect(
      screen.getByRole("link", { name: "Support" }).getAttribute("href"),
    ).toBe("/support");
  });

  it("shows the current copyright year", () => {
    render(<SiteFooter />);

    expect(
      screen.getByText(`© ${new Date().getFullYear()} Remora`),
    ).toBeTruthy();
  });
});
