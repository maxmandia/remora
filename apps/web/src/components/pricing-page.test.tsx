/** @vitest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { PublicPricingCatalog } from "../lib/public-pricing";
import { PricingPage } from "./pricing-page";

const downloadUrl =
  "https://releases.remora.computer/stable/darwin/arm64/Remora-darwin-arm64.dmg";

describe("PricingPage", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
  });

  it("renders the transparency promise and every published rate", () => {
    vi.stubEnv("VITE_MACOS_DOWNLOAD_URL", downloadUrl);
    render(<PricingPage catalog={createCatalog()} />);

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Provider price + 10%.",
      }),
    ).toBeTruthy();
    expect(
      screen.getByLabelText(
        "Example pricing calculation: Provider cost $1.00 plus Remora fee $0.10 equals $1.10",
      ),
    ).toBeTruthy();
    expect(screen.getByText("$1.00")).toBeTruthy();
    expect(screen.getByText("$0.10")).toBeTruthy();
    expect(screen.getByText("$1.10")).toBeTruthy();

    expect(
      screen.getByRole("heading", { level: 3, name: "Image models" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("heading", { level: 3, name: "Video models" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("heading", { level: 4, name: "Nano Banana 2" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("heading", { level: 4, name: "Seedance 2.0" }),
    ).toBeTruthy();

    expect(screen.getByText("1K")).toBeTruthy();
    expect(screen.getByText("2K")).toBeTruthy();
    expect(screen.getByText("480p / 720p · Without input video")).toBeTruthy();
    expect(screen.getByText("$0.067")).toBeTruthy();
    expect(screen.getByText("+$0.0067")).toBeTruthy();
    expect(screen.getByText("$0.0737")).toBeTruthy();
    expect(screen.getAllByText("per image")).toHaveLength(6);
    expect(screen.getAllByText("per 1M tokens")).toHaveLength(3);
    expect(screen.getByText("About token-based video pricing")).toBeTruthy();

    const pricingLinks = screen.getAllByRole("link", { name: "Pricing" });
    expect(
      pricingLinks.some((link) => link.getAttribute("aria-current") === "page"),
    ).toBe(true);
  });

  it("renders a fractional surcharge from the active pricing policy", () => {
    vi.stubEnv("VITE_MACOS_DOWNLOAD_URL", downloadUrl);
    render(<PricingPage catalog={createCatalog(1250)} />);

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Provider price + 12.5%.",
      }),
    ).toBeTruthy();
    expect(
      screen.getByLabelText(
        "Example pricing calculation: Provider cost $1.00 plus Remora fee $0.125 equals $1.125",
      ),
    ).toBeTruthy();
    expect(screen.getByText("$0.125")).toBeTruthy();
    expect(screen.getByText("$1.125")).toBeTruthy();
    expect(screen.getAllByText("Remora fee (12.5%)").length).toBeGreaterThan(0);
    expect(screen.getByText(/same 12.5% fee/)).toBeTruthy();
  });

  it("keeps the page usable when live pricing is unavailable", () => {
    vi.stubEnv("VITE_MACOS_DOWNLOAD_URL", downloadUrl);
    render(<PricingPage catalog={null} />);

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Provider price + one flat fee.",
      }),
    ).toBeTruthy();
    expect(screen.queryByLabelText(/Example pricing calculation/)).toBeNull();
    expect(screen.queryByText(/10%/)).toBeNull();
    expect(
      screen.getByRole("heading", {
        level: 3,
        name: "Pricing details are temporarily unavailable",
      }),
    ).toBeTruthy();
  });
});

function createCatalog(surchargeBasisPoints = 1000): PublicPricingCatalog {
  return {
    currencyCode: "USD",
    surchargeBasisPoints,
    models: [
      {
        id: "nano-banana-2",
        providerId: "google",
        providerName: "Google",
        displayName: "Nano Banana 2",
        modelType: "image",
        modelSpecId: "nano-banana-2-v1",
        modelSpecVersion: 1,
        rates: [
          {
            id: "nano-banana-2-output-image-1k",
            component: "output_image",
            quantityUnit: "image",
            unitQuantity: 1,
            ...createPrices(67_000, surchargeBasisPoints),
            conditions: { outputResolution: "1K" },
          },
          {
            id: "nano-banana-2-output-image-2k",
            component: "output_image",
            quantityUnit: "image",
            unitQuantity: 1,
            ...createPrices(101_000, surchargeBasisPoints),
            conditions: { outputResolution: "2K" },
          },
        ],
      },
      {
        id: "seedance-2.0-video",
        providerId: "byteplus",
        providerName: "BytePlus",
        displayName: "Seedance 2.0",
        modelType: "video",
        modelSpecId: "seedance-2.0-video-v1",
        modelSpecVersion: 1,
        rates: [
          {
            id: "seedance-2.0-video-provider-video-tokens-720p",
            component: "provider_video_tokens",
            quantityUnit: "token",
            unitQuantity: 1_000_000,
            ...createPrices(7_000_000, surchargeBasisPoints),
            conditions: {
              outputResolution: ["480p", "720p"],
              inputIncludesVideo: false,
            },
          },
        ],
      },
    ],
  };
}

function createPrices(
  upstreamUnitPriceUsdMicros: number,
  surchargeBasisPoints: number,
) {
  const remoraFeeUnitPriceUsdMicros = Math.ceil(
    (upstreamUnitPriceUsdMicros * surchargeBasisPoints) / 10_000,
  );

  return {
    upstreamUnitPriceUsdMicros,
    remoraFeeUnitPriceUsdMicros,
    customerUnitPriceUsdMicros:
      upstreamUnitPriceUsdMicros + remoraFeeUnitPriceUsdMicros,
  };
}
