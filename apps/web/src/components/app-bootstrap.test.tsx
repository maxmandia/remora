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
  authState: {
    current: {
      error: null as string | null,
      requestAuth: vi.fn(),
      signOut: vi.fn(),
      status: "loading" as "loading" | "signed-in" | "signed-out",
      user: null as {
        id: string;
        name: string;
        email: string;
        image: string | null;
      } | null,
    },
  },
  getBalance: vi.fn(),
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

vi.mock("@remora/app/auth", () => ({
  useAuth: () => mocks.authState.current,
}));

import { AppBootstrap } from "./app-bootstrap";

const balance = {
  availableCreditAmountUsdMicros: 2_500_000,
  reservedCreditAmountUsdMicros: 500_000,
};

describe("app bootstrap", () => {
  beforeEach(() => {
    mocks.getBalance.mockReset();
    mocks.authState.current.error = null;
    mocks.authState.current.requestAuth.mockReset();
    mocks.authState.current.requestAuth.mockResolvedValue(undefined);
    mocks.authState.current.signOut.mockReset();
    mocks.authState.current.signOut.mockResolvedValue(undefined);
    mocks.authState.current.status = "loading";
    mocks.authState.current.user = null;
  });

  afterEach(() => {
    cleanup();
  });

  it("shows session loading without making a protected request", () => {
    render(<AppBootstrap />);

    expect(screen.getByText("Resolving session...")).toBeTruthy();
    expect(mocks.getBalance).not.toHaveBeenCalled();
    expect(mocks.authState.current.requestAuth).not.toHaveBeenCalled();
  });

  it("redirects signed-out users to sign in", async () => {
    mocks.authState.current.status = "signed-out";

    render(<AppBootstrap />);

    expect(screen.getByText("Redirecting to sign in...")).toBeTruthy();
    await waitFor(() => {
      expect(mocks.authState.current.requestAuth).toHaveBeenCalledTimes(1);
    });
    expect(mocks.getBalance).not.toHaveBeenCalled();
  });

  it("loads and displays the signed-in user's protected credit balance", async () => {
    setSignedIn();
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
    setSignedIn();
    mocks.getBalance.mockRejectedValue({
      data: {
        code: "UNAUTHORIZED",
      },
    });

    render(<AppBootstrap />);

    expect(await screen.findByText("Redirecting to sign in...")).toBeTruthy();
    expect(mocks.authState.current.requestAuth).toHaveBeenCalledTimes(1);
  });

  it("shows other failures and retries the protected request", async () => {
    setSignedIn();
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

function setSignedIn() {
  mocks.authState.current.status = "signed-in";
  mocks.authState.current.user = {
    id: "user_1",
    name: "Remora User",
    email: "user@example.com",
    image: null,
  };
}
