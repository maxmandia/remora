/** @vitest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { PrivacyPage } from "../components/privacy-page";
import { SupportPage } from "../components/support-page";
import { TermsPage } from "../components/terms-page";

describe("site content pages", () => {
  afterEach(() => {
    cleanup();
  });

  it("publishes the desktop application terms", () => {
    render(<TermsPage />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Terms of Service" }),
    ).toBeTruthy();
    expect(
      screen.getByText("7. Credits, purchases, and auto-reload"),
    ).toBeTruthy();
    expect(screen.getByText("14. Governing law and disputes")).toBeTruthy();
  });

  it("discloses generation, analytics, and deletion practices", () => {
    render(<PrivacyPage />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Privacy Policy" }),
    ).toBeTruthy();
    expect(
      screen.getByText("5. AI processing and model training"),
    ).toBeTruthy();
    expect(screen.getByText("8. Data retention and deletion")).toBeTruthy();
  });

  it("provides a working support contact", () => {
    render(<SupportPage />);

    const supportLinks = screen.getAllByRole("link", {
      name: "support@remora.computer",
    });

    expect(supportLinks.length).toBeGreaterThan(0);
    expect(supportLinks[0]?.getAttribute("href")).toBe(
      "mailto:support@remora.computer",
    );
  });
});
