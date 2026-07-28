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

  it("renders the active impersonation destination with accessible navigation", () => {
    renderAdminSidebar({ isImpersonationActive: true });

    expect(screen.getByRole("complementary", { name: "Admin" })).toBeTruthy();
    expect(screen.getByText("Admin")).toBeTruthy();

    const impersonationLink = screen.getByRole("link", {
      name: "Account impersonation",
    });

    expect(impersonationLink.getAttribute("href")).toBe(
      "/app/admin/impersonation",
    );
    expect(impersonationLink.getAttribute("aria-current")).toBe("page");
    expect(impersonationLink.getAttribute("data-active")).toBe("true");
  });

  it("selects impersonation from an unmodified primary click", () => {
    const onSelectImpersonation = vi.fn();
    renderAdminSidebar({ onSelectImpersonation });

    fireEvent.click(
      screen.getByRole("link", { name: "Account impersonation" }),
    );

    expect(onSelectImpersonation).toHaveBeenCalledTimes(1);
  });

  it("preserves native modified-click behavior", () => {
    const onSelectImpersonation = vi.fn();
    renderAdminSidebar({ onSelectImpersonation });
    const impersonationLink = screen.getByRole("link", {
      name: "Account impersonation",
    });
    impersonationLink.setAttribute("href", "#impersonation");

    fireEvent.click(impersonationLink, {
      metaKey: true,
    });

    expect(onSelectImpersonation).not.toHaveBeenCalled();
  });
});

function renderAdminSidebar({
  isImpersonationActive = false,
  onSelectImpersonation = vi.fn(),
}: {
  isImpersonationActive?: boolean;
  onSelectImpersonation?: () => void;
} = {}) {
  return render(
    <AdminSidebar
      impersonationHref="/app/admin/impersonation"
      isImpersonationActive={isImpersonationActive}
      onSelectImpersonation={onSelectImpersonation}
    />,
    {
      wrapper: ({ children }: { children: ReactNode }) => (
        <SidebarProvider>{children}</SidebarProvider>
      ),
    },
  );
}
