/** @vitest-environment jsdom */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AppRoute } from "./app-route.tsx";

import type {
  PublishedGenerationModelSummary,
  VideoFieldSpec,
} from "@remora/backend/types";

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  queryOptions: vi.fn(),
  mutationOptions: vi.fn(),
  createVideo: vi.fn(),
  authState: {
    current: {
      status: "signed-in" as const,
      user: { id: "user_1" },
      error: null,
      requestAuth: async () => undefined,
      signOut: async () => undefined,
    },
  },
}));

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mocks.navigate,
}));

vi.mock("../providers/auth-provider.tsx", () => ({
  useAuth: () => mocks.authState.current,
}));

vi.mock("../lib/trpc.ts", () => ({
  useTRPC: () => ({
    generation: {
      createVideo: {
        mutationOptions: mocks.mutationOptions,
      },
    },
    model: {
      listPublished: {
        queryOptions: mocks.queryOptions,
      },
    },
  }),
}));

vi.mock("@remora/ui", async () => {
  const React = await import("react");

  return {
    Button: ({ children, ...props }: React.ComponentProps<"button">) =>
      React.createElement("button", props, children),
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
        style: props.style as React.CSSProperties,
      }),
    ComboboxContent: ({ children }: { children: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
    ComboboxList: () => null,
    ComboboxItem: ({ children }: { children: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
    Select: ({ children }: { children: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
    SelectTrigger: ({ children }: { children: React.ReactNode }) =>
      React.createElement("button", { type: "button" }, children),
    SelectValue: () => null,
    SelectContent: ({ children }: { children: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
    SelectItem: ({ children }: { children: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
  };
});

describe("AppRoute composer submission", () => {
  beforeEach(() => {
    mocks.navigate.mockReset();
    mocks.createVideo.mockReset();
    mocks.createVideo.mockResolvedValue({
      jobId: "job_1",
      workflowId: "generation-job:job_1",
      status: "queued",
    });
    mocks.queryOptions.mockImplementation((_input, options) => ({
      ...options,
      queryKey: ["model", "listPublished"],
      queryFn: async () => [createSeedanceModel()],
    }));
    mocks.mutationOptions.mockImplementation((options) => ({
      ...options,
      mutationFn: mocks.createVideo,
    }));
  });

  afterEach(() => {
    cleanup();
  });

  it("requires a prompt and model, submits settings, and clears the prompt", async () => {
    renderAppRoute();

    const promptInput = screen.getByPlaceholderText(
      "A castle in the sky with...",
    );
    const submitButton = screen.getByRole("button", {
      name: "Submit generation",
    });

    expect((submitButton as HTMLButtonElement).disabled).toBe(true);

    fireEvent.change(promptInput, {
      target: { value: "A glass studio above the ocean" },
    });

    expect((submitButton as HTMLButtonElement).disabled).toBe(true);

    await screen.findByText("Seedance 2.0");

    fireEvent.change(screen.getByLabelText("Model"), {
      target: { value: "seedance-2.0-video" },
    });

    await waitFor(() => {
      expect((submitButton as HTMLButtonElement).disabled).toBe(false);
    });

    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mocks.createVideo).toHaveBeenCalledWith(
        {
          modelId: "seedance-2.0-video",
          prompt: "A glass studio above the ocean",
          aspectRatio: "16:9",
          duration: 5,
          generateAudio: true,
        },
        expect.objectContaining({ client: expect.any(QueryClient) }),
      );
    });
    await waitFor(() => {
      expect((promptInput as HTMLInputElement).value).toBe("");
    });
  });

  it("initializes Kling settings from numeric canonical duration values", async () => {
    mocks.queryOptions.mockImplementation((_input, options) => ({
      ...options,
      queryKey: ["model", "listPublished"],
      queryFn: async () => [createSeedanceModel(), createKlingModel()],
    }));

    renderAppRoute();

    const promptInput = screen.getByPlaceholderText(
      "A castle in the sky with...",
    );
    const submitButton = screen.getByRole("button", {
      name: "Submit generation",
    });

    fireEvent.change(promptInput, {
      target: { value: "A lantern city at dusk" },
    });

    await screen.findByText("Kling 3.0 Text to Video");

    fireEvent.change(screen.getByLabelText("Model"), {
      target: { value: "kling-v3-text-to-video" },
    });

    await waitFor(() => {
      expect((submitButton as HTMLButtonElement).disabled).toBe(false);
    });

    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mocks.createVideo).toHaveBeenCalledWith(
        {
          modelId: "kling-v3-text-to-video",
          prompt: "A lantern city at dusk",
          aspectRatio: "16:9",
          duration: 5,
          generateAudio: false,
        },
        expect.objectContaining({ client: expect.any(QueryClient) }),
      );
    });
  });
});

function renderAppRoute() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
      mutations: {
        retry: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <AppRoute />
    </QueryClientProvider>,
  );
}

function createSeedanceModel(): PublishedGenerationModelSummary {
  const fields = [
    createField({
      id: "aspectRatio",
      label: "Aspect ratio",
      valueKind: "string",
      defaultValue: "16:9",
      options: [
        { label: "16:9", value: "16:9" },
        { label: "9:16", value: "9:16" },
      ],
    }),
    createField({
      id: "duration",
      label: "Duration",
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
      valueKind: "boolean",
      defaultValue: true,
      options: [
        { label: "On", value: true },
        { label: "Off", value: false },
      ],
    }),
  ] as [VideoFieldSpec, ...VideoFieldSpec[]];

  return {
    id: "seedance-2.0-video",
    providerId: "byteplus",
    providerName: "BytePlus",
    displayName: "Seedance 2.0",
    type: "video",
    latestSpecId: "seedance-2.0-video-v1",
    latestSpecVersion: 1,
    spec: {
      schemaVersion: 1,
      id: "seedance-2.0-video",
      provider: "byteplus",
      providerModelId: "dreamina-seedance-2-0-260128",
      displayName: "Seedance 2.0",
      type: "video",
      status: "published",
      sourceUrls: [],
      endpoint: {
        method: "POST",
        path: "/contents/generations/tasks",
      },
      modelParameter: {
        path: ["model"],
        source: "spec",
      },
      fields,
      groups: [
        {
          id: "output",
          label: "Output",
          fieldIds: ["aspectRatio", "duration", "generateAudio"],
          advanced: false,
        },
      ],
      transforms: [{ kind: "seedanceContentArray" }],
      validationRules: ["seedance20ContentRules"],
    },
  };
}

function createKlingModel(): PublishedGenerationModelSummary {
  const fields = [
    createField({
      id: "aspectRatio",
      label: "Aspect ratio",
      valueKind: "string",
      defaultValue: "16:9",
      options: [
        { label: "16:9", value: "16:9" },
        { label: "9:16", value: "9:16" },
        { label: "1:1", value: "1:1" },
      ],
    }),
    createField({
      id: "duration",
      label: "Duration",
      valueKind: "integer",
      defaultValue: 5,
      providerPath: ["duration"],
      providerValueMap: [
        { canonicalValue: 5, providerValue: "5" },
        { canonicalValue: 10, providerValue: "10" },
      ],
      options: [
        { label: "5s", value: 5 },
        { label: "10s", value: 10 },
      ],
    }),
    createField({
      id: "generateAudio",
      label: "Sound",
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
  ] as [VideoFieldSpec, ...VideoFieldSpec[]];

  return {
    id: "kling-v3-text-to-video",
    providerId: "kling",
    providerName: "Kling",
    displayName: "Kling 3.0 Text to Video",
    type: "video",
    latestSpecId: "kling-v3-text-to-video-v1",
    latestSpecVersion: 1,
    spec: {
      schemaVersion: 1,
      id: "kling-v3-text-to-video",
      provider: "kling",
      providerModelId: null,
      displayName: "Kling 3.0 Text to Video",
      type: "video",
      status: "published",
      sourceUrls: [],
      endpoint: {
        method: "POST",
        path: "/v1/videos/text2video",
      },
      modelParameter: {
        path: ["model_name"],
        source: "runtime",
      },
      fields,
      groups: [
        {
          id: "output",
          label: "Output",
          fieldIds: ["aspectRatio", "duration", "generateAudio"],
          advanced: false,
        },
      ],
      transforms: [],
      validationRules: ["klingTextToVideoRules"],
    },
  };
}

function createField(overrides: Partial<VideoFieldSpec>): VideoFieldSpec {
  return {
    id: "aspectRatio",
    label: "Field",
    componentKind: "select",
    valueKind: "string",
    required: false,
    advanced: false,
    omitWhenEmpty: true,
    omitWhenDefault: false,
    notes: [],
    ...overrides,
  };
}
