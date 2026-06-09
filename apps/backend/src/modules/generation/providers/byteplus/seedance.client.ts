import type {
  CreateSeedanceVideoTaskResult,
  RetrieveSeedanceVideoTaskResult,
  SeedanceProviderError,
  SeedanceProviderStatus,
  SeedanceUsage,
  SeedanceVideoTaskRequest,
} from "../../generation.types.ts";
import {
  isJsonObject,
  ProviderHttpError,
  requestProviderJson,
} from "../provider-http.ts";

type Fetch = typeof fetch;

export type BytePlusSeedanceClientConfig = {
  apiKey: string;
  baseUrl: string;
  fetcher?: Fetch;
};

export class BytePlusSeedanceClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly fetcher: Fetch;

  constructor({
    apiKey,
    baseUrl,
    fetcher = fetch,
  }: BytePlusSeedanceClientConfig) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
    this.fetcher = fetcher;
  }

  async createSeedanceVideoTask(
    request: SeedanceVideoTaskRequest,
  ): Promise<CreateSeedanceVideoTaskResult> {
    const response = await requestProviderJson({
      providerName: "BytePlus",
      baseUrl: this.baseUrl,
      fetcher: this.fetcher,
      path: "/contents/generations/tasks",
      init: {
        method: "POST",
        body: JSON.stringify(request),
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
      },
    });

    return this.parseCreateResponse(response, request.model);
  }

  async retrieveSeedanceVideoTask(
    providerTaskId: string,
  ): Promise<RetrieveSeedanceVideoTaskResult> {
    const response = await requestProviderJson({
      providerName: "BytePlus",
      baseUrl: this.baseUrl,
      fetcher: this.fetcher,
      path: `/contents/generations/tasks/${encodeURIComponent(providerTaskId)}`,
      init: {
        method: "GET",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
      },
    });

    return BytePlusSeedanceClient.normalizeSeedanceVideoTaskResponse(response);
  }

  static normalizeSeedanceVideoTaskResponse(
    value: unknown,
  ): RetrieveSeedanceVideoTaskResult {
    if (
      !isJsonObject(value) ||
      typeof value.id !== "string" ||
      !BytePlusSeedanceClient.isProviderStatus(value.status)
    ) {
      throw new ProviderHttpError(
        "BytePlus",
        "retrieve response was malformed",
        {
          statusCode: null,
          code: null,
          providerMessage: null,
        },
      );
    }

    return {
      provider: "byteplus",
      providerTaskId: value.id,
      providerModelId: typeof value.model === "string" ? value.model : null,
      status: value.status,
      videoUrl: BytePlusSeedanceClient.parseContentUrl(
        value.content,
        "video_url",
      ),
      lastFrameUrl: BytePlusSeedanceClient.parseContentUrl(
        value.content,
        "last_frame_url",
      ),
      usage: BytePlusSeedanceClient.parseUsage(value.usage),
      createdAt: typeof value.created_at === "number" ? value.created_at : null,
      updatedAt: typeof value.updated_at === "number" ? value.updated_at : null,
      providerError: BytePlusSeedanceClient.parseTaskError(value.error),
    };
  }

  private parseCreateResponse(
    value: unknown,
    providerModelId: string,
  ): CreateSeedanceVideoTaskResult {
    if (!isJsonObject(value) || typeof value.id !== "string") {
      throw new ProviderHttpError("BytePlus", "create response was malformed", {
        statusCode: null,
        code: null,
        providerMessage: null,
      });
    }

    return {
      provider: "byteplus",
      providerTaskId: value.id,
      providerModelId,
    };
  }

  private static parseContentUrl(
    content: unknown,
    key: "video_url" | "last_frame_url",
  ) {
    if (!isJsonObject(content)) {
      return null;
    }

    return typeof content[key] === "string" ? content[key] : null;
  }

  private static parseUsage(usage: unknown): SeedanceUsage | null {
    if (!isJsonObject(usage)) {
      return null;
    }

    return {
      completionTokens:
        typeof usage.completion_tokens === "number"
          ? usage.completion_tokens
          : null,
      totalTokens:
        typeof usage.total_tokens === "number" ? usage.total_tokens : null,
    };
  }

  private static parseTaskError(error: unknown): SeedanceProviderError | null {
    if (!isJsonObject(error)) {
      return null;
    }

    return {
      code: typeof error.code === "string" ? error.code : null,
      message: typeof error.message === "string" ? error.message : null,
    };
  }

  private static isProviderStatus(
    status: unknown,
  ): status is SeedanceProviderStatus {
    return (
      status === "queued" ||
      status === "running" ||
      status === "cancelled" ||
      status === "succeeded" ||
      status === "failed" ||
      status === "expired"
    );
  }
}
