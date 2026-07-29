import type { SignedGenerationAttachmentMedia } from "../../../generation-attachment-media/generation-attachment-media.types.ts";
import type { ImageModelSpec } from "../../../model/model.types.ts";
import type { ImageGenerationSubmissionInput } from "../../generation.types.ts";

export type OpenAIImageSize = "1024x1024" | "1536x1024" | "1024x1536";

export type OpenAIInputImageContentType =
  | "image/jpeg"
  | "image/png"
  | "image/webp";

export type OpenAISignedImageAttachment = SignedGenerationAttachmentMedia & {
  contentType: string | null;
  contentLength: number | null;
};

export type OpenAIImageGenerationInput = {
  submittedInput: ImageGenerationSubmissionInput;
  attachmentMedia: OpenAISignedImageAttachment[];
};

export type OpenAIGenerateImageInput = {
  jobId: string;
  spec: ImageModelSpec;
  input: OpenAIImageGenerationInput;
};

export type OpenAIImageGenerateRequest = {
  model: "gpt-image-2-2026-04-21";
  prompt: string;
  n: 1;
  quality: "high";
  output_format: "jpeg";
  size: OpenAIImageSize;
};

export type OpenAIImageEditRequest = OpenAIImageGenerateRequest & {
  images: Array<{ image_url: string }>;
};

export type OpenAIImageGenerationUsage = {
  inputTokens: number;
  inputTextTokens: number;
  inputImageTokens: number;
  outputTextTokens: null;
  outputImageTokens: number;
  thoughtTokens: null;
  totalTokens: number;
};

export type SanitizedOpenAIImagePayload = {
  created: number | null;
  outputFormat: "jpeg";
  quality: "high";
  size: OpenAIImageSize;
  usage: OpenAIImageGenerationUsage;
  output: {
    imageCount: 1;
    selectedImageContentType: "image/jpeg";
  };
};

export type OpenAIImageGenerationResult = {
  provider: "openai";
  providerTaskId: string;
  providerModelId: "gpt-image-2-2026-04-21";
  image: {
    data: Buffer;
    contentType: "image/jpeg";
    contentLength: number;
  };
  usage: OpenAIImageGenerationUsage;
  rawPayload: SanitizedOpenAIImagePayload;
  receivedAt: string;
};

type OpenAIProviderErrorOptions = {
  code: string;
  retryable: boolean;
  statusCode?: number | null;
  requestId?: string | null;
  providerMessage?: string | null;
};

export class OpenAIProviderError extends Error {
  readonly code: string;
  readonly retryable: boolean;
  readonly statusCode: number | null;
  readonly requestId: string | null;
  readonly providerMessage: string | null;

  constructor(message: string, options: OpenAIProviderErrorOptions) {
    super(message);
    this.name = "OpenAIProviderError";
    this.code = options.code;
    this.retryable = options.retryable;
    this.statusCode = options.statusCode ?? null;
    this.requestId = options.requestId ?? null;
    this.providerMessage = options.providerMessage ?? null;
  }
}
