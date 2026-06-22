/** @vitest-environment jsdom */

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { CreditsSettingsRoute } from "./credits-settings-route.tsx";

describe("CreditsSettingsRoute", () => {
  afterEach(() => {
    cleanup();
  });

  it("opens the buy credits dialog with the default preset selected", async () => {
    render(<CreditsSettingsRoute />);

    await openBuyCreditsDialog();

    expect(getOptionButton("$25").getAttribute("aria-pressed")).toBe("true");
    expect(getOptionButton("$10").getAttribute("aria-pressed")).toBe("false");
  });

  it("submits the default preset without requiring a custom amount", async () => {
    render(<CreditsSettingsRoute />);

    await openBuyCreditsDialog();

    const submitButton = getSubmitButton();

    expect(submitButton.disabled).toBe(false);

    fireEvent.click(submitButton);

    expect(screen.getByRole("dialog", { name: "Buy credits" })).not.toBeNull();
    expect(screen.queryByLabelText("Custom Amount")).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("shows and validates the custom amount field", async () => {
    render(<CreditsSettingsRoute />);

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

  it("resets the form when the dialog closes", async () => {
    render(<CreditsSettingsRoute />);

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
