/** @vitest-environment jsdom */

import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { GenerationCreativeCategoryCtas } from "./generation-creative-category-ctas.tsx";

describe("GenerationCreativeCategoryCtas", () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("renders inert creative category buttons with decorative previews", () => {
    const { container } = render(<GenerationCreativeCategoryCtas />);

    const group = screen.getByRole("group", { name: "Creative categories" });

    expect(group).toBeTruthy();
    expect(group.className).toContain("py-[14px]");
    expect(group.className).toContain("rounded-none");
    expect(group.className).toContain("border-0");
    expect(group.className).toContain("shadow-none");

    const sprocketRails = container.querySelectorAll<SVGElement>(
      '[data-slot="film-sprocket-rail"]',
    );

    expect(sprocketRails).toHaveLength(2);
    expect(
      Array.from(sprocketRails, (rail) => rail.dataset.edge),
    ).toStrictEqual(["top", "bottom"]);

    for (const rail of sprocketRails) {
      expect(rail.getAttribute("aria-hidden")).toBe("true");
      expect(rail.classList.contains("pointer-events-none")).toBe(true);
    }

    const [, bottomRail] = sprocketRails;

    expect(
      Array.from(
        bottomRail?.querySelectorAll("text") ?? [],
        (frameNumber) => frameNumber.textContent,
      ),
    ).toStrictEqual(["47", "48", "49"]);

    const categories = [
      ["Film", "Explore stories", "film.mp4"],
      ["Ads", "Explore campaigns", "ads.mp4"],
      ["Art", "Explore visuals", "art.mp4"],
    ] as const;

    for (const [label, subtitle, previewFileName] of categories) {
      const button = screen.getByRole("button", {
        description: subtitle,
        name: label,
      });
      const preview = button.querySelector<HTMLVideoElement>(
        '[data-slot="creative-category-preview"]',
      );
      const content = button.querySelector<HTMLElement>(
        '[data-slot="creative-category-content"]',
      );
      const previewFilter = button.querySelector<HTMLElement>(
        '[data-slot="creative-category-preview-filter"]',
      );

      expect(button.getAttribute("type")).toBe("button");
      expect(button.className).toContain("bg-surface-strong");
      expect(button.className).toContain("rounded-none");
      expect(button.className).toContain("border-transparent");
      expect(button.className).toContain("focus-visible:ring-inset");
      expect(button.className).not.toContain("before:bg");
      expect(button.className).not.toContain("hover:border");
      expect(button.className).not.toContain("hover:shadow");
      expect(button.className).toContain(
        "hover:bg-[color-mix(in_srgb,var(--surface-strong),var(--surface-strong-foreground)_4%)]",
      );
      expect(preview).not.toBeNull();
      expect(preview?.getAttribute("aria-hidden")).toBe("true");
      expect(preview?.getAttribute("preload")).toBe("auto");
      expect(preview?.getAttribute("src")).toContain(previewFileName);
      expect(preview?.tabIndex).toBe(-1);
      expect(preview?.controls).toBe(false);
      expect(preview?.loop).toBe(true);
      expect(preview?.muted).toBe(true);
      expect(preview?.playsInline).toBe(true);
      expect(preview?.dataset.state).toBe("hidden");
      expect(preview?.className).toContain("pointer-events-none");
      expect(preview?.className).toContain("object-cover");
      expect(preview?.className).toContain("data-[state=visible]:opacity-10");
      expect(previewFilter?.getAttribute("aria-hidden")).toBe("true");
      expect(previewFilter?.dataset.state).toBe("hidden");
      expect(previewFilter?.className).toContain("bg-amber-400/10");
      expect(previewFilter?.className).toContain("mix-blend-color");
      expect(previewFilter?.className).toContain(
        "data-[state=visible]:opacity-100",
      );
      expect(content?.className).toContain("z-10");
      expect(within(button).getByText(label)).toBeTruthy();
      expect(within(button).getByText(subtitle)).toBeTruthy();
    }
  });

  it("plays from the beginning and reveals a preview only after playback starts", () => {
    const play = vi
      .spyOn(HTMLMediaElement.prototype, "play")
      .mockResolvedValue();
    const pause = vi
      .spyOn(HTMLMediaElement.prototype, "pause")
      .mockImplementation(() => undefined);

    render(<GenerationCreativeCategoryCtas />);

    const button = screen.getByRole("button", { name: "Film" });
    const preview = getPreview(button);

    preview.currentTime = 8;
    fireEvent.pointerEnter(button, { pointerType: "mouse" });

    expect(pause).toHaveBeenCalledTimes(1);
    expect(preview.currentTime).toBe(0);
    expect(play).toHaveBeenCalledTimes(1);
    expect(preview.dataset.state).toBe("hidden");

    fireEvent.playing(preview);

    expect(preview.dataset.state).toBe("visible");
    expect(getPreviewFilter(button).dataset.state).toBe("visible");
  });

  it("fades out before pausing and resetting after the exit transition", () => {
    vi.useFakeTimers();
    vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
    const pause = vi
      .spyOn(HTMLMediaElement.prototype, "pause")
      .mockImplementation(() => undefined);

    render(<GenerationCreativeCategoryCtas />);

    const button = screen.getByRole("button", { name: "Film" });
    const preview = getPreview(button);

    fireEvent.pointerEnter(button, { pointerType: "mouse" });
    fireEvent.playing(preview);
    preview.currentTime = 4;
    pause.mockClear();

    fireEvent.pointerLeave(button, { pointerType: "mouse" });

    expect(preview.dataset.state).toBe("hidden");
    expect(pause).not.toHaveBeenCalled();
    expect(preview.currentTime).toBe(4);

    act(() => vi.advanceTimersByTime(199));
    expect(pause).not.toHaveBeenCalled();
    expect(preview.currentTime).toBe(4);

    act(() => vi.advanceTimersByTime(1));
    expect(pause).toHaveBeenCalledTimes(1);
    expect(preview.currentTime).toBe(0);
  });

  it("cancels exit cleanup and restarts on rapid mouse re-entry", () => {
    vi.useFakeTimers();
    const play = vi
      .spyOn(HTMLMediaElement.prototype, "play")
      .mockResolvedValue();
    const pause = vi
      .spyOn(HTMLMediaElement.prototype, "pause")
      .mockImplementation(() => undefined);

    render(<GenerationCreativeCategoryCtas />);

    const button = screen.getByRole("button", { name: "Film" });
    const preview = getPreview(button);

    fireEvent.pointerEnter(button, { pointerType: "mouse" });
    fireEvent.playing(preview);
    fireEvent.pointerLeave(button, { pointerType: "mouse" });
    act(() => vi.advanceTimersByTime(100));

    preview.currentTime = 3;
    fireEvent.pointerEnter(button, { pointerType: "mouse" });

    expect(play).toHaveBeenCalledTimes(2);
    expect(preview.currentTime).toBe(0);
    expect(preview.dataset.state).toBe("hidden");

    pause.mockClear();
    act(() => vi.advanceTimersByTime(100));
    expect(pause).not.toHaveBeenCalled();

    fireEvent.playing(preview);
    expect(preview.dataset.state).toBe("visible");
  });

  it("ignores non-mouse pointers, keyboard focus, and late playback events", () => {
    vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(
      () => undefined,
    );
    const play = vi
      .spyOn(HTMLMediaElement.prototype, "play")
      .mockResolvedValue();

    render(<GenerationCreativeCategoryCtas />);

    const button = screen.getByRole("button", { name: "Film" });
    const preview = getPreview(button);

    fireEvent.pointerEnter(button, { pointerType: "touch" });
    fireEvent.focus(button);

    expect(play).not.toHaveBeenCalled();
    expect(preview.dataset.state).toBe("hidden");

    fireEvent.pointerEnter(button, { pointerType: "mouse" });
    fireEvent.pointerLeave(button, { pointerType: "mouse" });
    fireEvent.playing(preview);

    expect(preview.dataset.state).toBe("hidden");
  });

  it("keeps the resting state when playback rejects or the media errors", async () => {
    vi.spyOn(HTMLMediaElement.prototype, "play")
      .mockRejectedValueOnce(new Error("Playback unavailable"))
      .mockResolvedValue();
    vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(
      () => undefined,
    );

    render(<GenerationCreativeCategoryCtas />);

    const filmButton = screen.getByRole("button", { name: "Film" });
    const filmPreview = getPreview(filmButton);

    fireEvent.pointerEnter(filmButton, { pointerType: "mouse" });
    await act(() => Promise.resolve());
    expect(filmPreview.dataset.state).toBe("hidden");

    const adsButton = screen.getByRole("button", { name: "Ads" });
    const adsPreview = getPreview(adsButton);

    fireEvent.pointerEnter(adsButton, { pointerType: "mouse" });
    fireEvent.playing(adsPreview);
    expect(adsPreview.dataset.state).toBe("visible");

    fireEvent.error(adsPreview);
    expect(adsPreview.dataset.state).toBe("hidden");
  });
});

function getPreview(button: HTMLElement) {
  const preview = button.querySelector<HTMLVideoElement>(
    '[data-slot="creative-category-preview"]',
  );

  expect(preview).not.toBeNull();

  if (!preview) {
    throw new Error("Expected creative category video preview");
  }

  return preview;
}

function getPreviewFilter(button: HTMLElement) {
  const previewFilter = button.querySelector<HTMLElement>(
    '[data-slot="creative-category-preview-filter"]',
  );

  expect(previewFilter).not.toBeNull();

  if (!previewFilter) {
    throw new Error("Expected creative category preview filter");
  }

  return previewFilter;
}
