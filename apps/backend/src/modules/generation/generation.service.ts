import { createHash, randomBytes } from "node:crypto";

import { parseBytePlusProviderEnv } from "@remora/env";
import type {
  JsonPrimitive,
  VideoFieldSpec,
  VideoModelSpec,
} from "../model/types.ts";
import {
  objectStorageService,
  type SignedObjectUrl,
} from "../storage/object-storage.service.ts";
import type { GenerationRepository } from "./generation.repository.ts";
import { generationRepository } from "./generation.repository.ts";
import type {
  CreatedVideoGenerationSubmission,
  CreateSeedanceVideoTaskInput,
  CreateSeedanceVideoTaskResult,
  CreateVideoGenerationFieldId,
  CreateVideoGenerationInput,
  GenerationSubmissionInput,
  GenerationThreadJobResult,
  GenerationThreadSubmission,
  RetrieveSeedanceVideoTaskInput,
  RetrieveSeedanceVideoTaskResult,
} from "./generation.types.ts";
import {
  createVideoGenerationFieldIds,
  GenerationInputValidationError,
  isSupportedVideoGenerationModelId,
  maxRequestedGenerations,
  minRequestedGenerations,
  UnsupportedGenerationModelError,
} from "./generation.types.ts";
import { BytePlusSeedanceClient } from "./providers/byteplus/seedance.client.ts";
import { buildSeedanceVideoTaskRequest } from "./providers/byteplus/seedance.payload.ts";

type ObjectStorageReader = {
  createSignedGetUrlWithExpiration(reference: {
    bucket: string;
    objectKey: string;
  }): Promise<SignedObjectUrl>;
};

export class GenerationService {
  constructor(
    private readonly repository: GenerationRepository = generationRepository,
    private readonly storage: ObjectStorageReader = objectStorageService,
  ) {}

  async listSubmissionsFromThread({
    userId,
    threadId,
  }: {
    userId: string;
    threadId: string;
  }): Promise<GenerationThreadSubmission[]> {
    const submissions = await this.repository.listSubmissionsFromThread({
      userId,
      threadId,
    });

    for (const submission of submissions) {
      for (const job of submission.jobs) {
        if (!job.result?.assets?.length) {
          continue;
        }

        for (const asset of job.result.assets) {
          this.applySignedVideoAssetUrl({
            result: job.result,
            signedUrl: await this.storage.createSignedGetUrlWithExpiration({
              bucket: asset.bucket,
              objectKey: asset.objectKey,
            }),
          });
        }
      }
    }

    return submissions;
  }

  async createVideoGenerationSubmission({
    userId,
    input,
  }: {
    userId: string;
    input: CreateVideoGenerationInput;
  }): Promise<CreatedVideoGenerationSubmission> {
    this.validateRequestedGenerations(input.requestedGenerations);

    const modelSpec = await this.getPublishedSupportedVideoModelSpec({
      modelId: input.modelId,
    });
    const submittedInput = this.toSubmittedInput(input);
    const callbackTokens = [...Array(input.requestedGenerations)].map(() =>
      this.createGenerationCallbackToken(),
    );

    this.validateCreateVideoInputAgainstSpec({
      input: {
        ...input,
        ...submittedInput,
      },
      spec: modelSpec.spec,
    });

    const createdSubmission = await this.repository.insertGenerationSubmission({
      userId,
      input,
      modelSpec,
      submittedInput,
      callbackTokenHashes: callbackTokens.map((callbackToken) =>
        this.hashGenerationCallbackToken(callbackToken),
      ),
    });

    return {
      submission: createdSubmission.submission,
      jobs: createdSubmission.jobs.map((job, index) => ({
        job,
        callbackToken: callbackTokens[index]!,
      })),
    };
  }

  async createSeedanceVideoTask(
    input: CreateSeedanceVideoTaskInput,
  ): Promise<CreateSeedanceVideoTaskResult> {
    const spec = await this.getPublishedSeedanceSpec(input);
    const request = buildSeedanceVideoTaskRequest({ spec, input });
    const client = this.createConfiguredBytePlusClient();

    return client.createSeedanceVideoTask(request);
  }

  async retrieveSeedanceVideoTask({
    providerTaskId,
  }: RetrieveSeedanceVideoTaskInput): Promise<RetrieveSeedanceVideoTaskResult> {
    const client = this.createConfiguredBytePlusClient();

    return client.retrieveSeedanceVideoTask(providerTaskId);
  }

  private applySignedVideoAssetUrl({
    result,
    signedUrl,
  }: {
    result: GenerationThreadJobResult;
    signedUrl: SignedObjectUrl;
  }) {
    result.videoUrl = signedUrl.url;

    result.mediaUrlExpiresAt = this.getEarliestMediaUrlExpiration(
      result.mediaUrlExpiresAt,
      signedUrl.expiresAt,
    );
  }

  private getEarliestMediaUrlExpiration(current: string | null, next: string) {
    if (!current || next < current) {
      return next;
    }

    return current;
  }

  private async getPublishedSeedanceSpec({
    modelId,
    modelSpecId,
  }: {
    modelId: string;
    modelSpecId: string;
  }): Promise<VideoModelSpec> {
    const modelSpec = await this.getPublishedSupportedVideoModelSpec({
      modelId,
      modelSpecId,
    });

    return modelSpec.spec;
  }

  private async getPublishedSupportedVideoModelSpec({
    modelId,
    modelSpecId,
  }: {
    modelId: string;
    modelSpecId?: string;
  }) {
    if (!isSupportedVideoGenerationModelId(modelId)) {
      throw new UnsupportedGenerationModelError(modelId);
    }

    const modelSpec = modelSpecId
      ? await this.repository.getPublishedGenerationModelSpecById({
          modelId,
          modelSpecId,
        })
      : await this.repository.getLatestPublishedGenerationModelSpec(modelId);

    if (!modelSpec) {
      throw new Error("Published Seedance model spec was not found");
    }

    return modelSpec;
  }

  private toSubmittedInput(
    input: CreateVideoGenerationInput,
  ): GenerationSubmissionInput {
    return {
      prompt: input.prompt.trim(),
      aspectRatio: input.aspectRatio,
      duration: input.duration,
      generateAudio: input.generateAudio,
    };
  }

  private validateCreateVideoInputAgainstSpec({
    input,
    spec,
  }: {
    input: CreateVideoGenerationInput;
    spec: VideoModelSpec;
  }) {
    for (const fieldId of createVideoGenerationFieldIds) {
      this.validateFieldValue({
        field: this.getRequiredField(spec, fieldId),
        value: input[fieldId],
      });
    }
  }

  private validateRequestedGenerations(requestedGenerations: number) {
    if (!Number.isInteger(requestedGenerations)) {
      throw new GenerationInputValidationError(
        "requestedGenerations",
        "requestedGenerations must be an integer",
      );
    }

    if (requestedGenerations < minRequestedGenerations) {
      throw new GenerationInputValidationError(
        "requestedGenerations",
        `requestedGenerations must be greater than or equal to ${minRequestedGenerations}`,
      );
    }

    if (requestedGenerations > maxRequestedGenerations) {
      throw new GenerationInputValidationError(
        "requestedGenerations",
        `requestedGenerations must be less than or equal to ${maxRequestedGenerations}`,
      );
    }
  }

  private getRequiredField(
    spec: VideoModelSpec,
    fieldId: CreateVideoGenerationFieldId,
  ) {
    const field = spec.fields.find((candidate) => candidate.id === fieldId);

    if (!field) {
      throw new GenerationInputValidationError(
        fieldId,
        `${fieldId} is not supported by this model`,
      );
    }

    return field;
  }

  private validateFieldValue({
    field,
    value,
  }: {
    field: VideoFieldSpec;
    value: JsonPrimitive;
  }) {
    this.validateFieldValueKind(field, value);
    this.validateFieldBounds(field, value);
    this.validateFieldOptions(field, value);
  }

  private validateFieldValueKind(field: VideoFieldSpec, value: JsonPrimitive) {
    if (field.valueKind === "integer" && !Number.isInteger(value)) {
      throw new GenerationInputValidationError(
        field.id,
        `${field.id} must be an integer`,
      );
    }

    if (field.valueKind === "number" && typeof value !== "number") {
      throw new GenerationInputValidationError(
        field.id,
        `${field.id} must be a number`,
      );
    }

    if (field.valueKind === "boolean" && typeof value !== "boolean") {
      throw new GenerationInputValidationError(
        field.id,
        `${field.id} must be a boolean`,
      );
    }

    if (field.valueKind === "string" && typeof value !== "string") {
      throw new GenerationInputValidationError(
        field.id,
        `${field.id} must be a string`,
      );
    }
  }

  private validateFieldBounds(field: VideoFieldSpec, value: JsonPrimitive) {
    if (typeof value === "number") {
      if (field.min !== undefined && value < field.min) {
        throw new GenerationInputValidationError(
          field.id,
          `${field.id} must be greater than or equal to ${field.min}`,
        );
      }

      if (field.max !== undefined && value > field.max) {
        throw new GenerationInputValidationError(
          field.id,
          `${field.id} must be less than or equal to ${field.max}`,
        );
      }
    }

    if (typeof value === "string") {
      if (field.minLength !== undefined && value.length < field.minLength) {
        throw new GenerationInputValidationError(
          field.id,
          `${field.id} must be at least ${field.minLength} characters`,
        );
      }

      if (field.maxLength !== undefined && value.length > field.maxLength) {
        throw new GenerationInputValidationError(
          field.id,
          `${field.id} must be at most ${field.maxLength} characters`,
        );
      }
    }
  }

  private validateFieldOptions(field: VideoFieldSpec, value: JsonPrimitive) {
    if (!field.options || field.options.length === 0) {
      return;
    }

    if (!field.options.some((option) => option.value === value)) {
      throw new GenerationInputValidationError(
        field.id,
        `${field.id} must match a supported model option`,
      );
    }
  }

  private createConfiguredBytePlusClient() {
    const env = parseBytePlusProviderEnv(process.env);

    return new BytePlusSeedanceClient({
      apiKey: env.BYTEPLUS_ARK_API_KEY,
      baseUrl: env.BYTEPLUS_ARK_BASE_URL,
    });
  }

  private createGenerationCallbackToken() {
    return randomBytes(32).toString("base64url");
  }

  private hashGenerationCallbackToken(token: string) {
    return createHash("sha256").update(token).digest("hex");
  }
}

export const generationService = new GenerationService();
