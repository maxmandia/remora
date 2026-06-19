import { describe, expect, it } from "vitest";

import { validateGenerationReferenceMediaRules } from "./validator.ts";

describe("generation reference media rules", () => {
  it("reports Seedance audio references without an image or video reference", () => {
    expect(
      validateGenerationReferenceMediaRules({
        validationRules: ["seedance20ContentRules"],
        referenceMedia: {
          images: [],
          videos: [],
          audios: ["voice.mp3"],
        },
      }),
    ).toEqual([
      {
        kind: "audioRequiresVisualReference",
        fieldId: "audios",
      },
    ]);
  });

  it("allows Seedance audio references with an image reference", () => {
    expect(
      validateGenerationReferenceMediaRules({
        validationRules: ["seedance20ContentRules"],
        referenceMedia: {
          images: ["reference.png"],
          videos: [],
          audios: ["voice.mp3"],
        },
      }),
    ).toEqual([]);
  });

  it("allows Seedance audio references with a video reference", () => {
    expect(
      validateGenerationReferenceMediaRules({
        validationRules: ["seedance20ContentRules"],
        referenceMedia: {
          images: [],
          videos: ["reference.mp4"],
          audios: ["voice.mp3"],
        },
      }),
    ).toEqual([]);
  });

  it("allows empty Seedance audio references", () => {
    expect(
      validateGenerationReferenceMediaRules({
        validationRules: ["seedance20ContentRules"],
        referenceMedia: {
          images: [],
          videos: [],
          audios: [],
        },
      }),
    ).toEqual([]);
  });

  it("does not apply reference-media rules to Kling text-to-video specs", () => {
    expect(
      validateGenerationReferenceMediaRules({
        validationRules: ["klingTextToVideoRules"],
        referenceMedia: {
          images: [],
          videos: [],
          audios: ["voice.mp3"],
        },
      }),
    ).toEqual([]);
  });

  it("allows audio-only references without model validation rules", () => {
    expect(
      validateGenerationReferenceMediaRules({
        validationRules: [],
        referenceMedia: {
          images: [],
          videos: [],
          audios: ["voice.mp3"],
        },
      }),
    ).toEqual([]);
  });
});
