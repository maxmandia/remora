/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ExplorePage } from "./explore-page.tsx";

describe("ExplorePage", () => {
  afterEach(cleanup);

  it("offers every creative category from the explore landing page", () => {
    const onSelectCategory = vi.fn();

    render(
      <ExplorePage
        onBack={() => undefined}
        onSelectCategory={onSelectCategory}
        onStartCreating={() => undefined}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Explore what you can create." }),
    ).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Explore Film" }));
    fireEvent.click(screen.getByRole("button", { name: "Explore Ads" }));
    fireEvent.click(screen.getByRole("button", { name: "Explore Art" }));

    expect(onSelectCategory.mock.calls).toStrictEqual([
      ["film"],
      ["ads"],
      ["art"],
    ]);
  });

  it("renders a selected category and exposes category navigation", () => {
    const onSelectCategory = vi.fn();
    const onStartCreating = vi.fn();

    render(
      <ExplorePage
        category="film"
        onBack={() => undefined}
        onSelectCategory={onSelectCategory}
        onStartCreating={onStartCreating}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Build a world worth watching." }),
    ).toBeTruthy();
    expect(
      screen.getByLabelText("Film creative inspiration").getAttribute("src"),
    ).toContain("film.mp4");
    expect(
      screen.getByRole("button", { name: "Film" }).getAttribute("aria-current"),
    ).toBe("page");

    fireEvent.click(screen.getByRole("button", { name: "Ads" }));
    fireEvent.click(screen.getByRole("button", { name: "Start creating" }));

    expect(onSelectCategory).toHaveBeenCalledWith("ads");
    expect(onStartCreating).toHaveBeenCalledOnce();
  });

  it("returns to the workspace from the header action", () => {
    const onBack = vi.fn();

    render(
      <ExplorePage
        onBack={onBack}
        onSelectCategory={() => undefined}
        onStartCreating={() => undefined}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Back to create" }));

    expect(onBack).toHaveBeenCalledOnce();
  });
});
