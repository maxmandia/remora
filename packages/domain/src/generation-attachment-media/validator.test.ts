import { describe, expect, it } from "vitest";

import { validateGenerationAttachmentMediaRules } from "./validator.ts";

describe("generation attachment media rules", () => {
  it("reports Seedance audio attachments without an image or video attachment", () => {
    expect(
      validateGenerationAttachmentMediaRules({
        validationRules: ["seedance20ContentRules"],
        attachmentMedia: {
          images: [],
          videos: [],
          audios: ["voice.mp3"],
        },
      }),
    ).toEqual([
      {
        kind: "audioRequiresVisualAttachment",
        fieldId: "audios",
      },
    ]);
  });

  it("allows Seedance audio attachments with an image attachment", () => {
    expect(
      validateGenerationAttachmentMediaRules({
        validationRules: ["seedance20ContentRules"],
        attachmentMedia: {
          images: ["reference.png"],
          videos: [],
          audios: ["voice.mp3"],
        },
      }),
    ).toEqual([]);
  });

  it("allows Seedance audio attachments with a video attachment", () => {
    expect(
      validateGenerationAttachmentMediaRules({
        validationRules: ["seedance20ContentRules"],
        attachmentMedia: {
          images: [],
          videos: ["reference.mp4"],
          audios: ["voice.mp3"],
        },
      }),
    ).toEqual([]);
  });

  it("allows empty Seedance audio attachments", () => {
    expect(
      validateGenerationAttachmentMediaRules({
        validationRules: ["seedance20ContentRules"],
        attachmentMedia: {
          images: [],
          videos: [],
          audios: [],
        },
      }),
    ).toEqual([]);
  });

  it("does not apply attachment-media rules to Kling text-to-video specs", () => {
    expect(
      validateGenerationAttachmentMediaRules({
        validationRules: ["klingTextToVideoRules"],
        attachmentMedia: {
          images: [],
          videos: [],
          audios: ["voice.mp3"],
        },
      }),
    ).toEqual([]);
  });

  it("allows audio-only attachments without model validation rules", () => {
    expect(
      validateGenerationAttachmentMediaRules({
        validationRules: [],
        attachmentMedia: {
          images: [],
          videos: [],
          audios: ["voice.mp3"],
        },
      }),
    ).toEqual([]);
  });
});
