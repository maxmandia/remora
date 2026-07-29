import { getOpenAIClient } from "../../../../clients/openai/openai.ts";
import type {
  OpenAIGenerateImageInput,
  OpenAIImageEditRequest,
  OpenAIImageGenerateRequest,
  OpenAIImageGenerationResult,
} from "./openai.types.ts";
import { OpenAIProviderError } from "./openai.types.ts";
import {
  buildOpenAIImageRequest,
  isOpenAIImageEditRequest,
  openAIImageEditPath,
  openAIImageModelId,
  parseOpenAIImageResponse,
  sanitizeOpenAIProviderMessage,
} from "./openai.utils.ts";

type OpenAIImageClient = {
  images: {
    generate(
      input: OpenAIImageGenerateRequest,
      options: { maxRetries: 0 },
    ): Promise<unknown>;
  };
  post(
    path: string,
    options: { body: OpenAIImageEditRequest; maxRetries: 0 },
  ): Promise<unknown>;
};

type OpenAIServiceOptions = {
  clientFactory?: () => OpenAIImageClient;
  now?: () => Date;
};

export class OpenAIService {
  private readonly clientFactory: () => OpenAIImageClient;
  private readonly now: () => Date;

  constructor({
    clientFactory = () => getOpenAIClient() as OpenAIImageClient,
    now = () => new Date(),
  }: OpenAIServiceOptions = {}) {
    this.clientFactory = clientFactory;
    this.now = now;
  }

  async generateImage(
    input: OpenAIGenerateImageInput,
  ): Promise<OpenAIImageGenerationResult> {
    const request = buildOpenAIImageRequest(input);
    const sensitiveValues = [
      request.prompt,
      ...(isOpenAIImageEditRequest(request)
        ? request.images.map((image) => image.image_url)
        : []),
    ];
    let response: unknown;
    let client: OpenAIImageClient;

    try {
      client = this.clientFactory();
    } catch {
      throw new OpenAIProviderError("OpenAI provider is not configured", {
        code: "PROVIDER_NOT_CONFIGURED",
        retryable: false,
      });
    }

    try {
      response = isOpenAIImageEditRequest(request)
        ? await client.post(openAIImageEditPath, {
            body: request,
            maxRetries: 0,
          })
        : await client.images.generate(request, { maxRetries: 0 });
    } catch (error) {
      if (error instanceof OpenAIProviderError) {
        throw error;
      }

      throw this.toProviderError(error, sensitiveValues);
    }

    return parseOpenAIImageResponse({
      value: response,
      providerTaskId: `openai-stateless:${input.jobId}`,
      providerModelId: openAIImageModelId,
      expectedSize: request.size,
      receivedAt: this.now().toISOString(),
    });
  }

  private toProviderError(
    error: unknown,
    sensitiveValues: readonly string[],
  ): OpenAIProviderError {
    const details =
      error && typeof error === "object"
        ? (error as Record<string, unknown>)
        : {};
    const statusCode =
      typeof details.status === "number" &&
      Number.isInteger(details.status) &&
      details.status >= 100
        ? details.status
        : null;
    const code =
      typeof details.code === "string" && details.code.trim()
        ? details.code.trim()
        : statusCode === null
          ? "NETWORK_ERROR"
          : `HTTP_${statusCode}`;
    const requestId =
      typeof details.requestID === "string" && details.requestID.trim()
        ? details.requestID.trim()
        : null;
    const providerMessage = sanitizeOpenAIProviderMessage({
      message: details.message,
      sensitiveValues,
    });
    const retryable =
      statusCode === null || statusCode === 429 || statusCode >= 500;

    return new OpenAIProviderError(
      [
        retryable
          ? "OpenAI image request failed"
          : "OpenAI image request was rejected",
        providerMessage ? `: ${providerMessage}` : "",
        statusCode === null ? "" : ` (HTTP ${statusCode}, code ${code})`,
      ].join(""),
      {
        code,
        retryable,
        statusCode,
        requestId,
        providerMessage,
      },
    );
  }
}

export const openAIService = new OpenAIService();
