/** @vitest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-router", () => ({
  Outlet: () => null,
}));

import { WebSettingsRoute } from "./web-settings-route";

describe("web settings route", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders an intentionally empty full-width settings surface", () => {
    const { container } = render(<WebSettingsRoute />);

    const workspace = screen.getByRole("main", {
      name: "Settings workspace",
    });

    expect(workspace.className).toContain("min-h-svh");
    expect(workspace.textContent).toBe("");
    expect(container.querySelector("aside")).toBeNull();
    expect(container.querySelector("button")).toBeNull();
  });
});
