/** @vitest-environment jsdom */

import { SidebarProvider } from "@remora/ui";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DesktopAppSidebar } from "./app-sidebar.tsx";

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
}));

vi.mock("@remora/app/sidebar", async () => {
  const React = await import("react");
  const actual = await vi.importActual<typeof import("@remora/app/sidebar")>(
    "@remora/app/sidebar",
  );

  return {
    ...actual,
    AppSidebarFooter: ({
      onOpenAdmin,
      onOpenCredits,
    }: {
      onOpenAdmin: () => void;
      onOpenCredits: () => void;
    }) =>
      React.createElement(
        "div",
        null,
        React.createElement(
          "button",
          { type: "button", onClick: onOpenAdmin },
          "Admin",
        ),
        React.createElement(
          "button",
          { type: "button", onClick: onOpenCredits },
          "Credits",
        ),
        React.createElement(
          "button",
          { type: "button", onClick: onOpenCredits },
          "Get Credits",
        ),
      ),
  };
});

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mocks.navigate,
}));

describe("DesktopAppSidebar", () => {
  beforeEach(() => {
    mocks.navigate.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it("composes host thread hrefs and selection behavior", () => {
    const onSelectThread = vi.fn();
    renderDesktopAppSidebar({
      onSelectThread,
      threads: [
        {
          id: "thread/with space",
          name: "Loose exploration",
          createdAt: "2026-06-08T12:00:00.000Z",
          updatedAt: "2026-06-08T12:00:00.000Z",
        },
      ],
    });

    const threadLink = screen.getByRole("link", {
      name: "Loose exploration",
    });

    expect(threadLink.getAttribute("href")).toBe(
      "/app/threads/thread%2Fwith%20space",
    );

    fireEvent.click(threadLink);

    expect(onSelectThread).toHaveBeenCalledWith("thread/with space");
  });

  it("opens credits from the shared footer", () => {
    renderDesktopAppSidebar();

    fireEvent.click(screen.getByRole("button", { name: "Credits" }));

    expect(mocks.navigate).toHaveBeenCalledWith({
      to: "/app/settings/credits",
    });
  });

  it("opens admin from the shared footer", () => {
    renderDesktopAppSidebar();

    fireEvent.click(screen.getByRole("button", { name: "Admin" }));

    expect(mocks.navigate).toHaveBeenCalledWith({
      to: "/app/admin",
    });
  });

  it("opens credits from the shared Get Credits action", () => {
    renderDesktopAppSidebar();

    fireEvent.click(screen.getByRole("button", { name: "Get Credits" }));

    expect(mocks.navigate).toHaveBeenCalledWith({
      to: "/app/settings/credits",
    });
  });
});

function renderDesktopAppSidebar({
  onSelectThread = vi.fn(),
  threads = [],
}: {
  onSelectThread?: (threadId: string) => void;
  threads?: Array<{
    createdAt: string;
    id: string;
    name: string;
    updatedAt: string;
  }>;
} = {}) {
  return render(
    <DesktopAppSidebar
      projectThreadRevealRequest={null}
      selectedThreadId={null}
      threads={threads}
      projects={[]}
      onCreateProject={vi.fn()}
      onNewGeneration={vi.fn()}
      onNewGenerationInProject={vi.fn()}
      onSelectThread={onSelectThread}
    />,
    {
      wrapper: ({ children }: { children: ReactNode }) => (
        <SidebarProvider>{children}</SidebarProvider>
      ),
    },
  );
}
