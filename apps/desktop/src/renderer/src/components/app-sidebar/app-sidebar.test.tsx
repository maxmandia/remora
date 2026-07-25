/** @vitest-environment jsdom */

import { SidebarProvider } from "@remora/ui";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DesktopAppSidebar } from "./app-sidebar.tsx";

const mocks = vi.hoisted(() => ({
  getBalance: vi.fn(),
  getBalanceQueryOptions: vi.fn(),
  navigate: vi.fn(),
  user: {
    current: {
      createdAt: "2026-01-01T00:00:00.000Z",
      email: "max@example.com",
      emailVerified: true,
      id: "user_1",
      image: null as string | null,
      name: "Max Remora" as string | null,
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
  },
}));

vi.mock("@remora/app/trpc", () => ({
  useTRPC: () => ({
    credits: {
      getBalance: {
        queryOptions: mocks.getBalanceQueryOptions,
      },
    },
  }),
}));

vi.mock("@remora/app/auth", () => ({
  useAuth: () => ({
    error: null,
    requestAuth: vi.fn(),
    signOut: vi.fn(),
    status: "signed-in",
    user: mocks.user.current,
  }),
}));

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mocks.navigate,
}));

describe("DesktopAppSidebar", () => {
  beforeEach(() => {
    mocks.getBalance.mockReset();
    mocks.getBalance.mockResolvedValue({
      availableCreditAmountUsdMicros: 25_000_000,
      reservedCreditAmountUsdMicros: 0,
    });
    mocks.getBalanceQueryOptions.mockReset();
    mocks.getBalanceQueryOptions.mockImplementation(() => ({
      queryKey: ["credits", "getBalance"],
      queryFn: mocks.getBalance,
    }));
    mocks.navigate.mockReset();
    mocks.user.current = {
      createdAt: "2026-01-01T00:00:00.000Z",
      email: "max@example.com",
      emailVerified: true,
      id: "user_1",
      image: null,
      name: "Max Remora",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
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

  it("opens credits from the settings dropdown", async () => {
    renderDesktopAppSidebar();

    fireEvent.click(screen.getByRole("button", { name: "Settings" }));

    expect(await screen.findByText("Max Remora")).toBeTruthy();
    expect(screen.getByText("MR")).toBeTruthy();

    fireEvent.click(await screen.findByRole("menuitem", { name: "Credits" }));

    expect(mocks.navigate).toHaveBeenCalledWith({
      to: "/app/settings/credits",
    });
  });

  it("renders the account image when one is available", async () => {
    mocks.user.current.image = "https://example.com/avatar.png";
    renderDesktopAppSidebar();

    fireEvent.click(screen.getByRole("button", { name: "Settings" }));

    await screen.findByText("Max Remora");

    expect(
      document.querySelector('img[src="https://example.com/avatar.png"]'),
    ).toBeTruthy();
    expect(screen.queryByText("MR")).toBeNull();
  });

  it.each([0, -80_000])(
    "shows the buy credits button for a %i available balance",
    async (availableCreditAmountUsdMicros) => {
      mocks.getBalance.mockResolvedValue({
        availableCreditAmountUsdMicros,
        reservedCreditAmountUsdMicros: 0,
      });

      renderDesktopAppSidebar();

      expect(
        await screen.findByRole("button", { name: "Get Credits" }),
      ).toBeTruthy();
    },
  );

  it("hides the buy credits button when the available balance is positive", async () => {
    renderDesktopAppSidebar();

    await waitFor(() => {
      expect(mocks.getBalance).toHaveBeenCalledTimes(1);
    });
    expect(screen.queryByRole("button", { name: "Get Credits" })).toBeNull();
  });

  it("hides the buy credits button while the balance is loading", () => {
    mocks.getBalance.mockReturnValue(new Promise(() => undefined));

    renderDesktopAppSidebar();

    expect(screen.queryByRole("button", { name: "Get Credits" })).toBeNull();
  });

  it("opens credits from the buy credits button", async () => {
    mocks.getBalance.mockResolvedValue({
      availableCreditAmountUsdMicros: 0,
      reservedCreditAmountUsdMicros: 0,
    });
    renderDesktopAppSidebar();

    fireEvent.click(await screen.findByRole("button", { name: "Get Credits" }));

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
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

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
        <QueryClientProvider client={queryClient}>
          <SidebarProvider>{children}</SidebarProvider>
        </QueryClientProvider>
      ),
    },
  );
}
