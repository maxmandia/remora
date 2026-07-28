/** @vitest-environment jsdom */

import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const navigate = vi.fn();

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => navigate,
}));

import { AdminRoute } from "./admin-route.tsx";

describe("desktop AdminRoute", () => {
  afterEach(() => {
    cleanup();
    navigate.mockReset();
  });

  it("redirects to account impersonation", async () => {
    render(<AdminRoute />);

    await waitFor(() =>
      expect(navigate).toHaveBeenCalledWith({
        to: "/app/admin/impersonation",
        replace: true,
      }),
    );
  });
});
