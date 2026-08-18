/** @vitest-environment jsdom */

import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LandingNavigation } from "./landing-navigation";

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    to,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & {
    to: string;
  }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));

describe("LandingNavigation", () => {
  afterEach(() => {
    cleanup();
  });

  it("links the brand home and provides the desktop navigation", () => {
    render(<LandingNavigation />);

    expect(
      screen.getByRole("link", { name: "Remora home" }).getAttribute("href"),
    ).toBe("/");
    expect(
      screen.getByRole("link", { name: "Pricing" }).getAttribute("href"),
    ).toBe("/pricing");

    const getStartedLink = screen.getByRole("link", {
      name: "Get Started",
    });

    expect(getStartedLink.getAttribute("href")).toBe("/sign-up");
  });

  it("provides the navigation actions from the mobile menu", async () => {
    render(<LandingNavigation />);

    fireEvent.click(
      screen.getByRole("button", { name: "Open navigation menu" }),
    );

    const menu = await screen.findByRole("menu");
    const pricingLink = within(menu).getByRole("menuitem", {
      name: "Pricing",
    });
    const getStartedLink = within(menu).getByRole("menuitem", {
      name: "Get Started",
    });

    expect(pricingLink.getAttribute("href")).toBe("/pricing");
    expect(getStartedLink.getAttribute("href")).toBe("/sign-up");
  });

  it("can omit the brand while preserving navigation actions", () => {
    render(<LandingNavigation showBrand={false} />);

    expect(screen.queryByRole("link", { name: "Remora home" })).toBeNull();
    expect(screen.getByRole("link", { name: "Pricing" })).not.toBeNull();
    expect(screen.getByRole("link", { name: "Get Started" })).not.toBeNull();
  });

  it("marks pricing as the current page", () => {
    render(<LandingNavigation activeItem="pricing" />);

    expect(
      screen
        .getByRole("link", { name: "Pricing" })
        .getAttribute("aria-current"),
    ).toBe("page");
  });
});
