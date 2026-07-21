/** @vitest-environment jsdom */

import type {
  PublishedGenerationModelSummary,
  GenerationFieldSpec,
} from "@remora/domain/generation-model/dto";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { GenerationModelSelector } from "./generation-model-selector.tsx";

vi.mock("@remora/ui", async () => {
  const React = await import("react");

  return {
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
        placeholder: props.placeholder as string,
        style: props.style as React.CSSProperties,
      }),
    ComboboxContent: ({ children }: { children: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
    ComboboxList: () => null,
    ComboboxItem: ({ children }: { children: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
  };
});

describe("GenerationModelSelector", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("sizes the combobox input from placeholder text", async () => {
    mockMeasuredTextWidth();

    render(
      <GenerationModelSelector
        models={[]}
        selectedModel={null}
        onSelectedModelChange={vi.fn()}
      />,
    );

    expect(screen.getByPlaceholderText("Select a model")).not.toBeNull();

    await waitFor(() => {
      expect(
        screen
          .getByTestId("model-combobox-input")
          .style.getPropertyValue("--model-combobox-input-width"),
      ).toBe("102px");
    });
  });

  it("emits selected models and sizes the combobox input from visible text", async () => {
    mockMeasuredTextWidth();

    const onSelectedModelChange = vi.fn();
    const seedanceModel = createModel("seedance-2.0-video", "Seedance 2.0");
    const klingModel = createModel(
      "kling-v3-text-to-video",
      "Kling 3.0 Text to Video",
    );

    render(
      <GenerationModelSelector
        models={[seedanceModel, klingModel]}
        selectedModel={null}
        onSelectedModelChange={onSelectedModelChange}
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

function mockMeasuredTextWidth() {
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
    function mockElementRect(this: HTMLElement) {
      return createRect(getMeasuredTextWidth(this.textContent ?? ""));
    },
  );
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

function createPromptField(): GenerationFieldSpec {
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
