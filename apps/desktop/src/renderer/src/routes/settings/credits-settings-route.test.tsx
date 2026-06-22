/** @vitest-environment jsdom */

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CreditsSettingsRoute } from "./credits-settings-route.tsx";

const mocks = vi.hoisted(() => ({
  createCheckoutSession: vi.fn(),
}));

vi.mock("../../lib/trpc.ts", () => ({
  useTRPC: () => ({
    credits: {
      createCheckoutSession: {
        mutationOptions: (options = {}) => ({
          ...options,
          mutationFn: mocks.createCheckoutSession,
        }),
      },
    },
  }),
}));

describe("CreditsSettingsRoute", () => {
  beforeEach(() => {
    mocks.createCheckoutSession.mockReset();
    mocks.createCheckoutSession.mockResolvedValue({
      checkoutUrl: "https://checkout.stripe.test/session_1",
    });
    vi.spyOn(window, "open").mockImplementation(() => null);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("opens the buy credits dialog with the default preset selected", async () => {
    renderCreditsSettingsRoute();

    await openBuyCreditsDialog();

    expect(getOptionButton("$25").getAttribute("aria-pressed")).toBe("true");
    expect(getOptionButton("$10").getAttribute("aria-pressed")).toBe("false");
  });

  it("submits the default preset without requiring a custom amount", async () => {
    renderCreditsSettingsRoute();

    await openBuyCreditsDialog();

    const submitButton = getSubmitButton();

    expect(submitButton.disabled).toBe(false);

    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mocks.createCheckoutSession).toHaveBeenCalledWith(
        {
          amountCents: 2500,
        },
        expect.any(Object),
      );
    });
    expect(window.open).toHaveBeenCalledWith(
      "https://checkout.stripe.test/session_1",
      "_blank",
      "noopener,noreferrer",
    );
    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Buy credits" })).toBeNull();
    });
    expect(screen.queryByLabelText("Custom Amount")).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("shows and validates the custom amount field", async () => {
    renderCreditsSettingsRoute();

    await openBuyCreditsDialog();

    fireEvent.click(getOptionButton("Other"));

    const customAmountInput = await screen.findByLabelText("Custom Amount");

    await waitFor(() => {
      expect(getSubmitButton().disabled).toBe(true);
    });
    expect(screen.getByRole("alert").textContent).toBe(
      "Enter a credit amount.",
    );

    fireEvent.change(customAmountInput, { target: { value: "12.34" } });

    await waitFor(() => {
      expect(getSubmitButton().disabled).toBe(false);
    });
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("submits custom amounts to checkout", async () => {
    renderCreditsSettingsRoute();

    await openBuyCreditsDialog();

    fireEvent.click(getOptionButton("Other"));
    fireEvent.change(await screen.findByLabelText("Custom Amount"), {
      target: { value: "12.34" },
    });
    fireEvent.click(getSubmitButton());

    await waitFor(() => {
      expect(mocks.createCheckoutSession).toHaveBeenCalledWith(
        {
          amountCents: 1234,
        },
        expect.any(Object),
      );
    });
  });

  it("rejects custom amounts outside checkout limits", async () => {
    renderCreditsSettingsRoute();

    await openBuyCreditsDialog();

    fireEvent.click(getOptionButton("Other"));
    fireEvent.change(await screen.findByLabelText("Custom Amount"), {
      target: { value: "0.99" },
    });

    await waitFor(() => {
      expect(getSubmitButton().disabled).toBe(true);
    });
    expect(screen.getByRole("alert").textContent).toBe(
      "Enter an amount of at least $1.",
    );

    fireEvent.change(screen.getByLabelText("Custom Amount"), {
      target: { value: "10000.01" },
    });

    await waitFor(() => {
      expect(getSubmitButton().disabled).toBe(true);
    });
    expect(screen.getByRole("alert").textContent).toBe(
      "Enter an amount of $10,000 or less.",
    );
  });

  it("disables submit while checkout creation is pending", async () => {
    let resolveCheckoutSession!: (value: { checkoutUrl: string }) => void;
    mocks.createCheckoutSession.mockReturnValue(
      new Promise((resolve) => {
        resolveCheckoutSession = resolve;
      }),
    );
    renderCreditsSettingsRoute();

    await openBuyCreditsDialog();

    fireEvent.click(getSubmitButton());

    await waitFor(() => {
      expect(getSubmitButton().disabled).toBe(true);
    });

    resolveCheckoutSession({
      checkoutUrl: "https://checkout.stripe.test/session_1",
    });
    await waitFor(() => {
      expect(window.open).toHaveBeenCalled();
    });
  });

  it("keeps the dialog open when checkout handoff fails", async () => {
    vi.mocked(window.open).mockImplementation(() => {
      throw new Error("Unable to open checkout");
    });
    renderCreditsSettingsRoute();

    await openBuyCreditsDialog();

    fireEvent.click(getSubmitButton());

    await waitFor(() => {
      expect(mocks.createCheckoutSession).toHaveBeenCalled();
    });
    expect(screen.getByRole("dialog", { name: "Buy credits" })).not.toBeNull();
  });

  it("resets the form when the dialog closes", async () => {
    renderCreditsSettingsRoute();

    await openBuyCreditsDialog();

    fireEvent.click(getOptionButton("Other"));
    await screen.findByLabelText("Custom Amount");
    expect(screen.getByRole("alert").textContent).toBe(
      "Enter a credit amount.",
    );

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Buy credits" })).toBeNull();
    });

    await openBuyCreditsDialog();

    expect(getOptionButton("$25").getAttribute("aria-pressed")).toBe("true");
    expect(screen.queryByLabelText("Custom Amount")).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

function renderCreditsSettingsRoute() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
      mutations: {
        retry: false,
      },
    },
  });

  return render(<CreditsSettingsRoute />, {
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    ),
  });
}

async function openBuyCreditsDialog() {
  fireEvent.click(screen.getByRole("button", { name: "Buy Credits" }));

  await screen.findByRole("dialog", { name: "Buy credits" });
}

function getOptionButton(name: string) {
  return screen.getByRole("button", { name }) as HTMLButtonElement;
}

function getSubmitButton() {
  return screen.getByRole("button", { name: "Submit" }) as HTMLButtonElement;
}
