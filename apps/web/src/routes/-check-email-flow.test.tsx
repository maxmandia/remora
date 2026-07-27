/**
 * @vitest-environment jsdom
 */

import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { StrictMode } from "react";
import type { ComponentType } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getStatus: vi.fn(),
  navigate: vi.fn(),
  refetchSession: vi.fn(),
  search: {} as Record<string, unknown>,
  sendVerificationEmail: vi.fn(),
  useSession: vi.fn(),
}));

vi.mock("@/clients/trpc", () => ({
  trpcClient: {
    promotion: {
      getStatus: {
        query: mocks.getStatus,
      },
    },
  },
}));

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    sendVerificationEmail: mocks.sendVerificationEmail,
    useSession: mocks.useSession,
  },
}));

vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-router")>()),
  createFileRoute: () => (options: Record<string, unknown>) => ({
    ...options,
    useNavigate: () => mocks.navigate,
    useSearch: () => mocks.search,
  }),
}));

import { Route } from "./check-email";

const CheckEmail = (
  Route as unknown as {
    component: ComponentType;
  }
).component;

describe("check-email flow", () => {
  beforeEach(() => {
    mocks.getStatus.mockReset();
    mocks.navigate.mockReset().mockResolvedValue(undefined);
    mocks.refetchSession.mockReset().mockResolvedValue(undefined);
    mocks.search = {};
    mocks.sendVerificationEmail.mockReset().mockResolvedValue({
      data: { status: true },
      error: null,
    });
    mocks.useSession.mockReset().mockReturnValue({
      data: {
        user: {
          email: "guest@example.test",
          id: "user_1",
        },
      },
      isPending: false,
      refetch: mocks.refetchSession,
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("consumes the initial-send marker and sends exactly once", async () => {
    mocks.search = { send: true };
    mocks.getStatus.mockResolvedValue({ status: "verification_required" });

    await act(async () => {
      render(
        <StrictMode>
          <CheckEmail />
        </StrictMode>,
      );
    });

    await waitFor(() => {
      expect(mocks.sendVerificationEmail).toHaveBeenCalledOnce();
    });
    expect(mocks.sendVerificationEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        callbackURL: "http://localhost:3000/check-email",
        email: "guest@example.test",
      }),
    );
    await waitFor(() => {
      expect(mocks.navigate).toHaveBeenCalledWith({
        replace: true,
        search: {},
        to: "/check-email",
      });
    });
  });

  it("shows the resend retry window after a rate limit", async () => {
    mocks.getStatus.mockResolvedValue({ status: "verification_required" });
    mocks.sendVerificationEmail.mockImplementation(async (input) => {
      input.fetchOptions.onError({
        response: new Response(null, {
          headers: {
            "X-Retry-After": "42",
          },
          status: 429,
        }),
      });

      return {
        data: null,
        error: { status: 429 },
      };
    });

    render(<CheckEmail />);
    fireEvent.click(
      await screen.findByRole("button", {
        name: "Resend verification email",
      }),
    );

    expect(
      await screen.findByText(
        "Too many verification emails were requested. Try again in 42 seconds.",
      ),
    ).toBeTruthy();
  });

  it("keeps invalid and expired callbacks recoverable", async () => {
    mocks.search = { error: "expired" };
    mocks.getStatus.mockResolvedValue({ status: "verification_required" });

    render(<CheckEmail />);

    expect(
      await screen.findByText(
        "That verification link has expired. Send yourself a new one.",
      ),
    ).toBeTruthy();
    expect(
      screen.getByRole<HTMLButtonElement>("button", {
        name: "Resend verification email",
      }).disabled,
    ).toBe(false);
  });

  it("force-refreshes the verified session and returns to the app", async () => {
    mocks.getStatus
      .mockResolvedValueOnce({ status: "verification_required" })
      .mockResolvedValueOnce({ status: "eligible" });

    render(<CheckEmail />);
    fireEvent.click(
      await screen.findByRole("button", {
        name: "I've verified my email",
      }),
    );

    await waitFor(() => {
      expect(mocks.refetchSession).toHaveBeenCalledWith({
        query: {
          disableCookieCache: true,
        },
      });
      expect(mocks.navigate).toHaveBeenCalledWith({
        replace: true,
        search: {},
        to: "/app",
      });
    });
  });

  it("returns users without a pending claim to the app", async () => {
    mocks.getStatus.mockResolvedValue({ status: "none" });

    render(<CheckEmail />);

    await waitFor(() => {
      expect(mocks.navigate).toHaveBeenCalledWith({
        replace: true,
        search: {},
        to: "/app",
      });
    });
    expect(mocks.sendVerificationEmail).not.toHaveBeenCalled();
  });
});
