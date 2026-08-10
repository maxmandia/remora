/** @vitest-environment jsdom */

import type {
  GenerationFieldSpec,
  PublishedGenerationModelSummary,
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

type ModelGroup = {
  value: string;
  items: PublishedGenerationModelSummary[];
};

vi.mock("@remora/ui", async () => {
  const React = await import("react");
  const GroupsContext = React.createContext<ModelGroup[]>([]);
  const GroupItemsContext = React.createContext<
    PublishedGenerationModelSummary[]
  >([]);

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
      items: ModelGroup[];
      itemToStringLabel: (item: PublishedGenerationModelSummary) => string;
      itemToStringValue: (item: PublishedGenerationModelSummary) => string;
      onInputValueChange: (value: string) => void;
      onValueChange: (value: PublishedGenerationModelSummary | null) => void;
      value: PublishedGenerationModelSummary | null;
    }) => {
      const models = items.flatMap((group) => group.items);

      return React.createElement(
        GroupsContext.Provider,
        { value: items },
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
                  models.find(
                    (item) => itemToStringValue(item) === event.target.value,
                  ) ?? null;

                onValueChange(nextModel);
                onInputValueChange(
                  nextModel ? itemToStringLabel(nextModel) : "",
                );
              },
            },
            React.createElement("option", { value: "" }, "Select a model"),
            models.map((item) =>
              React.createElement(
                "option",
                { key: item.id, value: itemToStringValue(item) },
                itemToStringLabel(item),
              ),
            ),
          ),
          children,
        ),
      );
    },
    ComboboxInput: (props: Record<string, unknown>) =>
      React.createElement("input", {
        "aria-hidden": true,
        "data-testid": "model-combobox-input",
        placeholder: props.placeholder as string,
        style: props.style as React.CSSProperties,
      }),
    ComboboxContent: ({
      children,
      side,
    }: {
      children: React.ReactNode;
      side?: string;
    }) =>
      React.createElement(
        "div",
        { "data-side": side, "data-slot": "combobox-content" },
        children,
      ),
    ComboboxList: ({
      children,
    }: {
      children: (group: ModelGroup, index: number) => React.ReactNode;
    }) => {
      const groups = React.useContext(GroupsContext);

      return React.createElement(
        "div",
        { "data-slot": "combobox-list" },
        groups.map(children),
      );
    },
    ComboboxGroup: ({
      children,
      items,
    }: {
      children: React.ReactNode;
      items: PublishedGenerationModelSummary[];
    }) =>
      React.createElement(
        GroupItemsContext.Provider,
        { value: items },
        React.createElement(
          "section",
          { "data-slot": "combobox-group" },
          children,
        ),
      ),
    ComboboxLabel: ({ children }: { children: React.ReactNode }) =>
      React.createElement("div", { "data-slot": "combobox-label" }, children),
    ComboboxCollection: ({
      children,
    }: {
      children: (model: PublishedGenerationModelSummary) => React.ReactNode;
    }) => {
      const models = React.useContext(GroupItemsContext);

      return models.map(children);
    },
    ComboboxItem: ({
      children,
      value,
    }: {
      children: React.ReactNode;
      value: PublishedGenerationModelSummary;
    }) =>
      React.createElement(
        "div",
        { "data-model-id": value.id, "data-slot": "combobox-item" },
        children,
      ),
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
    expect(
      document.querySelector<HTMLElement>('[data-slot="combobox-content"]')
        ?.dataset.side,
    ).toBe("top");
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

  it("groups image models before video models while preserving their relative order", () => {
    const firstVideo = createModel(
      "seedance-2.0-video",
      "Seedance 2.0",
      "video",
    );
    const firstImage = createModel("nano-banana-2", "Nano Banana 2", "image");
    const secondVideo = createModel(
      "kling-v3-text-to-video",
      "Kling 3.0 Text to Video",
      "video",
    );
    const secondImage = createModel(
      "another-image-model",
      "Another Image Model",
      "image",
    );

    const { container } = render(
      <GenerationModelSelector
        models={[firstVideo, firstImage, secondVideo, secondImage]}
        selectedModel={null}
        onSelectedModelChange={vi.fn()}
      />,
    );

    const groups = Array.from(
      container.querySelectorAll('[data-slot="combobox-group"]'),
    );

    expect(groups).toHaveLength(2);
    expect(getGroupLabel(groups[0])).toBe("Images");
    expect(getGroupModelIds(groups[0])).toEqual([
      firstImage.id,
      secondImage.id,
    ]);
    expect(getGroupLabel(groups[1])).toBe("Videos");
    expect(getGroupModelIds(groups[1])).toEqual([
      firstVideo.id,
      secondVideo.id,
    ]);
  });

  it("omits empty groups", () => {
    const videoModel = createModel(
      "seedance-2.0-video",
      "Seedance 2.0",
      "video",
    );

    const { container } = render(
      <GenerationModelSelector
        models={[videoModel]}
        selectedModel={null}
        onSelectedModelChange={vi.fn()}
      />,
    );

    const groups = Array.from(
      container.querySelectorAll('[data-slot="combobox-group"]'),
    );

    expect(groups).toHaveLength(1);
    expect(getGroupLabel(groups[0])).toBe("Videos");
    expect(getGroupModelIds(groups[0])).toEqual([videoModel.id]);
  });
});

function getGroupLabel(group: Element | undefined) {
  return group?.querySelector('[data-slot="combobox-label"]')?.textContent;
}

function getGroupModelIds(group: Element | undefined) {
  return Array.from(
    group?.querySelectorAll('[data-slot="combobox-item"]') ?? [],
    (item) => item.getAttribute("data-model-id"),
  );
}

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
  type: PublishedGenerationModelSummary["type"] = "video",
): PublishedGenerationModelSummary {
  const promptField = createPromptField();

  return {
    id,
    providerId: "byteplus",
    providerName: "BytePlus",
    displayName,
    type,
    latestSpecId: `${id}-v1`,
    latestSpecVersion: 1,
    spec: {
      schemaVersion: 1,
      id,
      provider: "byteplus",
      providerModelId: null,
      displayName,
      type,
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
