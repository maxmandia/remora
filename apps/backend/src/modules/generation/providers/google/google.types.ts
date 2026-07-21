import type { ImageModelSpec } from "../../../model/model.types.ts";
import type { SignedGenerationAttachmentMedia } from "../../../generation-attachment-media/generation-attachment-media.types.ts";
import type { ImageGenerationSubmissionInput } from "../../generation.types.ts";

export type GoogleImageResolution = "512" | "1K" | "2K" | "4K";

export type GoogleImageAspectRatio =
  | "1:1"
  | "1:4"
  | "1:8"
  | "2:3"
  | "3:2"
  | "3:4"
  | "4:1"
  | "4:3"
  | "4:5"
  | "5:4"
  | "8:1"
  | "9:16"
  | "16:9"
  | "21:9";

export type GoogleInputImageContentType =
  | "image/jpeg"
  | "image/png"
  | "image/webp"
  | "image/bmp";

export type GoogleSignedImageAttachment = SignedGenerationAttachmentMedia & {
  contentType: string | null;
  contentLength: number | null;
};

export type GoogleImageGenerationInput = {
  submittedInput: ImageGenerationSubmissionInput;
  attachmentMedia: GoogleSignedImageAttachment[];
};

export type GoogleGenerateImageInput = {
  jobId: string;
  spec: ImageModelSpec;
  input: GoogleImageGenerationInput;
};

export type GoogleImageInteractionRequest = {
  model: string;
  input: [
    {
      type: "user_input";
      content: [
        { type: "text"; text: string },
        ...Array<{
          type: "image";
          uri: string;
          mime_type: GoogleInputImageContentType;
        }>,
      ];
    },
  ];
  response_format: {
    type: "image";
    mime_type: "image/jpeg";
    aspect_ratio: GoogleImageAspectRatio;
    image_size: GoogleImageResolution;
  };
  store: false;
};

export type GoogleImageGenerationUsage = {
  inputTokens: number | null;
  outputTextTokens: number | null;
  outputImageTokens: number | null;
  thoughtTokens: number | null;
  totalTokens: number | null;
};

export type SanitizedGoogleInteractionStep = {
  type: string;
  content: Array<{
    type: string;
    mimeType: string | null;
  }>;
};

export type SanitizedGoogleInteractionPayload = {
  id: string | null;
  model: string;
  status: "completed";
  created: string | null;
  updated: string | null;
  usage: GoogleImageGenerationUsage | null;
  output: {
    imageCount: number;
    selectedImageContentType: "image/jpeg";
  };
  steps: SanitizedGoogleInteractionStep[];
};

export type GoogleImageGenerationResult = {
  provider: "google";
  providerTaskId: string;
  providerModelId: string;
  image: {
    data: Buffer;
    contentType: "image/jpeg";
    contentLength: number;
  };
  usage: GoogleImageGenerationUsage | null;
  rawPayload: SanitizedGoogleInteractionPayload;
  receivedAt: string;
};

export type GoogleInteractionStatus =
  | "in_progress"
  | "requires_action"
  | "completed"
  | "failed"
  | "cancelled"
  | "incomplete"
  | "budget_exceeded"
  | "queued";

type GoogleProviderErrorOptions = {
  code: string;
  statusCode?: number | null;
  interactionStatus?: GoogleInteractionStatus | null;
  providerMessage?: string | null;
};

export class GoogleProviderError extends Error {
  readonly code: string;
  readonly statusCode: number | null;
  readonly interactionStatus: GoogleInteractionStatus | null;
  readonly providerMessage: string | null;

  constructor(message: string, options: GoogleProviderErrorOptions) {
    super(message);
    this.name = "GoogleProviderError";
    this.code = options.code;
    this.statusCode = options.statusCode ?? null;
    this.interactionStatus = options.interactionStatus ?? null;
    this.providerMessage = options.providerMessage ?? null;
  }
}
