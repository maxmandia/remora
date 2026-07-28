/** @vitest-environment jsdom */

import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AccountImpersonationPage } from "./account-impersonation-page.tsx";

describe("AccountImpersonationPage", () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("lists, searches, paginates, and impersonates accounts", async () => {
    const listUsers = vi.fn(async ({ offset }: { offset: number }) => ({
      total: 26,
      users: [
        {
          id: offset === 0 ? "user_1" : "user_26",
          name: offset === 0 ? "First User" : "Last User",
          email: offset === 0 ? "first@example.test" : "last@example.test",
          createdAt: "2026-07-28T00:00:00.000Z",
        },
      ],
    }));
    const impersonateUser = vi.fn(async () => undefined);
    const onImpersonated = vi.fn();

    render(
      <AccountImpersonationPage
        adapter={{ impersonateUser, listUsers }}
        onImpersonated={onImpersonated}
      />,
    );

    expect(await screen.findByText("first@example.test")).toBeTruthy();
    expect(listUsers).toHaveBeenCalledWith({
      searchField: "email",
      searchValue: "",
      limit: 25,
      offset: 0,
    });

    fireEvent.click(screen.getByRole("button", { name: "Next accounts" }));
    expect(await screen.findByText("last@example.test")).toBeTruthy();
    expect(listUsers).toHaveBeenLastCalledWith({
      searchField: "email",
      searchValue: "",
      limit: 25,
      offset: 25,
    });

    fireEvent.click(screen.getByRole("button", { name: "Impersonate" }));
    await waitFor(() =>
      expect(impersonateUser).toHaveBeenCalledWith("user_26"),
    );
    expect(onImpersonated).toHaveBeenCalledOnce();
  });

  it("debounces searches and exposes loading failures inline", async () => {
    vi.useFakeTimers();
    const listUsers = vi
      .fn()
      .mockResolvedValueOnce({ total: 0, users: [] })
      .mockRejectedValueOnce(new Error("Unavailable"));

    render(
      <AccountImpersonationPage
        adapter={{
          impersonateUser: vi.fn(),
          listUsers,
        }}
        onImpersonated={vi.fn()}
      />,
    );

    await act(async () => {
      await Promise.resolve();
    });
    fireEvent.change(screen.getByLabelText("Search users by email"), {
      target: { value: "customer@example.test" },
    });
    await act(async () => {
      vi.advanceTimersByTime(300);
      await Promise.resolve();
    });

    expect(listUsers).toHaveBeenLastCalledWith({
      searchField: "email",
      searchValue: "customer@example.test",
      limit: 25,
      offset: 0,
    });
    expect(screen.getByRole("alert").textContent).toBe(
      "Unable to load accounts.",
    );
  });
});
