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

import { GenerationSettings } from "./generation-settings.tsx";

describe("GenerationSettings", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders settings in canonical order regardless of field order", () => {
    const { container } = render(
      <GenerationSettings
        selectedModel={createModel([
          createField({
            id: "generateAudio",
            label: "Generate audio",
            componentKind: "toggle",
            valueKind: "boolean",
            defaultValue: true,
            options: [
              { label: "On", value: true },
              { label: "Off", value: false },
            ],
          }),
          createField({
            id: "duration",
            label: "Duration",
            componentKind: "select",
            valueKind: "integer",
            defaultValue: 5,
            options: [
              { label: "5s", value: 5 },
              { label: "10s", value: 10 },
            ],
          }),
          createField({
            id: "aspectRatio",
            label: "Aspect ratio",
            componentKind: "select",
            valueKind: "string",
            defaultValue: "16:9",
            options: [
              { label: "16:9", value: "16:9" },
              { label: "9:16", value: "9:16" },
            ],
          }),
        ])}
        value={{
          aspectRatio: "16:9",
          duration: 5,
          generateAudio: true,
          requestedGenerations: 1,
        }}
        onValueChange={vi.fn()}
      />,
    );

    const triggerLabels = Array.from(
      container.querySelectorAll('[data-slot="select-trigger"]'),
      (trigger) => trigger.textContent?.replace("▼", ""),
    );

    expect(triggerLabels).toEqual(["1", "16:9", "5s", "On"]);
  });

  it("uses shared surface-aware ghost trigger styling", () => {
    const { container } = render(
      <GenerationSettings
        selectedModel={createModel([
          createField({
            id: "duration",
            label: "Duration",
            componentKind: "select",
            valueKind: "integer",
            defaultValue: 5,
            options: [{ label: "5s", value: 5 }],
          }),
        ])}
        value={{
          aspectRatio: "16:9",
          duration: 5,
          generateAudio: true,
          requestedGenerations: 1,
        }}
        onValueChange={vi.fn()}
      />,
    );

    const triggers = Array.from(
      container.querySelectorAll<HTMLElement>('[data-slot="select-trigger"]'),
    );

    expect(triggers.length).toBeGreaterThan(0);

    for (const trigger of triggers) {
      expect(trigger.className).toContain(
        "hover:bg-[var(--surface-interactive-hover)]",
      );
      expect(trigger.className).toContain(
        "aria-expanded:bg-[var(--surface-interactive-active)]",
      );
      expect(trigger.className).not.toContain("primary-foreground/10");
    }
  });

  it("renders select popovers on the shared popover surface", async () => {
    render(
      <GenerationSettings
        selectedModel={createModel([
          createField({
            id: "duration",
            label: "Duration",
            componentKind: "select",
            valueKind: "integer",
            defaultValue: 5,
            options: [{ label: "5s", value: 5 }],
          }),
        ])}
        value={{
          aspectRatio: "16:9",
          duration: 5,
          generateAudio: true,
          requestedGenerations: 1,
        }}
        onValueChange={vi.fn()}
      />,
    );

    fireEvent.click(
      screen.getByRole("combobox", {
        name: "Requested generations",
      }),
    );

    const option = await screen.findByRole("option", { name: "1" });
    const content = document.querySelector<HTMLElement>(
      '[data-slot="select-content"]',
    );

    expect(content?.dataset.surface).toBe("popup");
    expect(content?.className).toContain("bg-popover");
    expect(option.className).toContain(
      "focus:bg-[var(--surface-interactive-hover)]",
    );
  });

  it("renders requested generation options and emits selected counts", async () => {
    const onValueChange = vi.fn();

    render(
      <GenerationSettings
        selectedModel={createModel([
          createField({
            id: "duration",
            label: "Duration",
            componentKind: "select",
            valueKind: "integer",
            defaultValue: 5,
            options: [{ label: "5s", value: 5 }],
          }),
        ])}
        value={{
          aspectRatio: "16:9",
          duration: 5,
          generateAudio: true,
          requestedGenerations: 1,
        }}
        onValueChange={onValueChange}
      />,
    );

    fireEvent.click(
      screen.getByRole("combobox", {
        name: "Requested generations",
      }),
    );

    const option = await screen.findByRole("option", { name: "15" });
    fireEvent.pointerDown(option);
    fireEvent.pointerUp(option);
    fireEvent.click(option);

    await waitFor(() => {
      expect(onValueChange).toHaveBeenCalledWith({
        aspectRatio: "16:9",
        duration: 5,
        generateAudio: true,
        requestedGenerations: 15,
      });
    });
  });

  it("renders Seedance audio as a canonical boolean setting", () => {
    const { container } = render(
      <GenerationSettings
        selectedModel={createModel([
          createField({
            id: "generateAudio",
            label: "Generate audio",
            componentKind: "toggle",
            valueKind: "boolean",
            defaultValue: true,
            options: [
              { label: "On", value: true },
              { label: "Off", value: false },
            ],
          }),
        ])}
        value={{
          aspectRatio: "16:9",
          duration: 5,
          generateAudio: true,
          requestedGenerations: 1,
        }}
        onValueChange={vi.fn()}
      />,
    );

    expect(screen.getByText("On")).toBeTruthy();
    expect(
      container.querySelector('[data-slot="select-trigger"]'),
    ).not.toBeNull();
    expect(screen.queryByRole("switch")).toBeNull();
  });

  it("renders Kling audio as the same canonical boolean setting", () => {
    const { container } = render(
      <GenerationSettings
        selectedModel={createModel([
          createField({
            id: "generateAudio",
            label: "Sound",
            componentKind: "select",
            valueKind: "boolean",
            defaultValue: false,
            providerPath: ["sound"],
            providerValueMap: [
              { canonicalValue: true, providerValue: "on" },
              { canonicalValue: false, providerValue: "off" },
            ],
            options: [
              { label: "On", value: true },
              { label: "Off", value: false },
            ],
          }),
        ])}
        value={{
          aspectRatio: "16:9",
          duration: 5,
          generateAudio: false,
          requestedGenerations: 1,
        }}
        onValueChange={vi.fn()}
      />,
    );

    expect(screen.getByText("Off")).toBeTruthy();
    expect(
      container.querySelector('[data-slot="select-trigger"]'),
    ).not.toBeNull();
    const audioTrigger = screen
      .getByText("Off")
      .closest('[data-slot="select-trigger"]');

    expect(
      audioTrigger
        ?.querySelector('[data-slot="select-trigger-icon"] svg')
        ?.classList.contains("lucide-volume-off"),
    ).toBe(true);
    expect(screen.queryByRole("switch")).toBeNull();
  });

  it("renders controlled values instead of local defaults", () => {
    render(
      <GenerationSettings
        selectedModel={createModel([
          createField({
            id: "duration",
            label: "Duration",
            componentKind: "select",
            valueKind: "integer",
            defaultValue: 5,
            options: [
              { label: "5s", value: 5 },
              { label: "10s", value: 10 },
            ],
          }),
          createField({
            id: "generateAudio",
            label: "Generate audio",
            componentKind: "toggle",
            valueKind: "boolean",
            defaultValue: true,
            options: [
              { label: "On", value: true },
              { label: "Off", value: false },
            ],
          }),
          createField({
            id: "aspectRatio",
            label: "Aspect ratio",
            componentKind: "select",
            valueKind: "string",
            defaultValue: "16:9",
            options: [
              { label: "16:9", value: "16:9" },
              { label: "9:16", value: "9:16" },
            ],
          }),
        ])}
        value={{
          aspectRatio: "9:16",
          duration: 10,
          generateAudio: false,
          requestedGenerations: 7,
        }}
        onValueChange={vi.fn()}
      />,
    );

    expect(screen.getByText("9:16")).toBeTruthy();
    expect(screen.getByText("10s")).toBeTruthy();
    expect(screen.getByText("Off")).toBeTruthy();
  });
});

function createField(overrides: Partial<VideoFieldSpec> = {}): VideoFieldSpec {
  return {
    id: "prompt",
    label: "Prompt",
    componentKind: "promptTextarea",
    valueKind: "string",
    required: false,
    advanced: false,
    defaultValue: "",
    omitWhenEmpty: true,
    omitWhenDefault: false,
    notes: [],
    ...overrides,
  };
}

function createModel(
  fields: [VideoFieldSpec, ...VideoFieldSpec[]],
): PublishedGenerationModelSummary {
  const fieldIds = fields.map((field) => field.id) as [
    VideoFieldSpec["id"],
    ...VideoFieldSpec["id"][],
  ];

  return {
    id: "test-model",
    providerId: "byteplus",
    providerName: "BytePlus",
    displayName: "Test Model",
    type: "video",
    latestSpecId: "test-model-v1",
    latestSpecVersion: 1,
    spec: {
      schemaVersion: 1,
      id: "test-model",
      provider: "byteplus",
      providerModelId: null,
      displayName: "Test Model",
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
      fields,
      groups: [
        {
          id: "output",
          label: "Output",
          fieldIds,
          advanced: false,
        },
      ],
      transforms: [],
      validationRules: [],
    },
  };
}
