/** @vitest-environment jsdom */

import type { SignedGenerationThreadAttachmentMedia } from "@remora/domain/generation-attachment-media/dto";
import type { PublishedGenerationModelSummary } from "@remora/domain/generation-model/dto";
import type { VideoGenerationThreadSubmission } from "@remora/domain/generation-submission/dto";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useEditGenerationSubmission } from "./use-edit-generation-submission.ts";

const mocks = vi.hoisted(() => ({
  attachmentMediaQuery:
    vi.fn<() => Promise<SignedGenerationThreadAttachmentMedia[]>>(),
  attachmentMediaQueryOptions: vi.fn(),
  toastError: vi.fn(),
  toastInfo: vi.fn(),
}));

vi.mock("../trpc.ts", () => ({
  useTRPC: () => ({
    generation: {
      listAttachmentMediaFromSubmission: {
        queryOptions: mocks.attachmentMediaQueryOptions,
      },
    },
  }),
}));

vi.mock("@remora/ui", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@remora/ui")>();

  return {
    ...actual,
    toast: {
      error: mocks.toastError,
      info: mocks.toastInfo,
    },
  };
});

describe("useEditGenerationSubmission", () => {
  beforeEach(() => {
    mocks.attachmentMediaQuery.mockReset();
    mocks.attachmentMediaQuery.mockResolvedValue([createSignedMedia()]);
    mocks.attachmentMediaQueryOptions.mockReset();
    mocks.attachmentMediaQueryOptions.mockImplementation((input, options) => ({
      ...options,
      queryKey: ["generation", "listAttachmentMediaFromSubmission", input],
      queryFn: mocks.attachmentMediaQuery,
    }));
    mocks.toastError.mockReset();
    mocks.toastInfo.mockReset();
  });

  it("loads stored media and applies a latest-model composer draft", async () => {
    const onApply = vi.fn();
    const submission = createSubmission();
    const { result } = renderEditor({ models: [createModel()], onApply });

    await act(() => result.current.editGenerationSubmission(submission));

    expect(mocks.attachmentMediaQueryOptions).toHaveBeenCalledWith(
      { submissionId: submission.id },
      { meta: { suppressErrorToast: true } },
    );
    expect(onApply).toHaveBeenCalledWith({
      model: expect.objectContaining({ id: "test-model" }),
      prompt: "Restore this prompt",
      settings: {
        modelType: "video",
        aspectRatio: "16:9",
        resolution: "1080p",
        duration: 10,
        generateAudio: true,
        requestedGenerations: 2,
      },
      attachmentMedia: {
        images: [
          expect.objectContaining({
            source: "stored",
            id: "attachment_1",
            role: "reference",
          }),
        ],
        videos: [],
        audios: [],
      },
    });
    expect(mocks.toastInfo).toHaveBeenCalledWith(
      "Some settings were updated to match the latest model version.",
    );
  });

  it("leaves the composer untouched when the model is unavailable", async () => {
    const onApply = vi.fn();
    const { result } = renderEditor({ models: [], onApply });

    await act(() =>
      result.current.editGenerationSubmission(createSubmission()),
    );

    expect(onApply).not.toHaveBeenCalled();
    expect(mocks.attachmentMediaQuery).not.toHaveBeenCalled();
    expect(mocks.toastError).toHaveBeenCalledWith(
      "This generation model is no longer available.",
    );
  });

  it("leaves the composer untouched when references cannot be loaded", async () => {
    const onApply = vi.fn();
    mocks.attachmentMediaQuery.mockRejectedValueOnce(new Error("unavailable"));
    const { result } = renderEditor({ models: [createModel()], onApply });

    await act(() =>
      result.current.editGenerationSubmission(createSubmission()),
    );

    expect(onApply).not.toHaveBeenCalled();
    expect(mocks.toastError).toHaveBeenCalledWith(
      "This generation's references could not be loaded.",
    );
  });
});

function renderEditor({
  models,
  onApply,
}: {
  models: PublishedGenerationModelSummary[];
  onApply: Parameters<typeof useEditGenerationSubmission>[0]["onApply"];
}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return renderHook(() => useEditGenerationSubmission({ models, onApply }), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    ),
  });
}

function createModel(): PublishedGenerationModelSummary {
  return {
    id: "test-model",
    providerId: "byteplus",
    providerName: "BytePlus",
    displayName: "Test Model",
    type: "video",
    latestSpecId: "test-model-v2",
    latestSpecVersion: 2,
    spec: {
      schemaVersion: 1,
      id: "test-model",
      provider: "byteplus",
      providerModelId: "test-model-v2",
      displayName: "Test Model",
      type: "video",
      status: "published",
      sourceUrls: [],
      endpoint: { method: "POST", path: "/generate" },
      modelParameter: { path: ["model"], source: "spec" },
      fields: [
        createField("prompt", "promptTextarea", "string", ""),
        createField("resolution", "select", "string", "1080p", [
          { label: "1080p", value: "1080p" },
        ]),
        createField("aspectRatio", "select", "string", "16:9", [
          { label: "16:9", value: "16:9" },
        ]),
        createField("duration", "select", "integer", 5, [
          { label: "5s", value: 5 },
          { label: "10s", value: 10 },
        ]),
        createField("generateAudio", "toggle", "boolean", true, [
          { label: "On", value: true },
          { label: "Off", value: false },
        ]),
      ],
      groups: [
        {
          id: "generation",
          label: "Generation",
          fieldIds: [
            "prompt",
            "resolution",
            "aspectRatio",
            "duration",
            "generateAudio",
          ],
          advanced: false,
        },
      ],
      transforms: [],
      validationRules: [],
    },
  };
}

function createField(
  id: string,
  componentKind: "promptTextarea" | "select" | "toggle",
  valueKind: "string" | "integer" | "boolean",
  defaultValue: string | number | boolean,
  options?: Array<{ label: string; value: string | number | boolean }>,
) {
  return {
    id,
    label: id,
    componentKind,
    valueKind,
    required: false,
    advanced: false,
    defaultValue,
    omitWhenEmpty: true,
    omitWhenDefault: false,
    options,
    notes: [],
  } as PublishedGenerationModelSummary["spec"]["fields"][number];
}

function createSubmission(): VideoGenerationThreadSubmission {
  return {
    id: "submission_1",
    threadId: "thread_1",
    userId: "user_1",
    modelId: "test-model",
    modelDisplayName: "Test Model",
    modelType: "video",
    modelSpecId: "test-model-v1",
    submittedInput: {
      prompt: "Restore this prompt",
      resolution: "720p",
      aspectRatio: "16:9",
      duration: 10,
      generateAudio: true,
      draft: false,
    },
    requestedGenerations: 2,
    attachmentMedia: { images: [], videos: [], audios: [] },
    createdAt: "2026-06-15T11:00:00.000Z",
    updatedAt: "2026-06-15T11:00:00.000Z",
    jobs: [],
  };
}

function createSignedMedia(): SignedGenerationThreadAttachmentMedia {
  return {
    id: "attachment_1",
    kind: "image",
    fieldId: "images",
    role: "reference",
    originalFileName: "reference.png",
    contentType: "image/png",
    contentLength: 5,
    metadata: {
      widthPx: 1024,
      heightPx: 576,
      durationSec: null,
      fps: null,
    },
    createdAt: "2026-06-15T11:00:00.000Z",
    url: "https://assets.example/reference.png",
    urlExpiresAt: "2026-06-15T12:00:00.000Z",
  };
}
