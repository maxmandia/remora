/** @vitest-environment jsdom */

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  multiGenerationPanelClosedTransform,
  multiGenerationPanelOpenTransform,
} from "../../lib/generation/generation-preview.ts";
import { GenerationWorkspaceStage } from "./generation-workspace-stage.tsx";

describe("GenerationWorkspaceStage", () => {
  afterEach(() => {
    cleanup();
  });

  it("owns stage sizing, composer measurement, and synchronized panel shift", async () => {
    const { container, rerender } = render(
      <GenerationWorkspaceStage
        composer={<div>Composer</div>}
        isSupplementalOpen={false}
        results={<div>Results</div>}
      />,
    );
    const stage = screen.getByTestId("generation-composer-stage");
    const composerLayout = container.querySelector<HTMLElement>(
      '[data-slot="generation-composer-layout"]',
    )!;
    const composer = screen.getByTestId("generation-composer");

    expect(stage.style.containerType).toBe("inline-size");
    expect(
      stage.style.getPropertyValue("--remora-generation-content-width"),
    ).toBe("var(--remora-generation-content-base-width)");
    expect(composerLayout.style.transform).toBe(
      multiGenerationPanelClosedTransform,
    );
    expect(composer.className).toContain(
      "bottom-[var(--remora-generation-composer-bottom-inset)]",
    );
    expect(composer.className).not.toContain("transition-[top,translate]");
    expect(composer.hasAttribute("data-placement")).toBe(false);
    expect(stage.hasAttribute("data-placement")).toBe(false);
    expect(
      container.querySelector(
        '[data-slot="generation-composer-dock-occlusion"]',
      ),
    ).toBeTruthy();
    expect(screen.queryByAltText("Remora")).toBeNull();

    composerLayout.getBoundingClientRect = () =>
      ({
        bottom: 188,
        height: 188,
        left: 0,
        right: 960,
        top: 0,
        width: 960,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }) as DOMRect;
    fireEvent.resize(window);

    await waitFor(() => {
      expect(
        stage.style.getPropertyValue(
          "--remora-generation-composer-measured-height",
        ),
      ).toBe("188px");
    });

    rerender(
      <GenerationWorkspaceStage
        composer={<div>Composer</div>}
        isSupplementalOpen
        results={<div>Results</div>}
      />,
    );

    expect(
      stage.style.getPropertyValue("--remora-generation-content-width"),
    ).toBe("var(--remora-generation-content-stack-panel-aware-width)");
    expect(composerLayout.style.transform).toBe(
      multiGenerationPanelOpenTransform,
    );
    expect(composerLayout.getAttribute("data-stack-panel-state")).toBe("open");
  });

  it("centers welcome content across the stage while reserving composer clearance", () => {
    const { container, rerender } = render(
      <GenerationWorkspaceStage
        branding={{ alt: "Remora", src: "/logo.svg" }}
        centeredContent={<div>Centered actions</div>}
        composer={<div>Composer</div>}
        isSupplementalOpen={false}
      />,
    );
    const composer = screen.getByTestId("generation-composer");
    const stage = screen.getByTestId("generation-composer-stage");
    const composerClassName = composer.className;
    const welcome = container.querySelector<HTMLElement>(
      '[data-slot="generation-workspace-welcome"]',
    )!;

    expect(screen.getByAltText("Remora")).toBeTruthy();
    expect(screen.getByText("Centered actions")).toBeTruthy();
    expect(welcome.className).toContain(
      "top-[var(--remora-generation-welcome-top-offset)]",
    );
    expect(welcome.className).toContain("bottom-0");
    expect(welcome.className).toContain(
      "grid-rows-[minmax(0,1fr)_auto_minmax(var(--remora-generation-results-bottom-reserve),1fr)]",
    );
    expect(
      stage.style.getPropertyValue(
        "--remora-generation-welcome-top-offset",
      ),
    ).toBe("0px");
    expect(welcome.className).toContain("grid");
    expect(
      container.querySelector(
        '[data-slot="generation-workspace-centered-content"]',
      ),
    ).toBeTruthy();

    rerender(
      <GenerationWorkspaceStage
        composer={<div>Composer</div>}
        isSupplementalOpen={false}
        results={<div>Results</div>}
      />,
    );

    expect(screen.queryByAltText("Remora")).toBeNull();
    expect(screen.queryByText("Centered actions")).toBeNull();
    expect(
      container.querySelector('[data-slot="generation-workspace-welcome"]'),
    ).toBeNull();
    expect(screen.getByTestId("generation-composer").className).toBe(
      composerClassName,
    );
  });

  it("applies a host-provided welcome top offset", () => {
    render(
      <GenerationWorkspaceStage
        branding={{ alt: "Remora", src: "/logo.svg" }}
        composer={<div>Composer</div>}
        isSupplementalOpen={false}
        welcomeTopOffset="-44px"
      />,
    );

    expect(
      screen
        .getByTestId("generation-composer-stage")
        .style.getPropertyValue("--remora-generation-welcome-top-offset"),
    ).toBe("-44px");
  });

  it("mounts the wizard entrance overlay only while the entrance is active", () => {
    const onWizardEntranceComplete = vi.fn();
    const { container } = render(
      <GenerationWorkspaceStage
        branding={{ alt: "Remora", src: "/logo.svg" }}
        composer={<div>Composer</div>}
        isSupplementalOpen={false}
      />,
    );

    expect(
      container.querySelector('[data-slot="wizard-entrance-overlay"]'),
    ).toBeNull();

    cleanup();
    render(
      <GenerationWorkspaceStage
        branding={{ alt: "Remora", src: "/logo.svg" }}
        composer={<div>Composer</div>}
        isSupplementalOpen={false}
        wizardEntranceActive
        onWizardEntranceComplete={onWizardEntranceComplete}
      />,
    );

    fireEvent.load(screen.getByAltText("Remora"));

    // jsdom reports zero-sized rects, so the overlay must bail out through
    // its completion callback instead of hiding the wizard forever.
    expect(onWizardEntranceComplete).toHaveBeenCalledTimes(1);
  });
});
