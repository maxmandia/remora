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
        branding={{ alt: "Remora", src: "/logo.svg" }}
        composer={<div>Composer</div>}
        isSupplementalOpen={false}
        placement="docked"
        results={<div>Results</div>}
      />,
    );
    const stage = screen.getByTestId("generation-composer-stage");
    const composerLayout = container.querySelector<HTMLElement>(
      '[data-slot="generation-composer-layout"]',
    )!;

    expect(stage.style.containerType).toBe("inline-size");
    expect(
      stage.style.getPropertyValue("--remora-generation-content-width"),
    ).toBe("var(--remora-generation-content-base-width)");
    expect(composerLayout.style.transform).toBe(
      multiGenerationPanelClosedTransform,
    );
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
        branding={{ alt: "Remora", src: "/logo.svg" }}
        composer={<div>Composer</div>}
        isSupplementalOpen
        placement="docked"
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

  it("exposes centered branding to accessibility", () => {
    render(
      <GenerationWorkspaceStage
        branding={{ alt: "Remora", src: "/logo.svg" }}
        composer={<div>Composer</div>}
        isSupplementalOpen={false}
        placement="centered"
      />,
    );

    expect(screen.getByAltText("Remora")).toBeTruthy();
  });

  it("mounts the wizard entrance overlay only while the entrance is active", () => {
    const onWizardEntranceComplete = vi.fn();
    const { container } = render(
      <GenerationWorkspaceStage
        branding={{ alt: "Remora", src: "/logo.svg" }}
        composer={<div>Composer</div>}
        isSupplementalOpen={false}
        placement="centered"
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
        placement="centered"
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
