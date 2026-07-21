import { parseGeminiProviderEnv } from "@remora/env";

import type {
  GoogleGenerateImageInput,
  GoogleImageGenerationResult,
} from "./google.types.ts";
import { GoogleProviderError } from "./google.types.ts";
import {
  buildGoogleImageInteractionRequest,
  formatGoogleHttpErrorMessage,
  parseGoogleImageInteractionResponse,
  readGoogleHttpErrorCode,
  readSafeGoogleHttpErrorMessage,
} from "./google.utils.ts";

type Fetch = typeof fetch;

type GoogleServiceOptions = {
  environment?: NodeJS.ProcessEnv;
  fetcher?: Fetch;
  now?: () => Date;
};

export class GoogleService {
  private readonly environment: NodeJS.ProcessEnv;
  private readonly fetcher: Fetch;
  private readonly now: () => Date;

  constructor({
    environment = process.env,
    fetcher = fetch,
    now = () => new Date(),
  }: GoogleServiceOptions = {}) {
    this.environment = environment;
    this.fetcher = fetcher;
    this.now = now;
  }

  async generateImage(
    input: GoogleGenerateImageInput,
  ): Promise<GoogleImageGenerationResult> {
    const environment = this.parseEnvironment();
    const request = buildGoogleImageInteractionRequest(input);
    const response = await this.requestInteraction({
      baseUrl: environment.GEMINI_API_BASE_URL,
      apiKey: environment.GEMINI_API_KEY,
      path: input.spec.endpoint.path,
      request,
    });

    return parseGoogleImageInteractionResponse({
      value: response,
      providerModelId: request.model,
      fallbackProviderTaskId: `google-stateless:${input.jobId}`,
      receivedAt: this.now().toISOString(),
    });
  }

  private parseEnvironment() {
    try {
      return parseGeminiProviderEnv(this.environment);
    } catch {
      throw new GoogleProviderError("Google provider is not configured", {
        code: "PROVIDER_NOT_CONFIGURED",
      });
    }
  }

  private async requestInteraction({
    baseUrl,
    apiKey,
    path,
    request,
  }: {
    baseUrl: string;
    apiKey: string;
    path: string;
    request: ReturnType<typeof buildGoogleImageInteractionRequest>;
  }): Promise<unknown> {
    let response: Response;

    try {
      response = await this.fetcher(new URL(path, `${baseUrl}/`), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify(request),
      });
    } catch {
      throw new GoogleProviderError(
        "Google image request failed before a response was received",
        { code: "NETWORK_ERROR" },
      );
    }

    const body = await this.parseResponseBody(response);

    if (!response.ok) {
      const code = readGoogleHttpErrorCode(body, response.status);
      const providerMessage = readSafeGoogleHttpErrorMessage({
        value: body,
        sensitiveValues: [
          apiKey,
          request.input[0].content[0].text,
          ...request.input[0].content.flatMap((content) =>
            content.type === "image" ? [content.uri] : [],
          ),
        ],
      });

      throw new GoogleProviderError(
        formatGoogleHttpErrorMessage({
          message: "Google image request was rejected",
          providerMessage,
          statusCode: response.status,
          code,
        }),
        {
          code,
          statusCode: response.status,
          providerMessage,
        },
      );
    }

    return body;
  }

  private async parseResponseBody(response: Response): Promise<unknown> {
    let body: string;

    try {
      body = await response.text();
    } catch {
      throw new GoogleProviderError("Google image response could not be read", {
        code: "RESPONSE_READ_ERROR",
        statusCode: response.status,
      });
    }

    try {
      return JSON.parse(body) as unknown;
    } catch {
      throw new GoogleProviderError(
        "Google image response was not valid JSON",
        { code: "INVALID_JSON", statusCode: response.status },
      );
    }
  }
}

export const googleService = new GoogleService();
