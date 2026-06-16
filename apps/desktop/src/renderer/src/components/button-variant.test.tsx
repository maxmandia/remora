/** @vitest-environment jsdom */

import { Badge, buttonVariants } from "@remora/ui";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

describe("Action component variants", () => {
  afterEach(() => {
    cleanup();
  });

  it("keeps the default button on the action primary token", () => {
    const className = buttonVariants();

    expect(className).toContain("bg-primary");
    expect(className).toContain("text-primary-foreground");
    expect(className).not.toContain("surface-strong");
  });

  it("keeps the default badge on the action primary token", () => {
    render(<Badge>Default badge</Badge>);

    const className = screen.getByText("Default badge").className;

    expect(className).toContain("bg-primary");
    expect(className).toContain("text-primary-foreground");
    expect(className).not.toContain("surface-strong");
  });
});
