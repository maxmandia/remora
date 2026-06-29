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
  getAutoReloadSettings: vi.fn(),
  getAutoReloadSettingsQueryFilter: vi.fn(),
  getAutoReloadSettingsQueryOptions: vi.fn(),
  getBalance: vi.fn(),
  getBalanceQueryOptions: vi.fn(),
  updateAutoReloadSettings: vi.fn(),
}));

vi.mock("../../lib/trpc.ts", () => ({
  useTRPC: () => ({
    creditAutoTopUpSettings: {
      getSettings: {
        queryFilter: mocks.getAutoReloadSettingsQueryFilter,
        queryOptions: mocks.getAutoReloadSettingsQueryOptions,
      },
      updateSettings: {
        mutationOptions: (options = {}) => ({
          ...options,
          mutationFn: mocks.updateAutoReloadSettings,
        }),
      },
    },
    credits: {
      getBalance: {
        queryOptions: mocks.getBalanceQueryOptions,
      },
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
    mocks.createCheckoutSession.mockReset();
    mocks.createCheckoutSession.mockResolvedValue({
      checkoutUrl: "https://checkout.stripe.test/session_1",
    });
    mocks.getAutoReloadSettings.mockReset();
    mocks.getAutoReloadSettings.mockResolvedValue({
      enabled: false,
      topUpFloorUsdMicros: 0,
      topUpAmountUsdMicros: 0,
    });
    mocks.getAutoReloadSettingsQueryFilter.mockReset();
    mocks.getAutoReloadSettingsQueryFilter.mockReturnValue({
      queryKey: ["creditAutoTopUpSettings", "getSettings"],
    });
    mocks.getAutoReloadSettingsQueryOptions.mockReset();
    mocks.getAutoReloadSettingsQueryOptions.mockImplementation(() => ({
      queryKey: ["creditAutoTopUpSettings", "getSettings"],
      queryFn: mocks.getAutoReloadSettings,
    }));
    mocks.updateAutoReloadSettings.mockReset();
    mocks.updateAutoReloadSettings.mockImplementation(
      async (
        input:
          | {
              enabled: false;
            }
          | {
              enabled: true;
              topUpAmountCents: number;
              topUpFloorCents: number;
            },
      ) =>
        input.enabled
          ? {
              enabled: true,
              topUpFloorUsdMicros: input.topUpFloorCents * 10_000,
              topUpAmountUsdMicros: input.topUpAmountCents * 10_000,
            }
          : {
              enabled: false,
              topUpFloorUsdMicros: 0,
              topUpAmountUsdMicros: 0,
            },
    );
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
    expect(getAutoReloadCheckbox().checked).toBe(false);
    expect(screen.queryByLabelText("Minimum balance")).toBeNull();
    expect(getSubmitButton().textContent).toBe("Continue");
  });

  it("opens configured auto-reload settings with saved matching preset values", async () => {
    mockConfiguredAutoReloadSettings({
      topUpFloorCents: 750,
      topUpAmountCents: 5000,
    });
    renderCreditsSettingsRoute();

    await openConfiguredAutoReloadDialogFromBuyCredits();

    expect(getOptionButton("$50").getAttribute("aria-pressed")).toBe("true");
    expect(getOptionButton("$25").getAttribute("aria-pressed")).toBe("false");
    expect(getAutoReloadCheckbox().checked).toBe(true);
    expect(getAutoReloadCheckbox().disabled).toBe(false);
    expect(
      ((await screen.findByLabelText("Minimum balance")) as HTMLInputElement)
        .value,
    ).toBe("7.50");
    expect(getSaveButton().disabled).toBe(true);
  });

  it("opens configured auto-reload settings from the manage link", async () => {
    mockConfiguredAutoReloadSettings({
      topUpFloorCents: 500,
      topUpAmountCents: 2500,
    });
    renderCreditsSettingsRoute();

    fireEvent.click(screen.getByText("Manage auto-reload"));

    await screen.findByRole("dialog", { name: "Manage auto-reload" });
    expect(getSaveButton().disabled).toBe(true);
  });

  it("opens configured auto-reload settings with saved custom top-up values", async () => {
    mockConfiguredAutoReloadSettings({
      topUpFloorCents: 500,
      topUpAmountCents: 1234,
    });
    renderCreditsSettingsRoute();

    await openConfiguredAutoReloadDialogFromBuyCredits();

    expect(getOptionButton("Other").getAttribute("aria-pressed")).toBe("true");
    expect(
      ((await screen.findByLabelText("Custom Amount")) as HTMLInputElement)
        .value,
    ).toBe("12.34");
    expect(getSaveButton().disabled).toBe(true);
  });

  it("saves configured auto-reload settings when the floor changes", async () => {
    mockConfiguredAutoReloadSettings({
      topUpFloorCents: 500,
      topUpAmountCents: 2500,
    });
    renderCreditsSettingsRoute();

    await openConfiguredAutoReloadDialogFromBuyCredits();

    expect(getSaveButton().disabled).toBe(true);

    fireEvent.change(await screen.findByLabelText("Minimum balance"), {
      target: { value: "7.50" },
    });

    await waitFor(() => {
      expect(getSaveButton().disabled).toBe(false);
    });
    fireEvent.click(getSaveButton());

    await waitFor(() => {
      expect(mocks.updateAutoReloadSettings).toHaveBeenCalledWith(
        {
          enabled: true,
          topUpFloorCents: 750,
          topUpAmountCents: 2500,
        },
        expect.any(Object),
      );
    });
    expect(mocks.createCheckoutSession).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(
        screen.queryByRole("dialog", { name: "Manage auto-reload" }),
      ).toBeNull();
    });
  });

  it("saves configured auto-reload settings when the top-up amount changes", async () => {
    mockConfiguredAutoReloadSettings({
      topUpFloorCents: 500,
      topUpAmountCents: 2500,
    });
    renderCreditsSettingsRoute();

    await openConfiguredAutoReloadDialogFromBuyCredits();

    fireEvent.click(getOptionButton("$50"));

    await waitFor(() => {
      expect(getSaveButton().disabled).toBe(false);
    });
    fireEvent.click(getSaveButton());

    await waitFor(() => {
      expect(mocks.updateAutoReloadSettings).toHaveBeenCalledWith(
        {
          enabled: true,
          topUpFloorCents: 500,
          topUpAmountCents: 5000,
        },
        expect.any(Object),
      );
    });
    expect(mocks.createCheckoutSession).not.toHaveBeenCalled();
  });

  it("reopens configured auto-reload settings with the last saved values", async () => {
    mockConfiguredAutoReloadSettings({
      topUpFloorCents: 500,
      topUpAmountCents: 2500,
    });
    renderCreditsSettingsRoute();

    await openConfiguredAutoReloadDialogFromBuyCredits();
    fireEvent.change(await screen.findByLabelText("Minimum balance"), {
      target: { value: "7.50" },
    });
    await waitFor(() => {
      expect(getSaveButton().disabled).toBe(false);
    });
    fireEvent.click(getSaveButton());

    await waitFor(() => {
      expect(mocks.updateAutoReloadSettings).toHaveBeenCalledWith(
        {
          enabled: true,
          topUpFloorCents: 750,
          topUpAmountCents: 2500,
        },
        expect.any(Object),
      );
    });
    await waitFor(() => {
      expect(
        screen.queryByRole("dialog", { name: "Manage auto-reload" }),
      ).toBeNull();
    });

    await openConfiguredAutoReloadDialogFromBuyCredits();

    await waitFor(() => {
      expect(
        (screen.getByLabelText("Minimum balance") as HTMLInputElement).value,
      ).toBe("7.50");
    });
    expect(getOptionButton("$25").getAttribute("aria-pressed")).toBe("true");
    expect(getSaveButton().disabled).toBe(true);
  });

  it("saves configured auto-reload settings when disabled", async () => {
    mockConfiguredAutoReloadSettings({
      topUpFloorCents: 500,
      topUpAmountCents: 2500,
    });
    renderCreditsSettingsRoute();

    await openConfiguredAutoReloadDialogFromBuyCredits();

    fireEvent.click(getAutoReloadCheckbox());

    expect(getAutoReloadCheckbox().checked).toBe(false);
    expect(screen.queryByLabelText("Minimum balance")).toBeNull();
    await waitFor(() => {
      expect(getSaveButton().disabled).toBe(false);
    });

    fireEvent.click(getSaveButton());

    await waitFor(() => {
      expect(mocks.updateAutoReloadSettings).toHaveBeenCalledWith(
        {
          enabled: false,
        },
        expect.any(Object),
      );
    });
    expect(mocks.createCheckoutSession).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(
        screen.queryByRole("dialog", { name: "Manage auto-reload" }),
      ).toBeNull();
    });

    await openBuyCreditsDialog();

    expect(getOptionButton("$25").getAttribute("aria-pressed")).toBe("true");
    expect(getAutoReloadCheckbox().checked).toBe(false);
    expect(screen.queryByLabelText("Minimum balance")).toBeNull();
    expect(getSubmitButton().textContent).toBe("Continue");
  });

  it("renders the fetched current balance", async () => {
    renderCreditsSettingsRoute();

    expect(await screen.findByText("$25")).toBeTruthy();
    expect(screen.getByText("Current balance")).toBeTruthy();
  });

  it("renders cent precision when the current balance has cents", async () => {
    mocks.getBalance.mockResolvedValue({
      availableCreditAmountUsdMicros: 12_340_000,
      reservedCreditAmountUsdMicros: 0,
    });

    renderCreditsSettingsRoute();

    expect(await screen.findByText("$12.34")).toBeTruthy();
  });

  it("renders zero when the fetched current balance is zero", async () => {
    mocks.getBalance.mockResolvedValue({
      availableCreditAmountUsdMicros: 0,
      reservedCreditAmountUsdMicros: 0,
    });

    renderCreditsSettingsRoute();

    expect(await screen.findByText("$0")).toBeTruthy();
  });

  it("shows a balance skeleton until the current balance loads", () => {
    mocks.getBalance.mockReturnValue(new Promise(() => undefined));
    const { container } = renderCreditsSettingsRoute();

    expect(screen.getByLabelText("Loading credit balance")).toBeTruthy();
    expect(container.querySelector("[data-slot='skeleton']")).not.toBeNull();
    expect(screen.queryByText("$0")).toBeNull();
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
          autoReload: {
            enabled: false,
          },
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

  it("shows minimum balance controls when auto-reload is checked", async () => {
    renderCreditsSettingsRoute();

    await openBuyCreditsDialog();

    expect(screen.queryByLabelText("Minimum balance")).toBeNull();

    fireEvent.click(getAutoReloadCheckbox());

    expect(getAutoReloadCheckbox().checked).toBe(true);
    expect(await screen.findByLabelText("Minimum balance")).toBeTruthy();
    expect(
      screen.getByText("When my balance hits $5, add $25."),
    ).toBeTruthy();
    expect(getAutoReloadSubmitButton()).toBeTruthy();
  });

  it("validates the auto-reload minimum balance when enabled", async () => {
    renderCreditsSettingsRoute();

    await openBuyCreditsDialog();
    fireEvent.click(getAutoReloadCheckbox());

    const minimumBalanceInput = await screen.findByLabelText("Minimum balance");

    fireEvent.change(minimumBalanceInput, { target: { value: "" } });

    await waitFor(() => {
      expect(getAutoReloadSubmitButton().disabled).toBe(true);
    });
    expect(screen.getByRole("alert").textContent).toBe(
      "Enter a minimum balance.",
    );

    fireEvent.change(minimumBalanceInput, { target: { value: "0" } });

    await waitFor(() => {
      expect(getAutoReloadSubmitButton().disabled).toBe(true);
    });
    expect(screen.getByRole("alert").textContent).toBe(
      "Enter a minimum balance greater than $0.",
    );

    fireEvent.change(minimumBalanceInput, { target: { value: "7.50" } });

    await waitFor(() => {
      expect(getAutoReloadSubmitButton().disabled).toBe(false);
    });
    expect(screen.queryByRole("alert")).toBeNull();
    expect(
      screen.getByText("When my balance hits $7.5, add $25."),
    ).toBeTruthy();
  });

  it("submits enabled auto-reload settings to checkout", async () => {
    renderCreditsSettingsRoute();

    await openBuyCreditsDialog();
    fireEvent.click(getAutoReloadCheckbox());

    fireEvent.change(await screen.findByLabelText("Minimum balance"), {
      target: { value: "7.50" },
    });
    fireEvent.click(getAutoReloadSubmitButton());

    await waitFor(() => {
      expect(mocks.createCheckoutSession).toHaveBeenCalledWith(
        {
          amountCents: 2500,
          autoReload: {
            enabled: true,
            minimumBalanceCents: 750,
          },
        },
        expect.any(Object),
      );
    });
  });

  it("submits disabled auto-reload settings to checkout", async () => {
    renderCreditsSettingsRoute();

    await openBuyCreditsDialog();

    fireEvent.click(getSubmitButton());

    await waitFor(() => {
      expect(mocks.createCheckoutSession).toHaveBeenCalledWith(
        {
          amountCents: 2500,
          autoReload: {
            enabled: false,
          },
        },
        expect.any(Object),
      );
    });
  });

  it("shows and validates the custom amount field", async () => {
    renderCreditsSettingsRoute();

    await openBuyCreditsDialog();

    fireEvent.click(getOptionButton("Other"));
    fireEvent.click(getAutoReloadCheckbox());

    const customAmountInput = await screen.findByLabelText("Custom Amount");

    await waitFor(() => {
      expect(getAutoReloadSubmitButton().disabled).toBe(true);
    });
    expect(screen.getByRole("alert").textContent).toBe(
      "Enter a credit amount.",
    );

    fireEvent.change(customAmountInput, { target: { value: "12.34" } });

    await waitFor(() => {
      expect(getAutoReloadSubmitButton().disabled).toBe(false);
    });
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("submits custom amounts to checkout", async () => {
    renderCreditsSettingsRoute();

    await openBuyCreditsDialog();

    fireEvent.click(getOptionButton("Other"));
    fireEvent.click(getAutoReloadCheckbox());
    fireEvent.change(await screen.findByLabelText("Custom Amount"), {
      target: { value: "12.34" },
    });
    fireEvent.click(getAutoReloadSubmitButton());

    await waitFor(() => {
      expect(mocks.createCheckoutSession).toHaveBeenCalledWith(
        {
          amountCents: 1234,
          autoReload: {
            enabled: true,
            minimumBalanceCents: 500,
          },
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
    fireEvent.click(getAutoReloadCheckbox());
    fireEvent.change(await screen.findByLabelText("Minimum balance"), {
      target: { value: "" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Buy credits" })).toBeNull();
    });

    await openBuyCreditsDialog();

    expect(getOptionButton("$25").getAttribute("aria-pressed")).toBe("true");
    expect(getAutoReloadCheckbox().checked).toBe(false);
    expect(screen.queryByLabelText("Custom Amount")).toBeNull();
    expect(screen.queryByLabelText("Minimum balance")).toBeNull();
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

async function openConfiguredAutoReloadDialogFromBuyCredits() {
  fireEvent.click(screen.getByRole("button", { name: "Buy Credits" }));

  await screen.findByRole("dialog", { name: "Manage auto-reload" });
}

function getOptionButton(name: string) {
  return screen.getByRole("button", { name }) as HTMLButtonElement;
}

function getSubmitButton() {
  return screen.getByRole("button", { name: "Continue" }) as HTMLButtonElement;
}

function getAutoReloadSubmitButton() {
  return screen.getByRole("button", {
    name: "Enable auto-reload",
  }) as HTMLButtonElement;
}

function getSaveButton() {
  return screen.getByRole("button", { name: "Save" }) as HTMLButtonElement;
}

function getAutoReloadCheckbox() {
  return screen.getByRole("checkbox", {
    name: /auto-reload/i,
  }) as HTMLInputElement;
}

function mockConfiguredAutoReloadSettings({
  topUpAmountCents,
  topUpFloorCents,
}: {
  topUpAmountCents: number;
  topUpFloorCents: number;
}) {
  let settings = {
    enabled: true,
    topUpFloorUsdMicros: topUpFloorCents * 10_000,
    topUpAmountUsdMicros: topUpAmountCents * 10_000,
  };

  mocks.getAutoReloadSettings.mockImplementation(async () => settings);
  mocks.updateAutoReloadSettings.mockImplementation(
    async (
      input:
        | {
            enabled: false;
          }
        | {
            enabled: true;
            topUpAmountCents: number;
            topUpFloorCents: number;
          },
    ) => {
      settings = input.enabled
        ? {
            enabled: true,
            topUpFloorUsdMicros: input.topUpFloorCents * 10_000,
            topUpAmountUsdMicros: input.topUpAmountCents * 10_000,
          }
        : {
            enabled: false,
            topUpFloorUsdMicros: 0,
            topUpAmountUsdMicros: 0,
          };

      return settings;
    },
  );
}
