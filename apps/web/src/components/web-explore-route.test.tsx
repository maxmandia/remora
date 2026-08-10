/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
}));

vi.mock("@remora/app/explore", () => ({
  ExplorePage: ({
    onTryPrompt,
  }: {
    onTryPrompt: (key: "78bd92a0") => void;
  }) => (
    <button onClick={() => onTryPrompt("78bd92a0")} type="button">
      Try prompt
    </button>
  ),
}));

vi.mock("@tanstack/react-router", () => ({
  useCanGoBack: () => false,
  useNavigate: () => mocks.navigate,
  useRouter: () => ({ history: { back: vi.fn() } }),
}));

import { WebExploreRoute } from "./web-explore-route";

describe("web Explore route", () => {
  beforeEach(() => {
    mocks.navigate.mockReset();
  });

  afterEach(cleanup);

  it("navigates to the workspace with the selected Explore ref", () => {
    render(<WebExploreRoute />);

    fireEvent.click(screen.getByRole("button", { name: "Try prompt" }));

    expect(mocks.navigate).toHaveBeenCalledWith({
      search: { exploreRef: "78bd92a0" },
      to: "/app",
    });
  });
});
