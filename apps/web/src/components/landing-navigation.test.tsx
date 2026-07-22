/** @vitest-environment jsdom */

import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createMacosDownload } from "../lib/macos-download";
import { LandingNavigation } from "./landing-navigation";

const downloadUrl =
  "https://releases.remora.computer/stable/darwin/arm64/Remora-darwin-arm64.dmg";

describe("LandingNavigation", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
  });

  it("links the brand home and provides the desktop navigation", () => {
    vi.stubEnv("VITE_MACOS_DOWNLOAD_URL", downloadUrl);
    render(<LandingNavigation />);

    expect(
      screen.getByRole("link", { name: "Remora home" }).getAttribute("href"),
    ).toBe("/");
    expect(
      screen.getByRole("link", { name: "Pricing" }).getAttribute("href"),
    ).toBe("/pricing");

    const download = createMacosDownload(downloadUrl);
    const downloadLink = screen.getByRole("link", {
      name: "Download Remora",
    });

    expect(downloadLink.getAttribute("href")).toBe(download.url);
    expect(downloadLink.getAttribute("download")).toBe(download.fileName);
  });

  it("provides the navigation actions from the mobile menu", async () => {
    vi.stubEnv("VITE_MACOS_DOWNLOAD_URL", downloadUrl);
    render(<LandingNavigation />);

    fireEvent.click(
      screen.getByRole("button", { name: "Open navigation menu" }),
    );

    const menu = await screen.findByRole("menu");
    const pricingLink = within(menu).getByRole("menuitem", {
      name: "Pricing",
    });
    const downloadLink = within(menu).getByRole("menuitem", {
      name: "Download Remora",
    });

    expect(pricingLink.getAttribute("href")).toBe("/pricing");
    expect(downloadLink.getAttribute("href")).toBe(downloadUrl);
    expect(downloadLink.getAttribute("download")).toBe(
      "Remora-darwin-arm64.dmg",
    );
  });

  it("marks pricing as the current page", () => {
    vi.stubEnv("VITE_MACOS_DOWNLOAD_URL", downloadUrl);
    render(<LandingNavigation activeItem="pricing" />);

    expect(
      screen
        .getByRole("link", { name: "Pricing" })
        .getAttribute("aria-current"),
    ).toBe("page");
  });
});
