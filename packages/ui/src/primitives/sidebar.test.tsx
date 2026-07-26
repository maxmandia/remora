/** @vitest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { SidebarMenuButton } from "./sidebar.tsx";

describe("SidebarMenuButton", () => {
  afterEach(() => {
    cleanup();
  });

  it("uses a pointer cursor", () => {
    render(<SidebarMenuButton>New generation</SidebarMenuButton>);

    expect(
      screen.getByRole("button", { name: "New generation" }).className,
    ).toContain("cursor-pointer");
  });
});
