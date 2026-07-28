/** @vitest-environment jsdom */

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

import { AppSidebarFooter } from "./app-sidebar-footer.tsx";

const mocks = vi.hoisted(() => ({
  getBalance: vi.fn(),
  getBalanceQueryOptions: vi.fn(),
  user: {
    current: {
      email: "max@example.com",
      id: "user_1",
      image: null as string | null,
      role: "user" as "admin" | "user",
      name: "Max Remora" as string | null,
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

describe("AppSidebarFooter", () => {
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
    mocks.user.current = {
      email: "max@example.com",
      id: "user_1",
      image: null,
      role: "user",
      name: "Max Remora",
    };
  });

  afterEach(() => {
    cleanup();
  });

  it("opens the account menu and invokes the credits callback", async () => {
    const onOpenCredits = vi.fn();
    renderFooter({ onOpenCredits });

    fireEvent.click(screen.getByRole("button", { name: "Settings" }));

    expect(await screen.findByText("Max Remora")).toBeTruthy();
    expect(screen.getByText("MR")).toBeTruthy();

    fireEvent.click(await screen.findByRole("menuitem", { name: "Credits" }));

    expect(onOpenCredits).toHaveBeenCalledTimes(1);
  });

  it("renders the account image when one is available", async () => {
    mocks.user.current.image = "https://example.com/avatar.png";
    renderFooter();

    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    await screen.findByText("Max Remora");

    expect(
      document.querySelector('img[src="https://example.com/avatar.png"]'),
    ).toBeTruthy();
    expect(screen.queryByText("MR")).toBeNull();
  });

  it("falls back to the email when the account has no display name", async () => {
    mocks.user.current.name = " ";
    renderFooter();

    fireEvent.click(screen.getByRole("button", { name: "Settings" }));

    expect(await screen.findByText("max@example.com")).toBeTruthy();
    expect(screen.getByText("MA")).toBeTruthy();
  });

  it.each([0, -80_000])(
    "shows Get Credits for a %i available balance",
    async (availableCreditAmountUsdMicros) => {
      mocks.getBalance.mockResolvedValue({
        availableCreditAmountUsdMicros,
        reservedCreditAmountUsdMicros: 0,
      });

      renderFooter();

      expect(
        await screen.findByRole("button", { name: "Get Credits" }),
      ).toBeTruthy();
    },
  );

  it("hides Get Credits for a positive available balance", async () => {
    renderFooter();

    await waitFor(() => {
      expect(mocks.getBalance).toHaveBeenCalledTimes(1);
    });
    expect(screen.queryByRole("button", { name: "Get Credits" })).toBeNull();
  });

  it("hides Get Credits while the balance is loading", () => {
    mocks.getBalance.mockReturnValue(new Promise(() => undefined));

    renderFooter();

    expect(screen.queryByRole("button", { name: "Get Credits" })).toBeNull();
  });

  it("invokes the credits callback from Get Credits", async () => {
    const onOpenCredits = vi.fn();
    mocks.getBalance.mockResolvedValue({
      availableCreditAmountUsdMicros: 0,
      reservedCreditAmountUsdMicros: 0,
    });
    renderFooter({ onOpenCredits });

    fireEvent.click(await screen.findByRole("button", { name: "Get Credits" }));

    expect(onOpenCredits).toHaveBeenCalledTimes(1);
  });

  it("hides the admin destination for non-admin users", async () => {
    renderFooter();

    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    await screen.findByText("Max Remora");

    expect(screen.queryByRole("menuitem", { name: "Admin" })).toBeNull();
  });

  it("shows the admin destination and invokes its callback for admins", async () => {
    const onOpenAdmin = vi.fn();
    mocks.user.current.role = "admin";
    renderFooter({ onOpenAdmin });

    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "Admin" }));

    expect(onOpenAdmin).toHaveBeenCalledTimes(1);
  });
});

function renderFooter({
  onOpenAdmin = vi.fn(),
  onOpenCredits = vi.fn(),
}: {
  onOpenAdmin?: () => void;
  onOpenCredits?: () => void;
} = {}) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return render(
    <AppSidebarFooter
      onOpenAdmin={onOpenAdmin}
      onOpenCredits={onOpenCredits}
    />,
    {
      wrapper: ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      ),
    },
  );
}
