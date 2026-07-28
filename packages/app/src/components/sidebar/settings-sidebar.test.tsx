/** @vitest-environment jsdom */

import { SidebarProvider } from "@remora/ui";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SettingsSidebar } from "./settings-sidebar.tsx";

describe("SettingsSidebar", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders the active credits destination with accessible navigation", () => {
    renderSettingsSidebar({ isCreditsActive: true });

    expect(
      screen.getByRole("complementary", { name: "Settings" }),
    ).toBeTruthy();
    expect(screen.getByText("General")).toBeTruthy();

    const creditsLink = screen.getByRole("link", { name: "Credits" });

    expect(creditsLink.getAttribute("href")).toBe("/app/settings/credits");
    expect(creditsLink.getAttribute("aria-current")).toBe("page");
    expect(creditsLink.getAttribute("data-active")).toBe("true");
  });

  it("selects credits from an unmodified primary click", () => {
    const onSelectCredits = vi.fn();
    renderSettingsSidebar({ onSelectCredits });

    fireEvent.click(screen.getByRole("link", { name: "Credits" }));

    expect(onSelectCredits).toHaveBeenCalledTimes(1);
  });

  it("preserves native modified-click behavior", () => {
    const onSelectCredits = vi.fn();
    renderSettingsSidebar({ onSelectCredits });
    const creditsLink = screen.getByRole("link", { name: "Credits" });
    creditsLink.setAttribute("href", "#credits");

    fireEvent.click(creditsLink, {
      metaKey: true,
    });

    expect(onSelectCredits).not.toHaveBeenCalled();
  });

  it("does not expose admin navigation", () => {
    renderSettingsSidebar();

    expect(screen.queryByRole("link", { name: "Admin" })).toBeNull();
  });
});

function renderSettingsSidebar({
  isCreditsActive = false,
  onSelectCredits = vi.fn(),
}: {
  isCreditsActive?: boolean;
  onSelectCredits?: () => void;
} = {}) {
  return render(
    <SettingsSidebar
      creditsHref="/app/settings/credits"
      isCreditsActive={isCreditsActive}
      onSelectCredits={onSelectCredits}
    />,
    {
      wrapper: ({ children }: { children: ReactNode }) => (
        <SidebarProvider>{children}</SidebarProvider>
      ),
    },
  );
}
