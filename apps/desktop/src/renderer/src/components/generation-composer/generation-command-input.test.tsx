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

  it("positions attachment references at the active @ token", async () => {
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
      function mockElementRect(this: HTMLElement) {
        return {
          bottom: 0,
          height: 0,
          left: 0,
          right: 32,
          top: 0,
          width:
            this.tagName === "SPAN" && this.textContent === "Use " ? 32 : 0,
          x: 0,
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

    focusPromptAt(promptInput, "Use @", 5);

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
    ) as HTMLInputElement;

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
  ) as HTMLInputElement;
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
  promptInput: HTMLInputElement,
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
