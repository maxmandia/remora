/** @vitest-environment jsdom */

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  type AttachmentMediaFieldId,
  type GenerationAttachmentMediaItem,
  type GenerationAttachmentMediaValue,
} from "../../lib/generation/attachment-media.ts";
import { GenerationCommandInput } from "./generation-command-input.tsx";

describe("GenerationCommandInput", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("renders a capped autosizing multiline prompt", () => {
    const promptInput = renderPromptInput({
      attachmentMediaValue: createAttachmentMediaValue(),
    });

    expect(promptInput.tagName).toBe("TEXTAREA");
    expect(promptInput.rows).toBe(1);
    expect(promptInput.className).toContain("field-sizing-content");
    expect(promptInput.className).toContain("min-h-10");
    expect(promptInput.className).toContain("max-h-[25dvh]");
    expect(promptInput.className).toContain("resize-none");
    expect(promptInput.className).toContain("overflow-y-auto");
    expect(promptInput.className).toContain("leading-6");
  });

  it("preserves multiline prompt changes and controlled replacements", () => {
    const onPromptChange = vi.fn();
    const { rerender } = render(
      <GenerationCommandInput
        attachmentMediaValue={createAttachmentMediaValue()}
        prompt="First line"
        onPromptChange={onPromptChange}
      />,
    );
    const promptInput = screen.getByPlaceholderText(
      "A castle in the sky with...",
    ) as HTMLTextAreaElement;

    fireEvent.change(promptInput, {
      target: { value: "First line\nSecond line" },
    });

    expect(onPromptChange).toHaveBeenCalledWith("First line\nSecond line");

    rerender(
      <GenerationCommandInput
        attachmentMediaValue={createAttachmentMediaValue()}
        prompt="Replacement prompt"
        onPromptChange={onPromptChange}
      />,
    );
    expect(promptInput.value).toBe("Replacement prompt");

    rerender(
      <GenerationCommandInput
        attachmentMediaValue={createAttachmentMediaValue()}
        prompt=""
        onPromptChange={onPromptChange}
      />,
    );
    expect(promptInput.value).toBe("");
  });

  it("opens attachment references when typing an @ token", async () => {
    const { container } = render(
      <ControlledGenerationCommandInput
        attachmentMediaValue={createAttachmentMediaValue({
          images: [
            createAttachmentMediaItem("first.png", "image/png"),
            createAttachmentMediaItem("second.png", "image/png"),
          ],
          videos: [createAttachmentMediaItem("clip.mp4", "video/mp4")],
          audios: [createAttachmentMediaItem("voice.wav", "audio/wav")],
        })}
      />,
    );
    const promptInput = screen.getByPlaceholderText(
      "A castle in the sky with...",
    ) as HTMLTextAreaElement;

    focusPromptAt(promptInput, "@", 1);

    expect(
      await screen.findByRole("option", { name: "Image1" }),
    ).not.toBeNull();
    expect(screen.getByRole("option", { name: "Image2" })).not.toBeNull();
    expect(screen.getByRole("option", { name: "Video1" })).not.toBeNull();
    expect(screen.getByRole("option", { name: "Audio1" })).not.toBeNull();
    expect(container.contains(screen.getByRole("listbox"))).toBe(false);
    expect(
      document.querySelector('[data-slot="popover-content"]')?.className,
    ).toContain("max-h-(--available-height)");
    expect(
      document.querySelector('[data-slot="popover-content"]')?.className,
    ).toContain("overflow-y-auto");
    expect(
      document.querySelector<HTMLElement>('[data-slot="popover-content"]')
        ?.dataset.surface,
    ).toBe("popup");
  });

  it("filters attachment references by the active @ query", async () => {
    const promptInput = renderPromptInput({
      attachmentMediaValue: createAttachmentMediaValue({
        images: [createAttachmentMediaItem("still.png", "image/png")],
        videos: [createAttachmentMediaItem("motion.mp4", "video/mp4")],
      }),
    });

    focusPromptAt(promptInput, "@vi", 3);

    expect(
      await screen.findByRole("option", { name: "Video1" }),
    ).not.toBeNull();
    expect(screen.queryByRole("option", { name: "Image1" })).toBeNull();
  });

  it("positions attachment references at a multiline @ token", async () => {
    let measureWidth = "";
    let measureWhiteSpace = "";
    let measureOverflowWrap = "";
    let measuredText = "";
    vi.spyOn(document.documentElement, "clientWidth", "get").mockReturnValue(
      1024,
    );
    vi.spyOn(document.documentElement, "clientHeight", "get").mockReturnValue(
      768,
    );
    vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockImplementation(
      function mockOffsetWidth(this: HTMLElement) {
        return this.classList.contains("isolate") ? 128 : 0;
      },
    );
    vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockImplementation(
      function mockOffsetHeight(this: HTMLElement) {
        return this.classList.contains("isolate") ? 40 : 0;
      },
    );
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
      function mockElementRect(this: HTMLElement) {
        const dataSlot = this.dataset.slot;

        if (dataSlot === "prompt-input-measure") {
          measureWidth = this.style.width;
          measureWhiteSpace = this.style.whiteSpace;
          measureOverflowWrap = this.style.overflowWrap;
          measuredText = this.textContent ?? "";
        }

        if (dataSlot === "prompt-textarea") {
          return createDomRect({
            bottom: 240,
            height: 40,
            left: 100,
            top: 200,
            width: 320,
          });
        }

        const left = dataSlot === "prompt-mention-position-marker" ? 32 : 0;

        return createDomRect({ left });
      },
    );
    const promptInput = renderPromptInput({
      attachmentMediaValue: createAttachmentMediaValue({
        images: [createAttachmentMediaItem("still.png", "image/png")],
      }),
    });

    Object.defineProperty(promptInput, "clientWidth", {
      configurable: true,
      value: 320,
    });

    focusPromptAt(promptInput, "First line\nUse @", 16);

    expect(
      await screen.findByRole("option", { name: "Image1" }),
    ).not.toBeNull();

    await waitFor(() => {
      const positioner = document.querySelector<HTMLElement>(
        '[data-slot="popover-content"]',
      )?.parentElement;

      expect(positioner?.style.transform).toContain("translate(132px");
      expect(positioner?.dataset.side).toBe("bottom");
    });
    expect(measureWidth).toBe("320px");
    expect(measureWhiteSpace).toBe("pre-wrap");
    expect(measureOverflowWrap).toBe("break-word");
    expect(measuredText).toBe("First line\nUse @");
  });

  it("flips attachment references above a prompt near the bottom edge", async () => {
    vi.spyOn(document.documentElement, "clientWidth", "get").mockReturnValue(
      1024,
    );
    vi.spyOn(document.documentElement, "clientHeight", "get").mockReturnValue(
      768,
    );
    vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockImplementation(
      function mockOffsetWidth(this: HTMLElement) {
        return this.classList.contains("isolate") ? 128 : 0;
      },
    );
    vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockImplementation(
      function mockOffsetHeight(this: HTMLElement) {
        return this.classList.contains("isolate") ? 160 : 0;
      },
    );
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
      function mockElementRect(this: HTMLElement) {
        if (this.dataset.slot === "prompt-textarea") {
          return createDomRect({
            bottom: 740,
            height: 40,
            left: 100,
            top: 700,
            width: 320,
          });
        }

        if (this.dataset.slot === "popover-content") {
          return createDomRect({ height: 160, width: 128 });
        }

        return createDomRect({
          left: this.dataset.slot === "prompt-mention-position-marker" ? 16 : 0,
        });
      },
    );
    const promptInput = renderPromptInput({
      attachmentMediaValue: createAttachmentMediaValue({
        images: [createAttachmentMediaItem("still.png", "image/png")],
      }),
    });

    Object.defineProperty(promptInput, "clientWidth", {
      configurable: true,
      value: 320,
    });

    focusPromptAt(promptInput, "@", 1);

    expect(
      await screen.findByRole("option", { name: "Image1" }),
    ).not.toBeNull();
    await waitFor(() => {
      expect(
        document.querySelector<HTMLElement>('[data-slot="popover-content"]')
          ?.parentElement?.dataset.side,
      ).toBe("top");
    });
  });

  it("inserts a clicked attachment reference and restores the caret", async () => {
    const promptInput = renderPromptInput({
      attachmentMediaValue: createAttachmentMediaValue({
        images: [createAttachmentMediaItem("still.png", "image/png")],
      }),
    });

    focusPromptAt(promptInput, "Use @im near the water", 7);

    const option = await screen.findByRole("option", { name: "Image1" });

    fireEvent.mouseDown(option);
    fireEvent.click(option);

    await waitFor(() => {
      expect(promptInput.value).toBe("Use @Image1 near the water");
      expect(promptInput.selectionStart).toBe(12);
      expect(promptInput.selectionEnd).toBe(12);
    });
  });

  it("supports keyboard navigation and selection", async () => {
    const promptInput = renderPromptInput({
      attachmentMediaValue: createAttachmentMediaValue({
        images: [createAttachmentMediaItem("still.png", "image/png")],
        videos: [createAttachmentMediaItem("motion.mp4", "video/mp4")],
      }),
    });

    focusPromptAt(promptInput, "@", 1);

    expect(
      (await screen.findByRole("option", { name: "Image1" })).getAttribute(
        "aria-selected",
      ),
    ).toBe("true");

    const videoOption = screen.getByRole("option", { name: "Video1" });
    const scrollIntoView = vi.fn();
    videoOption.scrollIntoView = scrollIntoView;

    fireEvent.keyDown(promptInput, { key: "ArrowDown" });

    await waitFor(() => {
      expect(videoOption.getAttribute("aria-selected")).toBe("true");
      expect(promptInput.getAttribute("aria-activedescendant")).toBe(
        videoOption.id,
      );
      expect(scrollIntoView).toHaveBeenCalledWith({ block: "nearest" });
    });

    fireEvent.keyDown(promptInput, { key: "Enter" });

    await waitFor(() => {
      expect(promptInput.value).toBe("@Video1 ");
      expect(promptInput.selectionStart).toBe(8);
      expect(promptInput.selectionEnd).toBe(8);
    });
  });

  it("closes attachment references with Escape", async () => {
    const promptInput = renderPromptInput({
      attachmentMediaValue: createAttachmentMediaValue({
        images: [createAttachmentMediaItem("still.png", "image/png")],
      }),
    });

    focusPromptAt(promptInput, "@", 1);

    expect(
      await screen.findByRole("option", { name: "Image1" }),
    ).not.toBeNull();

    fireEvent.keyDown(promptInput, { key: "Escape" });

    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("does not show attachment references without attachments or a valid @ token", () => {
    const { rerender } = render(
      <ControlledGenerationCommandInput
        attachmentMediaValue={createAttachmentMediaValue()}
      />,
    );
    const promptInput = screen.getByPlaceholderText(
      "A castle in the sky with...",
    ) as HTMLTextAreaElement;

    focusPromptAt(promptInput, "@", 1);

    expect(screen.queryByRole("listbox")).toBeNull();

    rerender(
      <ControlledGenerationCommandInput
        attachmentMediaValue={createAttachmentMediaValue({
          images: [createAttachmentMediaItem("still.png", "image/png")],
        })}
      />,
    );

    focusPromptAt(promptInput, "hello@", 6);

    expect(screen.queryByRole("listbox")).toBeNull();
  });
});

function renderPromptInput({
  attachmentMediaValue,
  initialPrompt = "",
}: {
  attachmentMediaValue: GenerationAttachmentMediaValue;
  initialPrompt?: string;
}) {
  render(
    <ControlledGenerationCommandInput
      attachmentMediaValue={attachmentMediaValue}
      initialPrompt={initialPrompt}
    />,
  );

  return screen.getByPlaceholderText(
    "A castle in the sky with...",
  ) as HTMLTextAreaElement;
}

function ControlledGenerationCommandInput({
  attachmentMediaValue,
  initialPrompt = "",
}: {
  attachmentMediaValue: GenerationAttachmentMediaValue;
  initialPrompt?: string;
}) {
  const [prompt, setPrompt] = useState(initialPrompt);

  return (
    <GenerationCommandInput
      attachmentMediaValue={attachmentMediaValue}
      prompt={prompt}
      onPromptChange={setPrompt}
    />
  );
}

function focusPromptAt(
  promptInput: HTMLTextAreaElement,
  prompt: string,
  caretPosition: number,
) {
  fireEvent.focus(promptInput);
  fireEvent.change(promptInput, { target: { value: prompt } });
  promptInput.setSelectionRange(caretPosition, caretPosition);
  fireEvent.keyUp(promptInput);
}

function createDomRect({
  bottom = 0,
  height = 0,
  left = 0,
  top = 0,
  width = 0,
}: {
  bottom?: number;
  height?: number;
  left?: number;
  top?: number;
  width?: number;
}) {
  return {
    bottom,
    height,
    left,
    right: left + width,
    top,
    width,
    x: left,
    y: top,
    toJSON: () => ({}),
  } as DOMRect;
}

function createAttachmentMediaValue(
  overrides: Partial<
    Record<AttachmentMediaFieldId, GenerationAttachmentMediaItem[]>
  > = {},
): GenerationAttachmentMediaValue {
  return {
    images: overrides.images ?? [],
    videos: overrides.videos ?? [],
    audios: overrides.audios ?? [],
  };
}

function createAttachmentMediaItem(
  name: string,
  type: string,
): GenerationAttachmentMediaItem {
  return {
    source: "local",
    file: new File(["media"], name, { type }),
    role: "reference",
  };
}
