/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DesktopUpdateButton } from "./desktop-update-button.tsx";

const mocks = vi.hoisted(() => ({
  installReadyUpdate: vi.fn(),
  state: { status: "disabled" } as {
    status: string;
    version?: string | null;
  },
}));

vi.mock("../../hooks/use-desktop-update.ts", () => ({
  useDesktopUpdate: () => ({
    installReadyUpdate: mocks.installReadyUpdate,
    state: mocks.state,
  }),
}));

describe("DesktopUpdateButton", () => {
  beforeEach(() => {
    mocks.installReadyUpdate.mockReset();
    mocks.installReadyUpdate.mockResolvedValue(true);
    mocks.state = { status: "disabled" };
  });

  afterEach(() => {
    cleanup();
  });

  it("hides before an update is ready", () => {
    render(<DesktopUpdateButton />);

    expect(screen.queryByRole("button", { name: "Update Ready" })).toBeNull();
  });

  it("installs the ready update from the titlebar button", () => {
    mocks.state = { status: "ready", version: "0.2.3" };

    render(<DesktopUpdateButton />);

    fireEvent.click(screen.getByRole("button", { name: "Update Ready" }));

    expect(mocks.installReadyUpdate).toHaveBeenCalledTimes(1);
  });
});
