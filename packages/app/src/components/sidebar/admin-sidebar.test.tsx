/** @vitest-environment jsdom */

import { SidebarProvider } from "@remora/ui";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AdminSidebar } from "./admin-sidebar.tsx";

describe("AdminSidebar", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders the active overview destination with accessible navigation", () => {
    renderAdminSidebar({ isOverviewActive: true });

    expect(screen.getByRole("complementary", { name: "Admin" })).toBeTruthy();
    expect(screen.getByText("Admin")).toBeTruthy();

    const overviewLink = screen.getByRole("link", { name: "Overview" });

    expect(overviewLink.getAttribute("href")).toBe("/app/admin");
    expect(overviewLink.getAttribute("aria-current")).toBe("page");
    expect(overviewLink.getAttribute("data-active")).toBe("true");
  });

  it("selects overview from an unmodified primary click", () => {
    const onSelectOverview = vi.fn();
    renderAdminSidebar({ onSelectOverview });

    fireEvent.click(screen.getByRole("link", { name: "Overview" }));

    expect(onSelectOverview).toHaveBeenCalledTimes(1);
  });

  it("preserves native modified-click behavior", () => {
    const onSelectOverview = vi.fn();
    renderAdminSidebar({ onSelectOverview });
    const overviewLink = screen.getByRole("link", { name: "Overview" });
    overviewLink.setAttribute("href", "#overview");

    fireEvent.click(overviewLink, {
      metaKey: true,
    });

    expect(onSelectOverview).not.toHaveBeenCalled();
  });
});

function renderAdminSidebar({
  isOverviewActive = false,
  onSelectOverview = vi.fn(),
}: {
  isOverviewActive?: boolean;
  onSelectOverview?: () => void;
} = {}) {
  return render(
    <AdminSidebar
      overviewHref="/app/admin"
      isOverviewActive={isOverviewActive}
      onSelectOverview={onSelectOverview}
    />,
    {
      wrapper: ({ children }: { children: ReactNode }) => (
        <SidebarProvider>{children}</SidebarProvider>
      ),
    },
  );
}
