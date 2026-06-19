/** @vitest-environment jsdom */

import type {
  PublishedGenerationModelSummary,
  VideoFieldSpec,
} from "@remora/backend/types";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { GenerationCommandInput } from "./generation-command-input.tsx";

vi.mock("@remora/ui", async () => {
  const React = await import("react");

  return {
    Button: ({ children, ...props }: React.ComponentProps<"button">) =>
      React.createElement("button", props, children),
    FilePickerButton: ({
      accept: _accept,
      children,
      multiple: _multiple,
      onFilesSelect: _onFilesSelect,
      ...props
    }: React.ComponentProps<"button"> & {
      accept?: string;
      multiple?: boolean;
      onFilesSelect: (files: File[]) => void;
    }) => React.createElement("button", props, children),
    Combobox: ({
      children,
      items,
      itemToStringLabel,
      itemToStringValue,
      onInputValueChange,
      onValueChange,
      value,
    }: {
      children: React.ReactNode;
      items: PublishedGenerationModelSummary[];
      itemToStringLabel: (item: PublishedGenerationModelSummary) => string;
      itemToStringValue: (item: PublishedGenerationModelSummary) => string;
      onInputValueChange: (value: string) => void;
      onValueChange: (value: PublishedGenerationModelSummary | null) => void;
      value: PublishedGenerationModelSummary | null;
    }) =>
      React.createElement(
        React.Fragment,
        null,
        React.createElement(
          "select",
          {
            "aria-label": "Model",
            value: value ? itemToStringValue(value) : "",
            onChange: (event: React.ChangeEvent<HTMLSelectElement>) => {
              const nextModel =
                items.find(
                  (item) => itemToStringValue(item) === event.target.value,
                ) ?? null;

              onValueChange(nextModel);
              onInputValueChange(nextModel ? itemToStringLabel(nextModel) : "");
            },
          },
          React.createElement("option", { value: "" }, "Select a model"),
          items.map((item) =>
            React.createElement(
              "option",
              { key: item.id, value: itemToStringValue(item) },
              itemToStringLabel(item),
            ),
          ),
        ),
        children,
      ),
    ComboboxInput: (props: Record<string, unknown>) =>
      React.createElement("input", {
        "aria-hidden": true,
        "data-testid": "model-combobox-input",
        style: props.style as React.CSSProperties,
      }),
    ComboboxContent: ({ children }: { children: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
    ComboboxList: () => null,
    ComboboxItem: ({ children }: { children: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
  };
});

describe("GenerationCommandInput", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("emits prompt changes and submits only when enabled", () => {
    const onPromptChange = vi.fn();
    const onSelectedModelChange = vi.fn();
    const onSubmit = vi.fn();
    const model = createModel("seedance-2.0-video", "Seedance 2.0");
    const props = {
      models: [model],
      prompt: "",
      selectedModel: null,
      generationAttachmentMedia: createAttachmentMediaValue(),
      generationSettings: null,
      onGenerationAttachmentMediaChange: vi.fn(),
      onGenerationSettingsChange: vi.fn(),
      onPromptChange,
      onSelectedModelChange,
      onSubmit,
    };
    const rendered = render(
      <GenerationCommandInput {...props} canSubmit={false} />,
    );
    const promptInput = screen.getByPlaceholderText(
      "A castle in the sky with...",
    );
    const submitButton = screen.getByRole("button", {
      name: "Submit generation",
    }) as HTMLButtonElement;

    expect(
      rendered.container.querySelector('[data-surface="strong"]'),
    ).not.toBeNull();
    expect(
      rendered.container.querySelector('[data-surface="strong"]')?.className,
    ).toContain("bg-surface-strong");
    expect(submitButton.getAttribute("variant")).toBe("ghost");

    fireEvent.change(promptInput, {
      target: { value: "A glass studio above the ocean" },
    });

    expect(onPromptChange).toHaveBeenCalledWith(
      "A glass studio above the ocean",
    );
    expect(submitButton.disabled).toBe(true);
    expect(onSubmit).not.toHaveBeenCalled();

    rendered.rerender(
      <GenerationCommandInput
        {...props}
        canSubmit
        prompt="A glass studio above the ocean"
        selectedModel={model}
      />,
    );

    expect(submitButton.disabled).toBe(false);

    fireEvent.click(submitButton);

    expect(onSubmit).toHaveBeenCalledOnce();
  });

  it("emits selected models and sizes the combobox input from visible text", async () => {
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
      function mockElementRect(this: HTMLElement) {
        return createRect(getMeasuredTextWidth(this.textContent ?? ""));
      },
    );

    const onSelectedModelChange = vi.fn();
    const seedanceModel = createModel("seedance-2.0-video", "Seedance 2.0");
    const klingModel = createModel(
      "kling-v3-text-to-video",
      "Kling 3.0 Text to Video",
    );

    render(
      <GenerationCommandInput
        canSubmit={false}
        models={[seedanceModel, klingModel]}
        prompt=""
        selectedModel={null}
        generationAttachmentMedia={createAttachmentMediaValue()}
        generationSettings={null}
        onGenerationAttachmentMediaChange={vi.fn()}
        onGenerationSettingsChange={vi.fn()}
        onPromptChange={vi.fn()}
        onSelectedModelChange={onSelectedModelChange}
        onSubmit={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText("Model"), {
      target: { value: "kling-v3-text-to-video" },
    });

    expect(onSelectedModelChange).toHaveBeenCalledWith(klingModel);

    await waitFor(() => {
      expect(
        screen
          .getByTestId("model-combobox-input")
          .style.getPropertyValue("--model-combobox-input-width"),
      ).toBe("166px");
    });
  });
});

function createAttachmentMediaValue() {
  return {
    images: [],
    videos: [],
    audios: [],
  };
}

function getMeasuredTextWidth(text: string) {
  if (text === "Kling 3.0 Text to Video") {
    return 160;
  }

  if (text === "Select a model") {
    return 96;
  }

  return 0;
}

function createRect(width: number) {
  return {
    bottom: 0,
    height: 0,
    left: 0,
    right: width,
    top: 0,
    width,
    x: 0,
    y: 0,
    toJSON: () => ({ width }),
  } as DOMRect;
}

function createModel(
  id: string,
  displayName: string,
): PublishedGenerationModelSummary {
  const promptField = createPromptField();

  return {
    id,
    providerId: "byteplus",
    providerName: "BytePlus",
    displayName,
    type: "video",
    latestSpecId: `${id}-v1`,
    latestSpecVersion: 1,
    spec: {
      schemaVersion: 1,
      id,
      provider: "byteplus",
      providerModelId: null,
      displayName,
      type: "video",
      status: "published",
      sourceUrls: [],
      endpoint: {
        method: "POST",
        path: "/test",
      },
      modelParameter: {
        path: ["model"],
        source: "runtime",
      },
      fields: [promptField],
      groups: [
        {
          id: "input",
          label: "Input",
          fieldIds: [promptField.id],
          advanced: false,
        },
      ],
      transforms: [],
      validationRules: [],
    },
  };
}

function createPromptField(): VideoFieldSpec {
  return {
    id: "prompt",
    label: "Prompt",
    componentKind: "promptTextarea",
    valueKind: "string",
    required: true,
    advanced: false,
    defaultValue: "",
    omitWhenEmpty: true,
    omitWhenDefault: false,
    notes: [],
  };
}
