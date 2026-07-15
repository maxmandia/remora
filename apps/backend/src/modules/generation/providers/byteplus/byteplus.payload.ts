import { ModelFieldPayloadBuilder } from "../../model-field-payload.ts";

import type { SignedGenerationAttachmentMedia } from "../../../generation-attachment-media/generation-attachment-media.types.ts";
import type { VideoModelSpec } from "../../../model/model.types.ts";
import type {
  SeedanceAudioInput,
  SeedanceContentItem,
  SeedanceImageInput,
  SeedancePayloadBuildInput,
  SeedanceVideoInput,
  SeedanceVideoTaskPayloadInput,
  SeedanceVideoTaskRequest,
} from "./byteplus.types.ts";
import type { ModelFieldPayloadValue } from "../../model-field-payload.ts";

const bytePlusProviderId = "byteplus";

export class SeedancePayloadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SeedancePayloadError";
  }
}

export function buildSeedanceVideoTaskRequest({
  spec,
  input,
}: SeedancePayloadBuildInput): SeedanceVideoTaskRequest {
  assertSeedanceSpec(spec);
  validateSeedanceInput(input);

  const payload: Record<string, unknown> = {};
  const payloadBuilder = new ModelFieldPayloadBuilder(payload);

  payloadBuilder.setProviderValue(
    spec.modelParameter.path,
    spec.providerModelId,
  );
  payload.content = buildSeedanceContent(input);
  payloadBuilder.applyFieldValues({
    fields: spec.fields,
    values: toSeedanceFieldValues(input),
  });

  return payload as SeedanceVideoTaskRequest;
}

function assertSeedanceSpec(spec: VideoModelSpec) {
  if (spec.provider !== bytePlusProviderId) {
    throw new SeedancePayloadError(
      "Seedance payloads require the BytePlus Seedance model spec",
    );
  }

  if (!spec.providerModelId) {
    throw new SeedancePayloadError(
      "Seedance model spec is missing providerModelId",
    );
  }

  if (spec.modelParameter.source !== "spec") {
    throw new SeedancePayloadError(
      "Seedance model spec must provide the model parameter from spec",
    );
  }

  if (
    !spec.transforms.some(
      (transform) => transform.kind === "seedanceContentArray",
    )
  ) {
    throw new SeedancePayloadError(
      "Seedance model spec is missing the content-array transform",
    );
  }
}

function validateSeedanceInput(input: SeedanceVideoTaskPayloadInput) {
  const prompt = input.prompt?.trim();
  const images = input.images ?? [];
  const videos = input.videos ?? [];
  const audios = input.audios ?? [];
  const hasDraftTask = Boolean(input.draftTaskId?.trim());

  if (
    hasDraftTask &&
    (prompt || images.length > 0 || videos.length > 0 || audios.length > 0)
  ) {
    throw new SeedancePayloadError(
      "draftTaskId cannot be combined with prompt or references",
    );
  }

  if (!hasDraftTask && !prompt && images.length === 0 && videos.length === 0) {
    throw new SeedancePayloadError(
      "Seedance input requires a prompt, image, video, or draft task",
    );
  }

  if (images.length > 9) {
    throw new SeedancePayloadError(
      "Seedance supports at most 9 reference images",
    );
  }

  if (videos.length > 3) {
    throw new SeedancePayloadError(
      "Seedance supports at most 3 reference videos",
    );
  }

  if (audios.length > 3) {
    throw new SeedancePayloadError(
      "Seedance supports at most 3 reference audio files",
    );
  }

  if (audios.length > 0 && images.length === 0 && videos.length === 0) {
    throw new SeedancePayloadError(
      "Seedance audio references require at least one image or video reference",
    );
  }

  const firstFrameCount = images.filter(
    (image) => image.role === "first_frame",
  ).length;
  const lastFrameCount = images.filter(
    (image) => image.role === "last_frame",
  ).length;

  if (firstFrameCount > 1) {
    throw new SeedancePayloadError(
      "Seedance supports at most one first-frame image",
    );
  }

  if (lastFrameCount > 1) {
    throw new SeedancePayloadError(
      "Seedance supports at most one last-frame image",
    );
  }

  if (lastFrameCount > 0 && firstFrameCount === 0) {
    throw new SeedancePayloadError(
      "Seedance last-frame images require a first-frame image",
    );
  }

  if (
    firstFrameCount + lastFrameCount > 0 &&
    (images.some((image) => !image.role || image.role === "reference_image") ||
      videos.length > 0 ||
      audios.length > 0)
  ) {
    throw new SeedancePayloadError(
      "Seedance reference attachments cannot be combined with first-frame or last-frame images",
    );
  }

  if (input.serviceTier && input.serviceTier !== "default") {
    throw new SeedancePayloadError(
      "Seedance 2.0 only supports the default online service tier",
    );
  }
}

function buildSeedanceContent(
  input: SeedanceVideoTaskPayloadInput,
): SeedanceContentItem[] {
  const draftTaskId = input.draftTaskId?.trim();

  if (draftTaskId) {
    return [
      {
        type: "draft_task",
        draft_task: { id: draftTaskId },
      },
    ];
  }

  const content: SeedanceContentItem[] = [];
  const prompt = input.prompt?.trim();

  if (prompt) {
    content.push({
      type: "text",
      text: prompt,
    });
  }

  for (const image of input.images ?? []) {
    content.push({
      type: "image_url",
      image_url: { url: image.url },
      ...(image.role ? { role: image.role } : {}),
    });
  }

  for (const video of input.videos ?? []) {
    content.push({
      type: "video_url",
      video_url: { url: video.url },
      role: video.role ?? "reference_video",
    });
  }

  for (const audio of input.audios ?? []) {
    content.push({
      type: "audio_url",
      audio_url: { url: audio.url },
      role: audio.role ?? "reference_audio",
    });
  }

  return content;
}

export function toSeedanceAttachmentMedia(
  media: SignedGenerationAttachmentMedia[],
): {
  images: SeedanceImageInput[];
  videos: SeedanceVideoInput[];
  audios: SeedanceAudioInput[];
} {
  return {
    images: media
      .filter((item) => item.fieldId === "images")
      .map((item) => ({
        url: item.url,
        role: toSeedanceImageRole(item.role),
      })),
    videos: media
      .filter((item) => item.fieldId === "videos")
      .map((item) => ({ url: item.url, role: "reference_video" })),
    audios: media
      .filter((item) => item.fieldId === "audios")
      .map((item) => ({ url: item.url, role: "reference_audio" })),
  };
}

function toSeedanceFieldValues(input: SeedanceVideoTaskPayloadInput) {
  return new Map<string, ModelFieldPayloadValue>([
    ["resolution", input.resolution],
    ["aspectRatio", input.aspectRatio],
    ["duration", input.duration],
    ["generateAudio", input.generateAudio],
    ["watermark", input.watermark],
    ["seed", input.seed],
    ["returnLastFrame", input.returnLastFrame],
    ["priority", input.priority],
    ["safetyIdentifier", input.safetyIdentifier],
    ["callbackUrl", input.callbackUrl],
    ["executionExpiresAfter", input.executionExpiresAfter],
    ["serviceTier", input.serviceTier],
    ["draft", input.draft],
    ["frames", input.frames],
    ["cameraFixed", input.cameraFixed],
  ]);
}

function toSeedanceImageRole(
  role: SignedGenerationAttachmentMedia["role"],
): SeedanceImageInput["role"] {
  switch (role) {
    case "firstFrame":
      return "first_frame";
    case "lastFrame":
      return "last_frame";
    case "reference":
      return "reference_image";
  }
}
