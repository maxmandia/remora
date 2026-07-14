/** @vitest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { MacosDownloadButton } from "./index";

const stableUrl =
  "https://releases.remora.computer/stable/darwin/arm64/Remora-darwin-arm64.dmg";
const nightlyUrl =
  "https://releases.remora.computer/nightly/darwin/arm64/Remora-Nightly-darwin-arm64.dmg";

describe("home route macOS download", () => {
  afterEach(() => {
    cleanup();
  });

  it.each([
    [stableUrl, "Remora-darwin-arm64.dmg"],
    [nightlyUrl, "Remora-Nightly-darwin-arm64.dmg"],
  ])("renders the configured DMG as a download link", (url, fileName) => {
    render(<MacosDownloadButton downloadUrl={url} />);

    const link = screen.getByRole("link", { name: "Download for Mac" });

    expect(link.getAttribute("href")).toBe(url);
    expect(link.getAttribute("download")).toBe(fileName);
  });
});
