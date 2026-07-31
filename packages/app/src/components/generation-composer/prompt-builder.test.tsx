/** @vitest-environment jsdom */

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PromptBuilder } from "./prompt-builder.tsx";

const modelIdByType = {
  image: "nano-banana-2",
  video: "seedance-2.0-video",
};

describe("PromptBuilder", () => {
  afterEach(cleanup);

  it("keeps the prompt prefix immutable and edits only the prompt details", () => {
    const onPromptChange = vi.fn();
    const { container } = render(
      <PromptBuilder
        isInteractive
        isPending={false}
        modelIdByType={modelIdByType}
        prompt="a lighthouse above a storm"
        onPromptChange={onPromptChange}
        onSubmit={vi.fn()}
      />,
    );
    const promptInput = screen.getByRole("textbox", {
      name: "Prompt details",
    }) as HTMLTextAreaElement;

    expect(
      container.querySelector('[data-slot="prompt-builder-prefix"]')
        ?.textContent,
    ).toBe("Generate an");
    expect(
      container.querySelector('[data-slot="prompt-builder-connector"]')
        ?.textContent,
    ).toBe("of");
    expect(
      screen.getByRole("combobox", { name: "Generation type" }).textContent,
    ).toContain("image");
    expect(promptInput.value).toBe("a lighthouse above a storm");
    expect(promptInput.getAttribute("placeholder")).toBeNull();
    expect(promptInput.value).not.toContain("generate an image of");
    const controls = container.querySelector<HTMLElement>(
      '[data-slot="prompt-builder-controls"]',
    );
    const submitButton = screen.getByRole("button", {
      name: "Submit prompt builder",
    });

    expect(controls?.className).toContain("mt-auto");
    expect(controls?.className).toContain("justify-end");
    expect(submitButton.parentElement).toBe(controls);
    expect(submitButton.getAttribute("type")).toBe("button");

    fireEvent.change(promptInput, { target: { value: "" } });

    expect(onPromptChange).toHaveBeenCalledWith("");
    expect(
      container.querySelector('[data-slot="prompt-builder-prefix"]')
        ?.textContent,
    ).toBe("Generate an");
    expect(
      container.querySelector('[data-slot="prompt-builder-connector"]')
        ?.textContent,
    ).toBe("of");
  });

  it("allows choosing image or video without making the choice editable", async () => {
    render(
      <PromptBuilder
        isInteractive
        isPending={false}
        modelIdByType={modelIdByType}
        prompt=""
        onPromptChange={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );
    const generationTypeSelect = screen.getByRole("combobox", {
      name: "Generation type",
    });

    fireEvent.click(generationTypeSelect);

    expect(await screen.findByRole("option", { name: "image" })).toBeTruthy();
    const videoOption = screen.getByRole("option", { name: "video" });

    fireEvent.pointerDown(videoOption);
    fireEvent.pointerUp(videoOption);
    fireEvent.click(videoOption);

    await waitFor(() => {
      expect(generationTypeSelect.textContent).toContain("video");
    });
  });

  it("submits the selected model type and prompt", async () => {
    const onSubmit = vi.fn();

    render(
      <PromptBuilder
        isInteractive
        isPending={false}
        modelIdByType={modelIdByType}
        prompt="A clockwork garden"
        onPromptChange={vi.fn()}
        onSubmit={onSubmit}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Submit prompt builder" }),
    );

    expect(onSubmit).toHaveBeenLastCalledWith({
      modelId: "nano-banana-2",
      prompt: "A clockwork garden",
    });

    fireEvent.click(screen.getByRole("combobox", { name: "Generation type" }));
    const videoOption = await screen.findByRole("option", { name: "video" });

    fireEvent.pointerDown(videoOption);
    fireEvent.pointerUp(videoOption);
    fireEvent.click(videoOption);

    await waitFor(() => {
      expect(
        screen.getByRole("combobox", { name: "Generation type" }).textContent,
      ).toContain("video");
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Submit prompt builder" }),
    );

    expect(onSubmit).toHaveBeenLastCalledWith({
      modelId: "seedance-2.0-video",
      prompt: "A clockwork garden",
    });
  });

  it("disables submission for blank prompts and while pending", () => {
    const onSubmit = vi.fn();
    const { rerender } = render(
      <PromptBuilder
        isInteractive
        isPending={false}
        modelIdByType={modelIdByType}
        prompt="   "
        onPromptChange={vi.fn()}
        onSubmit={onSubmit}
      />,
    );
    const submitButton = screen.getByRole("button", {
      name: "Submit prompt builder",
    });

    expect((submitButton as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(submitButton);
    expect(onSubmit).not.toHaveBeenCalled();

    rerender(
      <PromptBuilder
        isInteractive
        isPending
        modelIdByType={modelIdByType}
        prompt="A clockwork garden"
        onPromptChange={vi.fn()}
        onSubmit={onSubmit}
      />,
    );

    expect((submitButton as HTMLButtonElement).disabled).toBe(true);
    expect(submitButton.getAttribute("aria-busy")).toBe("true");
    expect(submitButton.querySelector(".animate-spin")).not.toBeNull();
  });

  it("disables submission while the prompt builder is not interactive", () => {
    render(
      <PromptBuilder
        isInteractive={false}
        isPending={false}
        modelIdByType={modelIdByType}
        prompt="A clockwork garden"
        onPromptChange={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );

    expect(
      (
        screen.getByRole("button", {
          name: "Submit prompt builder",
          hidden: true,
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
  });

  it("disables submission when the selected target model is unavailable", () => {
    render(
      <PromptBuilder
        isInteractive
        isPending={false}
        modelIdByType={{ image: null, video: "seedance-2.0-video" }}
        prompt="A clockwork garden"
        onPromptChange={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );

    expect(
      (
        screen.getByRole("button", {
          name: "Submit prompt builder",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
  });
});
