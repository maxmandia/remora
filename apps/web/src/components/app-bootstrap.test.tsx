/** @vitest-environment jsdom */

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getBalance: vi.fn(),
  redirectAppToSignIn: vi.fn(),
  useSession: vi.fn(),
}));

vi.mock("../clients/trpc", () => ({
  trpcClient: {
    credits: {
      getBalance: {
        query: mocks.getBalance,
      },
    },
  },
}));

vi.mock("../lib/auth-client", () => ({
  authClient: {
    useSession: mocks.useSession,
  },
}));

vi.mock("../lib/app-redirect", () => ({
  redirectAppToSignIn: mocks.redirectAppToSignIn,
}));

import { AppBootstrap } from "./app-bootstrap";

const balance = {
  availableCreditAmountUsdMicros: 2_500_000,
  reservedCreditAmountUsdMicros: 500_000,
};

describe("app bootstrap", () => {
  beforeEach(() => {
    mocks.getBalance.mockReset();
    mocks.redirectAppToSignIn.mockReset();
    mocks.useSession.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it("shows session loading without making a protected request", () => {
    mocks.useSession.mockReturnValue({
      data: null,
      isPending: true,
    });

    render(<AppBootstrap />);

    expect(screen.getByText("Resolving session...")).toBeTruthy();
    expect(mocks.getBalance).not.toHaveBeenCalled();
    expect(mocks.redirectAppToSignIn).not.toHaveBeenCalled();
  });

  it("redirects signed-out users to sign in", async () => {
    mocks.useSession.mockReturnValue({
      data: null,
      isPending: false,
    });

    render(<AppBootstrap />);

    expect(screen.getByText("Redirecting to sign in...")).toBeTruthy();
    await waitFor(() => {
      expect(mocks.redirectAppToSignIn).toHaveBeenCalledTimes(1);
    });
    expect(mocks.getBalance).not.toHaveBeenCalled();
  });

  it("loads and displays the signed-in user's protected credit balance", async () => {
    mocks.useSession.mockReturnValue({
      data: {
        user: {
          email: "user@example.com",
        },
      },
      isPending: false,
    });
    mocks.getBalance.mockResolvedValue(balance);

    render(<AppBootstrap />);

    expect(screen.getByText("Signed in as user@example.com")).toBeTruthy();
    expect(screen.getByText("Loading credit balance...")).toBeTruthy();
    expect(
      await screen.findByText("Available credit balance: 2500000"),
    ).toBeTruthy();
    expect(screen.getByText("Reserved credit balance: 500000")).toBeTruthy();
    expect(mocks.getBalance).toHaveBeenCalledTimes(1);
    expect(mocks.getBalance).toHaveBeenCalledWith(
      undefined,
      expect.objectContaining({
        signal: expect.any(AbortSignal),
      }),
    );
  });

  it("redirects when the protected request is unauthorized", async () => {
    mocks.useSession.mockReturnValue({
      data: {
        user: {
          email: "user@example.com",
        },
      },
      isPending: false,
    });
    mocks.getBalance.mockRejectedValue({
      data: {
        code: "UNAUTHORIZED",
      },
    });

    render(<AppBootstrap />);

    expect(await screen.findByText("Redirecting to sign in...")).toBeTruthy();
    expect(mocks.redirectAppToSignIn).toHaveBeenCalledTimes(1);
  });

  it("shows other failures and retries the protected request", async () => {
    mocks.useSession.mockReturnValue({
      data: {
        user: {
          email: "user@example.com",
        },
      },
      isPending: false,
    });
    mocks.getBalance
      .mockRejectedValueOnce(new Error("Network unavailable"))
      .mockResolvedValueOnce(balance);

    render(<AppBootstrap />);

    expect(
      await screen.findByText("Unable to load credit balance."),
    ).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    await waitFor(() => {
      expect(mocks.getBalance).toHaveBeenCalledTimes(2);
    });
    expect(
      await screen.findByText("Available credit balance: 2500000"),
    ).toBeTruthy();
  });
});
