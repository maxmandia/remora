import type { VideoModelSpec } from "../../../model/model.types.ts";
import type { CreateVideoTaskInput } from "../../generation.types.ts";

export const bflVideoModes = ["t2v", "i2v", "v2v"] as const;
export type BflVideoMode = (typeof bflVideoModes)[number];

export const bflVideoAspectRatios = [
  "auto",
  "21:9",
  "2:1",
  "16:9",
  "4:3",
  "1:1",
  "3:4",
  "9:16",
] as const;
export type BflVideoAspectRatio = (typeof bflVideoAspectRatios)[number];

export type BflVideoResolution = "hd" | "fhd";

type BflVideoTaskRequestBase = {
  prompt: string;
  aspect_ratio: BflVideoAspectRatio;
  duration: number;
  resolution: BflVideoResolution;
  version: "latest";
  generate_audio: boolean;
  safety_tolerance: 4;
  draft: boolean;
};

export type BflVideoTaskRequest =
  | (BflVideoTaskRequestBase & { mode: "t2v" })
  | (BflVideoTaskRequestBase & {
      mode: "i2v";
      keyframes: string[];
    })
  | (BflVideoTaskRequestBase & {
      mode: "v2v";
      start_video: string;
    })
  | {
      mode: "draft_enhance";
      draft_cache: string;
      resolution: BflVideoResolution;
      safety_tolerance: 4;
    };

export type BflVideoTaskBuildInput = {
  spec: VideoModelSpec;
  input: CreateVideoTaskInput;
};

export class BflProviderError extends Error {
  readonly code: string | null;
  readonly providerMessage: string | null;
  readonly retryable: boolean;
  readonly statusCode: number | null;

  constructor({
    code,
    message,
    providerMessage,
    retryable,
    statusCode,
  }: {
    code: string | null;
    message: string;
    providerMessage: string | null;
    retryable: boolean;
    statusCode: number | null;
  }) {
    super(message);
    this.name = "BflProviderError";
    this.code = code;
    this.providerMessage = providerMessage;
    this.retryable = retryable;
    this.statusCode = statusCode;
  }
}

export class BflPayloadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BflPayloadError";
  }
}
