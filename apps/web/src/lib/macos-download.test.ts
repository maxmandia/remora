import { afterEach, describe, expect, it, vi } from "vitest";

import { createMacosDownload } from "./macos-download";

const stableUrl =
  "https://releases.remora.computer/stable/darwin/arm64/Remora-darwin-arm64.dmg";
const nightlyUrl =
  "https://releases.remora.computer/nightly/darwin/arm64/Remora-Nightly-darwin-arm64.dmg";

describe("macOS download configuration", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it.each([
    [stableUrl, "Remora-darwin-arm64.dmg"],
    [nightlyUrl, "Remora-Nightly-darwin-arm64.dmg"],
  ])("accepts the configured R2 DMG URL", (url, fileName) => {
    expect(createMacosDownload(url)).toEqual({ fileName, url });
  });

  it("requires a configured URL", () => {
    vi.stubEnv("VITE_MACOS_DOWNLOAD_URL", "");

    expect(() => createMacosDownload()).toThrow(
      "VITE_MACOS_DOWNLOAD_URL is required.",
    );
    expect(() => createMacosDownload("   ")).toThrow(
      "VITE_MACOS_DOWNLOAD_URL is required.",
    );
  });

  it("rejects malformed URLs", () => {
    expect(() => createMacosDownload("not a URL")).toThrow(
      "VITE_MACOS_DOWNLOAD_URL must be a valid URL.",
    );
  });

  it("requires HTTPS", () => {
    expect(() =>
      createMacosDownload(
        "http://releases.remora.computer/Remora-darwin-arm64.dmg",
      ),
    ).toThrow("VITE_MACOS_DOWNLOAD_URL must use HTTPS.");
  });

  it("requires a DMG target", () => {
    expect(() =>
      createMacosDownload("https://releases.remora.computer/latest.json"),
    ).toThrow("VITE_MACOS_DOWNLOAD_URL must point to a DMG file.");
  });
});
