import {
  GetObjectCommand,
  S3Client,
  type CompleteMultipartUploadCommandOutput,
  type PutObjectCommandInput,
} from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { parseR2StorageEnv } from "@remora/env";
import { Readable } from "node:stream";

export type R2StorageEnv = ReturnType<typeof parseR2StorageEnv>;

export type ObjectStorageReference = {
  bucket: string;
  objectKey: string;
};

export type StoredObjectReference = ObjectStorageReference & {
  contentType: string | null;
  contentLength: number | null;
  etag: string | null;
  checksumSha256: string | null;
};

export type SignedObjectUrl = {
  url: string;
  expiresAt: string;
};

export type RemoteObject = {
  body: Readable;
  contentType: string | null;
  contentLength: number | null;
};

export class ObjectStorageError extends Error {
  readonly code:
    | "REMOTE_OBJECT_DOWNLOAD_FAILED"
    | "REMOTE_OBJECT_RESPONSE_BODY_MISSING"
    | "OBJECT_UPLOAD_FAILED"
    | "OBJECT_SIGNED_URL_FAILED";
  readonly sourceUrl: string | null;
  readonly objectKey: string | null;
  readonly statusCode: number | null;

  constructor({
    code,
    message,
    cause,
    objectKey = null,
    sourceUrl = null,
    statusCode = null,
  }: {
    code:
      | "REMOTE_OBJECT_DOWNLOAD_FAILED"
      | "REMOTE_OBJECT_RESPONSE_BODY_MISSING"
      | "OBJECT_UPLOAD_FAILED"
      | "OBJECT_SIGNED_URL_FAILED";
    message: string;
    cause?: unknown;
    objectKey?: string | null;
    sourceUrl?: string | null;
    statusCode?: number | null;
  }) {
    super(message, { cause });
    this.name = "ObjectStorageError";
    this.code = code;
    this.objectKey = objectKey;
    this.sourceUrl = sourceUrl;
    this.statusCode = statusCode;
  }
}

export class ObjectStorageService {
  private readonly env: R2StorageEnv | null;
  private readonly fetcher: typeof fetch;
  private readonly putObject: (input: {
    client: S3Client;
    params: PutObjectCommandInput;
  }) => Promise<
    Pick<CompleteMultipartUploadCommandOutput, "ChecksumSHA256" | "ETag">
  >;
  private readonly signedUrlFactory: (input: {
    client: S3Client;
    command: GetObjectCommand;
    expiresIn: number;
  }) => Promise<string>;
  private configuredS3Client: S3Client | null = null;

  constructor(
    options: {
      env?: R2StorageEnv;
      fetcher?: typeof fetch;
      putObject?: (input: {
        client: S3Client;
        params: PutObjectCommandInput;
      }) => Promise<
        Pick<CompleteMultipartUploadCommandOutput, "ChecksumSHA256" | "ETag">
      >;
      signedUrlFactory?: (input: {
        client: S3Client;
        command: GetObjectCommand;
        expiresIn: number;
      }) => Promise<string>;
    } = {},
  ) {
    this.env = options.env ?? null;
    this.fetcher = options.fetcher ?? fetch;
    this.putObject = options.putObject ?? this.putObjectToR2;
    this.signedUrlFactory =
      options.signedUrlFactory ?? this.createR2SignedGetUrl;
  }

  async importRemoteObject({
    objectKey,
    sourceUrl,
  }: {
    objectKey: string;
    sourceUrl: string;
  }): Promise<StoredObjectReference> {
    const remoteObject = await this.downloadRemoteObject(sourceUrl);

    return this.uploadObject({
      objectKey,
      body: remoteObject.body,
      contentLength: remoteObject.contentLength,
      contentType: remoteObject.contentType,
      sourceUrl,
    });
  }

  async downloadRemoteObject(sourceUrl: string): Promise<RemoteObject> {
    let response: Response;

    try {
      response = await this.fetcher(sourceUrl);
    } catch (cause) {
      throw new ObjectStorageError({
        code: "REMOTE_OBJECT_DOWNLOAD_FAILED",
        message: `Failed to download remote object: ${sourceUrl}`,
        cause,
        sourceUrl,
      });
    }

    if (!response.ok) {
      throw new ObjectStorageError({
        code: "REMOTE_OBJECT_DOWNLOAD_FAILED",
        message: `Remote object download failed with status ${response.status}: ${sourceUrl}`,
        sourceUrl,
        statusCode: response.status,
      });
    }

    if (!response.body) {
      throw new ObjectStorageError({
        code: "REMOTE_OBJECT_RESPONSE_BODY_MISSING",
        message: `Remote object response body was missing: ${sourceUrl}`,
        sourceUrl,
        statusCode: response.status,
      });
    }

    return {
      body: Readable.fromWeb(
        response.body as Parameters<typeof Readable.fromWeb>[0],
      ),
      contentType: this.normalizeHeaderValue(
        response.headers.get("content-type"),
      ),
      contentLength: this.parseContentLength(
        response.headers.get("content-length"),
      ),
    };
  }

  async uploadObject({
    objectKey,
    body,
    contentLength,
    contentType,
    sourceUrl = null,
  }: {
    objectKey: string;
    body: Readable;
    contentLength: number | null;
    contentType: string | null;
    sourceUrl?: string | null;
  }): Promise<StoredObjectReference> {
    const params: PutObjectCommandInput = {
      Bucket: this.getStorageEnv().R2_BUCKET_NAME,
      Key: objectKey,
      Body: body,
      ...(contentType ? { ContentType: contentType } : {}),
      ...(contentLength !== null ? { ContentLength: contentLength } : {}),
    };

    try {
      const uploadResult = await this.putObject({
        client: this.getOrCreateS3Client(),
        params,
      });

      return {
        bucket: this.getStorageEnv().R2_BUCKET_NAME,
        objectKey,
        contentType,
        contentLength,
        etag: uploadResult.ETag ?? null,
        checksumSha256: uploadResult.ChecksumSHA256 ?? null,
      };
    } catch (cause) {
      throw new ObjectStorageError({
        code: "OBJECT_UPLOAD_FAILED",
        message: `Failed to upload object: ${objectKey}`,
        cause,
        objectKey,
        sourceUrl,
      });
    }
  }

  async createSignedGetUrl(reference: ObjectStorageReference): Promise<string> {
    const signedUrl = await this.createSignedGetUrlWithExpiration(reference);

    return signedUrl.url;
  }

  async createSignedGetUrlWithExpiration(
    reference: ObjectStorageReference,
  ): Promise<SignedObjectUrl> {
    const env = this.getStorageEnv();
    const expiresAt = new Date(
      Date.now() + env.R2_SIGNED_URL_TTL_SECONDS * 1000,
    ).toISOString();

    try {
      const url = await this.signedUrlFactory({
        client: this.getOrCreateS3Client(),
        command: new GetObjectCommand({
          Bucket: reference.bucket,
          Key: reference.objectKey,
        }),
        expiresIn: env.R2_SIGNED_URL_TTL_SECONDS,
      });

      return {
        url,
        expiresAt,
      };
    } catch (cause) {
      throw new ObjectStorageError({
        code: "OBJECT_SIGNED_URL_FAILED",
        message: `Failed to create signed URL for object: ${reference.objectKey}`,
        cause,
        objectKey: reference.objectKey,
      });
    }
  }

  static joinObjectKey(...segments: string[]) {
    return segments
      .map((segment) => segment.replace(/^\/+|\/+$/g, ""))
      .filter(Boolean)
      .join("/");
  }

  joinObjectKey(...segments: string[]) {
    return ObjectStorageService.joinObjectKey(...segments);
  }

  private getStorageEnv(): R2StorageEnv {
    return this.env ?? parseR2StorageEnv(process.env);
  }

  private getOrCreateS3Client(): S3Client {
    this.configuredS3Client ??= this.createR2S3Client(this.getStorageEnv());

    return this.configuredS3Client;
  }

  private normalizeHeaderValue(value: string | null) {
    const normalized = value?.trim();

    return normalized ? normalized : null;
  }

  private parseContentLength(value: string | null) {
    const parsed = Number(value);

    if (!value || !Number.isSafeInteger(parsed) || parsed < 0) {
      return null;
    }

    return parsed;
  }

  private createR2S3Client(env: R2StorageEnv): S3Client {
    return new S3Client({
      region: "auto",
      endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: env.R2_ACCESS_KEY_ID,
        secretAccessKey: env.R2_SECRET_ACCESS_KEY,
      },
    });
  }

  private async putObjectToR2({
    client,
    params,
  }: {
    client: S3Client;
    params: PutObjectCommandInput;
  }): Promise<
    Pick<CompleteMultipartUploadCommandOutput, "ChecksumSHA256" | "ETag">
  > {
    const upload = new Upload({
      client,
      params,
    });

    return upload.done();
  }

  private async createR2SignedGetUrl({
    client,
    command,
    expiresIn,
  }: {
    client: S3Client;
    command: GetObjectCommand;
    expiresIn: number;
  }) {
    return getSignedUrl(client, command, { expiresIn });
  }
}

export const objectStorageService = new ObjectStorageService();
