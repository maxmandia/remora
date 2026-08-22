import type { Model3dModelSpec } from "../../../model/model.types.ts";
import type { CreateModel3dTaskInput } from "../../generation.types.ts";

export const tripoH31ModelId = "v3.1-20260211" as const;
export const tripoP1ModelId = "P1-20260311" as const;
export type TripoModelId = typeof tripoH31ModelId | typeof tripoP1ModelId;

export type TripoModel3dTaskBuildInput = {
  spec: Model3dModelSpec;
  input: CreateModel3dTaskInput;
};

type TripoTextureRequest =
  | { texture: false; pbr: false }
  | {
      texture: true;
      pbr: true;
      texture_quality: "standard" | "detailed";
    };

type TripoModel3dRequestBase = TripoTextureRequest & {
  model: TripoModelId;
  face_limit?: number;
  geometry_quality?: "standard" | "detailed";
};

export type TripoTextToModelRequest = TripoModel3dRequestBase & {
  prompt: string;
};

export type TripoImageToModelRequest = TripoModel3dRequestBase & {
  input: string;
};

export type TripoModel3dTaskRequest =
  | TripoTextToModelRequest
  | TripoImageToModelRequest;

export class TripoPayloadError extends Error {
  readonly retryable = false;

  constructor(message: string) {
    super(message);
    this.name = "TripoPayloadError";
  }
}

export class TripoProviderError extends Error {
  readonly code: string | null;
  readonly providerMessage: string | null;
  readonly retryable: boolean;
  readonly retryAfterMs: number | null;
  readonly statusCode: number | null;
  readonly requestId: string | null;

  constructor({
    code,
    message,
    providerMessage,
    retryable,
    retryAfterMs = null,
    statusCode,
    requestId = null,
  }: {
    code: string | null;
    message: string;
    providerMessage: string | null;
    retryable: boolean;
    retryAfterMs?: number | null;
    statusCode: number | null;
    requestId?: string | null;
  }) {
    super(message);
    this.name = "TripoProviderError";
    this.code = code;
    this.providerMessage = providerMessage;
    this.retryable = retryable;
    this.retryAfterMs = retryAfterMs;
    this.statusCode = statusCode;
    this.requestId = requestId;
  }
}
