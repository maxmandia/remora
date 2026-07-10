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
    const promptInput = renderPromptInput({
      attachmentMediaValue: createAttachmentMediaValue({
        images: [
          createAttachmentMediaItem("first.png", "image/png"),
          createAttachmentMediaItem("second.png", "image/png"),
        ],
        videos: [createAttachmentMediaItem("clip.mp4", "video/mp4")],
        audios: [createAttachmentMediaItem("voice.wav", "audio/wav")],
      }),
    });

    focusPromptAt(promptInput, "@", 1);

    expect(
      await screen.findByRole("option", { name: "Image1" }),
    ).not.toBeNull();
    expect(screen.getByRole("option", { name: "Image2" })).not.toBeNull();
    expect(screen.getByRole("option", { name: "Video1" })).not.toBeNull();
    expect(screen.getByRole("option", { name: "Audio1" })).not.toBeNull();
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
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
      function mockElementRect(this: HTMLElement) {
        const dataSlot = this.dataset.slot;

        if (dataSlot === "prompt-input-measure") {
          measureWidth = this.style.width;
          measureWhiteSpace = this.style.whiteSpace;
          measureOverflowWrap = this.style.overflowWrap;
          measuredText = this.textContent ?? "";
        }

        const left = dataSlot === "prompt-mention-position-marker" ? 32 : 0;

        return {
          bottom: 0,
          height: 0,
          left,
          right: left,
          top: 0,
          width: 0,
          x: left,
          y: 0,
          toJSON: () => ({}),
        } as DOMRect;
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
      expect(
        document.querySelector<HTMLElement>(
          '[data-slot="attachment-reference-menu"]',
        )?.style.left,
      ).toBe("32px");
    });
    expect(measureWidth).toBe("320px");
    expect(measureWhiteSpace).toBe("pre-wrap");
    expect(measureOverflowWrap).toBe("break-word");
    expect(measuredText).toBe("First line\nUse @");
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

    fireEvent.keyDown(promptInput, { key: "ArrowDown" });

    expect(
      screen
        .getByRole("option", { name: "Video1" })
        .getAttribute("aria-selected"),
    ).toBe("true");

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
    file: new File(["media"], name, { type }),
    role: "reference",
  };
}
